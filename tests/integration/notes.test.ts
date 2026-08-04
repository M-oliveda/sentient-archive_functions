/**
 * Notes Routes Integration Tests
 *
 * Tests the file extraction endpoint against Firebase Emulators
 *
 * Prerequisites:
 * - Firebase Emulators running (npm run emulators:start)
 *
 * Run with: npm run test:integration
 * Or in CI: npm run test:ci
 */

// Set emulator environment variables FIRST, before any Firebase imports
process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8081";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
process.env["GCLOUD_PROJECT"] = "demo-sentient-archive";

import { describe, test, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { initializeApp, deleteApp, App } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import request from "supertest";
import express, { Express, Request, Response, NextFunction } from "express";

// Test configuration
const TEST_USER_ID = "test-notes-integration-user";
const TEST_USER = {
    email: "notes-user@example.com",
    displayName: "Notes Test User",
    role: "client" as const,
    isActive: true,
};

// Sample file contents for testing
const SAMPLE_TXT_CONTENT = `
Meeting Notes - Q4 Planning
===========================

Date: January 15, 2024
Attendees: John, Jane, Bob

Agenda:
1. Review Q3 performance
2. Set Q4 goals
3. Budget allocation

Key Decisions:
- Increase marketing budget by 15%
- Launch new product line in February
- Hire two additional developers

Action Items:
- John: Prepare budget proposal by Jan 20
- Jane: Draft marketing plan
- Bob: Start recruitment process
`.trim();

const SAMPLE_MD_CONTENT = `
# Machine Learning Basics

## Introduction

Machine learning is a subset of artificial intelligence that enables systems to learn from data.

## Key Concepts

- **Supervised Learning**: Learning from labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Reinforcement Learning**: Learning through trial and error

## Common Algorithms

1. Linear Regression
2. Decision Trees
3. Neural Networks
4. Support Vector Machines

## Conclusion

Machine learning has many practical applications including:
- Image recognition
- Natural language processing
- Recommendation systems
`.trim();

// Variables to hold app instances
let firebaseApp: App;
let db: Firestore;
let expressApp: Express;
const createdNoteIds: string[] = [];

// Mock the auth middleware module
jest.unstable_mockModule("@/middleware/auth.js", () => ({
    authMiddleware: async (req: Request, _res: Response, next: NextFunction) => {
        const { AppError } = await import("@/middleware/errorHandler.js");
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next(
                new AppError(
                    "UNAUTHENTICATED",
                    401,
                    "Missing or invalid authorization header",
                ),
            );
        }

        // Get the user from Firestore
        if (db) {
            const userDoc = await db.collection("users").doc(TEST_USER_ID).get();
            if (userDoc.exists) {
                req.user = userDoc.data() as typeof req.user;
                req.uid = TEST_USER_ID;
            }
        }
        next();
    },
}));

describe("Notes Routes Integration Tests", () => {
    beforeAll(async () => {
        // Initialize Firebase Admin as the DEFAULT app
        firebaseApp = initializeApp({ projectId: "demo-sentient-archive" });
        db = getFirestore(firebaseApp);

        // Create test user document
        await db
            .collection("users")
            .doc(TEST_USER_ID)
            .set({
                uid: TEST_USER_ID,
                email: TEST_USER.email,
                displayName: TEST_USER.displayName,
                photoURL: null,
                role: TEST_USER.role,
                isActive: TEST_USER.isActive,
                tokenBalance: 100,
                totalTokensGranted: 100,
                totalTokensSpent: 0,
                createdAt: Timestamp.now(),
                lastLoginAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            });

        // Import routes after mocking
        const { default: notesRouter } = await import("@/routes/notes.routes.js");
        const { errorHandler } = await import("@/middleware/errorHandler.js");

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use("/v1/notes", notesRouter);
        expressApp.use(errorHandler);
    });

    afterAll(async () => {
        // Cleanup: Delete test data
        try {
            // Delete created notes
            for (const noteId of createdNoteIds) {
                await db
                    .collection("users")
                    .doc(TEST_USER_ID)
                    .collection("notes")
                    .doc(noteId)
                    .delete()
                    .catch(() => {
                        // Ignore if doesn't exist
                    });
            }

            // Delete user document
            await db.collection("users").doc(TEST_USER_ID).delete();

            // Delete system config if modified
            await db
                .collection("system_config")
                .doc("settings")
                .delete()
                .catch(() => {
                    // Ignore if doesn't exist
                });
        } catch (error) {
            console.error("Cleanup error:", error);
        }

        // Delete app
        await deleteApp(firebaseApp);
    });

    describe("Authentication", () => {
        test("POST /v1/notes/extract should return 401 without auth token", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .attach("file", Buffer.from(SAMPLE_TXT_CONTENT), "test.txt");

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });
    });

    describe("POST /v1/notes/extract - TXT files", () => {
        test("should extract content from TXT file", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(SAMPLE_TXT_CONTENT), "meeting-notes.txt");

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("noteId");
            expect(data).toHaveProperty("title");
            expect(data).toHaveProperty("content");
            expect(data).toHaveProperty("excerpt");
            expect(data).toHaveProperty("sourceFile");
            expect(data).toHaveProperty("createdAt");

            // Store for cleanup
            createdNoteIds.push(data["noteId"] as string);

            // Verify title is generated from filename (dashes replaced with spaces, capitalized)
            expect(data["title"]).toBe("Meeting notes");

            // Verify content was extracted
            expect(data["content"]).toContain("Meeting Notes");
            expect(data["content"]).toContain("Q4 Planning");

            // Verify sourceFile metadata
            const sourceFile = data["sourceFile"] as Record<string, unknown>;
            expect(sourceFile["type"]).toBe("txt");
            expect(sourceFile["name"]).toBe("meeting-notes.txt");
        });

        test("should create note in Firestore", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach(
                    "file",
                    Buffer.from("Test content for Firestore"),
                    "firestore-test.txt",
                );

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const noteId = data["noteId"] as string;
            createdNoteIds.push(noteId);

            // Verify note exists in Firestore
            const noteDoc = await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(noteId)
                .get();

            expect(noteDoc.exists).toBe(true);

            const noteData = noteDoc.data();
            expect(noteData).toBeDefined();
            expect(noteData!["title"]).toBe("Firestore test");
            expect(noteData!["content"]).toBe("Test content for Firestore");
            expect(noteData!["userId"]).toBe(TEST_USER_ID);
            expect(noteData!["sourceFile"]).toBeDefined();
            const sourceFileData = noteData!["sourceFile"] as { type: string };
            expect(sourceFileData.type).toBe("txt");
        });
    });

    describe("POST /v1/notes/extract - MD files", () => {
        test("should extract content from Markdown file", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(SAMPLE_MD_CONTENT), "machine-learning.md");

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: Record<string, unknown> }).data;
            createdNoteIds.push(data["noteId"] as string);

            // Verify content was extracted
            expect(data["content"]).toContain("Machine Learning Basics");
            expect(data["content"]).toContain("Supervised Learning");

            // Verify sourceFile metadata
            const sourceFile = data["sourceFile"] as Record<string, unknown>;
            expect(sourceFile["type"]).toBe("md");
            expect(sourceFile["name"]).toBe("machine-learning.md");
        });
    });

    describe("POST /v1/notes/extract - Validation", () => {
        test("should return 400 when no file is provided", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("should return 415 for unsupported file type", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from("fake image data"), {
                    filename: "image.jpg",
                    contentType: "image/jpeg",
                });

            expect(response.status).toBe(415);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNSUPPORTED_FILE_TYPE",
            );
        });

        test("should return 400 for empty file content", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(""), "empty.txt");

            expect(response.status).toBe(400);
            // Empty buffer (size 0) triggers "File is empty" validation error
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_FILE",
            );
        });

        test("should return 400 for whitespace-only content", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from("   \n\n\t\t   \n  "), "whitespace.txt");

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "EXTRACTION_FAILED",
            );
        });
    });

    describe("POST /v1/notes/extract - Feature flag", () => {
        test("should return 503 when file extraction is disabled", async () => {
            // Disable file extraction feature
            await db
                .collection("system_config")
                .doc("settings")
                .set({
                    features: {
                        fileExtractionEnabled: false,
                        summarizeEnabled: true,
                        autoTagEnabled: true,
                        flashcardsEnabled: true,
                        ragQueryEnabled: true,
                    },
                });

            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(SAMPLE_TXT_CONTENT), "test.txt");

            expect(response.status).toBe(503);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "FILE_EXTRACTION_DISABLED",
            );

            // Re-enable feature for other tests
            await db.collection("system_config").doc("settings").delete();
        });
    });

    describe("POST /v1/notes/extract - Excerpt generation", () => {
        test("should generate excerpt from content", async () => {
            const longContent = "A".repeat(500); // Content longer than excerpt limit

            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(longContent), "long-content.txt");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            createdNoteIds.push(data["noteId"] as string);

            // Excerpt should be truncated (max 200 chars + "..." = 203)
            expect((data["excerpt"] as string).length).toBeLessThanOrEqual(203);
        });

        test("should use full content as excerpt for short content", async () => {
            const shortContent = "Short note content";

            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from(shortContent), "short-content.txt");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            createdNoteIds.push(data["noteId"] as string);

            expect(data["excerpt"]).toBe(shortContent);
        });
    });

    describe("POST /v1/notes/extract - Title generation", () => {
        test("should generate title from filename without extension", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from("Content"), "my-awesome-notes.txt");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            createdNoteIds.push(data["noteId"] as string);

            // Title is generated with dashes replaced by spaces and first letter capitalized
            expect(data["title"]).toBe("My awesome notes");
        });

        test("should handle filenames with multiple dots", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from("Content"), "notes.2024.01.15.txt");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            createdNoteIds.push(data["noteId"] as string);

            // First letter is capitalized
            expect(data["title"]).toBe("Notes.2024.01.15");
        });
    });

    describe("POST /v1/notes/extract - Note initialization", () => {
        test("should initialize note with correct default values", async () => {
            const response = await request(expressApp)
                .post("/v1/notes/extract")
                .set("Authorization", "Bearer test-token")
                .attach("file", Buffer.from("Test defaults"), "defaults-test.txt");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const noteId = data["noteId"] as string;
            createdNoteIds.push(noteId);

            // Verify note in Firestore has correct defaults
            const noteDoc = await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(noteId)
                .get();

            const noteData = noteDoc.data();
            expect(noteData).toBeDefined();
            expect(noteData!["folderId"]).toBeNull();
            expect(noteData!["tags"]).toEqual([]);
            expect(noteData!["aiTags"]).toEqual([]);
            expect(noteData!["summary"]).toBeNull();
            expect(noteData!["flashcards"]).toBeNull();
            expect(noteData!["isPinned"]).toBe(false);
            expect(noteData!["isArchived"]).toBe(false);
        });
    });
});
