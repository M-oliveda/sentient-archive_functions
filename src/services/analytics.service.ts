/**
 * Analytics Service
 *
 * Aggregates system-wide analytics from Firestore.
 * Provides metrics on users, notes, tokens, and AI operations.
 */

import { getDb } from "@/utils/firestore.js";
import { logInfo, logError } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";

/**
 * User statistics
 */
export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    clients: number;
}

/**
 * Notes statistics
 */
export interface NotesStats {
    total: number;
}

/**
 * Token statistics
 */
export interface TokenStats {
    totalGranted: number;
    totalSpent: number;
    netBalance: number;
}

/**
 * AI operations statistics
 */
export interface AIOperationsStats {
    total: number;
    byType: {
        summarize: number;
        autoTag: number;
        flashcards: number;
        ragQuery: number;
    };
}

/**
 * Complete analytics response
 */
export interface SystemAnalytics {
    users: UserStats;
    notes: NotesStats;
    tokens: TokenStats;
    aiOperations: AIOperationsStats;
}

/**
 * Time-series data point
 */
export interface DataPoint {
    date: string;
    count: number;
}

/**
 * Token usage data point
 */
export interface TokenDataPoint {
    date: string;
    granted: number;
    spent: number;
}

/**
 * User growth data point
 */
export interface UserGrowthPoint {
    date: string;
    totalUsers: number;
    newUsers: number;
}

/**
 * Analytics trends over time
 */
export interface AnalyticsTrends {
    aiOperationsOverTime: DataPoint[];
    tokenUsageOverTime: TokenDataPoint[];
    userGrowthOverTime: UserGrowthPoint[];
}

/**
 * System analytics with time-series trends
 */
export interface SystemAnalyticsWithTrends extends SystemAnalytics {
    trends: AnalyticsTrends;
    dateRange: "7d" | "30d" | "90d";
}

/**
 * Analytics Service class
 * Aggregates system-wide metrics
 */
export class AnalyticsService {
    /**
     * Get complete system analytics
     *
     * @returns System-wide analytics
     */
    async getAnalytics(): Promise<SystemAnalytics> {
        try {
            // Run all aggregations in parallel for better performance
            const [users, notes, tokens, aiOperations] = await Promise.all([
                this.getUserStats(),
                this.getNotesStats(),
                this.getTokenStats(),
                this.getAIOperationsStats(),
            ]);

            logInfo("Analytics retrieved successfully");

            return {
                users,
                notes,
                tokens,
                aiOperations,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError(
                "Failed to get analytics",
                error instanceof Error ? error : undefined,
            );
            throw new AppError("INTERNAL_ERROR", 500, "Failed to retrieve analytics");
        }
    }

    /**
     * Get user statistics
     */
    private async getUserStats(): Promise<UserStats> {
        const db = getDb();
        const usersSnapshot = await db.collection("users").get();

        let active = 0;
        let inactive = 0;
        let admins = 0;
        let clients = 0;

        usersSnapshot.forEach((doc) => {
            const data = doc.data();

            // Count by active status
            if (data["isActive"] === true) {
                active++;
            } else {
                inactive++;
            }

            // Count by role
            if (data["role"] === "admin") {
                admins++;
            } else {
                clients++;
            }
        });

        return {
            total: usersSnapshot.size,
            active,
            inactive,
            admins,
            clients,
        };
    }

    /**
     * Get notes statistics using collection group query
     */
    private async getNotesStats(): Promise<NotesStats> {
        const db = getDb();

        // Use collection group query to count all notes across all users
        const notesSnapshot = await db.collectionGroup("notes").count().get();

        return {
            total: notesSnapshot.data().count,
        };
    }

    /**
     * Get token statistics aggregated from user documents
     */
    private async getTokenStats(): Promise<TokenStats> {
        const db = getDb();
        const usersSnapshot = await db.collection("users").get();

        let totalGranted = 0;
        let totalSpent = 0;
        let netBalance = 0;

        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            totalGranted += (data["totalTokensGranted"] as number) ?? 0;
            totalSpent += (data["totalTokensSpent"] as number) ?? 0;
            netBalance += (data["tokenBalance"] as number) ?? 0;
        });

        return {
            totalGranted,
            totalSpent,
            netBalance,
        };
    }

    /**
     * Get AI operations statistics from transactions collection
     */
    private async getAIOperationsStats(): Promise<AIOperationsStats> {
        const db = getDb();

        // Query all deduction transactions (AI operations)
        const transactionsSnapshot = await db
            .collection("transactions")
            .where("type", "==", "deduction")
            .get();

        const byType = {
            summarize: 0,
            autoTag: 0,
            flashcards: 0,
            ragQuery: 0,
        };

        transactionsSnapshot.forEach((doc) => {
            const data = doc.data();
            const operation = data["operation"] as string;

            if (operation in byType) {
                byType[operation as keyof typeof byType]++;
            }
        });

        const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

        return {
            total,
            byType,
        };
    }

    /**
     * Get analytics with time-series trends
     *
     * @param dateRange - Time range for trends ('7d', '30d', or '90d')
     * @returns System analytics with trend data
     */
    async getAnalyticsWithTrends(
        dateRange: "7d" | "30d" | "90d" = "30d",
    ): Promise<SystemAnalyticsWithTrends> {
        try {
            // Get base analytics and trends in parallel
            const [baseAnalytics, trends] = await Promise.all([
                this.getAnalytics(),
                this.getTrends(dateRange),
            ]);

            logInfo("Analytics with trends retrieved successfully", { dateRange });

            return {
                ...baseAnalytics,
                trends,
                dateRange,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError(
                "Failed to get analytics with trends",
                error instanceof Error ? error : undefined,
            );
            throw new AppError(
                "INTERNAL_ERROR",
                500,
                "Failed to retrieve analytics with trends",
            );
        }
    }

    /**
     * Get trends data for the specified date range
     */
    private async getTrends(dateRange: "7d" | "30d" | "90d"): Promise<AnalyticsTrends> {
        const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const [aiOperationsOverTime, tokenUsageOverTime, userGrowthOverTime] =
            await Promise.all([
                this.getAIOperationsTrend(startDate, days),
                this.getTokenUsageTrend(startDate, days),
                this.getUserGrowthTrend(startDate, days),
            ]);

        return {
            aiOperationsOverTime,
            tokenUsageOverTime,
            userGrowthOverTime,
        };
    }

    /**
     * Get AI operations trend over time
     */
    private async getAIOperationsTrend(
        startDate: Date,
        days: number,
    ): Promise<DataPoint[]> {
        const db = getDb();

        // Query AI operations (deduction transactions) from start date
        const transactionsSnapshot = await db
            .collection("transactions")
            .where("type", "==", "deduction")
            .where("createdAt", ">=", startDate)
            .get();

        // Initialize date buckets
        const dateBuckets = new Map<string, number>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split("T")[0];
            dateBuckets.set(dateKey!, 0);
        }

        // Count operations by date
        transactionsSnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtRaw = data["createdAt"] as
                | FirebaseFirestore.Timestamp
                | string
                | number
                | undefined;
            let createdAt: Date;
            if (
                createdAtRaw &&
                typeof createdAtRaw === "object" &&
                "toDate" in createdAtRaw
            ) {
                createdAt = createdAtRaw.toDate();
            } else {
                createdAt = new Date(createdAtRaw ?? Date.now());
            }
            const dateKey = createdAt.toISOString().split("T")[0];

            if (dateKey && dateBuckets.has(dateKey)) {
                dateBuckets.set(dateKey, dateBuckets.get(dateKey)! + 1);
            }
        });

        // Convert to array and sort by date
        return Array.from(dateBuckets.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get token usage trend over time
     */
    private async getTokenUsageTrend(
        startDate: Date,
        days: number,
    ): Promise<TokenDataPoint[]> {
        const db = getDb();

        // Query all transactions from start date
        const transactionsSnapshot = await db
            .collection("transactions")
            .where("createdAt", ">=", startDate)
            .get();

        // Initialize date buckets
        const dateBuckets = new Map<string, { granted: number; spent: number }>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split("T")[0];
            dateBuckets.set(dateKey!, { granted: 0, spent: 0 });
        }

        // Aggregate tokens by date and type
        transactionsSnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtRaw = data["createdAt"] as
                | FirebaseFirestore.Timestamp
                | string
                | number
                | undefined;
            let createdAt: Date;
            if (
                createdAtRaw &&
                typeof createdAtRaw === "object" &&
                "toDate" in createdAtRaw
            ) {
                createdAt = createdAtRaw.toDate();
            } else {
                createdAt = new Date(createdAtRaw ?? Date.now());
            }
            const dateKey = createdAt.toISOString().split("T")[0];
            const amount = (data["amount"] as number | undefined) ?? 0;
            const type = data["type"] as string | undefined;

            if (dateKey && dateBuckets.has(dateKey)) {
                const bucket = dateBuckets.get(dateKey)!;
                if (type === "grant") {
                    bucket.granted += amount;
                } else if (type === "deduction") {
                    bucket.spent += amount;
                }
            }
        });

        // Convert to array and sort by date
        return Array.from(dateBuckets.entries())
            .map(([date, { granted, spent }]) => ({ date, granted, spent }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get user growth trend over time
     */
    private async getUserGrowthTrend(
        startDate: Date,
        days: number,
    ): Promise<UserGrowthPoint[]> {
        const db = getDb();

        // Query all users
        const usersSnapshot = await db.collection("users").get();

        // Initialize date buckets
        const dateBuckets = new Map<string, { newUsers: number }>();
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split("T")[0];
            dateBuckets.set(dateKey!, { newUsers: 0 });
        }

        // Count new users by registration date
        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtRaw = data["createdAt"] as
                | FirebaseFirestore.Timestamp
                | string
                | number
                | undefined;
            let createdAt: Date;
            if (
                createdAtRaw &&
                typeof createdAtRaw === "object" &&
                "toDate" in createdAtRaw
            ) {
                createdAt = createdAtRaw.toDate();
            } else {
                createdAt = new Date(createdAtRaw ?? Date.now());
            }
            const dateKey = createdAt.toISOString().split("T")[0];

            if (dateKey && dateBuckets.has(dateKey)) {
                const bucket = dateBuckets.get(dateKey)!;
                bucket.newUsers += 1;
            }
        });

        // Calculate cumulative total users
        let cumulativeUsers = 0;
        const results: UserGrowthPoint[] = [];

        // Sort by date and calculate cumulative
        const sortedEntries = Array.from(dateBuckets.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        );

        for (const [date, { newUsers }] of sortedEntries) {
            cumulativeUsers += newUsers;
            results.push({
                date,
                newUsers,
                totalUsers: cumulativeUsers,
            });
        }

        return results;
    }
}

/**
 * Singleton instance of AnalyticsService
 */
export const analyticsService = new AnalyticsService();
