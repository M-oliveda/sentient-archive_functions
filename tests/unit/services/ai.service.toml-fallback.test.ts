/**
 * AI Service TOML Fallback Tests
 *
 * Tests for fallback behavior when TOML configuration loading fails.
 * These tests require mocking the TOML utilities to throw errors.
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock types
interface MockGenerateContentResult {
    response: {
        text: () => string;
        usageMetadata?: {
            totalTokenCount: number;
        };
    };
}

interface MockGenerativeModel {
    generateContent: jest.Mock<() => Promise<MockGenerateContentResult>>;
}

interface MockDocSnapshot {
    exists: boolean;
    data: () => Record<string, unknown> | undefined;
}

// Create mock response helper
const createMockResponse = (
    text: string,
    tokensUsed = 100,
): MockGenerateContentResult => ({
    response: {
        text: () => text,
        usageMetadata: {
            totalTokenCount: tokensUsed,
        },
    },
});

// Mock the generative model
const mockGenerateContent = jest.fn<() => Promise<MockGenerateContentResult>>();
const mockModel: MockGenerativeModel = {
    generateContent: mockGenerateContent,
};

// Mock Firestore
const mockTimestampNow = jest.fn(() => ({
    toDate: () => new Date("2024-01-15T00:00:00.000Z"),
}));

const mockDocGet = jest.fn<() => Promise<MockDocSnapshot>>();
const mockDocSet = jest.fn<() => Promise<void>>();
const mockDocRef = {
    id: "test-log-id",
    set: mockDocSet,
};

const mockDb = {
    collection: jest.fn((name: string) => {
        if (name === "system_config") {
            return {
                doc: jest.fn(() => ({
                    get: mockDocGet,
                })),
            };
        }
        if (name === "ai_requests") {
            return {
                doc: jest.fn(() => mockDocRef),
            };
        }
        return {
            doc: jest.fn(() => ({
                get: mockDocGet,
            })),
        };
    }),
};

// Mock Firebase modules
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApp: jest.fn(() => {
        throw new Error("No Firebase app initialized");
    }),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(() => mockDb),
    Timestamp: {
        now: mockTimestampNow,
        fromDate: (date: Date) => ({ toDate: () => date }),
    },
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: jest.fn(() => ({})),
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock Gemini utilities
jest.unstable_mockModule("@/utils/gemini.js", () => ({
    __esModule: true,
    getGenerativeModel: jest.fn(() => mockModel),
    DEFAULT_MAX_TOKENS: 2048,
    DEFAULT_TEMPERATURE: 1,
}));

// Mock TOML utilities to throw errors for testing fallback behavior
const mockLoadPromptsConfig = jest.fn();
const mockGetDefaultAIConfig = jest.fn();

jest.unstable_mockModule("@/utils/toml.js", () => ({
    __esModule: true,
    loadPromptsConfig: mockLoadPromptsConfig,
    getDefaultAIConfig: mockGetDefaultAIConfig,
}));

// Import module dynamically after mocking
let AIService: typeof import("@/services/ai.service.js").AIService;
let aiService: import("@/services/ai.service.js").AIService;

describe("AI Service TOML Fallback", () => {
    beforeAll(async () => {
        const mod = await import("@/services/ai.service.js");
        AIService = mod.AIService;
        aiService = mod.aiService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: no config exists, use defaults
        mockDocGet.mockResolvedValue({
            exists: false,
            data: () => undefined,
        });
    });

    describe("getDefaultPrompts fallback", () => {
        test("should use fallback prompts when loadPromptsConfig throws", async () => {
            // Make loadPromptsConfig throw an error
            mockLoadPromptsConfig.mockImplementation(() => {
                throw new Error("TOML file not found");
            });

            // getDefaultAIConfig can succeed
            mockGetDefaultAIConfig.mockReturnValue({
                temperature: 1,
                maxTokens: 2048,
                model: "gemini-flash-lite-latest",
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse("Fallback summary", 100),
            );

            // The service should still work with fallback prompts
            const result = await aiService.summarize("user-123", {
                content: "Test content",
            });

            expect(result.summary).toBe("Fallback summary");
            expect(mockLoadPromptsConfig).toHaveBeenCalled();
        });
    });

    describe("getDefaultAIConfig fallback", () => {
        test("should use default config when getDefaultAIConfig throws", async () => {
            // loadPromptsConfig succeeds
            mockLoadPromptsConfig.mockReturnValue({
                prompts: {
                    summarize: { instructions: "Test summarize prompt" },
                    autoTag: { instructions: "Test autoTag prompt" },
                    flashcards: { instructions: "Test flashcards prompt" },
                    ragQuery: { instructions: "Test ragQuery prompt" },
                },
            });

            // getDefaultAIConfig throws
            mockGetDefaultAIConfig.mockImplementation(() => {
                throw new Error("TOML defaults not found");
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse("Config fallback test", 100),
            );

            // The service should still work with fallback config
            const result = await aiService.summarize("user-123", {
                content: "Test content",
            });

            expect(result.summary).toBe("Config fallback test");
            expect(mockGetDefaultAIConfig).toHaveBeenCalled();
        });
    });

    describe("both TOML functions fail", () => {
        test("should use all fallbacks when both TOML functions throw", async () => {
            // Both functions throw errors
            mockLoadPromptsConfig.mockImplementation(() => {
                throw new Error("TOML prompts not found");
            });
            mockGetDefaultAIConfig.mockImplementation(() => {
                throw new Error("TOML defaults not found");
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse("Full fallback test", 100),
            );

            // The service should still work with all fallback values
            const result = await aiService.summarize("user-123", {
                content: "Test content",
            });

            expect(result.summary).toBe("Full fallback test");
        });

        test("should return valid config when getConfig is called with TOML failures", async () => {
            mockLoadPromptsConfig.mockImplementation(() => {
                throw new Error("TOML prompts not found");
            });
            mockGetDefaultAIConfig.mockImplementation(() => {
                throw new Error("TOML defaults not found");
            });

            const service = new AIService();
            const config = await service.getConfig();

            // Should use fallback values
            expect(config.model).toBe("gemini-flash-lite-latest");
            expect(config.maxTokensPerRequest).toBe(2048);
            expect(config.temperature).toBe(1);
            expect(config.systemPrompts.summarize).toContain("summarizes text content");
            expect(config.systemPrompts.autoTag).toContain("generates relevant tags");
            expect(config.systemPrompts.flashcards).toContain("educational flashcards");
            expect(config.systemPrompts.ragQuery).toContain("answers questions");
        });
    });
});
