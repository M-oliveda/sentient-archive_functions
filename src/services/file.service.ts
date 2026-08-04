/**
 * File Service
 *
 * Orchestrates file content extraction from uploaded files
 * Uses extractors to process PDF, TXT, and MD files
 */

import { FileType, ExtractedContent, FileMetadata } from "@/types/file.js";
import { extractPdf, extractTxt, extractMd } from "./extractors/index.js";
import {
    validateFile,
    getFileExtension,
    generateTitleFromFilename,
    generateExcerpt,
} from "@/utils/fileValidation.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";

/**
 * File extraction options
 */
export interface FileExtractionOptions {
    /** Maximum pages to extract from PDF (default: all) */
    maxPdfPages?: number;
    /** Character encoding for text files (default: utf-8) */
    encoding?: BufferEncoding;
}

/**
 * Processed file result with cleaned content
 */
export interface ProcessedFile {
    /** Extracted and cleaned text content */
    content: string;
    /** Suggested title (from filename or content) */
    title: string;
    /** Short excerpt of the content */
    excerpt: string;
    /** File metadata */
    metadata: FileMetadata;
    /** Detected file type */
    fileType: FileType;
}

/**
 * File Service class
 * Handles file validation and content extraction
 */
export class FileService {
    /**
     * Validate a file before processing
     *
     * @param filename - The original filename
     * @param mimeType - The MIME type
     * @param sizeBytes - The file size in bytes
     * @returns The detected file type if valid
     * @throws AppError if validation fails
     */
    validateFile(filename: string, mimeType: string, sizeBytes: number): FileType {
        const result = validateFile(filename, mimeType, sizeBytes);

        if (!result.valid || !result.fileType) {
            throw new AppError(
                "INVALID_FILE",
                400,
                /* istanbul ignore next -- error is always set when valid is false */
                result.error ?? "File validation failed",
            );
        }

        return result.fileType;
    }

    /**
     * Extract content from a file buffer
     *
     * @param buffer - The file buffer
     * @param fileType - The file type (pdf, txt, md)
     * @param options - Extraction options
     * @returns Extracted content
     */
    async extractContent(
        buffer: Buffer,
        fileType: FileType,
        options: FileExtractionOptions = {},
    ): Promise<ExtractedContent> {
        logInfo("Extracting file content", {
            fileType,
            bufferSize: buffer.length,
        });

        let text: string;

        switch (fileType) {
            case "pdf": {
                const pdfResult = await extractPdf(buffer, {
                    maxPages: options.maxPdfPages,
                });
                text = pdfResult.text;
                break;
            }
            case "txt": {
                const txtResult = extractTxt(buffer, {
                    encoding: options.encoding,
                });
                text = txtResult.text;
                break;
            }
            case "md": {
                const mdResult = extractMd(buffer, {
                    encoding: options.encoding,
                });
                text = mdResult.text;
                break;
            }
            default: {
                // This should never happen if validation is done correctly
                const _exhaustiveCheck: never = fileType;
                throw new AppError(
                    "INVALID_FILE",
                    400,
                    `Unsupported file type: ${String(_exhaustiveCheck)}`,
                );
            }
        }

        // Metadata is set by caller
        return {
            text,
            metadata: {
                name: "",
                mimeType: "",
                size: buffer.length,
                extension: "",
            },
        };
    }

    /**
     * Process an uploaded file
     * Validates, extracts content, and prepares for note creation
     *
     * @param buffer - The file buffer
     * @param filename - The original filename
     * @param mimeType - The MIME type
     * @param options - Processing options
     * @returns Processed file ready for note creation
     */
    async processFile(
        buffer: Buffer,
        filename: string,
        mimeType: string,
        options: FileExtractionOptions = {},
    ): Promise<ProcessedFile> {
        // Validate file
        const fileType = this.validateFile(filename, mimeType, buffer.length);

        logInfo("Processing file", {
            filename,
            mimeType,
            fileType,
            size: buffer.length,
        });

        // Extract content
        const extracted = await this.extractContent(buffer, fileType, options);

        // Clean the extracted text
        const cleanedContent = this.cleanText(extracted.text);

        // Generate title
        let title = generateTitleFromFilename(filename);

        // For markdown, try to use extracted title if available
        if (fileType === "md") {
            const mdResult = extractMd(buffer, { encoding: options.encoding });
            if (mdResult.extractedTitle) {
                title = mdResult.extractedTitle;
            }
        }

        // Generate excerpt
        const excerpt = generateExcerpt(cleanedContent);

        // Build metadata
        const metadata: FileMetadata = {
            name: filename,
            mimeType,
            size: buffer.length,
            extension: getFileExtension(filename),
        };

        logEvent("file_extracted", {
            filename,
            fileType,
            size: buffer.length,
            contentLength: cleanedContent.length,
        });

        return {
            content: cleanedContent,
            title,
            excerpt,
            metadata,
            fileType,
        };
    }

    /**
     * Clean and sanitize extracted text
     *
     * @param text - The raw extracted text
     * @returns Cleaned text
     */
    cleanText(text: string): string {
        return (
            text
                // Remove null bytes
                .replace(/\0/g, "")
                // Normalize line endings
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                // Remove excessive whitespace (but preserve markdown formatting)
                .replace(/[ \t]+/g, " ")
                // Remove excessive blank lines (more than 2)
                .replace(/\n{3,}/g, "\n\n")
                // Trim leading/trailing whitespace from each line
                .split("\n")
                .map((line) => line.trim())
                .join("\n")
                // Trim overall
                .trim()
        );
    }

    /**
     * Check if content is empty after extraction
     *
     * @param content - The extracted content
     * @returns true if content is effectively empty
     */
    isContentEmpty(content: string): boolean {
        // Remove all whitespace and check length
        const stripped = content.replace(/\s/g, "");
        return stripped.length === 0;
    }
}

/**
 * Singleton instance of FileService
 */
export const fileService = new FileService();
