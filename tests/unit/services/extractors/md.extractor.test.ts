/**
 * MD Extractor Tests
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
let extractMd: typeof import("@/services/extractors/md.extractor.js").extractMd;

describe("MD Extractor", () => {
    beforeAll(async () => {
        const mod = await import("@/services/extractors/md.extractor.js");
        extractMd = mod.extractMd;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("extractMd", () => {
        test("should extract text from markdown buffer", () => {
            const content = "# Hello World\n\nThis is a **bold** paragraph.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.text).toBe(content);
            expect(result.lineCount).toBe(3);
            expect(result.encoding).toBe("utf-8");
        });

        test("should detect ATX-style heading as title", () => {
            const content = "# My Document Title\n\nSome content here.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.hasTitle).toBe(true);
            expect(result.extractedTitle).toBe("My Document Title");
        });

        test("should detect h2 ATX-style heading as title", () => {
            const content = "## Section Title\n\nContent.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            // Should not match h2 as title (only h1)
            expect(result.hasTitle).toBe(false);
        });

        test("should detect Setext-style heading as title", () => {
            const content = "My Document Title\n================\n\nSome content here.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.hasTitle).toBe(true);
            expect(result.extractedTitle).toBe("My Document Title");
        });

        test("should handle markdown without heading", () => {
            const content = "This is just a paragraph.\n\nAnother paragraph.";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.hasTitle).toBe(false);
            expect(result.extractedTitle).toBeUndefined();
        });

        test("should handle empty markdown file", () => {
            const buffer = Buffer.from("", "utf-8");

            const result = extractMd(buffer);

            expect(result.text).toBe("");
            expect(result.lineCount).toBe(1);
            expect(result.hasTitle).toBe(false);
        });

        test("should preserve markdown formatting", () => {
            const content = `# Title

- List item 1
- List item 2

\`\`\`javascript
const code = "block";
\`\`\`

> Blockquote

| Table | Header |
|-------|--------|
| Cell  | Cell   |`;
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.text).toBe(content);
            expect(result.text).toContain("```javascript");
            expect(result.text).toContain("| Table | Header |");
        });

        test("should handle different line endings - CRLF", () => {
            const content = "# Title\r\n\r\nContent";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.lineCount).toBe(3);
        });

        test("should handle heading with extra spaces", () => {
            const content = "#   Title with spaces   \n\nContent";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.hasTitle).toBe(true);
            expect(result.extractedTitle).toBe("Title with spaces");
        });

        test("should use custom encoding when specified", () => {
            const content = "# Test\n\nContent";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer, { encoding: "utf-8" });

            expect(result.encoding).toBe("utf-8");
        });

        test("should handle unicode in markdown", () => {
            const content = "# 你好世界\n\nChinese content 中文";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.extractedTitle).toBe("你好世界");
            expect(result.text).toContain("中文");
        });

        test("should handle markdown with only title", () => {
            const content = "# Just a Title";
            const buffer = Buffer.from(content, "utf-8");

            const result = extractMd(buffer);

            expect(result.hasTitle).toBe(true);
            expect(result.extractedTitle).toBe("Just a Title");
            expect(result.lineCount).toBe(1);
        });

        test("should throw AppError when buffer.toString throws", () => {
            const buffer = Buffer.from("test");

            jest.spyOn(buffer, "toString").mockImplementation(() => {
                throw new Error("Encoding error");
            });

            expect(() => extractMd(buffer)).toThrow();

            try {
                extractMd(buffer);
            } catch (error) {
                expect(error).toMatchObject({
                    code: "EXTRACTION_FAILED",
                    statusCode: 500,
                    message: expect.stringContaining("Encoding error"),
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

            expect(() => extractMd(buffer)).toThrow();

            try {
                extractMd(buffer);
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
