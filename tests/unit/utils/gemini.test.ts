/**
 * Gemini Client Utility Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";

// Mock the Google Generative AI module
const mockGetGenerativeModel = jest.fn();
const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
}));

jest.unstable_mockModule("@google/generative-ai", () => ({
    __esModule: true,
    GoogleGenerativeAI: MockGoogleGenerativeAI,
}));

// Mock logger
jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe("Gemini Client Utility", () => {
    let getGeminiClient: typeof import("@/utils/gemini.js").getGeminiClient;
    let getGenerativeModel: typeof import("@/utils/gemini.js").getGenerativeModel;
    let resetGeminiClient: typeof import("@/utils/gemini.js").resetGeminiClient;
    let isGeminiConfigured: typeof import("@/utils/gemini.js").isGeminiConfigured;
    let DEFAULT_MODEL: string;
    let DEFAULT_MAX_TOKENS: number;
    let DEFAULT_TEMPERATURE: number;

    beforeEach(async () => {
        // Reset mocks
        jest.clearAllMocks();
        MockGoogleGenerativeAI.mockClear();

        // Reset module cache to get fresh imports
        jest.resetModules();

        // Re-import the module
        const mod = await import("@/utils/gemini.js");
        getGeminiClient = mod.getGeminiClient;
        getGenerativeModel = mod.getGenerativeModel;
        resetGeminiClient = mod.resetGeminiClient;
        isGeminiConfigured = mod.isGeminiConfigured;
        DEFAULT_MODEL = mod.DEFAULT_MODEL;
        DEFAULT_MAX_TOKENS = mod.DEFAULT_MAX_TOKENS;
        DEFAULT_TEMPERATURE = mod.DEFAULT_TEMPERATURE;
    });

    describe("getGeminiClient", () => {
        test("should create client with API key", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";

            const client = getGeminiClient();

            expect(client).toBeDefined();
            expect(MockGoogleGenerativeAI).toHaveBeenCalledWith("test-api-key");
        });

        test("should return same client instance on subsequent calls", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";

            const client1 = getGeminiClient();
            const client2 = getGeminiClient();

            expect(client1).toBe(client2);
            expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(1);
        });

        test("should throw error when API key is not set", () => {
            delete process.env["GEMINI_API_KEY"];
            resetGeminiClient();

            expect(() => getGeminiClient()).toThrow(
                "GEMINI_API_KEY environment variable is not set",
            );
        });
    });

    describe("getGenerativeModel", () => {
        test("should return model with default name", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";
            resetGeminiClient();
            const mockModel = { generateContent: jest.fn() };
            mockGetGenerativeModel.mockReturnValue(mockModel);

            const model = getGenerativeModel();

            expect(mockGetGenerativeModel).toHaveBeenCalledWith({
                model: DEFAULT_MODEL,
            });
            expect(model).toBe(mockModel);
        });

        test("should return model with custom name", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";
            resetGeminiClient();
            const mockModel = { generateContent: jest.fn() };
            mockGetGenerativeModel.mockReturnValue(mockModel);

            const model = getGenerativeModel("custom-model");

            expect(mockGetGenerativeModel).toHaveBeenCalledWith({
                model: "custom-model",
            });
            expect(model).toBe(mockModel);
        });
    });

    describe("resetGeminiClient", () => {
        test("should reset client so new instance is created", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";

            getGeminiClient();
            resetGeminiClient();
            getGeminiClient();

            expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(2);
        });
    });

    describe("isGeminiConfigured", () => {
        test("should return true when API key is set", () => {
            process.env["GEMINI_API_KEY"] = "test-api-key";

            expect(isGeminiConfigured()).toBe(true);
        });

        test("should return false when API key is not set", () => {
            delete process.env["GEMINI_API_KEY"];

            expect(isGeminiConfigured()).toBe(false);
        });
    });

    describe("constants", () => {
        test("should export DEFAULT_MODEL", () => {
            expect(DEFAULT_MODEL).toBe("gemini-flash-lite-latest");
        });

        test("should export DEFAULT_MAX_TOKENS", () => {
            expect(DEFAULT_MAX_TOKENS).toBe(2048);
        });

        test("should export DEFAULT_TEMPERATURE", () => {
            expect(DEFAULT_TEMPERATURE).toBe(1);
        });
    });
});
