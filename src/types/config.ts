/**
 * Configuration Types
 *
 * Types for system configuration
 */

import { Timestamp } from "firebase-admin/firestore";

export interface SystemConfig {
    ai: AIConfig;
    tokens: TokenConfig;
    features: FeatureFlags;
    fileUpload: FileUploadConfig;
    rateLimits: RateLimits;
    lastUpdatedBy: string;
    lastUpdatedAt: Timestamp;
    version: number;
}

export interface AIConfig {
    model: string;
    maxTokensPerRequest: number;
    temperature: number;
    /**
     * Thinking level for Gemini 3+ models
     * Values: "minimal" | "low" | "medium" | "high"
     * See: https://ai.google.dev/gemini-api/docs/thinking
     */
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    /**
     * Thinking budget for Gemini 2.5 models (numeric)
     * -1 = dynamic, 0 = disabled, >0 = specific token count
     * See: https://ai.google.dev/gemini-api/docs/thinking
     */
    thinkingBudget?: number;
    systemPrompts: {
        summarize: string;
        autoTag: string;
        flashcards: string;
        ragQuery: string;
    };
}

export interface TokenConfig {
    initialGrant: {
        production: number;
        development: number;
        staging: number;
        local: number;
    };
    costs: {
        summarize: number;
        autoTag: number;
        flashcards: number;
        ragQuery: number;
    };
    maxPerOperation: number;
}

export interface FeatureFlags {
    summarizeEnabled: boolean;
    autoTagEnabled: boolean;
    flashcardsEnabled: boolean;
    ragQueryEnabled: boolean;
    fileExtractionEnabled: boolean;
}

export interface FileUploadConfig {
    maxSizeBytes: number;
    allowedTypes: string[];
    allowedExtensions: string[];
}

export interface RateLimits {
    aiRequestsPerHour: number;
    fileExtractionsPerDay: number;
}
