/**
 * Activity Types
 *
 * Types for the client activity feed and stats endpoints
 */

export type ActivityCategory = "ai" | "tokens" | "notes" | "folders";

export type ActivityIconHint = "bot" | "coins" | "file-text" | "folder" | "pencil";

export interface ActivityEntry {
    id: string;
    category: ActivityCategory;
    title: string;
    description: string;
    createdAt: string; // ISO
    iconHint?: ActivityIconHint;
}

export interface ActivityStats {
    actionsToday: number;
    actionsTodayDeltaPct: number;
    aiOpsThisWeek: number;
    aiOpsThisWeekDeltaPct: number;
    totalActions: number;
}
