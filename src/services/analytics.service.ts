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
}

/**
 * Singleton instance of AnalyticsService
 */
export const analyticsService = new AnalyticsService();
