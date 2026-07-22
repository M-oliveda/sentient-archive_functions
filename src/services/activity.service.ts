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

interface InternalActivityEvent {
    id: string;
    category: ActivityCategory;
    title: string;
    description: string;
    createdAt: Date;
    iconHint: ActivityIconHint;
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
}

export const activityService = new ActivityService();
