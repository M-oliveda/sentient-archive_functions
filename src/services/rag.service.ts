/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Handles context retrieval for AI-powered Q&A:
 * - Keyword extraction from user queries
 * - Note search and relevance scoring
 * - Context building from multiple notes
 *
 * Used by the /v1/ai/ragQuery endpoint for Knowledge Q&A.
 */

import { getDb } from "@/utils/firestore.js";
import { logInfo, logError } from "@/utils/logger.js";
import { Note } from "@/types/note.js";

/**
 * Relevance scoring weights for different note fields
 */
const RELEVANCE_WEIGHTS = {
    /** Weight for title matches (highest priority) */
    title: 10,
    /** Weight for tag matches (high priority - user-defined) */
    tags: 8,
    /** Weight for AI-generated tag matches */
    aiTags: 6,
    /** Weight for summary matches (good signal) */
    summary: 5,
    /** Weight for content matches (lowest per-match, but most content) */
    content: 1,
};

/**
 * Configuration for context building
 */
const CONTEXT_CONFIG = {
    /** Maximum characters in the combined context */
    maxContextLength: 8000,
    /** Maximum characters per note in context */
    maxNoteLength: 2000,
    /** Minimum relevance score to include a note */
    minRelevanceScore: 1,
};

/**
 * Common stop words to exclude from keyword extraction
 */
const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "his",
    "how",
    "i",
    "in",
    "is",
    "it",
    "its",
    "me",
    "my",
    "no",
    "not",
    "of",
    "on",
    "or",
    "our",
    "she",
    "so",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "to",
    "us",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "will",
    "with",
    "would",
    "you",
    "your",
    "can",
    "could",
    "should",
    "would",
    "may",
    "might",
    "must",
    "shall",
    "about",
    "been",
    "being",
    "do",
    "does",
    "did",
    "doing",
    "done",
]);

/**
 * Result of note retrieval with relevance information
 */
export interface RetrievedNote {
    /** The note ID */
    noteId: string;
    /** The note title */
    title: string;
    /** The note content (may be truncated) */
    content: string;
    /** Relevance score (higher is more relevant) */
    score: number;
    /** Keywords that matched */
    matchedKeywords: string[];
}

/**
 * Result of context retrieval for RAG
 */
export interface RAGContext {
    /** Combined context from relevant notes */
    context: string;
    /** IDs of notes used in context */
    noteIds: string[];
    /** Number of notes found */
    notesFound: number;
    /** Total relevance score */
    totalScore: number;
}

/**
 * RAG Service class
 * Manages context retrieval for AI-powered Q&A
 */
export class RAGService {
    /**
     * Extract keywords from a query string
     *
     * Removes stop words, normalizes case, and filters short words.
     *
     * @param query - The user's question
     * @returns Array of extracted keywords
     */
    extractKeywords(query: string): string[] {
        // Normalize and tokenize
        const tokens = query
            .toLowerCase()
            // Remove punctuation except hyphens in words
            .replace(/[^\w\s-]/g, " ")
            // Split on whitespace
            .split(/\s+/)
            // Filter empty strings
            .filter((token) => token.length > 0);

        // Remove stop words and short words
        const keywords = tokens.filter(
            (token) => !STOP_WORDS.has(token) && token.length >= 2,
        );

        // Remove duplicates while preserving order
        return [...new Set(keywords)];
    }

    /**
     * Calculate relevance score for a note based on keyword matches
     *
     * @param note - The note to score
     * @param keywords - Keywords to match against
     * @returns Score and matched keywords
     */
    calculateRelevance(
        note: Note,
        keywords: string[],
    ): { score: number; matchedKeywords: string[] } {
        let score = 0;
        const matchedKeywords = new Set<string>();

        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();

            // Check title
            if (note.title.toLowerCase().includes(lowerKeyword)) {
                score += RELEVANCE_WEIGHTS.title;
                matchedKeywords.add(keyword);
            }

            // Check manual tags
            for (const tag of note.tags) {
                if (tag.toLowerCase().includes(lowerKeyword)) {
                    score += RELEVANCE_WEIGHTS.tags;
                    matchedKeywords.add(keyword);
                    break; // Only count once per keyword per field
                }
            }

            // Check AI tags
            for (const tag of note.aiTags) {
                if (tag.toLowerCase().includes(lowerKeyword)) {
                    score += RELEVANCE_WEIGHTS.aiTags;
                    matchedKeywords.add(keyword);
                    break;
                }
            }

            // Check summary
            if (note.summary?.toLowerCase().includes(lowerKeyword)) {
                score += RELEVANCE_WEIGHTS.summary;
                matchedKeywords.add(keyword);
            }

            // Check content (count occurrences for weighted scoring)
            const contentLower = note.content.toLowerCase();
            const occurrences = this.countOccurrences(contentLower, lowerKeyword);
            if (occurrences > 0) {
                // Cap at 10 occurrences to prevent gaming
                score += RELEVANCE_WEIGHTS.content * Math.min(occurrences, 10);
                matchedKeywords.add(keyword);
            }
        }

        return {
            score,
            matchedKeywords: [...matchedKeywords],
        };
    }

    /**
     * Count occurrences of a substring in a string
     *
     * @param text - The text to search in
     * @param substring - The substring to count
     * @returns Number of occurrences
     */
    private countOccurrences(text: string, substring: string): number {
        let count = 0;
        let position = 0;

        while ((position = text.indexOf(substring, position)) !== -1) {
            count++;
            position += substring.length;
        }

        return count;
    }

    /**
     * Retrieve and rank notes based on a query
     *
     * @param userId - The user ID
     * @param query - The search query
     * @param maxResults - Maximum number of notes to return
     * @returns Array of retrieved notes sorted by relevance
     */
    async retrieveNotes(
        userId: string,
        query: string,
        maxResults: number,
    ): Promise<RetrievedNote[]> {
        const keywords = this.extractKeywords(query);

        if (keywords.length === 0) {
            logInfo("RAG: No keywords extracted from query", { query });
            return [];
        }

        const db = getDb();

        try {
            // Fetch user's active notes
            const snapshot = await db
                .collection("users")
                .doc(userId)
                .collection("notes")
                .where("isArchived", "==", false)
                .get();

            if (snapshot.empty) {
                logInfo("RAG: No notes found for user", { userId });
                return [];
            }

            // Score and rank notes
            const scoredNotes: RetrievedNote[] = [];

            snapshot.forEach((doc) => {
                const note = doc.data() as Note;
                const { score, matchedKeywords } = this.calculateRelevance(
                    note,
                    keywords,
                );

                if (score >= CONTEXT_CONFIG.minRelevanceScore) {
                    scoredNotes.push({
                        noteId: doc.id,
                        title: note.title,
                        content: note.content,
                        score,
                        matchedKeywords,
                    });
                }
            });

            // Sort by score descending
            scoredNotes.sort((a, b) => b.score - a.score);

            // Return top results
            const results = scoredNotes.slice(0, maxResults);

            logInfo("RAG: Notes retrieved", {
                userId,
                keywords,
                totalNotes: snapshot.size,
                matchingNotes: scoredNotes.length,
                returnedNotes: results.length,
            });

            return results;
        } catch (error) {
            logError(
                "RAG: Failed to retrieve notes",
                error instanceof Error ? error : undefined,
                {
                    userId,
                    query,
                },
            );
            throw error;
        }
    }

    /**
     * Build context string from retrieved notes
     *
     * Combines note content respecting length limits.
     *
     * @param notes - Retrieved notes with scores
     * @returns Formatted context string
     */
    buildContext(notes: RetrievedNote[]): string {
        if (notes.length === 0) {
            return "";
        }

        const contextParts: string[] = [];
        let totalLength = 0;

        for (const note of notes) {
            // Truncate individual note content if needed
            let noteContent = note.content;
            if (noteContent.length > CONTEXT_CONFIG.maxNoteLength) {
                noteContent =
                    noteContent.substring(0, CONTEXT_CONFIG.maxNoteLength) + "...";
            }

            // Format note for context
            const formattedNote = `## ${note.title}\n${noteContent}`;
            const noteLength = formattedNote.length;

            // Check if adding this note would exceed limit
            if (totalLength + noteLength > CONTEXT_CONFIG.maxContextLength) {
                // Try to fit a truncated version
                const remainingSpace =
                    CONTEXT_CONFIG.maxContextLength - totalLength - 50; // 50 for separator
                if (remainingSpace > 200) {
                    const truncated = `## ${note.title}\n${noteContent.substring(0, remainingSpace)}...`;
                    contextParts.push(truncated);
                }
                break;
            }

            contextParts.push(formattedNote);
            totalLength += noteLength + 10; // 10 for separator
        }

        return contextParts.join("\n\n---\n\n");
    }

    /**
     * Get context from user's notes for a RAG query
     *
     * Main entry point for the RAG retrieval process.
     *
     * @param userId - The user ID
     * @param query - The user's question
     * @param maxResults - Maximum number of notes to consider
     * @returns RAG context with note IDs and metadata
     */
    async getContext(
        userId: string,
        query: string,
        maxResults = 5,
    ): Promise<RAGContext> {
        // Retrieve relevant notes
        const notes = await this.retrieveNotes(userId, query, maxResults);

        if (notes.length === 0) {
            return {
                context: "",
                noteIds: [],
                notesFound: 0,
                totalScore: 0,
            };
        }

        // Build context string
        const context = this.buildContext(notes);

        // Calculate total score
        const totalScore = notes.reduce((sum, note) => sum + note.score, 0);

        return {
            context,
            noteIds: notes.map((n) => n.noteId),
            notesFound: notes.length,
            totalScore,
        };
    }
}

/**
 * Singleton instance of RAGService
 */
export const ragService = new RAGService();
