/**
 * File Validation Utility
 *
 * Validates file type, MIME type, extension, and size
 * Used by file extraction endpoints
 */

import { FileType, FileValidationResult } from "@/types/file.js";

/**
 * Maximum allowed file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed file type configurations
 */
export const ALLOWED_FILE_TYPES: Record<
    FileType,
    {
        mimes: string[];
        extensions: string[];
    }
> = {
    pdf: {
        mimes: ["application/pdf"],
        extensions: [".pdf"],
    },
    txt: {
        mimes: ["text/plain"],
        extensions: [".txt"],
    },
    md: {
        mimes: ["text/markdown", "text/x-markdown"],
        extensions: [".md", ".markdown"],
    },
};

/**
 * Get all allowed MIME types
 */
export function getAllowedMimeTypes(): string[] {
    return Object.values(ALLOWED_FILE_TYPES).flatMap((config) => config.mimes);
}

/**
 * Get all allowed file extensions
 */
export function getAllowedExtensions(): string[] {
    return Object.values(ALLOWED_FILE_TYPES).flatMap((config) => config.extensions);
}

/**
 * Extract file extension from filename
 *
 * @param filename - The filename to extract extension from
 * @returns The file extension including the dot (e.g., ".pdf")
 */
export function getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
        return "";
    }
    return filename.substring(lastDotIndex).toLowerCase();
}

/**
 * Detect file type from MIME type or extension
 *
 * @param mimeType - The MIME type of the file
 * @param extension - The file extension
 * @returns The detected FileType or undefined if not recognized
 */
export function detectFileType(
    mimeType: string,
    extension: string,
): FileType | undefined {
    const normalizedExtension = extension.toLowerCase();

    for (const [type, config] of Object.entries(ALLOWED_FILE_TYPES)) {
        if (
            config.mimes.includes(mimeType) ||
            config.extensions.includes(normalizedExtension)
        ) {
            return type as FileType;
        }
    }

    return undefined;
}

/**
 * Validate file metadata
 *
 * @param filename - The filename
 * @param mimeType - The MIME type
 * @param sizeBytes - The file size in bytes
 * @returns Validation result with file type if valid
 */
export function validateFile(
    filename: string,
    mimeType: string,
    sizeBytes: number,
): FileValidationResult {
    // Check file size
    if (sizeBytes <= 0) {
        return {
            valid: false,
            error: "File is empty",
        };
    }

    if (sizeBytes > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        };
    }

    // Check filename
    if (!filename || filename.trim().length === 0) {
        return {
            valid: false,
            error: "Filename is required",
        };
    }

    if (filename.length > 255) {
        return {
            valid: false,
            error: "Filename is too long (max 255 characters)",
        };
    }

    // Extract extension
    const extension = getFileExtension(filename);

    if (!extension) {
        return {
            valid: false,
            error: "File must have an extension",
        };
    }

    // Detect file type
    const fileType = detectFileType(mimeType, extension);

    if (!fileType) {
        return {
            valid: false,
            error: `Unsupported file type. Only PDF, TXT, and MD files are allowed. Received MIME type: ${mimeType}, extension: ${extension}`,
        };
    }

    // Verify MIME type matches extension for security
    const config = ALLOWED_FILE_TYPES[fileType];
    const mimeMatchesType = config.mimes.includes(mimeType);
    const extensionMatchesType = config.extensions.includes(extension);

    // Allow if either matches (some systems may not set correct MIME type)
    // but at least one must match the detected type
    // This is defensive code - if detectFileType found a type, at least one of these should match
    /* istanbul ignore if -- defensive code for type safety */
    if (!mimeMatchesType && !extensionMatchesType) {
        return {
            valid: false,
            error: `File type mismatch. MIME type ${mimeType} does not match extension ${extension}`,
        };
    }

    return {
        valid: true,
        fileType,
    };
}

/**
 * Generate a title from filename
 *
 * @param filename - The original filename
 * @returns A cleaned title suitable for note title
 */
export function generateTitleFromFilename(filename: string): string {
    // Remove extension
    const extension = getFileExtension(filename);
    let title = filename;

    if (extension) {
        title = filename.slice(0, -extension.length);
    }

    // Replace common separators with spaces
    title = title.replace(/[-_]/g, " ");

    // Remove multiple spaces
    title = title.replace(/\s+/g, " ");

    // Trim whitespace
    title = title.trim();

    // Capitalize first letter if lowercase
    const firstChar = title.charAt(0);
    if (title.length > 0 && firstChar !== firstChar.toUpperCase()) {
        title = firstChar.toUpperCase() + title.slice(1);
    }

    // Fallback if title is empty
    if (!title) {
        title = "Untitled";
    }

    return title;
}

/**
 * Generate an excerpt from content
 *
 * @param content - The full content
 * @param maxLength - Maximum excerpt length (default: 200)
 * @returns The excerpt with ellipsis if truncated
 */
export function generateExcerpt(content: string, maxLength = 200): string {
    // Clean the content
    let excerpt = content
        // Remove markdown headings
        .replace(/^#{1,6}\s+/gm, "")
        // Remove markdown bold/italic
        .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
        // Remove markdown links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        // Remove multiple newlines
        .replace(/\n+/g, " ")
        // Remove multiple spaces
        .replace(/\s+/g, " ")
        // Trim
        .trim();

    if (excerpt.length <= maxLength) {
        return excerpt;
    }

    // Truncate at word boundary
    excerpt = excerpt.substring(0, maxLength);
    const lastSpaceIndex = excerpt.lastIndexOf(" ");

    if (lastSpaceIndex > maxLength * 0.8) {
        excerpt = excerpt.substring(0, lastSpaceIndex);
    }

    return excerpt + "...";
}
