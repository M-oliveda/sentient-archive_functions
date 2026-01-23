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
