/**
 * TXT Extractor
 *
 * Extracts text content from plain text files
 */

import { logDebug, logError } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";

/**
 * TXT extraction options
 */
export interface TxtExtractionOptions {
    /** Character encoding (default: utf-8) */
    encoding?: BufferEncoding;
}

/**
 * TXT extraction result
 */
export interface TxtExtractionResult {
    text: string;
    lineCount: number;
    encoding: BufferEncoding;
}

/**
 * Extract text content from a plain text file buffer
 *
 * @param buffer - Text file buffer
 * @param options - Extraction options
 * @returns Extracted text and metadata
 * @throws AppError if extraction fails
 */
export function extractTxt(
    buffer: Buffer,
    options: TxtExtractionOptions = {},
): TxtExtractionResult {
    try {
        const encoding = options.encoding ?? "utf-8";

        logDebug("Starting TXT extraction", {
            bufferSize: buffer.length,
            encoding,
        });

        const text = buffer.toString(encoding);
        const lineCount = text.split(/\r\n|\r|\n/).length;

        const result: TxtExtractionResult = {
            text,
            lineCount,
            encoding,
        };

        logDebug("TXT extraction completed", {
            textLength: result.text.length,
            lineCount: result.lineCount,
        });

        return result;
    } catch (error) {
        logError(
            "TXT extraction failed",
            error instanceof Error ? error : new Error(String(error)),
            { bufferSize: buffer.length },
        );

        throw new AppError(
            "EXTRACTION_FAILED",
            500,
            `Failed to extract text from TXT file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}
