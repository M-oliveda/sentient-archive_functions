/**
 * PDF Extractor Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Type for pdf-parse result
interface PdfParseResult {
    text: string;
    numpages: number;
    info?: Record<string, string>;
}

// Mock pdf-parse before importing the module
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
let extractPdf: typeof import("@/services/extractors/pdf.extractor.js").extractPdf;

describe("PDF Extractor", () => {
    beforeAll(async () => {
        const mod = await import("@/services/extractors/pdf.extractor.js");
        extractPdf = mod.extractPdf;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("extractPdf", () => {
        test("should extract text from PDF buffer", async () => {
            const mockBuffer = Buffer.from("fake pdf content");
            const mockPdfData = {
                text: "This is the extracted text from the PDF.",
                numpages: 5,
                info: {
                    Title: "Test Document",
                    Author: "Test Author",
                    Subject: "Test Subject",
                    Creator: "Test Creator",
                },
            };

            mockPdfParse.mockResolvedValue(mockPdfData);

            const result = await extractPdf(mockBuffer);

            expect(result.text).toBe("This is the extracted text from the PDF.");
            expect(result.pageCount).toBe(5);
            expect(result.info?.title).toBe("Test Document");
            expect(result.info?.author).toBe("Test Author");
            expect(result.info?.subject).toBe("Test Subject");
            expect(result.info?.creator).toBe("Test Creator");
            expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer, {});
        });

        test("should respect maxPages option", async () => {
            const mockBuffer = Buffer.from("fake pdf content");
            const mockPdfData = {
                text: "Page 1 content",
                numpages: 1,
                info: {},
            };

            mockPdfParse.mockResolvedValue(mockPdfData);

            const result = await extractPdf(mockBuffer, { maxPages: 1 });

            expect(result.pageCount).toBe(1);
            expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer, { max: 1 });
        });

        test("should handle PDF without metadata", async () => {
            const mockBuffer = Buffer.from("fake pdf content");
            const mockPdfData = {
                text: "Simple text content",
                numpages: 1,
                info: undefined,
            };

            mockPdfParse.mockResolvedValue(mockPdfData);

            const result = await extractPdf(mockBuffer);

            expect(result.text).toBe("Simple text content");
            expect(result.pageCount).toBe(1);
            expect(result.info?.title).toBeUndefined();
        });

        test("should throw AppError on extraction failure", async () => {
            const mockBuffer = Buffer.from("invalid pdf content");
            const error = new Error("Invalid PDF structure");

            mockPdfParse.mockRejectedValue(error);

            await expect(extractPdf(mockBuffer)).rejects.toMatchObject({
                code: "EXTRACTION_FAILED",
                statusCode: 500,
                message: expect.stringContaining("Invalid PDF structure"),
            });
        });

        test("should handle non-Error rejection", async () => {
            const mockBuffer = Buffer.from("invalid pdf content");

            mockPdfParse.mockRejectedValue("String error");

            await expect(extractPdf(mockBuffer)).rejects.toMatchObject({
                code: "EXTRACTION_FAILED",
                statusCode: 500,
            });
        });

        test("should handle empty PDF", async () => {
            const mockBuffer = Buffer.from("empty pdf");
            const mockPdfData = {
                text: "",
                numpages: 0,
                info: {},
            };

            mockPdfParse.mockResolvedValue(mockPdfData);

            const result = await extractPdf(mockBuffer);

            expect(result.text).toBe("");
            expect(result.pageCount).toBe(0);
        });
    });
});
