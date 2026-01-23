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
