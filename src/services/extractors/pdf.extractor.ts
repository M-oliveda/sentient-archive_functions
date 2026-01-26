/**
 * PDF Extractor
 *
 * Extracts text content from PDF files using pdf-parse library
 */

import pdfParse from "pdf-parse";
import { logDebug, logError } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";
import { PdfExtractionOptions, PdfExtractionResult } from "@/types/file.js";

/**
 * Extract text content from a PDF buffer
 *
 * @param buffer - PDF file buffer
 * @param options - Extraction options
 * @returns Extracted text and metadata
 * @throws AppError if extraction fails
 */
export async function extractPdf(
    buffer: Buffer,
    options: PdfExtractionOptions = {},
): Promise<PdfExtractionResult> {
    try {
        logDebug("Starting PDF extraction", {
            bufferSize: buffer.length,
            maxPages: options.maxPages,
        });

        // Configure pdf-parse options
        const parseOptions: pdfParse.Options = {};

        if (options.maxPages) {
            parseOptions.max = options.maxPages;
        }

        const data = await pdfParse(buffer, parseOptions);
        const dataInfo = data.info as
            | {
                  Title?: string;
                  Author?: string;
                  Subject?: string;
                  Creator?: string;
              }
            | undefined;

        const result: PdfExtractionResult = {
            text: data.text,
            pageCount: data.numpages,
            info: dataInfo
                ? {
                      title: dataInfo.Title,
                      author: dataInfo.Author,
                      subject: dataInfo.Subject,
                      creator: dataInfo.Creator,
                  }
                : undefined,
        };

        logDebug("PDF extraction completed", {
            textLength: result.text.length,
            pageCount: result.pageCount,
        });

        return result;
    } catch (error) {
        logError(
            "PDF extraction failed",
            error instanceof Error ? error : new Error(String(error)),
            { bufferSize: buffer.length },
        );

        throw new AppError(
            "EXTRACTION_FAILED",
            500,
            `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}
