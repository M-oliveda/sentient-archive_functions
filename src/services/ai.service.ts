/**
 * AI Service
 *
 * Handles AI operations using Google Gemini:
 * - Summarization
 * - Auto-tagging
 * - Flashcard generation
 * - RAG queries
 *
 * System prompts are loaded from TOML configuration for ~10% token savings.
 * @see src/config/prompts.toml
 */

import { Timestamp } from "firebase-admin/firestore";
import {
    getGenerativeModel,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
} from "@/utils/gemini.js";
import { getDb } from "@/utils/firestore.js";
import { logInfo, logError, logEvent } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";
import { AIConfig } from "@/types/config.js";
import { Flashcard } from "@/types/note.js";
import {
    AIOperation,
    SummarizeInput,
    SummarizeResult,
    AutoTagInput,
    AutoTagResult,
    FlashcardsInput,
    FlashcardsResult,
    RAGQueryInput,
    RAGQueryResult,
    AIRequestLog,
} from "@/types/ai.js";
import { loadPromptsConfig, getDefaultAIConfig } from "@/utils/toml.js";

/**
 * Get default prompts from TOML configuration
 * Falls back to hardcoded defaults if TOML loading fails
 */
function getDefaultPrompts(): AIConfig["systemPrompts"] {
    try {
        const config = loadPromptsConfig();
        return {
            summarize: config.prompts.summarize.instructions,
            autoTag: config.prompts.autoTag.instructions,
            flashcards: config.prompts.flashcards.instructions,
            ragQuery: config.prompts.ragQuery.instructions,
        };
    } catch {
        // Fallback to hardcoded defaults if TOML loading fails
        logError("Failed to load TOML prompts, using hardcoded defaults");
        return FALLBACK_PROMPTS;
    }
}

/**
 * Fallback prompts in case TOML loading fails
 * These match the TOML configuration for consistency
 */
const FALLBACK_PROMPTS = {
    summarize: `You are a helpful assistant that summarizes text content.
Create a concise summary that captures the key points and main ideas.
Keep the summary clear and well-structured.
Respond with only the summary text, no additional commentary.`,

    autoTag: `You are a helpful assistant that generates relevant tags for content.
Analyze the title and content to identify key topics, themes, and concepts.
Generate tags that would be useful for organizing and searching the content.
Return tags as a JSON array of lowercase strings with no spaces (use hyphens for multi-word tags).
Example: ["machine-learning", "python", "data-science"]
Respond with only the JSON array, no additional text.`,

    flashcards: `You are a helpful assistant that creates educational flashcards.
Based on the content, create flashcards that test understanding of key concepts.
Each flashcard should have a clear question (front) and concise answer (back).
Return flashcards as a JSON array with objects containing "front" and "back" properties.
Example: [{"front": "What is photosynthesis?", "back": "The process by which plants convert sunlight into energy"}]
Respond with only the JSON array, no additional text.`,

    ragQuery: `You are a helpful assistant that answers questions based on provided context.
Use ONLY the information from the provided context to answer the question.
If the context doesn't contain enough information to answer, say so clearly.
Be concise and accurate in your response.`,
};

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
};

/**
 * AI Service class
 * Manages AI operations with Gemini
 */
export class AIService {
    /**
     * Get AI configuration from Firestore or use TOML defaults
     *
     * Priority order:
     * 1. Firestore system_config (if exists)
     * 2. TOML configuration (prompts.toml)
     * 3. Hardcoded fallback defaults
     */
    async getConfig(): Promise<AIConfig> {
        const db = getDb();
        const configDoc = await db.collection("system_config").doc("settings").get();

        // Load defaults from TOML configuration
        const defaultPrompts = getDefaultPrompts();
        let tomlDefaults: { temperature: number; maxTokens: number; model: string };

        try {
            tomlDefaults = getDefaultAIConfig();
        } catch {
            // Fallback if TOML loading fails
            tomlDefaults = {
                temperature: DEFAULT_TEMPERATURE,
                maxTokens: DEFAULT_MAX_TOKENS,
                model: "gemini-flash-lite-latest",
            };
        }

        if (!configDoc.exists) {
            return {
                model: tomlDefaults.model,
                maxTokensPerRequest: tomlDefaults.maxTokens,
                temperature: tomlDefaults.temperature,
                systemPrompts: defaultPrompts,
            };
        }

        const config = configDoc.data();
        const aiConfig = config?.["ai"] as AIConfig | undefined;

        return {
            model: aiConfig?.model ?? tomlDefaults.model,
            maxTokensPerRequest:
                aiConfig?.maxTokensPerRequest ?? tomlDefaults.maxTokens,
            temperature: aiConfig?.temperature ?? tomlDefaults.temperature,
            systemPrompts: {
                summarize:
                    aiConfig?.systemPrompts?.summarize ?? defaultPrompts.summarize,
                autoTag: aiConfig?.systemPrompts?.autoTag ?? defaultPrompts.autoTag,
                flashcards:
                    aiConfig?.systemPrompts?.flashcards ?? defaultPrompts.flashcards,
                ragQuery: aiConfig?.systemPrompts?.ragQuery ?? defaultPrompts.ragQuery,
            },
        };
    }

    /**
     * Log AI request to Firestore for audit
     */
    private async logRequest(
        userId: string,
        operation: AIOperation,
        success: boolean,
        durationMs: number,
        tokensUsed: number,
        errorMessage?: string,
    ): Promise<void> {
        try {
            const db = getDb();
            const logRef = db.collection("ai_requests").doc();

            const logEntry: AIRequestLog = {
                id: logRef.id,
                userId,
                operation,
                inputTokens: 0, // Gemini API doesn't always provide this breakdown
                outputTokens: 0,
                totalTokens: tokensUsed,
                model: "gemini-flash-lite-latest",
                success,
                errorMessage,
                durationMs,
                createdAt: Timestamp.now(),
            };

            await logRef.set(logEntry);

            logEvent("ai_request", {
                userId,
                operation,
                success,
                durationMs,
                tokensUsed,
            });
        } catch (error) {
            // Don't fail the main operation if logging fails
            logError(
                "Failed to log AI request",
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Execute with retry logic for transient failures
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Don't retry on certain errors
                if (this.isNonRetryableError(lastError)) {
                    throw lastError;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
                    RETRY_CONFIG.maxDelayMs,
                );

                logInfo(
                    `Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${operationName}`,
                    {
                        delay,
                        error: lastError.message,
                    },
                );

                await this.sleep(delay);
            }
        }

        /* istanbul ignore next -- defensive fallback, lastError always set in catch */
        throw lastError ?? new Error("Unknown error");
    }

    /**
     * Check if error should not be retried
     */
    isNonRetryableError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return (
            message.includes("invalid api key") ||
            message.includes("permission denied") ||
            message.includes("quota exceeded") ||
            message.includes("invalid argument")
        );
    }

    /**
     * Sleep helper for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Summarize note content
     *
     * @param userId - User ID for logging
     * @param input - Summarization input
     * @returns Summarization result
     */
    async summarize(userId: string, input: SummarizeInput): Promise<SummarizeResult> {
        const startTime = Date.now();
        let success = false;
        let tokensUsed = 0;

        try {
            const config = await this.getConfig();
            const model = getGenerativeModel(config.model);

            const prompt = `${config.systemPrompts.summarize}

Content to summarize:
${input.content}

${input.maxLength ? `Maximum summary length: ${input.maxLength} characters` : ""}`;

            const result = await this.executeWithRetry(
                () =>
                    model.generateContent({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: config.temperature,
                            maxOutputTokens: config.maxTokensPerRequest,
                        },
                    }),
                "summarize",
            );

            const response = result.response;
            const summary = response.text();

            tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;
            success = true;

            return { summary, tokensUsed };
        } catch (error) {
            /* istanbul ignore next -- executeWithRetry always wraps as Error */
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            throw new AppError(
                "AI_API_ERROR",
                502,
                `Summarization failed: ${errorMessage}`,
            );
        } finally {
            const durationMs = Date.now() - startTime;
            await this.logRequest(
                userId,
                "summarize",
                success,
                durationMs,
                tokensUsed,
                success ? undefined : "Operation failed",
            );
        }
    }

    /**
     * Generate tags for note content
     *
     * @param userId - User ID for logging
     * @param input - Auto-tag input
     * @returns Auto-tag result
     */
    async autoTag(userId: string, input: AutoTagInput): Promise<AutoTagResult> {
        const startTime = Date.now();
        let success = false;
        let tokensUsed = 0;

        try {
            const config = await this.getConfig();
            const model = getGenerativeModel(config.model);

            const maxTags = input.maxTags ?? 5;

            const prompt = `${config.systemPrompts.autoTag}

Title: ${input.title}

Content:
${input.content}

Generate up to ${maxTags} relevant tags.`;

            const result = await this.executeWithRetry(
                () =>
                    model.generateContent({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: config.temperature,
                            maxOutputTokens: config.maxTokensPerRequest,
                            responseMimeType: "application/json",
                        },
                    }),
                "autoTag",
            );

            const response = result.response;
            const text = response.text();

            /* istanbul ignore next -- Gemini API always provides usageMetadata on success */
            tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

            // Parse JSON response
            let tags: string[] = [];
            try {
                tags = JSON.parse(text) as string[];
                if (!Array.isArray(tags)) {
                    throw new Error("Response is not an array");
                }
                tags = tags
                    .filter((t) => typeof t === "string")
                    .map((t) => t.toLowerCase().trim())
                    .slice(0, maxTags);
            } catch {
                logError("Failed to parse autoTag response", undefined, { text });
                tags = [];
            }

            success = true;
            return { tags, tokensUsed };
        } catch (error) {
            /* istanbul ignore next -- defensive: executeWithRetry wraps errors */
            if (error instanceof AppError) throw error;
            /* istanbul ignore next -- executeWithRetry always wraps as Error */
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            throw new AppError(
                "AI_API_ERROR",
                502,
                `Auto-tagging failed: ${errorMessage}`,
            );
        } finally {
            const durationMs = Date.now() - startTime;
            await this.logRequest(
                userId,
                "autoTag",
                success,
                durationMs,
                tokensUsed,
                success ? undefined : "Operation failed",
            );
        }
    }

    /**
     * Generate flashcards from note content
     *
     * @param userId - User ID for logging
     * @param input - Flashcard generation input
     * @returns Flashcard generation result
     */
    async generateFlashcards(
        userId: string,
        input: FlashcardsInput,
    ): Promise<FlashcardsResult> {
        const startTime = Date.now();
        let success = false;
        let tokensUsed = 0;

        try {
            const config = await this.getConfig();
            const model = getGenerativeModel(config.model);

            const count = input.count ?? 5;

            const prompt = `${config.systemPrompts.flashcards}

Title: ${input.title}

Content:
${input.content}

Generate exactly ${count} flashcards.`;

            const result = await this.executeWithRetry(
                () =>
                    model.generateContent({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: config.temperature,
                            maxOutputTokens: config.maxTokensPerRequest,
                            responseMimeType: "application/json",
                        },
                    }),
                "flashcards",
            );

            const response = result.response;
            const text = response.text();

            /* istanbul ignore next -- Gemini API always provides usageMetadata on success */
            tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

            // Parse JSON response
            let flashcards: Flashcard[] = [];
            try {
                const parsed = JSON.parse(text) as { front: unknown; back: unknown }[];
                if (!Array.isArray(parsed)) {
                    throw new Error("Response is not an array");
                }
                flashcards = parsed
                    .filter(
                        (card: unknown) =>
                            typeof card === "object" &&
                            card !== null &&
                            "front" in card &&
                            "back" in card,
                    )
                    .map((card: { front: unknown; back: unknown }) => ({
                        front: String(card.front),
                        back: String(card.back),
                    }))
                    .slice(0, count);
            } catch {
                logError("Failed to parse flashcards response", undefined, { text });
                flashcards = [];
            }

            success = true;
            return { flashcards, tokensUsed };
        } catch (error) {
            /* istanbul ignore next -- defensive: executeWithRetry wraps errors */
            if (error instanceof AppError) throw error;
            /* istanbul ignore next -- executeWithRetry always wraps as Error */
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            throw new AppError(
                "AI_API_ERROR",
                502,
                `Flashcard generation failed: ${errorMessage}`,
            );
        } finally {
            const durationMs = Date.now() - startTime;
            await this.logRequest(
                userId,
                "flashcards",
                success,
                durationMs,
                tokensUsed,
                success ? undefined : "Operation failed",
            );
        }
    }

    /**
     * Answer a question using RAG (Retrieval-Augmented Generation)
     *
     * @param userId - User ID for logging
     * @param input - RAG query input
     * @returns RAG query result
     */
    async ragQuery(userId: string, input: RAGQueryInput): Promise<RAGQueryResult> {
        const startTime = Date.now();
        let success = false;
        let tokensUsed = 0;

        try {
            const config = await this.getConfig();
            const model = getGenerativeModel(config.model);

            const prompt = `${config.systemPrompts.ragQuery}

Context from your notes:
---
${input.context}
---

Question: ${input.query}

${input.maxLength ? `Maximum response length: ${input.maxLength} characters` : ""}`;

            const result = await this.executeWithRetry(
                () =>
                    model.generateContent({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: config.temperature,
                            maxOutputTokens: config.maxTokensPerRequest,
                        },
                    }),
                "ragQuery",
            );

            const response = result.response;
            const answer = response.text();

            /* istanbul ignore next -- Gemini API always provides usageMetadata on success */
            tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;
            success = true;

            return { answer, tokensUsed };
        } catch (error) {
            /* istanbul ignore next -- defensive: executeWithRetry wraps errors */
            if (error instanceof AppError) throw error;
            /* istanbul ignore next -- executeWithRetry always wraps as Error */
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            throw new AppError(
                "AI_API_ERROR",
                502,
                `RAG query failed: ${errorMessage}`,
            );
        } finally {
            const durationMs = Date.now() - startTime;
            await this.logRequest(
                userId,
                "ragQuery",
                success,
                durationMs,
                tokensUsed,
                success ? undefined : "Operation failed",
            );
        }
    }

    /**
     * Check if a feature is enabled
     */
    async isFeatureEnabled(
        feature: "summarize" | "autoTag" | "flashcards" | "ragQuery",
    ): Promise<boolean> {
        const db = getDb();
        const configDoc = await db.collection("system_config").doc("settings").get();

        if (!configDoc.exists) {
            return true; // Default to enabled
        }

        const config = configDoc.data();
        const features = config?.["features"] as Record<string, boolean> | undefined;

        const featureKey = `${feature}Enabled`;
        return features?.[featureKey] ?? true;
    }
}

/**
 * Singleton instance of AIService
 */
export const aiService = new AIService();
