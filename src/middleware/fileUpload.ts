/**
 * File Upload Middleware
 *
 * Handles multipart/form-data file uploads using busboy
 * Validates file type, size, and extracts file buffer
 */

import { Request, Response, NextFunction } from "express";
import Busboy from "busboy";
import { logDebug, logWarn } from "@/utils/logger.js";
import { AppError } from "./errorHandler.js";

/**
 * File upload configuration
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
];

/**
 * File upload middleware
 * Parses multipart/form-data and extracts file
 *
 * Usage:
 *   app.post('/upload',
 *     authMiddleware,
 *     fileUploadMiddleware,
 *     (req, res) => {
 *       // req.file contains the uploaded file
 *       console.log(req.file.buffer);
 *     }
 *   );
 */
export function fileUploadMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    try {
        // Check content type
        const contentType = req.headers["content-type"];

        if (!contentType?.includes("multipart/form-data")) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "Content-Type must be multipart/form-data",
            );
        }

        let fileReceived = false;
        let fileTooLarge = false;
        let fileBuffer: Buffer | null = null;
        let filename = "";
        let mimeType = "";
        let fileSize = 0;

        // Create busboy instance
        const busboy = Busboy({
            headers: req.headers,
            limits: {
                fileSize: MAX_FILE_SIZE,
                files: 1, // Only one file per request
                fields: 0, // No additional fields expected
            },
        });

        // Handle file size limit exceeded
        busboy.on("filesLimit", () => {
            fileTooLarge = true;
            logWarn("File upload limit exceeded", {
                userId: req.uid,
                path: req.path,
            });
        });

        // Handle file upload
        busboy.on("file", (_fieldname, fileStream, info) => {
            if (fileReceived) {
                // Already received a file, drain this one
                fileStream.resume();
                return;
            }

            fileReceived = true;
            filename = info.filename;
            mimeType = info.mimeType;

            logDebug("Receiving file upload", {
                filename,
                mimeType,
                userId: req.uid,
            });

            const chunks: Buffer[] = [];

            fileStream.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
                fileSize += chunk.length;

                // Check size during upload
                if (fileSize > MAX_FILE_SIZE) {
                    fileTooLarge = true;
                    fileStream.resume(); // Drain stream
                }
            });

            fileStream.on("limit", () => {
                fileTooLarge = true;
                fileStream.resume();
            });

            fileStream.on("end", () => {
                if (!fileTooLarge) {
                    fileBuffer = Buffer.concat(chunks);
                }
            });

            fileStream.on("error", (error: Error) => {
                logWarn("File stream error", {
                    error: error.message,
                    userId: req.uid,
                });
            });
        });

        // Handle form completion
        busboy.on("finish", () => {
            if (fileTooLarge) {
                next(
                    new AppError(
                        "FILE_TOO_LARGE",
                        413,
                        `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
                    ),
                );
                return;
            }

            if (!fileReceived || !fileBuffer) {
                next(new AppError("INVALID_REQUEST", 400, "No file uploaded"));
                return;
            }

            // Validate MIME type
            if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
                next(
                    new AppError(
                        "UNSUPPORTED_FILE_TYPE",
                        415,
                        "Unsupported file type. Only PDF, TXT, and MD files are allowed.",
                        {
                            receivedType: mimeType,
                            allowedTypes: ALLOWED_MIME_TYPES,
                        },
                    ),
                );
                return;
            }

            // Validate file extension
            const extension = filename
                .substring(filename.lastIndexOf("."))
                .toLowerCase();
            const allowedExtensions = [".pdf", ".txt", ".md", ".markdown"];

            if (!allowedExtensions.includes(extension)) {
                next(
                    new AppError(
                        "UNSUPPORTED_FILE_TYPE",
                        415,
                        "Unsupported file extension. Only .pdf, .txt, and .md files are allowed.",
                        {
                            receivedExtension: extension,
                            allowedExtensions,
                        },
                    ),
                );
                return;
            }

            // Attach file to request
            req.file = {
                buffer: fileBuffer,
                filename,
                mimeType,
                size: fileSize,
            };

            logDebug("File upload successful", {
                filename,
                mimeType,
                size: fileSize,
                userId: req.uid,
            });

            next();
        });

        // Handle busboy errors
        busboy.on("error", (error: Error) => {
            logWarn("Busboy error", {
                error: error.message,
                userId: req.uid,
            });

            next(new AppError("INVALID_REQUEST", 400, "Failed to parse file upload"));
        });

        // Pipe request to busboy
        req.pipe(busboy);
    } catch (error) {
        next(error);
    }
}

/**
 * Validate file metadata
 * Can be used as additional validation after fileUploadMiddleware
 */
export function validateFileMetadata(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    try {
        if (!req.file) {
            throw new AppError("INVALID_REQUEST", 400, "No file found in request");
        }

        const { filename, mimeType, size } = req.file;

        // Validate filename
        if (!filename || filename.length > 255) {
            throw new AppError("INVALID_FILE", 400, "Invalid filename");
        }

        // Validate size
        if (size <= 0 || size > MAX_FILE_SIZE) {
            throw new AppError(
                "FILE_TOO_LARGE",
                413,
                `File size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            );
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new AppError("UNSUPPORTED_FILE_TYPE", 415, "Unsupported file type");
        }

        next();
    } catch (error) {
        next(error);
    }
}
