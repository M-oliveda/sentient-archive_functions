/**
 * AI Routes
 *
 * Handles AI-powered API endpoints:
 * - POST /summarize - Summarize note content (2 tokens)
 * - POST /autoTag - Generate tags (1 token)
 * - POST /flashcards - Create flashcards (3 tokens)
 * - POST /ragQuery - Answer questions (4 tokens)
 */

import { Router, Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { authMiddleware } from "@/middleware/auth.js";
import { asyncHandler, AppError } from "@/middleware/errorHandler.js";
import { aiService } from "@/services/ai.service.js";
import { tokenService } from "@/services/token.service.js";
import { ragService } from "@/services/rag.service.js";
import { getDb } from "@/utils/firestore.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import {
    SummarizeRequestSchema,
    AutoTagRequestSchema,
    FlashcardsRequestSchema,
    RagQueryRequestSchema,
    validateRequest,
} from "@/utils/validation.js";
import { ApiResponse } from "@/types/api.js";
import { Note } from "@/types/note.js";

const router = Router();

/**
 * Get a note by ID for a specific user
 */
async function getNoteById(userId: string, noteId: string): Promise<Note | null> {
    const db = getDb();
    const noteDoc = await db
        .collection("users")
        .doc(userId)
        .collection("notes")
        .doc(noteId)
        .get();

    if (!noteDoc.exists) {
        return null;
    }

    return noteDoc.data() as Note;
}

/**
 * Update a note with AI-generated data
 */
async function updateNote(
    userId: string,
    noteId: string,
    data: Partial<Note>,
): Promise<void> {
    const db = getDb();
    await db
        .collection("users")
        .doc(userId)
        .collection("notes")
        .doc(noteId)
        .update({
            ...data,
            updatedAt: Timestamp.now(),
        });
}

/**
 * POST /summarize
 *
 * Summarize note content
 *
 * Request body:
 * - noteId: string (required)
 * - maxLength: number (50-500, default: 200)
 *
 * Token cost: 2 tokens
 */
router.post(
    "/summarize",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        // Validate request body
        const { noteId, maxLength } = validateRequest(SummarizeRequestSchema, req.body);

        logInfo("Summarize request", { userId, noteId, maxLength });

        // Check if feature is enabled
        const isEnabled = await aiService.isFeatureEnabled("summarize");
        if (!isEnabled) {
            throw new AppError(
                "FEATURE_DISABLED",
                503,
                "Summarization feature is currently disabled",
            );
        }

        // Get token cost
        const tokenCost = await tokenService.getOperationCost("summarize");

        // Check if user has enough tokens
        const hasTokens = await tokenService.hasEnoughTokens(userId, tokenCost);
        if (!hasTokens) {
            const balance = await tokenService.getBalance(userId);
            throw new AppError(
                "INSUFFICIENT_TOKENS",
                402,
                `Insufficient tokens. Required: ${tokenCost}, Available: ${balance.balance}`,
            );
        }

        // Get the note
        const note = await getNoteById(userId, noteId);
        if (!note) {
            throw new AppError("NOT_FOUND", 404, "Note not found");
        }

        // Deduct tokens first
        await tokenService.deductTokens(userId, tokenCost, "summarize");

        // Generate summary
        const result = await aiService.summarize(userId, {
            content: note.content,
            maxLength,
        });

        // Update note with summary
        await updateNote(userId, noteId, { summary: result.summary });

        logEvent("note_summarized", {
            userId,
            noteId,
            summaryLength: result.summary.length,
            tokensUsed: result.tokensUsed,
        });

        const response: ApiResponse<{
            noteId: string;
            summary: string;
            tokensUsed: number;
            tokenCost: number;
        }> = {
            success: true,
            data: {
                noteId,
                summary: result.summary,
                tokensUsed: result.tokensUsed,
                tokenCost,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /autoTag
 *
 * Generate tags for a note
 *
 * Request body:
 * - noteId: string (required)
 * - maxTags: number (1-10, default: 5)
 *
 * Token cost: 1 token
 */
router.post(
    "/autoTag",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        // Validate request body
        const { noteId, maxTags } = validateRequest(AutoTagRequestSchema, req.body);

        logInfo("Auto-tag request", { userId, noteId, maxTags });

        // Check if feature is enabled
        const isEnabled = await aiService.isFeatureEnabled("autoTag");
        if (!isEnabled) {
            throw new AppError(
                "FEATURE_DISABLED",
                503,
                "Auto-tagging feature is currently disabled",
            );
        }

        // Get token cost
        const tokenCost = await tokenService.getOperationCost("autoTag");

        // Check if user has enough tokens
        const hasTokens = await tokenService.hasEnoughTokens(userId, tokenCost);
        if (!hasTokens) {
            const balance = await tokenService.getBalance(userId);
            throw new AppError(
                "INSUFFICIENT_TOKENS",
                402,
                `Insufficient tokens. Required: ${tokenCost}, Available: ${balance.balance}`,
            );
        }

        // Get the note
        const note = await getNoteById(userId, noteId);
        if (!note) {
            throw new AppError("NOT_FOUND", 404, "Note not found");
        }

        // Deduct tokens first
        await tokenService.deductTokens(userId, tokenCost, "autoTag");

        // Generate tags
        const result = await aiService.autoTag(userId, {
            title: note.title,
            content: note.content,
            maxTags,
        });

        // Update note with AI tags
        await updateNote(userId, noteId, { aiTags: result.tags });

        logEvent("note_auto_tagged", {
            userId,
            noteId,
            tagsGenerated: result.tags.length,
            tokensUsed: result.tokensUsed,
        });

        const response: ApiResponse<{
            noteId: string;
            tags: string[];
            tokensUsed: number;
            tokenCost: number;
        }> = {
            success: true,
            data: {
                noteId,
                tags: result.tags,
                tokensUsed: result.tokensUsed,
                tokenCost,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /flashcards
 *
 * Generate flashcards from a note
 *
 * Request body:
 * - noteId: string (required)
 * - count: number (2-20, default: 5)
 *
 * Token cost: 3 tokens
 */
router.post(
    "/flashcards",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        // Validate request body
        const { noteId, count } = validateRequest(FlashcardsRequestSchema, req.body);

        logInfo("Flashcards request", { userId, noteId, count });

        // Check if feature is enabled
        const isEnabled = await aiService.isFeatureEnabled("flashcards");
        if (!isEnabled) {
            throw new AppError(
                "FEATURE_DISABLED",
                503,
                "Flashcard generation feature is currently disabled",
            );
        }

        // Get token cost
        const tokenCost = await tokenService.getOperationCost("flashcards");

        // Check if user has enough tokens
        const hasTokens = await tokenService.hasEnoughTokens(userId, tokenCost);
        if (!hasTokens) {
            const balance = await tokenService.getBalance(userId);
            throw new AppError(
                "INSUFFICIENT_TOKENS",
                402,
                `Insufficient tokens. Required: ${tokenCost}, Available: ${balance.balance}`,
            );
        }

        // Get the note
        const note = await getNoteById(userId, noteId);
        if (!note) {
            throw new AppError("NOT_FOUND", 404, "Note not found");
        }

        // Deduct tokens first
        await tokenService.deductTokens(userId, tokenCost, "flashcards");

        // Generate flashcards
        const result = await aiService.generateFlashcards(userId, {
            title: note.title,
            content: note.content,
            count,
        });

        // Update note with flashcards
        await updateNote(userId, noteId, { flashcards: result.flashcards });

        logEvent("flashcards_generated", {
            userId,
            noteId,
            flashcardsGenerated: result.flashcards.length,
            tokensUsed: result.tokensUsed,
        });

        const response: ApiResponse<{
            noteId: string;
            flashcards: { front: string; back: string }[];
            tokensUsed: number;
            tokenCost: number;
        }> = {
            success: true,
            data: {
                noteId,
                flashcards: result.flashcards,
                tokensUsed: result.tokensUsed,
                tokenCost,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /ragQuery
 *
 * Answer a question using RAG (Retrieval-Augmented Generation)
 *
 * Request body:
 * - query: string (3-500 chars, required)
 * - maxResults: number (1-10, default: 5)
 *
 * Token cost: 4 tokens
 */
router.post(
    "/ragQuery",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        // Validate request body
        const { query, maxResults } = validateRequest(RagQueryRequestSchema, req.body);

        logInfo("RAG query request", { userId, queryLength: query.length, maxResults });

        // Check if feature is enabled
        const isEnabled = await aiService.isFeatureEnabled("ragQuery");
        if (!isEnabled) {
            throw new AppError(
                "FEATURE_DISABLED",
                503,
                "Knowledge Q&A feature is currently disabled",
            );
        }

        // Get token cost
        const tokenCost = await tokenService.getOperationCost("ragQuery");

        // Check if user has enough tokens
        const hasTokens = await tokenService.hasEnoughTokens(userId, tokenCost);
        if (!hasTokens) {
            const balance = await tokenService.getBalance(userId);
            throw new AppError(
                "INSUFFICIENT_TOKENS",
                402,
                `Insufficient tokens. Required: ${tokenCost}, Available: ${balance.balance}`,
            );
        }

        // Get context from user's notes using RAG service
        const ragContext = await ragService.getContext(userId, query, maxResults ?? 5);

        if (!ragContext.context) {
            throw new AppError(
                "NO_CONTEXT",
                400,
                "No notes found to provide context for the query",
            );
        }

        // Deduct tokens first
        await tokenService.deductTokens(userId, tokenCost, "ragQuery");

        // Generate answer
        const result = await aiService.ragQuery(userId, {
            query,
            context: ragContext.context,
        });

        logEvent("rag_query_answered", {
            userId,
            queryLength: query.length,
            notesUsed: ragContext.notesFound,
            answerLength: result.answer.length,
            tokensUsed: result.tokensUsed,
            totalRelevanceScore: ragContext.totalScore,
        });

        const response: ApiResponse<{
            query: string;
            answer: string;
            sourceNoteIds: string[];
            tokensUsed: number;
            tokenCost: number;
        }> = {
            success: true,
            data: {
                query,
                answer: result.answer,
                sourceNoteIds: ragContext.noteIds,
                tokensUsed: result.tokensUsed,
                tokenCost,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
