/**
 * File Upload Middleware Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { Readable, Writable } from "stream";
import { fileUploadMiddleware, validateFileMetadata } from "@/middleware/fileUpload";

// Mock logger
jest.mock("@/utils/logger.js", () => ({
    logDebug: jest.fn(),
    logWarn: jest.fn(),
}));

interface CustomRequest extends Request {
    uid?: string;
    file?: {
        buffer: Buffer;
        filename: string;
        mimeType: string;
        size: number;
    };
}

describe("File Upload Middleware", () => {
    let mockRequest: Partial<CustomRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            headers: {
                "content-type": "multipart/form-data; boundary=----WebKitFormBoundary",
            },
            path: "/upload",
            uid: "user123",
        };

        mockResponse = {};
        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    describe("fileUploadMiddleware", () => {
        test("should reject non-multipart content type", () => {
            mockRequest.headers = {
                "content-type": "application/json",
            };

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "INVALID_REQUEST",
                    statusCode: 400,
                    message: "Content-Type must be multipart/form-data",
                }),
            );
        });

        test("should reject when content-type is missing", () => {
            mockRequest.headers = {};

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "INVALID_REQUEST",
                    statusCode: 400,
                }),
            );
        });

        test("should process valid PDF upload", (done) => {
            const fileContent = Buffer.from("PDF content");
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="document.pdf"',
                "Content-Type: application/pdf",
                "",
                fileContent.toString(),
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn(() => {
                expect(mockRequest.file).toBeDefined();
                expect(mockRequest.file?.filename).toBe("document.pdf");
                expect(mockRequest.file?.mimeType).toBe("application/pdf");
                expect(mockRequest.file?.buffer).toBeInstanceOf(Buffer);
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should reject file with unsupported MIME type", (done) => {
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="image.jpg"',
                "Content-Type: image/jpeg",
                "",
                "Image content",
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn((error) => {
                expect(error).toBeDefined();
                const appError = error as { code: string; statusCode: number };
                expect(appError.code).toBe("UNSUPPORTED_FILE_TYPE");
                expect(appError.statusCode).toBe(415);
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should reject file with unsupported extension", (done) => {
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="document.docx"',
                "Content-Type: application/pdf",
                "",
                "Content",
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn((error) => {
                expect(error).toBeDefined();
                const appError = error as { code: string };
                expect(appError.code).toBe("UNSUPPORTED_FILE_TYPE");
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should reject when no file uploaded", (done) => {
            const boundary = "----WebKitFormBoundary";

            const requestBody = [`--${boundary}--`].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn((error) => {
                expect(error).toBeDefined();
                const appError = error as { code: string; message: string };
                expect(appError.code).toBe("INVALID_REQUEST");
                expect(appError.message).toBe("No file uploaded");
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should handle file size exceeding limit", (done) => {
            const boundary = "----WebKitFormBoundary";
            const largeContent = "x".repeat(11 * 1024 * 1024); // 11MB

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="large.pdf"',
                "Content-Type: application/pdf",
                "",
                largeContent,
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn((error) => {
                expect(error).toBeDefined();
                const appError = error as { code: string; statusCode: number };
                expect(appError.code).toBe("FILE_TOO_LARGE");
                expect(appError.statusCode).toBe(413);
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should process valid PDF upload via rawBody (Cloud Functions path)", (done) => {
            const fileContent = Buffer.from("PDF content");
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="document.pdf"',
                "Content-Type: application/pdf",
                "",
                fileContent.toString(),
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };
            (mockRequest as CustomRequest & { rawBody?: Buffer }).rawBody =
                Buffer.from(requestBody);

            mockNext = jest.fn(() => {
                expect(mockRequest.file).toBeDefined();
                expect(mockRequest.file?.filename).toBe("document.pdf");
                expect(mockRequest.file?.mimeType).toBe("application/pdf");
                expect(mockRequest.file?.buffer).toBeInstanceOf(Buffer);
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should process text file upload", (done) => {
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="notes.txt"',
                "Content-Type: text/plain",
                "",
                "Text content",
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn(() => {
                expect(mockRequest.file).toBeDefined();
                expect(mockRequest.file?.filename).toBe("notes.txt");
                expect(mockRequest.file?.mimeType).toBe("text/plain");
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });

        test("should process markdown file upload", (done) => {
            const boundary = "----WebKitFormBoundary";

            const requestBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="file"; filename="README.md"',
                "Content-Type: text/markdown",
                "",
                "# Markdown content",
                `--${boundary}--`,
            ].join("\r\n");

            mockRequest.headers = {
                "content-type": `multipart/form-data; boundary=${boundary}`,
            };

            const readableStream = Readable.from([requestBody]);
            mockRequest.pipe = <T extends NodeJS.WritableStream>(
                destination: T,
                options?: { end?: boolean },
            ): T => {
                readableStream.pipe(destination as unknown as Writable, options);
                return destination;
            };

            mockNext = jest.fn(() => {
                expect(mockRequest.file).toBeDefined();
                expect(mockRequest.file?.filename).toBe("README.md");
                expect(mockRequest.file?.mimeType).toBe("text/markdown");
                done();
            });

            fileUploadMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );
        });
    });

    describe("validateFileMetadata", () => {
        test("should validate valid file metadata", () => {
            mockRequest.file = {
                buffer: Buffer.from("content"),
                filename: "document.pdf",
                mimeType: "application/pdf",
                size: 1024,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should reject when file is missing", () => {
            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "INVALID_REQUEST",
                    statusCode: 400,
                    message: "No file found in request",
                }),
            );
        });

        test("should reject invalid filename", () => {
            mockRequest.file = {
                buffer: Buffer.from("content"),
                filename: "",
                mimeType: "application/pdf",
                size: 1024,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "INVALID_FILE",
                    statusCode: 400,
                    message: "Invalid filename",
                }),
            );
        });

        test("should reject filename exceeding length", () => {
            mockRequest.file = {
                buffer: Buffer.from("content"),
                filename: "a".repeat(256) + ".pdf",
                mimeType: "application/pdf",
                size: 1024,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "INVALID_FILE",
                    statusCode: 400,
                }),
            );
        });

        test("should reject file size of zero", () => {
            mockRequest.file = {
                buffer: Buffer.from(""),
                filename: "empty.pdf",
                mimeType: "application/pdf",
                size: 0,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "FILE_TOO_LARGE",
                    statusCode: 413,
                }),
            );
        });

        test("should reject file size exceeding limit", () => {
            mockRequest.file = {
                buffer: Buffer.from("content"),
                filename: "large.pdf",
                mimeType: "application/pdf",
                size: 11 * 1024 * 1024,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "FILE_TOO_LARGE",
                    statusCode: 413,
                }),
            );
        });

        test("should reject unsupported MIME type", () => {
            mockRequest.file = {
                buffer: Buffer.from("content"),
                filename: "image.jpg",
                mimeType: "image/jpeg",
                size: 1024,
            };

            validateFileMetadata(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNSUPPORTED_FILE_TYPE",
                    statusCode: 415,
                    message: "Unsupported file type",
                }),
            );
        });
    });
});
