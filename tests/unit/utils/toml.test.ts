/**
 * TOML Utility Tests
 */

import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock fs module
const mockReadFileSync = jest.fn<(path: string, encoding: string) => string>();

jest.unstable_mockModule("fs", () => ({
    readFileSync: mockReadFileSync,
}));

// Mock logger
jest.unstable_mockModule("@/utils/logger.js", () => ({
    logInfo: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

// Import after mocks
const {
    loadToml,
    loadPromptsConfig,
    getPromptInstructions,
    getDefaultAIConfig,
    clearConfigCache,
    reloadConfig,
} = await import("@/utils/toml.js");

// Sample TOML content
const SAMPLE_TOML = `
[metadata]
version = "1.0.0"
description = "Test prompts"
last_updated = "2026-01-27"

[prompts.summarize]
role = "assistant"
task = "summarize"
instructions = "You are a helpful assistant that summarizes text content."

[prompts.autoTag]
role = "assistant"
task = "tag"
instructions = "You are a helpful assistant that generates relevant tags for content."

[prompts.flashcards]
role = "assistant"
task = "flashcards"
instructions = "You are a helpful assistant that creates educational flashcards."

[prompts.ragQuery]
role = "assistant"
task = "rag"
instructions = "You are a helpful assistant that answers questions based on provided context."

[defaults]
temperature = 1.0
max_tokens = 2048
model = "gemini-flash-lite-latest"
`;

describe("TOML Utility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearConfigCache();
    });

    afterEach(() => {
        clearConfigCache();
    });

    describe("loadToml", () => {
        test("should load and parse TOML file", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const result = loadToml<{ metadata: { version: string } }>("prompts.toml");

            expect(result.metadata.version).toBe("1.0.0");
            expect(mockReadFileSync).toHaveBeenCalledWith(
                expect.stringContaining("prompts.toml"),
                "utf-8",
            );
        });

        test("should cache loaded configuration", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            // First load
            loadToml("prompts.toml");
            // Second load (should use cache)
            loadToml("prompts.toml");

            // Should only read file once
            expect(mockReadFileSync).toHaveBeenCalledTimes(1);
        });

        test("should throw error when file cannot be read", () => {
            mockReadFileSync.mockImplementation(() => {
                throw new Error("File not found");
            });

            expect(() => loadToml("nonexistent.toml")).toThrow(
                "Failed to load TOML config nonexistent.toml: File not found",
            );
        });

        test("should throw error for invalid TOML syntax", () => {
            mockReadFileSync.mockReturnValue("invalid toml [[[");

            expect(() => loadToml("invalid.toml")).toThrow(
                "Failed to load TOML config invalid.toml",
            );
        });
    });

    describe("loadPromptsConfig", () => {
        test("should load prompts configuration", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const config = loadPromptsConfig();

            expect(config.metadata.version).toBe("1.0.0");
            expect(config.prompts.summarize.instructions).toContain(
                "summarizes text content",
            );
            expect(config.defaults.temperature).toBe(1.0);
        });
    });

    describe("getPromptInstructions", () => {
        test("should return summarize instructions", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const instructions = getPromptInstructions("summarize");

            expect(instructions).toContain("summarizes text content");
        });

        test("should return autoTag instructions", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const instructions = getPromptInstructions("autoTag");

            expect(instructions).toContain("generates relevant tags");
        });

        test("should return flashcards instructions", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const instructions = getPromptInstructions("flashcards");

            expect(instructions).toContain("educational flashcards");
        });

        test("should return ragQuery instructions", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const instructions = getPromptInstructions("ragQuery");

            expect(instructions).toContain("answers questions");
        });
    });

    describe("getDefaultAIConfig", () => {
        test("should return default AI configuration", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            const config = getDefaultAIConfig();

            expect(config.temperature).toBe(1.0);
            expect(config.maxTokens).toBe(2048);
            expect(config.model).toBe("gemini-flash-lite-latest");
        });
    });

    describe("clearConfigCache", () => {
        test("should clear the configuration cache", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            // Load to populate cache
            loadToml("prompts.toml");
            expect(mockReadFileSync).toHaveBeenCalledTimes(1);

            // Clear cache
            clearConfigCache();

            // Load again (should read file again)
            loadToml("prompts.toml");
            expect(mockReadFileSync).toHaveBeenCalledTimes(2);
        });
    });

    describe("reloadConfig", () => {
        test("should reload configuration from file", () => {
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);

            // Initial load
            loadToml("prompts.toml");
            expect(mockReadFileSync).toHaveBeenCalledTimes(1);

            // Reload
            const result = reloadConfig<{ metadata: { version: string } }>(
                "prompts.toml",
            );

            expect(mockReadFileSync).toHaveBeenCalledTimes(2);
            expect(result.metadata.version).toBe("1.0.0");
        });

        test("should update cached value after reload", () => {
            // First load with v1
            mockReadFileSync.mockReturnValue(SAMPLE_TOML);
            const first = loadToml<{ metadata: { version: string } }>("prompts.toml");
            expect(first.metadata.version).toBe("1.0.0");

            // Update mock to return different version
            const updatedToml = SAMPLE_TOML.replace(
                'version = "1.0.0"',
                'version = "2.0.0"',
            );
            mockReadFileSync.mockReturnValue(updatedToml);

            // Reload
            const second = reloadConfig<{ metadata: { version: string } }>(
                "prompts.toml",
            );
            expect(second.metadata.version).toBe("2.0.0");

            // Subsequent load should use new cached value
            const third = loadToml<{ metadata: { version: string } }>("prompts.toml");
            expect(third.metadata.version).toBe("2.0.0");
        });
    });
});
