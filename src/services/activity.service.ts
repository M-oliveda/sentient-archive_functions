/**
 * Activity Service
 *
 * Aggregates a client activity feed from transactions, notes, and folders
 */

import { getDb } from "@/utils/firestore.js";
import { Transaction, OperationType } from "@/types/transaction.js";
import {
    ActivityCategory,
    ActivityEntry,
    ActivityIconHint,
    ActivityStats,
} from "@/types/activity.js";

const AI_OPERATIONS: OperationType[] = [
    "summarize",
    "autoTag",
    "flashcards",
    "ragQuery",
];

const AI_OPERATION_LABELS: Record<string, string> = {
    summarize: "AI Summary",
    autoTag: "AI Auto-Tag",
    flashcards: "AI Flashcards",
    ragQuery: "AI Q&A",
    admin_grant: "Token Grant",
};

interface ActivityQueryOptions {
    category?: "all" | ActivityCategory;
    q?: string;
    limit?: number;
    offset?: number;
}

export interface AdminActivityQueryOptions {
    category?: "all" | ActivityCategory;
    userId?: string;
    q?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export interface AdminActivityEntry extends ActivityEntry {
    userId: string;
    userEmail: string;
    userName?: string;
}

interface InternalActivityEvent {
    id: string;
    category: ActivityCategory;
    title: string;
    description: string;
    createdAt: Date;
    iconHint: ActivityIconHint;
}

interface InternalAdminActivityEvent extends InternalActivityEvent {
    userId: string;
    userEmail: string;
    userName?: string;
}

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfWeek(date: Date): Date {
    const d = startOfDay(date);
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    return d;
}

function percentDelta(current: number, previous: number): number {
    if (previous === 0) {
        return 0;
    }
    return Math.round(((current - previous) / previous) * 100);
}

function timestampToDate(value: unknown): Date {
    if (value instanceof Date) {
        return value;
    }
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate: () => Date }).toDate === "function"
    ) {
        return (value as { toDate: () => Date }).toDate();
    }
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date(0);
}

function matchesSearch(event: InternalActivityEvent, q: string): boolean {
    if (!q) {
        return true;
    }
    const needle = q.toLowerCase();
    return (
        event.title.toLowerCase().includes(needle) ||
        event.description.toLowerCase().includes(needle)
    );
}

function matchesCategory(
    event: InternalActivityEvent,
    category: "all" | ActivityCategory,
): boolean {
    if (category === "all") {
        return true;
    }
    return event.category === category;
}

export class ActivityService {
    /**
     * Build a paginated activity feed for a user
     */
    async getFeed(
        userId: string,
        options: ActivityQueryOptions = {},
    ): Promise<ActivityEntry[]> {
        const { category = "all", q = "", limit = 50, offset = 0 } = options;

        const events = await this.collectEvents(userId);
        const filtered = events
            .filter((e) => matchesCategory(e, category))
            .filter((e) => matchesSearch(e, q))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return filtered.slice(offset, offset + limit).map((e) => ({
            id: e.id,
            category: e.category,
            title: e.title,
            description: e.description,
            createdAt: e.createdAt.toISOString(),
            iconHint: e.iconHint,
        }));
    }

    /**
     * Compute activity summary stats for a user
     */
    async getStats(userId: string): Promise<ActivityStats> {
        const events = await this.collectEvents(userId);
        const now = new Date();

        const todayStart = startOfDay(now);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const thisWeekStart = startOfWeek(now);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const actionsToday = events.filter((e) => e.createdAt >= todayStart).length;
        const actionsYesterday = events.filter(
            (e) => e.createdAt >= yesterdayStart && e.createdAt < todayStart,
        ).length;

        const aiOpsThisWeek = events.filter(
            (e) => e.category === "ai" && e.createdAt >= thisWeekStart,
        ).length;
        const aiOpsLastWeek = events.filter(
            (e) =>
                e.category === "ai" &&
                e.createdAt >= lastWeekStart &&
                e.createdAt < thisWeekStart,
        ).length;

        return {
            actionsToday,
            actionsTodayDeltaPct: percentDelta(actionsToday, actionsYesterday),
            aiOpsThisWeek,
            aiOpsThisWeekDeltaPct: percentDelta(aiOpsThisWeek, aiOpsLastWeek),
            totalActions: events.length,
        };
    }

    private async collectEvents(userId: string): Promise<InternalActivityEvent[]> {
        const [txEvents, noteEvents, folderEvents] = await Promise.all([
            this.collectTransactionEvents(userId),
            this.collectNoteEvents(userId),
            this.collectFolderEvents(userId),
        ]);

        return [...txEvents, ...noteEvents, ...folderEvents];
    }

    private async collectTransactionEvents(
        userId: string,
    ): Promise<InternalActivityEvent[]> {
        const db = getDb();
        const snapshot = await db
            .collection("transactions")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(200)
            .get();

        const events: InternalActivityEvent[] = [];

        snapshot.forEach((doc) => {
            const tx = doc.data() as Transaction;
            const isAi = AI_OPERATIONS.includes(tx.operation);
            const category: ActivityCategory = isAi ? "ai" : "tokens";
            const label = AI_OPERATION_LABELS[tx.operation] ?? tx.operation;
            const amountSign = tx.type === "grant" ? "+" : "−";

            events.push({
                id: `tx-${doc.id}`,
                category,
                title: label,
                description:
                    tx.description ||
                    `${amountSign}${tx.amount} tokens · balance ${tx.balanceAfter}`,
                createdAt: timestampToDate(tx.createdAt),
                iconHint: isAi ? "bot" : "coins",
            });
        });

        return events;
    }

    private async collectNoteEvents(userId: string): Promise<InternalActivityEvent[]> {
        const db = getDb();
        const snapshot = await db
            .collection("users")
            .doc(userId)
            .collection("notes")
            .limit(200)
            .get();

        const events: InternalActivityEvent[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            const title = (data["title"] as string) || "Untitled note";
            const createdAt = timestampToDate(data["createdAt"]);
            const updatedAt = timestampToDate(data["updatedAt"]);

            events.push({
                id: `note-create-${doc.id}`,
                category: "notes",
                title: "Note created",
                description: title,
                createdAt,
                iconHint: "file-text",
            });

            // Emit update when updated meaningfully after create (> 1 minute)
            if (updatedAt.getTime() - createdAt.getTime() > 60_000) {
                events.push({
                    id: `note-update-${doc.id}`,
                    category: "notes",
                    title: "Note updated",
                    description: title,
                    createdAt: updatedAt,
                    iconHint: "pencil",
                });
            }
        });

        return events;
    }

    private async collectFolderEvents(
        userId: string,
    ): Promise<InternalActivityEvent[]> {
        const db = getDb();
        const snapshot = await db
            .collection("users")
            .doc(userId)
            .collection("folders")
            .limit(200)
            .get();

        const events: InternalActivityEvent[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            const name = (data["name"] as string) || "Untitled folder";

            events.push({
                id: `folder-create-${doc.id}`,
                category: "folders",
                title: "Folder created",
                description: name,
                createdAt: timestampToDate(data["createdAt"]),
                iconHint: "folder",
            });
        });

        return events;
    }

    /**
     * Get system-wide activity feed (admin only)
     */
    async getSystemWideFeed(
        options: AdminActivityQueryOptions = {},
    ): Promise<{ entries: AdminActivityEntry[]; total: number }> {
        const {
            category = "all",
            userId,
            q = "",
            startDate,
            endDate,
            limit = 50,
            offset = 0,
        } = options;

        const events = await this.collectSystemWideEvents({
            category,
            userId,
            startDate,
            endDate,
        });

        // Apply search filter
        const filtered = events.filter((e) => this.matchesAdminSearch(e, q));

        // Sort by date descending
        const sorted = filtered.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );

        // Get total count and paginate
        const total = sorted.length;
        const paginated = sorted.slice(offset, offset + limit);

        // Convert to AdminActivityEntry format
        const entries: AdminActivityEntry[] = paginated.map((e) => ({
            id: e.id,
            category: e.category,
            title: e.title,
            description: e.description,
            createdAt: e.createdAt.toISOString(),
            iconHint: e.iconHint,
            userId: e.userId,
            userEmail: e.userEmail,
            userName: e.userName,
        }));

        return { entries, total };
    }

    /**
     * Collect system-wide activity events
     */
    private async collectSystemWideEvents(options: {
        category?: "all" | ActivityCategory;
        userId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<InternalAdminActivityEvent[]> {
        const { category = "all", userId, startDate, endDate } = options;

        // Build date filters
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        // Get user map for enrichment
        const userMap = await this.getUserMap();

        // Collect events based on category
        const events: InternalAdminActivityEvent[] = [];

        if (category === "all" || category === "ai" || category === "tokens") {
            const txEvents = await this.collectSystemWideTransactionEvents(
                userMap,
                userId,
                start,
                end,
                category,
            );
            events.push(...txEvents);
        }

        if (category === "all" || category === "notes") {
            const noteEvents = await this.collectSystemWideNoteEvents(
                userMap,
                userId,
                start,
                end,
            );
            events.push(...noteEvents);
        }

        if (category === "all" || category === "folders") {
            const folderEvents = await this.collectSystemWideFolderEvents(
                userMap,
                userId,
                start,
                end,
            );
            events.push(...folderEvents);
        }

        return events;
    }

    /**
     * Get user map for enriching events with user info
     */
    private async getUserMap(): Promise<Map<string, { email: string; name?: string }>> {
        const db = getDb();
        const usersSnapshot = await db.collection("users").get();
        const userMap = new Map<string, { email: string; name?: string }>();

        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            userMap.set(doc.id, {
                email: (data["email"] as string) || "Unknown",
                name: (data["displayName"] as string) || undefined,
            });
        });

        return userMap;
    }

    /**
     * Collect system-wide transaction events
     */
    private async collectSystemWideTransactionEvents(
        userMap: Map<string, { email: string; name?: string }>,
        userId?: string,
        start?: Date,
        end?: Date,
        category?: "all" | ActivityCategory,
    ): Promise<InternalAdminActivityEvent[]> {
        const db = getDb();
        let query = db.collection("transactions") as FirebaseFirestore.Query;

        if (userId) {
            query = query.where("userId", "==", userId);
        }

        if (start) {
            query = query.where("createdAt", ">=", start);
        }

        if (end) {
            query = query.where("createdAt", "<=", end);
        }

        const snapshot = await query.orderBy("createdAt", "desc").limit(500).get();

        const events: InternalAdminActivityEvent[] = [];

        snapshot.forEach((doc) => {
            const tx = doc.data() as Transaction;
            const isAi = AI_OPERATIONS.includes(tx.operation);
            const eventCategory: ActivityCategory = isAi ? "ai" : "tokens";

            // Skip if category doesn't match
            if (category !== "all" && category !== eventCategory) {
                return;
            }

            const userInfo = userMap.get(tx.userId) ?? {
                email: "Unknown",
                name: undefined,
            };
            const label = AI_OPERATION_LABELS[tx.operation] ?? tx.operation;
            const amountSign = tx.type === "grant" ? "+" : "−";

            events.push({
                id: `tx-${doc.id}`,
                category: eventCategory,
                title: label,
                description:
                    tx.description ||
                    `${amountSign}${tx.amount} tokens · balance ${tx.balanceAfter}`,
                createdAt: timestampToDate(tx.createdAt),
                iconHint: isAi ? "bot" : "coins",
                userId: tx.userId,
                userEmail: userInfo.email,
                userName: userInfo.name,
            });
        });

        return events;
    }

    /**
     * Collect system-wide note events
     */
    private async collectSystemWideNoteEvents(
        userMap: Map<string, { email: string; name?: string }>,
        userId?: string,
        start?: Date,
        end?: Date,
    ): Promise<InternalAdminActivityEvent[]> {
        const db = getDb();
        const events: InternalAdminActivityEvent[] = [];

        if (userId) {
            // Query specific user's notes
            let query = db
                .collection("users")
                .doc(userId)
                .collection("notes") as FirebaseFirestore.Query;

            if (start) {
                query = query.where("createdAt", ">=", start);
            }

            if (end) {
                query = query.where("createdAt", "<=", end);
            }

            const snapshot = await query.limit(200).get();
            const userInfo = userMap.get(userId) ?? {
                email: "Unknown",
                name: undefined,
            };

            snapshot.forEach((doc) => {
                const data = doc.data();
                const title = (data["title"] as string) || "Untitled note";
                const createdAt = timestampToDate(data["createdAt"]);

                events.push({
                    id: `note-create-${doc.id}`,
                    category: "notes",
                    title: "Note created",
                    description: title,
                    createdAt,
                    iconHint: "file-text",
                    userId,
                    userEmail: userInfo.email,
                    userName: userInfo.name,
                });
            });
        } else {
            // Query all notes using collection group
            let query = db.collectionGroup("notes") as FirebaseFirestore.Query;

            if (start) {
                query = query.where("createdAt", ">=", start);
            }

            if (end) {
                query = query.where("createdAt", "<=", end);
            }

            const snapshot = await query.limit(200).get();

            snapshot.forEach((doc) => {
                const data = doc.data();
                const noteUserId = doc.ref.parent.parent?.id;
                if (!noteUserId) return;

                const userInfo = userMap.get(noteUserId) ?? {
                    email: "Unknown",
                    name: undefined,
                };
                const title = (data["title"] as string) || "Untitled note";
                const createdAt = timestampToDate(data["createdAt"]);

                events.push({
                    id: `note-create-${doc.id}`,
                    category: "notes",
                    title: "Note created",
                    description: title,
                    createdAt,
                    iconHint: "file-text",
                    userId: noteUserId,
                    userEmail: userInfo.email,
                    userName: userInfo.name,
                });
            });
        }

        return events;
    }

    /**
     * Collect system-wide folder events
     */
    private async collectSystemWideFolderEvents(
        userMap: Map<string, { email: string; name?: string }>,
        userId?: string,
        start?: Date,
        end?: Date,
    ): Promise<InternalAdminActivityEvent[]> {
        const db = getDb();
        const events: InternalAdminActivityEvent[] = [];

        if (userId) {
            // Query specific user's folders
            let query = db
                .collection("users")
                .doc(userId)
                .collection("folders") as FirebaseFirestore.Query;

            if (start) {
                query = query.where("createdAt", ">=", start);
            }

            if (end) {
                query = query.where("createdAt", "<=", end);
            }

            const snapshot = await query.limit(200).get();
            const userInfo = userMap.get(userId) ?? {
                email: "Unknown",
                name: undefined,
            };

            snapshot.forEach((doc) => {
                const data = doc.data();
                const name = (data["name"] as string) || "Untitled folder";

                events.push({
                    id: `folder-create-${doc.id}`,
                    category: "folders",
                    title: "Folder created",
                    description: name,
                    createdAt: timestampToDate(data["createdAt"]),
                    iconHint: "folder",
                    userId,
                    userEmail: userInfo.email,
                    userName: userInfo.name,
                });
            });
        } else {
            // Query all folders using collection group
            let query = db.collectionGroup("folders") as FirebaseFirestore.Query;

            if (start) {
                query = query.where("createdAt", ">=", start);
            }

            if (end) {
                query = query.where("createdAt", "<=", end);
            }

            const snapshot = await query.limit(200).get();

            snapshot.forEach((doc) => {
                const data = doc.data();
                const folderUserId = doc.ref.parent.parent?.id;
                if (!folderUserId) return;

                const userInfo = userMap.get(folderUserId) ?? {
                    email: "Unknown",
                    name: undefined,
                };
                const name = (data["name"] as string) || "Untitled folder";

                events.push({
                    id: `folder-create-${doc.id}`,
                    category: "folders",
                    title: "Folder created",
                    description: name,
                    createdAt: timestampToDate(data["createdAt"]),
                    iconHint: "folder",
                    userId: folderUserId,
                    userEmail: userInfo.email,
                    userName: userInfo.name,
                });
            });
        }

        return events;
    }

    /**
     * Match admin search query
     */
    private matchesAdminSearch(event: InternalAdminActivityEvent, q: string): boolean {
        if (!q) {
            return true;
        }
        const needle = q.toLowerCase();
        return (
            event.title.toLowerCase().includes(needle) ||
            event.description.toLowerCase().includes(needle) ||
            event.userEmail.toLowerCase().includes(needle) ||
            (event.userName?.toLowerCase().includes(needle) ?? false)
        );
    }
}

export const activityService = new ActivityService();
