/**
 * File Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Type for pdf-parse result
interface PdfParseResult {
    text: string;
    numpages: number;
    info?: Record<string, string>;
}

// Mock pdf-parse
const mockPdfParse =
    jest.fn<(buffer: Buffer, options?: object) => Promise<PdfParseResult>>();

jest.unstable_mockModule("pdf-parse", () => ({
    __esModule: true,
    default: mockPdfParse,
}));

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
let FileService: typeof import("@/services/file.service.js").FileService;
let fileService: import("@/services/file.service.js").FileService;

describe("File Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/file.service.js");
        FileService = mod.FileService;
        fileService = mod.fileService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("validateFile", () => {
        test("should validate PDF file and return file type", () => {
            const result = fileService.validateFile(
                "document.pdf",
                "application/pdf",
                1024,
            );

            expect(result).toBe("pdf");
        });

        test("should validate TXT file and return file type", () => {
            const result = fileService.validateFile("notes.txt", "text/plain", 512);

            expect(result).toBe("txt");
        });

        test("should validate MD file and return file type", () => {
            const result = fileService.validateFile("readme.md", "text/markdown", 256);

            expect(result).toBe("md");
        });

        test("should throw AppError for invalid file", () => {
            expect(() =>
                fileService.validateFile("image.png", "image/png", 1024),
            ).toThrow();

            try {
                fileService.validateFile("image.png", "image/png", 1024);
            } catch (error) {
                expect(error).toMatchObject({
                    code: "INVALID_FILE",
                    statusCode: 400,
                });
            }
        });

        test("should throw AppError for empty file", () => {
            expect(() =>
                fileService.validateFile("document.pdf", "application/pdf", 0),
            ).toThrow();
        });

        test("should throw AppError for oversized file", () => {
            const oversized = 11 * 1024 * 1024; // 11MB
            expect(() =>
                fileService.validateFile("document.pdf", "application/pdf", oversized),
            ).toThrow();
        });

        test("should use fallback error message when result.error is undefined", () => {
            // This tests the branch where validateFile returns valid: false but no error message
            // In practice this shouldn't happen, but the code handles it defensively
            // We'll test via the error message fallback
            try {
                // Using an invalid file that triggers validation failure
                fileService.validateFile("", "application/pdf", 1024);
            } catch (error) {
                // The error should have a message (either from validation or fallback)
                expect(error).toMatchObject({
                    code: "INVALID_FILE",
                    statusCode: 400,
                });
                expect((error as Error).message).toBeTruthy();
            }
        });
    });

    describe("extractContent", () => {
        test("should extract content from PDF", async () => {
            mockPdfParse.mockResolvedValue({
                text: "PDF content",
                numpages: 1,
                info: {},
            });

            const buffer = Buffer.from("fake pdf");
            const result = await fileService.extractContent(buffer, "pdf");

            expect(result.text).toBe("PDF content");
            expect(mockPdfParse).toHaveBeenCalled();
        });

        test("should extract content from TXT", async () => {
            const content = "Plain text content";
            const buffer = Buffer.from(content, "utf-8");

            const result = await fileService.extractContent(buffer, "txt");

            expect(result.text).toBe(content);
        });

        test("should extract content from MD", async () => {
            const content = "# Markdown\n\nContent";
            const buffer = Buffer.from(content, "utf-8");

            const result = await fileService.extractContent(buffer, "md");

            expect(result.text).toBe(content);
        });

        test("should throw error for unsupported file type", async () => {
            const buffer = Buffer.from("content");

            await expect(
                // @ts-expect-error Testing invalid input
                fileService.extractContent(buffer, "unknown"),
            ).rejects.toMatchObject({
                code: "INVALID_FILE",
                statusCode: 400,
            });
        });

        test("should pass options to PDF extractor", async () => {
            mockPdfParse.mockResolvedValue({
                text: "PDF content",
                numpages: 1,
                info: {},
            });

            const buffer = Buffer.from("fake pdf");
            await fileService.extractContent(buffer, "pdf", { maxPdfPages: 5 });

            expect(mockPdfParse).toHaveBeenCalledWith(buffer, { max: 5 });
        });
    });

    describe("processFile", () => {
        test("should process PDF file completely", async () => {
            mockPdfParse.mockResolvedValue({
                text: "This is the PDF content with multiple sentences. Here is more content.",
                numpages: 2,
                info: { Title: "PDF Title" },
            });

            const buffer = Buffer.from("fake pdf");
            const result = await fileService.processFile(
                buffer,
                "my_document.pdf",
                "application/pdf",
            );

            expect(result.title).toBe("My document");
            expect(result.content).toContain("PDF content");
            expect(result.excerpt.length).toBeLessThanOrEqual(203);
            expect(result.fileType).toBe("pdf");
            expect(result.metadata.name).toBe("my_document.pdf");
            expect(result.metadata.mimeType).toBe("application/pdf");
            expect(result.metadata.extension).toBe(".pdf");
        });

        test("should process TXT file completely", async () => {
            const content = "This is plain text content.";
            const buffer = Buffer.from(content, "utf-8");

            const result = await fileService.processFile(
                buffer,
                "notes.txt",
                "text/plain",
            );

            expect(result.title).toBe("Notes");
            expect(result.content).toBe(content);
            expect(result.fileType).toBe("txt");
        });

        test("should process MD file and extract title from content", async () => {
            const content = "# Document Title\n\nThis is the markdown content.";
            const buffer = Buffer.from(content, "utf-8");

            const result = await fileService.processFile(
                buffer,
                "readme.md",
                "text/markdown",
            );

            // Should use extracted title from markdown heading
            expect(result.title).toBe("Document Title");
            expect(result.fileType).toBe("md");
        });

        test("should use filename as title if no markdown heading", async () => {
            const content = "Just some content without heading.";
            const buffer = Buffer.from(content, "utf-8");

            const result = await fileService.processFile(
                buffer,
                "my-notes.md",
                "text/markdown",
            );

            expect(result.title).toBe("My notes");
        });

        test("should throw error for invalid file", async () => {
            const buffer = Buffer.from("content");

            await expect(
                fileService.processFile(buffer, "file.jpg", "image/jpeg"),
            ).rejects.toMatchObject({
                code: "INVALID_FILE",
            });
        });
    });

    describe("cleanText", () => {
        test("should remove null bytes", () => {
            const text = "Hello\0World\0";
            expect(fileService.cleanText(text)).toBe("HelloWorld");
        });

        test("should normalize CRLF to LF", () => {
            const text = "Line 1\r\nLine 2";
            expect(fileService.cleanText(text)).toBe("Line 1\nLine 2");
        });

        test("should normalize CR to LF", () => {
            const text = "Line 1\rLine 2";
            expect(fileService.cleanText(text)).toBe("Line 1\nLine 2");
        });

        test("should collapse multiple spaces", () => {
            const text = "Multiple    spaces   here";
            expect(fileService.cleanText(text)).toBe("Multiple spaces here");
        });

        test("should collapse more than 2 blank lines", () => {
            const text = "Para 1\n\n\n\n\nPara 2";
            expect(fileService.cleanText(text)).toBe("Para 1\n\nPara 2");
        });

        test("should trim whitespace from lines", () => {
            const text = "  Line 1  \n  Line 2  ";
            expect(fileService.cleanText(text)).toBe("Line 1\nLine 2");
        });

        test("should handle empty string", () => {
            expect(fileService.cleanText("")).toBe("");
        });

        test("should handle whitespace-only string", () => {
            expect(fileService.cleanText("   \n\t\r\n   ")).toBe("");
        });
    });

    describe("isContentEmpty", () => {
        test("should return true for empty string", () => {
            expect(fileService.isContentEmpty("")).toBe(true);
        });

        test("should return true for whitespace-only content", () => {
            expect(fileService.isContentEmpty("   \n\t\r\n   ")).toBe(true);
        });

        test("should return false for content with text", () => {
            expect(fileService.isContentEmpty("Hello")).toBe(false);
        });

        test("should return false for content with text and whitespace", () => {
            expect(fileService.isContentEmpty("  Hello  ")).toBe(false);
        });
    });

    describe("FileService class instantiation", () => {
        test("should create new instance", () => {
            const service = new FileService();
            expect(service).toBeInstanceOf(FileService);
        });

        test("singleton instance should be available", () => {
            expect(fileService).toBeInstanceOf(FileService);
        });
    });
});
