/**
 * Note Types
 *
 * Types for notes and related data structures
 */

import { Timestamp } from "firebase-admin/firestore";

export interface Note {
    id: string;
    userId: string;

    // Content
    title: string;
    content: string; // Markdown
    excerpt: string; // First 200 chars

    // Organization
    folderId: string | null;
    tags: string[];
    aiTags: string[];

    // AI-Generated
    summary: string | null;
    flashcards: Flashcard[] | null;

    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;
    viewedAt: Timestamp;
    isPinned: boolean;
    isArchived: boolean;

    // File Source (if created from file extraction)
    sourceFile: SourceFile | null;
}

export interface Flashcard {
    front: string;
    back: string;
}

export interface SourceFile {
    name: string;
    type: "pdf" | "txt" | "md";
    size: number; // in bytes
    extractedAt: Timestamp;
}

export interface CreateNoteInput {
    title: string;
    content: string;
    folderId?: string | null;
    tags?: string[];
}

export interface UpdateNoteInput {
    title?: string;
    content?: string;
    folderId?: string | null;
    tags?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
}
