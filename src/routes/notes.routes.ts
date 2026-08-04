/**
 * Notes Routes
 *
 * Handles note-related API endpoints including file extraction
 */

import { Router, Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { authMiddleware } from "@/middleware/auth.js";
import { fileUploadMiddleware } from "@/middleware/fileUpload.js";
import { asyncHandler, AppError } from "@/middleware/errorHandler.js";
import { fileService } from "@/services/file.service.js";
import { getDb, getSystemConfig } from "@/utils/firestore.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import { ApiResponse } from "@/types/api.js";
import { FileExtractionResult } from "@/types/file.js";
import { Note } from "@/types/note.js";

const router = Router();

/**
 * POST /extract
 *
 * Extract content from an uploaded file (PDF, TXT, MD)
 * Creates a new note with the extracted content
 *
 * Request: multipart/form-data with 'file' field
 * Response: FileExtractionResult
 */
router.post(
    "/extract",
    authMiddleware,
    fileUploadMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;
        const file = req.file!;

        logInfo("File extraction request", {
            userId,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
        });

        // Check if file extraction is enabled
        const systemConfig = await getSystemConfig();
        const features = systemConfig?.["features"] as
            | { fileExtractionEnabled?: boolean }
            | undefined;
        const fileExtractionEnabled = features?.fileExtractionEnabled ?? true;

        if (!fileExtractionEnabled) {
            throw new AppError(
                "FILE_EXTRACTION_DISABLED",
                503,
                "File extraction feature is currently disabled",
            );
        }

        // Process the file
        const processedFile = await fileService.processFile(
            file.buffer,
            file.filename,
            file.mimeType,
        );

        // Check if content is empty
        if (fileService.isContentEmpty(processedFile.content)) {
            throw new AppError(
                "EXTRACTION_FAILED",
                400,
                "No text content could be extracted from the file",
            );
        }

        // Create note in Firestore
        const db = getDb();
        const noteRef = db.collection("users").doc(userId).collection("notes").doc();
        const now = Timestamp.now();

        const noteData: Omit<Note, "id"> = {
            userId,
            title: processedFile.title,
            content: processedFile.content,
            excerpt: processedFile.excerpt,
            folderId: null,
            tags: [],
            aiTags: [],
            summary: null,
            flashcards: null,
            createdAt: now,
            updatedAt: now,
            viewedAt: now,
            isPinned: false,
            isArchived: false,
            sourceFile: {
                name: processedFile.metadata.name,
                type: processedFile.fileType,
                size: processedFile.metadata.size,
                extractedAt: now,
            },
        };

        await noteRef.set({
            id: noteRef.id,
            ...noteData,
        });

        logEvent("note_created_from_file", {
            userId,
            noteId: noteRef.id,
            fileType: processedFile.fileType,
            fileName: processedFile.metadata.name,
            fileSize: processedFile.metadata.size,
            contentLength: processedFile.content.length,
        });

        // Build response
        const result: FileExtractionResult = {
            noteId: noteRef.id,
            title: processedFile.title,
            content: processedFile.content,
            excerpt: processedFile.excerpt,
            sourceFile: {
                name: processedFile.metadata.name,
                type: processedFile.fileType,
                size: processedFile.metadata.size,
                extractedAt: now.toDate().toISOString(),
            },
            createdAt: now.toDate().toISOString(),
        };

        const response: ApiResponse<FileExtractionResult> = {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
