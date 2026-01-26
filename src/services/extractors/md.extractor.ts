/**
 * Markdown Extractor
 *
 * Extracts text content from Markdown files
 * Preserves markdown formatting as it's stored as-is in notes
 */

import { logDebug, logError } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";

/**
 * Markdown extraction options
 */
export interface MdExtractionOptions {
    /** Character encoding (default: utf-8) */
    encoding?: BufferEncoding;
}

/**
 * Markdown extraction result
 */
export interface MdExtractionResult {
    text: string;
    lineCount: number;
    encoding: BufferEncoding;
    hasTitle: boolean;
    /** Extracted title from first heading (if present) */
    extractedTitle?: string;
}

/**
 * Extract text content from a Markdown file buffer
 *
 * @param buffer - Markdown file buffer
 * @param options - Extraction options
 * @returns Extracted text and metadata
 * @throws AppError if extraction fails
 */
export function extractMd(
    buffer: Buffer,
    options: MdExtractionOptions = {},
): MdExtractionResult {
    try {
        const encoding = options.encoding ?? "utf-8";

        logDebug("Starting MD extraction", {
            bufferSize: buffer.length,
            encoding,
        });

        const text = buffer.toString(encoding);
        const lines = text.split(/\r\n|\r|\n/);
        const lineCount = lines.length;

        // Try to extract title from first heading (# Title or Title\n===)
        let extractedTitle: string | undefined;
        let hasTitle = false;

        // Check for ATX-style heading (# Title)
        const atxMatch = /^#\s+(.+)$/m.exec(text);
        if (atxMatch?.[1]) {
            extractedTitle = atxMatch[1].trim();
            hasTitle = true;
        } else {
            // Check for Setext-style heading (Title\n===)
            const setextMatch = /^(.+)\n=+$/m.exec(text);
            if (setextMatch?.[1]) {
                extractedTitle = setextMatch[1].trim();
                hasTitle = true;
            }
        }

        const result: MdExtractionResult = {
            text,
            lineCount,
            encoding,
            hasTitle,
            extractedTitle,
        };

        logDebug("MD extraction completed", {
            textLength: result.text.length,
            lineCount: result.lineCount,
            hasTitle: result.hasTitle,
        });

        return result;
    } catch (error) {
        logError(
            "MD extraction failed",
            error instanceof Error ? error : new Error(String(error)),
            { bufferSize: buffer.length },
        );

        throw new AppError(
            "EXTRACTION_FAILED",
            500,
            `Failed to extract text from Markdown file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}
