/**
 * AI Service Tests
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

// Type for mock call arguments
interface MockCallArgs {
    contents: [{ parts: [{ text: string }] }];
    generationConfig?: {
        temperature: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        thinkingLevel?: string;
        thinkingBudget?: number;
    };
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
    DEFAULT_MODEL: "gemini-3.5-flash",
    DEFAULT_MAX_TOKENS: 2048,
    DEFAULT_TEMPERATURE: 1.0,
    supportsThinking: jest.fn((model: string) => /gemini-2\.5/i.test(model)),
}));

// Import module dynamically after mocking
let AIService: typeof import("@/services/ai.service.js").AIService;
let aiService: import("@/services/ai.service.js").AIService;

// Helper to get mock call args safely
function getMockCallArgs(callIndex: number): MockCallArgs {
    const calls = mockGenerateContent.mock.calls;
    const call = calls[callIndex] as unknown as [MockCallArgs] | undefined;
    if (!call?.[0]) {
        throw new Error(`No mock call at index ${callIndex}`);
    }
    return call[0];
}

describe("AI Service", () => {
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

    describe("summarize", () => {
        test("should successfully summarize content", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("This is a test summary.", 150),
            );

            const result = await aiService.summarize("user-123", {
                content: "Long content to summarize...",
            });

            expect(result.summary).toBe("This is a test summary.");
            expect(result.tokensUsed).toBe(150);
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        test("should include maxLength in prompt when provided", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Short summary.", 100),
            );

            await aiService.summarize("user-123", {
                content: "Content...",
                maxLength: 100,
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Maximum summary length: 100 characters",
            );
        });

        test("should log AI request to Firestore", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));

            await aiService.summarize("user-123", { content: "Content" });

            expect(mockDocSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "user-123",
                    operation: "summarize",
                    success: true,
                }),
            );
        });

        test("should throw AI_API_ERROR on failure", async () => {
            mockGenerateContent.mockRejectedValue(new Error("API Error"));

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                statusCode: 502,
            });
        });

        test("should handle missing usageMetadata", async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => "Summary without metadata",
                    usageMetadata: undefined,
                },
            });

            const result = await aiService.summarize("user-123", {
                content: "Content",
            });

            expect(result.summary).toBe("Summary without metadata");
            expect(result.tokensUsed).toBe(0);
        });

        test("should include language instruction for Spanish", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Resumen en español", 100),
            );

            await aiService.summarize("user-123", {
                content: "Content to summarize",
                language: "es",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Spanish.",
            );
        });

        test("should include language instruction for French", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Résumé en français", 100),
            );

            await aiService.summarize("user-123", {
                content: "Content to summarize",
                language: "fr",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in French.",
            );
        });

        test("should include language instruction for Portuguese", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Resumo em português", 100),
            );

            await aiService.summarize("user-123", {
                content: "Content to summarize",
                language: "pt",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Portuguese.",
            );
        });

        test("should default to English when language not provided", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("English summary", 100),
            );

            await aiService.summarize("user-123", {
                content: "Content to summarize",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in English.",
            );
        });
    });

    describe("autoTag", () => {
        test("should successfully generate tags", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["javascript", "web-development", "react"]', 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "React Tutorial",
                content: "Learn React basics...",
            });

            expect(result.tags).toEqual(["javascript", "web-development", "react"]);
            expect(result.tokensUsed).toBe(80);
        });

        test("should respect maxTags limit", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["tag1", "tag2", "tag3", "tag4", "tag5"]', 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
                maxTags: 3,
            });

            expect(result.tags).toHaveLength(3);
        });

        test("should handle invalid JSON response", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("not valid json", 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.tags).toEqual([]);
        });

        test("should handle non-array JSON response", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('{"tags": ["a", "b"]}', 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.tags).toEqual([]);
        });

        test("should filter non-string tags", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["valid", 123, null, "another"]', 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.tags).toEqual(["valid", "another"]);
        });

        test("should lowercase and trim tags", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["  JavaScript  ", "REACT", "node-js"]', 80),
            );

            const result = await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.tags).toEqual(["javascript", "react", "node-js"]);
        });

        test("should use default maxTags of 5", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("[]", 50));

            await aiService.autoTag("user-123", {
                title: "Test",
                content: "Content",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Generate up to 5 relevant tags",
            );
        });

        test("should include language instruction for Spanish", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["etiqueta-uno", "etiqueta-dos"]', 80),
            );

            await aiService.autoTag("user-123", {
                title: "Título",
                content: "Contenido",
                language: "es",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Spanish.",
            );
        });

        test("should default to English when language not provided", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('["tag-one", "tag-two"]', 80),
            );

            await aiService.autoTag("user-123", {
                title: "Title",
                content: "Content",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in English.",
            );
        });
    });

    describe("generateFlashcards", () => {
        test("should successfully generate flashcards", async () => {
            const flashcardsJson = JSON.stringify([
                {
                    front: "What is React?",
                    back: "A JavaScript library for building UIs",
                },
                {
                    front: "What are hooks?",
                    back: "Functions that let you use state in functional components",
                },
            ]);

            mockGenerateContent.mockResolvedValue(
                createMockResponse(flashcardsJson, 200),
            );

            const result = await aiService.generateFlashcards("user-123", {
                title: "React Notes",
                content: "React is a JavaScript library...",
                count: 2,
            });

            expect(result.flashcards).toHaveLength(2);
            expect(result.flashcards[0]?.front).toBe("What is React?");
            expect(result.tokensUsed).toBe(200);
        });

        test("should default to 5 flashcards when count not specified", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("[]", 50));

            await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Generate exactly 5 flashcards",
            );
        });

        test("should handle invalid flashcard format", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('[{"invalid": "format"}]', 50),
            );

            const result = await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.flashcards).toEqual([]);
        });

        test("should handle non-array response", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse('{"flashcards": []}', 50),
            );

            const result = await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.flashcards).toEqual([]);
        });

        test("should filter invalid flashcard objects", async () => {
            const flashcardsJson = JSON.stringify([
                { front: "Valid", back: "Card" },
                { front: "Missing back" },
                { back: "Missing front" },
                null,
                { front: "Another valid", back: "Card" },
            ]);

            mockGenerateContent.mockResolvedValue(
                createMockResponse(flashcardsJson, 100),
            );

            const result = await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
            });

            expect(result.flashcards).toHaveLength(2);
            expect(result.flashcards[0]?.front).toBe("Valid");
            expect(result.flashcards[1]?.front).toBe("Another valid");
        });

        test("should respect count limit", async () => {
            const flashcardsJson = JSON.stringify([
                { front: "Q1", back: "A1" },
                { front: "Q2", back: "A2" },
                { front: "Q3", back: "A3" },
                { front: "Q4", back: "A4" },
                { front: "Q5", back: "A5" },
            ]);

            mockGenerateContent.mockResolvedValue(
                createMockResponse(flashcardsJson, 100),
            );

            const result = await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
                count: 3,
            });

            expect(result.flashcards).toHaveLength(3);
        });

        test("should include language instruction for Spanish", async () => {
            const flashcardsJson = JSON.stringify([
                { front: "¿Qué es React?", back: "Una biblioteca de JavaScript" },
            ]);

            mockGenerateContent.mockResolvedValue(
                createMockResponse(flashcardsJson, 100),
            );

            await aiService.generateFlashcards("user-123", {
                title: "React",
                content: "Contenido sobre React",
                language: "es",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Spanish.",
            );
        });

        test("should default to English when language not provided", async () => {
            const flashcardsJson = JSON.stringify([
                { front: "What is React?", back: "A JavaScript library" },
            ]);

            mockGenerateContent.mockResolvedValue(
                createMockResponse(flashcardsJson, 100),
            );

            await aiService.generateFlashcards("user-123", {
                title: "React",
                content: "Content about React",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in English.",
            );
        });
    });

    describe("ragQuery", () => {
        test("should successfully answer question with context", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse(
                    "Based on your notes, React is a JavaScript library for building user interfaces.",
                    120,
                ),
            );

            const result = await aiService.ragQuery("user-123", {
                query: "What is React?",
                context: "React is a JavaScript library...",
            });

            expect(result.answer).toContain("JavaScript library");
            expect(result.tokensUsed).toBe(120);
        });

        test("should include maxLength in prompt when provided", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Short answer.", 50),
            );

            await aiService.ragQuery("user-123", {
                query: "Question?",
                context: "Context",
                maxLength: 200,
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Maximum response length: 200 characters",
            );
        });

        test("should include context in prompt", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("Answer", 50));

            await aiService.ragQuery("user-123", {
                query: "What is X?",
                context: "X is a special thing that does Y.",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "X is a special thing that does Y",
            );
        });

        test("should include language instruction for Spanish", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Respuesta en español", 50),
            );

            await aiService.ragQuery("user-123", {
                query: "¿Qué es React?",
                context: "React es una biblioteca de JavaScript",
                language: "es",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Spanish.",
            );
        });

        test("should include language instruction for Portuguese", async () => {
            mockGenerateContent.mockResolvedValue(
                createMockResponse("Resposta em português", 50),
            );

            await aiService.ragQuery("user-123", {
                query: "O que é React?",
                context: "React é uma biblioteca JavaScript",
                language: "pt",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in Portuguese.",
            );
        });

        test("should default to English when language not provided", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("Answer", 50));

            await aiService.ragQuery("user-123", {
                query: "What is React?",
                context: "React is a JavaScript library",
            });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "Respond entirely in English.",
            );
        });
    });

    describe("isFeatureEnabled", () => {
        test("should return true when no config exists", async () => {
            mockDocGet.mockResolvedValue({
                exists: false,
                data: () => undefined,
            });

            const result = await aiService.isFeatureEnabled("summarize");

            expect(result).toBe(true);
        });

        test("should return config value when it exists", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    features: {
                        summarizeEnabled: false,
                        autoTagEnabled: true,
                    },
                }),
            });

            expect(await aiService.isFeatureEnabled("summarize")).toBe(false);
            expect(await aiService.isFeatureEnabled("autoTag")).toBe(true);
        });

        test("should return true when feature not in config", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    features: {},
                }),
            });

            expect(await aiService.isFeatureEnabled("flashcards")).toBe(true);
        });

        test("should handle all feature types", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    features: {
                        summarizeEnabled: true,
                        autoTagEnabled: true,
                        flashcardsEnabled: false,
                        ragQueryEnabled: false,
                    },
                }),
            });

            expect(await aiService.isFeatureEnabled("summarize")).toBe(true);
            expect(await aiService.isFeatureEnabled("autoTag")).toBe(true);
            expect(await aiService.isFeatureEnabled("flashcards")).toBe(false);
            expect(await aiService.isFeatureEnabled("ragQuery")).toBe(false);
        });
    });

    describe("retry logic", () => {
        test("should retry on transient errors", async () => {
            mockGenerateContent
                .mockRejectedValueOnce(new Error("Temporary error"))
                .mockResolvedValueOnce(createMockResponse("Success", 100));

            const result = await aiService.summarize("user-123", {
                content: "Content",
            });

            expect(result.summary).toBe("Success");
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        });

        test("should not retry on permission errors", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Permission denied"));

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
            });

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        test("should not retry on invalid API key errors", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Invalid API key"));

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
            });

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        test("should not retry on quota exceeded errors", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Quota exceeded"));

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
            });

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        test("should not retry on invalid argument errors", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Invalid argument"));

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
            });

            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });
    });

    describe("configuration", () => {
        test("should use config from Firestore when available", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "custom-model",
                        temperature: 0.5,
                        maxTokensPerRequest: 4096,
                        systemPrompts: {
                            summarize: "Custom summarize prompt",
                        },
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));

            await aiService.summarize("user-123", { content: "Content" });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain("Custom summarize prompt");
            expect(args.generationConfig?.temperature).toBe(0.5);
        });

        test("should use default prompts when config prompts missing", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "custom-model",
                        // No systemPrompts
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));

            await aiService.summarize("user-123", { content: "Content" });

            const args = getMockCallArgs(0);
            expect(args.contents[0].parts[0].text).toContain(
                "You are a helpful assistant that summarizes text content",
            );
        });

        test("should include thinkingLevel in generation config when provided", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "gemini-2.5-flash",
                        temperature: 0.7,
                        maxTokensPerRequest: 2048,
                        thinkingLevel: "high",
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));

            await aiService.summarize("user-123", { content: "Content" });

            const args = getMockCallArgs(0);
            expect(args.generationConfig).toHaveProperty("thinkingLevel", "high");
        });

        test("should include thinkingBudget in generation config when provided", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "gemini-2.5-flash",
                        temperature: 0.7,
                        maxTokensPerRequest: 2048,
                        thinkingBudget: 5000,
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));

            await aiService.summarize("user-123", { content: "Content" });

            const args = getMockCallArgs(0);
            expect(args.generationConfig).toHaveProperty("thinkingBudget", 5000);
        });

        test("should include both thinkingLevel and thinkingBudget in autoTag", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "gemini-2.5-flash",
                        temperature: 0.7,
                        maxTokensPerRequest: 2048,
                        thinkingLevel: "medium",
                        thinkingBudget: 3000,
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse(JSON.stringify(["tag1", "tag2"]), 100),
            );

            await aiService.autoTag("user-123", { title: "Test", content: "Content" });

            const args = getMockCallArgs(0);
            expect(args.generationConfig).toHaveProperty("thinkingLevel", "medium");
            expect(args.generationConfig).toHaveProperty("thinkingBudget", 3000);
        });

        test("should include both thinkingLevel and thinkingBudget in generateFlashcards", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "gemini-2.5-flash",
                        temperature: 0.7,
                        maxTokensPerRequest: 2048,
                        thinkingLevel: "low",
                        thinkingBudget: 1000,
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse(
                    JSON.stringify([
                        { front: "Q1", back: "A1" },
                        { front: "Q2", back: "A2" },
                    ]),
                    100,
                ),
            );

            await aiService.generateFlashcards("user-123", {
                title: "Test",
                content: "Content",
            });

            const args = getMockCallArgs(0);
            expect(args.generationConfig).toHaveProperty("thinkingLevel", "low");
            expect(args.generationConfig).toHaveProperty("thinkingBudget", 1000);
        });

        test("should include both thinkingLevel and thinkingBudget in ragQuery", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "gemini-2.5-flash",
                        temperature: 0.7,
                        maxTokensPerRequest: 2048,
                        thinkingLevel: "high",
                        thinkingBudget: 8000,
                    },
                }),
            });

            mockGenerateContent.mockResolvedValue(
                createMockResponse("Answer to the question", 100),
            );

            await aiService.ragQuery("user-123", {
                query: "What is this?",
                context: "Some context",
            });

            const args = getMockCallArgs(0);
            expect(args.generationConfig).toHaveProperty("thinkingLevel", "high");
            expect(args.generationConfig).toHaveProperty("thinkingBudget", 8000);
        });
    });

    describe("getConfig", () => {
        test("should return default config when no config exists", async () => {
            mockDocGet.mockResolvedValue({
                exists: false,
                data: () => undefined,
            });

            const config = await aiService.getConfig();

            expect(config.model).toBe("gemini-3.5-flash");
            expect(config.maxTokensPerRequest).toBe(2048);
            expect(config.temperature).toBe(1.0);
            expect(config.systemPrompts.summarize).toContain("summarizes text content");
        });

        test("should merge partial config with defaults", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: "custom-model",
                        // Missing other fields
                    },
                }),
            });

            const config = await aiService.getConfig();

            expect(config.model).toBe("custom-model");
            expect(config.maxTokensPerRequest).toBe(2048); // default
            expect(config.temperature).toBe(1.0); // default
        });

        test("should use defaults when ai config exists but fields are undefined", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    ai: {
                        model: undefined,
                        maxTokensPerRequest: undefined,
                        temperature: undefined,
                        systemPrompts: {
                            summarize: undefined,
                            autoTag: undefined,
                            flashcards: undefined,
                            ragQuery: undefined,
                        },
                    },
                }),
            });

            const config = await aiService.getConfig();

            expect(config.model).toBe("gemini-3.5-flash");
            expect(config.maxTokensPerRequest).toBe(2048);
            expect(config.temperature).toBe(1.0);
            expect(config.systemPrompts.summarize).toContain("summarizes text content");
            expect(config.systemPrompts.autoTag).toContain("generates relevant tags");
            expect(config.systemPrompts.flashcards).toContain("educational flashcards");
            expect(config.systemPrompts.ragQuery).toContain("answers questions");
        });

        test("should handle config with no ai key", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    otherConfig: "value",
                }),
            });

            const config = await aiService.getConfig();

            expect(config.model).toBe("gemini-3.5-flash");
            expect(config.maxTokensPerRequest).toBe(2048);
            expect(config.temperature).toBe(1.0);
        });
    });

    describe("error handling", () => {
        test("should re-throw AppError from autoTag", async () => {
            // First call succeeds to get config, second fails
            mockGenerateContent.mockRejectedValue(new Error("Test error"));

            await expect(
                aiService.autoTag("user-123", { title: "Test", content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                statusCode: 502,
                message: expect.stringContaining("Auto-tagging failed"),
            });
        });

        test("should re-throw AppError from generateFlashcards", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Test error"));

            await expect(
                aiService.generateFlashcards("user-123", {
                    title: "Test",
                    content: "Content",
                }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                statusCode: 502,
                message: expect.stringContaining("Flashcard generation failed"),
            });
        });

        test("should re-throw AppError from ragQuery", async () => {
            mockGenerateContent.mockRejectedValue(new Error("Test error"));

            await expect(
                aiService.ragQuery("user-123", { query: "Test", context: "Context" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                statusCode: 502,
                message: expect.stringContaining("RAG query failed"),
            });
        });

        test("should handle non-Error thrown objects", async () => {
            mockGenerateContent.mockRejectedValue("String error");

            await expect(
                aiService.summarize("user-123", { content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
            });
        });

        test("should handle non-Error thrown objects in autoTag", async () => {
            mockGenerateContent.mockRejectedValue("String error from autoTag");

            await expect(
                aiService.autoTag("user-123", { title: "Test", content: "Content" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                message: expect.stringContaining("Auto-tagging failed"),
            });
        });

        test("should handle non-Error thrown objects in generateFlashcards", async () => {
            mockGenerateContent.mockRejectedValue("String error from flashcards");

            await expect(
                aiService.generateFlashcards("user-123", {
                    title: "Test",
                    content: "Content",
                }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                message: expect.stringContaining("Flashcard generation failed"),
            });
        });

        test("should handle non-Error thrown objects in ragQuery", async () => {
            mockGenerateContent.mockRejectedValue("String error from ragQuery");

            await expect(
                aiService.ragQuery("user-123", { query: "Test", context: "Context" }),
            ).rejects.toMatchObject({
                code: "AI_API_ERROR",
                message: expect.stringContaining("RAG query failed"),
            });
        });
    });

    describe("executeWithRetry", () => {
        test("should handle string errors in retry logic", async () => {
            // Access the method through the service instance
            const service = new AIService();

            await expect(
                service.executeWithRetry(() => {
                    return Promise.reject(new Error("string error wrapper"));
                }, "test"),
            ).rejects.toBeDefined();
        });

        test("should respect max retries", async () => {
            let attempts = 0;
            const service = new AIService();

            await expect(
                service.executeWithRetry(() => {
                    attempts++;
                    return Promise.reject(new Error("Always fails"));
                }, "test"),
            ).rejects.toThrow("Always fails");

            expect(attempts).toBe(3); // maxRetries = 3
        });
    });

    describe("isNonRetryableError", () => {
        test("should identify non-retryable errors correctly", () => {
            const service = new AIService();

            expect(
                service.isNonRetryableError(new Error("Invalid API key provided")),
            ).toBe(true);
            expect(
                service.isNonRetryableError(
                    new Error("Permission denied for resource"),
                ),
            ).toBe(true);
            expect(
                service.isNonRetryableError(new Error("Quota exceeded for today")),
            ).toBe(true);
            expect(
                service.isNonRetryableError(new Error("Invalid argument: bad input")),
            ).toBe(true);
            expect(service.isNonRetryableError(new Error("Network timeout"))).toBe(
                false,
            );
            expect(service.isNonRetryableError(new Error("Server error"))).toBe(false);
        });
    });

    describe("AIService class instantiation", () => {
        test("should create new instance", () => {
            const service = new AIService();
            expect(service).toBeInstanceOf(AIService);
        });

        test("singleton instance should be available", () => {
            expect(aiService).toBeInstanceOf(AIService);
        });
    });

    describe("logging failures", () => {
        test("should not fail operation if logging fails", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));
            mockDocSet.mockRejectedValue(new Error("Logging failed"));

            // Should still return the result even though logging failed
            const result = await aiService.summarize("user-123", {
                content: "Content",
            });

            expect(result.summary).toBe("Summary");
        });

        test("should handle non-Error objects in logging failure", async () => {
            mockGenerateContent.mockResolvedValue(createMockResponse("Summary", 100));
            mockDocSet.mockRejectedValue("String error in logging");

            // Should still return the result even though logging failed with non-Error
            const result = await aiService.summarize("user-123", {
                content: "Content",
            });

            expect(result.summary).toBe("Summary");
        });
    });
});
