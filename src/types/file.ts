/**
 * File Types
 *
 * Types for file upload and content extraction
 */

export type FileType = "pdf" | "txt" | "md";

export interface FileValidationResult {
    valid: boolean;
    fileType?: FileType;
    error?: string;
}

export interface FileMetadata {
    name: string;
    mimeType: string;
    size: number;
    extension: string;
}

export interface ExtractedContent {
    text: string;
    metadata: FileMetadata;
}

export interface FileExtractionResult {
    noteId: string;
    title: string;
    content: string;
    excerpt: string;
    sourceFile: {
        name: string;
        type: FileType;
        size: number;
        extractedAt: string; // ISO 8601
    };
    createdAt: string; // ISO 8601
}

/**
 * PDF Extractor Types
 */

/** PDF extraction options */
export interface PdfExtractionOptions {
    /** Maximum number of pages to extract (default: all) */
    maxPages?: number;
}

/** PDF extraction result */
export interface PdfExtractionResult {
    text: string;
    pageCount: number;
    info?: {
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
    };
}

/**
 * TXT Extractor Types
 */

/** TXT extraction options */
export interface TxtExtractionOptions {
    /** Character encoding (default: utf-8) */
    encoding?: BufferEncoding;
}

/** TXT extraction result */
export interface TxtExtractionResult {
    text: string;
    lineCount: number;
    encoding: BufferEncoding;
}

/**
 * Markdown Extractor Types
 */

/** Markdown extraction options */
export interface MdExtractionOptions {
    /** Character encoding (default: utf-8) */
    encoding?: BufferEncoding;
}

/** Markdown extraction result */
export interface MdExtractionResult {
    text: string;
    lineCount: number;
    encoding: BufferEncoding;
    hasTitle: boolean;
    /** Extracted title from first heading (if present) */
    extractedTitle?: string;
}
