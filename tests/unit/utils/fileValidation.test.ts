/**
 * File Validation Utility Tests
 */

import { describe, test, expect } from "@jest/globals";
import {
    validateFile,
    getFileExtension,
    detectFileType,
    generateTitleFromFilename,
    generateExcerpt,
    getAllowedMimeTypes,
    getAllowedExtensions,
    MAX_FILE_SIZE,
} from "@/utils/fileValidation.js";

describe("File Validation Utility", () => {
    describe("MAX_FILE_SIZE", () => {
        test("should be 10MB", () => {
            expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
        });
    });

    describe("getAllowedMimeTypes", () => {
        test("should return all allowed MIME types", () => {
            const mimeTypes = getAllowedMimeTypes();

            expect(mimeTypes).toContain("application/pdf");
            expect(mimeTypes).toContain("text/plain");
            expect(mimeTypes).toContain("text/markdown");
            expect(mimeTypes).toContain("text/x-markdown");
        });
    });

    describe("getAllowedExtensions", () => {
        test("should return all allowed extensions", () => {
            const extensions = getAllowedExtensions();

            expect(extensions).toContain(".pdf");
            expect(extensions).toContain(".txt");
            expect(extensions).toContain(".md");
            expect(extensions).toContain(".markdown");
        });
    });

    describe("getFileExtension", () => {
        test("should extract extension from filename", () => {
            expect(getFileExtension("document.pdf")).toBe(".pdf");
            expect(getFileExtension("notes.txt")).toBe(".txt");
            expect(getFileExtension("readme.md")).toBe(".md");
        });

        test("should handle uppercase extensions", () => {
            expect(getFileExtension("document.PDF")).toBe(".pdf");
            expect(getFileExtension("notes.TXT")).toBe(".txt");
        });

        test("should handle multiple dots in filename", () => {
            expect(getFileExtension("my.document.v2.pdf")).toBe(".pdf");
        });

        test("should return empty string for no extension", () => {
            expect(getFileExtension("filename")).toBe("");
        });

        test("should handle hidden files", () => {
            expect(getFileExtension(".gitignore")).toBe(".gitignore");
        });
    });

    describe("detectFileType", () => {
        test("should detect PDF by MIME type", () => {
            expect(detectFileType("application/pdf", ".pdf")).toBe("pdf");
            expect(detectFileType("application/pdf", ".unknown")).toBe("pdf");
        });

        test("should detect TXT by MIME type", () => {
            expect(detectFileType("text/plain", ".txt")).toBe("txt");
            expect(detectFileType("text/plain", ".unknown")).toBe("txt");
        });

        test("should detect MD by MIME type", () => {
            expect(detectFileType("text/markdown", ".md")).toBe("md");
            expect(detectFileType("text/x-markdown", ".md")).toBe("md");
        });

        test("should detect file type by extension when MIME unknown", () => {
            expect(detectFileType("application/octet-stream", ".pdf")).toBe("pdf");
            expect(detectFileType("application/octet-stream", ".txt")).toBe("txt");
            expect(detectFileType("application/octet-stream", ".md")).toBe("md");
            expect(detectFileType("application/octet-stream", ".markdown")).toBe("md");
        });

        test("should return undefined for unknown types", () => {
            expect(detectFileType("image/png", ".png")).toBeUndefined();
            expect(
                detectFileType("application/octet-stream", ".unknown"),
            ).toBeUndefined();
        });
    });

    describe("validateFile", () => {
        test("should validate PDF file", () => {
            const result = validateFile("document.pdf", "application/pdf", 1024);

            expect(result.valid).toBe(true);
            expect(result.fileType).toBe("pdf");
        });

        test("should validate TXT file", () => {
            const result = validateFile("notes.txt", "text/plain", 512);

            expect(result.valid).toBe(true);
            expect(result.fileType).toBe("txt");
        });

        test("should validate MD file", () => {
            const result = validateFile("readme.md", "text/markdown", 256);

            expect(result.valid).toBe(true);
            expect(result.fileType).toBe("md");
        });

        test("should validate .markdown extension", () => {
            const result = validateFile("readme.markdown", "text/markdown", 256);

            expect(result.valid).toBe(true);
            expect(result.fileType).toBe("md");
        });

        test("should reject empty file", () => {
            const result = validateFile("document.pdf", "application/pdf", 0);

            expect(result.valid).toBe(false);
            expect(result.error).toBe("File is empty");
        });

        test("should reject file exceeding size limit", () => {
            const result = validateFile(
                "large.pdf",
                "application/pdf",
                MAX_FILE_SIZE + 1,
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain("exceeds");
        });

        test("should reject empty filename", () => {
            const result = validateFile("", "application/pdf", 1024);

            expect(result.valid).toBe(false);
            expect(result.error).toBe("Filename is required");
        });

        test("should reject whitespace-only filename", () => {
            const result = validateFile("   ", "application/pdf", 1024);

            expect(result.valid).toBe(false);
            expect(result.error).toBe("Filename is required");
        });

        test("should reject too long filename", () => {
            const longFilename = "a".repeat(256) + ".pdf";
            const result = validateFile(longFilename, "application/pdf", 1024);

            expect(result.valid).toBe(false);
            expect(result.error).toContain("too long");
        });

        test("should reject file without extension", () => {
            const result = validateFile("noextension", "application/pdf", 1024);

            expect(result.valid).toBe(false);
            expect(result.error).toBe("File must have an extension");
        });

        test("should reject unsupported file type", () => {
            const result = validateFile("image.png", "image/png", 1024);

            expect(result.valid).toBe(false);
            expect(result.error).toContain("Unsupported file type");
        });

        test("should accept file with correct extension but generic MIME", () => {
            // Some systems may not set correct MIME type
            const result = validateFile(
                "document.pdf",
                "application/octet-stream",
                1024,
            );

            expect(result.valid).toBe(true);
            expect(result.fileType).toBe("pdf");
        });

        test("should accept file at exactly max size", () => {
            const result = validateFile(
                "document.pdf",
                "application/pdf",
                MAX_FILE_SIZE,
            );

            expect(result.valid).toBe(true);
        });

        test("should reject negative file size", () => {
            const result = validateFile("document.pdf", "application/pdf", -1);

            expect(result.valid).toBe(false);
            expect(result.error).toBe("File is empty");
        });
    });

    describe("generateTitleFromFilename", () => {
        test("should remove extension", () => {
            expect(generateTitleFromFilename("document.pdf")).toBe("Document");
            expect(generateTitleFromFilename("my-notes.txt")).toBe("My notes");
        });

        test("should replace underscores with spaces", () => {
            expect(generateTitleFromFilename("my_document_title.pdf")).toBe(
                "My document title",
            );
        });

        test("should replace hyphens with spaces", () => {
            expect(generateTitleFromFilename("my-document-title.pdf")).toBe(
                "My document title",
            );
        });

        test("should capitalize first letter", () => {
            expect(generateTitleFromFilename("lowercase.txt")).toBe("Lowercase");
        });

        test("should preserve already capitalized first letter", () => {
            expect(generateTitleFromFilename("Uppercase.txt")).toBe("Uppercase");
        });

        test("should handle multiple dots", () => {
            expect(generateTitleFromFilename("my.document.v2.pdf")).toBe(
                "My.document.v2",
            );
        });

        test("should remove multiple spaces", () => {
            expect(generateTitleFromFilename("my___document.pdf")).toBe("My document");
        });

        test("should return Untitled for empty result", () => {
            expect(generateTitleFromFilename(".pdf")).toBe("Untitled");
            expect(generateTitleFromFilename("___.pdf")).toBe("Untitled");
        });

        test("should handle Unicode filenames", () => {
            expect(generateTitleFromFilename("文档.pdf")).toBe("文档");
        });
    });

    describe("generateExcerpt", () => {
        test("should return content if under maxLength", () => {
            const content = "Short content";
            expect(generateExcerpt(content)).toBe("Short content");
        });

        test("should truncate long content with ellipsis", () => {
            const content = "a".repeat(300);
            const excerpt = generateExcerpt(content, 200);

            expect(excerpt.length).toBeLessThanOrEqual(203); // 200 + "..."
            expect(excerpt.slice(-3)).toBe("...");
        });

        test("should truncate at word boundary", () => {
            const content = "This is a long sentence that should be truncated";
            const excerpt = generateExcerpt(content, 30);

            expect(excerpt.slice(-3)).toBe("...");
            expect(excerpt).not.toContain("trunca"); // Should cut before partial word
        });

        test("should remove markdown headings", () => {
            const content = "# Heading\n\nParagraph content here.";
            const excerpt = generateExcerpt(content);

            expect(excerpt).not.toContain("# ");
            expect(excerpt).toContain("Heading");
        });

        test("should remove markdown bold/italic", () => {
            const content = "This is **bold** and *italic* and ***both***.";
            const excerpt = generateExcerpt(content);

            expect(excerpt).toBe("This is bold and italic and both.");
        });

        test("should remove markdown links", () => {
            const content = "Check out [this link](https://example.com) for more.";
            const excerpt = generateExcerpt(content);

            expect(excerpt).toBe("Check out this link for more.");
        });

        test("should normalize whitespace", () => {
            const content = "Multiple   spaces\n\nand\nnewlines";
            const excerpt = generateExcerpt(content);

            expect(excerpt).toBe("Multiple spaces and newlines");
        });

        test("should handle empty content", () => {
            expect(generateExcerpt("")).toBe("");
        });

        test("should handle whitespace-only content", () => {
            expect(generateExcerpt("   \n\t  ")).toBe("");
        });

        test("should use custom maxLength", () => {
            const content =
                "This is test content that is longer than fifty characters.";
            const excerpt = generateExcerpt(content, 50);

            expect(excerpt.length).toBeLessThanOrEqual(53);
        });
    });
});
