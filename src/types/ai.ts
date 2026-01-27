/**
 * AI Types
 *
 * Types for AI operations and responses
 */

import { Timestamp } from "firebase-admin/firestore";
import { Flashcard } from "@/types/note.js";

/**
 * AI Operation Types (matches OperationType in transaction.ts)
 */
export type AIOperation = "summarize" | "autoTag" | "flashcards" | "ragQuery";

/**
 * Summarization request input
 */
export interface SummarizeInput {
    /** The note content to summarize */
    content: string;
    /** Maximum length of summary in characters (optional) */
    maxLength?: number;
}

/**
 * Summarization result
 */
export interface SummarizeResult {
    /** The generated summary */
    summary: string;
    /** Number of tokens used */
    tokensUsed: number;
}

/**
 * Auto-tagging request input
 */
export interface AutoTagInput {
    /** The note content to analyze */
    content: string;
    /** The note title (helps with context) */
    title: string;
    /** Maximum number of tags to generate */
    maxTags?: number;
}

/**
 * Auto-tagging result
 */
export interface AutoTagResult {
    /** Generated tags */
    tags: string[];
    /** Number of tokens used */
    tokensUsed: number;
}

/**
 * Flashcard generation request input
 */
export interface FlashcardsInput {
    /** The note content to create flashcards from */
    content: string;
    /** The note title */
    title: string;
    /** Number of flashcards to generate (default: 5) */
    count?: number;
}

/**
 * Flashcard generation result
 */
export interface FlashcardsResult {
    /** Generated flashcards */
    flashcards: Flashcard[];
    /** Number of tokens used */
    tokensUsed: number;
}

/**
 * RAG Query request input
 */
export interface RAGQueryInput {
    /** The user's question */
    query: string;
    /** Context from relevant notes */
    context: string;
    /** Maximum response length */
    maxLength?: number;
}

/**
 * RAG Query result
 */
export interface RAGQueryResult {
    /** The generated answer */
    answer: string;
    /** Number of tokens used */
    tokensUsed: number;
}

/**
 * AI Request logging data
 */
export interface AIRequestLog {
    id: string;
    userId: string;
    operation: AIOperation;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model: string;
    success: boolean;
    errorMessage?: string;
    durationMs: number;
    createdAt: Timestamp;
}
