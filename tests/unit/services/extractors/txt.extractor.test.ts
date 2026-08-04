/**
 * TXT Extractor Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock firebase-functions/v2 logger
jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import module dynamically after mocking
let extractTxt: typeof import("@/services/extractors/txt.extractor.js").extractTxt;

describe("TXT Extractor", () => {
    beforeAll(async () => {
        const mod = await import("@/services/extractors/txt.extractor.js");
        extractTxt = mod.extractTxt;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("extractTxt", () => {
        test("should extract text from buffer with default encoding", () => {
            const content = "Hello, World!\nThis is a test file.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.text).toBe(content);
            expect(result.lineCount).toBe(2);
            expect(result.encoding).toBe("utf-8");
        });

        test("should handle different line endings - LF", () => {
            const content = "Line 1\nLine 2\nLine 3";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.lineCount).toBe(3);
        });

        test("should handle different line endings - CRLF", () => {
            const content = "Line 1\r\nLine 2\r\nLine 3";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.lineCount).toBe(3);
        });

        test("should handle different line endings - CR", () => {
            const content = "Line 1\rLine 2\rLine 3";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.lineCount).toBe(3);
        });

        test("should handle empty file", () => {
            const buffer = Buffer.from("", "utf-8");

            const result = extractTxt(buffer);

            expect(result.text).toBe("");
            expect(result.lineCount).toBe(1); // Empty string splits to one empty element
        });

        test("should handle file with single line", () => {
            const content = "Single line without newline";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.text).toBe(content);
            expect(result.lineCount).toBe(1);
        });

        test("should use custom encoding when specified", () => {
            const content = "Test content";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer, { encoding: "utf-8" });

            expect(result.text).toBe(content);
            expect(result.encoding).toBe("utf-8");
        });

        test("should handle unicode content", () => {
            const content = "Hello, 世界! 🌍\nEmojis and special chars: àéïöü";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.text).toBe(content);
            expect(result.lineCount).toBe(2);
        });

        test("should handle large file", () => {
            const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
            const content = lines.join("\n");
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.lineCount).toBe(1000);
            expect(result.text).toContain("Line 1");
            expect(result.text).toContain("Line 1000");
        });

        test("should handle file with only whitespace", () => {
            const content = "   \n\t\n   ";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractTxt(buffer);

            expect(result.text).toBe(content);
            expect(result.lineCount).toBe(3);
        });

        test("should throw AppError when buffer.toString throws", () => {
            // Create a buffer that will throw when toString is called
            const buffer = Buffer.from("test");
            const originalToString = buffer.toString.bind(buffer);

            // Mock toString to throw on first call
            let callCount = 0;
            jest.spyOn(buffer, "toString").mockImplementation((...args) => {
                callCount++;
                if (callCount === 1) {
                    throw new Error("Encoding error");
                }
                return originalToString(...args);
            });

            expect(() => extractTxt(buffer)).toThrow();

            try {
                extractTxt(buffer);
            } catch (error) {
                expect(error).toMatchObject({
                    code: "EXTRACTION_FAILED",
                    statusCode: 500,
                });
            }
        });

        test("should handle non-Error exception in catch block", () => {
            const buffer = Buffer.from("test");

            // Throw a non-Error value to cover the branch where error is not an Error instance
            jest.spyOn(buffer, "toString").mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw "String error";
            });

            expect(() => extractTxt(buffer)).toThrow();

            try {
                extractTxt(buffer);
            } catch (error) {
                expect(error).toMatchObject({
                    code: "EXTRACTION_FAILED",
                    statusCode: 500,
                    message: expect.stringContaining("Unknown error"),
                });
            }
        });
    });
});
