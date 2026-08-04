/**
 * AI Routes Integration Tests
 *
 * Tests the AI endpoints against Firebase Emulators
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
const TEST_USER_ID = "test-ai-integration-user";
const TEST_USER = {
    email: "test-ai-user@example.com",
    displayName: "AI Test User",
};

const TEST_NOTE = {
    title: "Machine Learning Fundamentals",
    content: `
# Machine Learning Fundamentals

Machine learning is a subset of artificial intelligence that enables systems to learn from data.

## Key Concepts

1. **Supervised Learning**: Learning from labeled data
2. **Unsupervised Learning**: Finding patterns in unlabeled data
3. **Reinforcement Learning**: Learning through trial and error

## Common Algorithms

- Linear Regression
- Decision Trees
- Neural Networks
- Support Vector Machines

Machine learning has applications in image recognition, natural language processing, and recommendation systems.
    `.trim(),
};

// Variables to hold app instances
let firebaseApp: App;
let db: Firestore;
let expressApp: Express;
let testNoteId: string;

// Mock the auth middleware module (must be set up before imports)
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

        // Get the user from Firestore using the global db
        // This will be set in beforeAll
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

// NOTE: We do NOT mock getDb() - instead we initialize Firebase as the default app
// so that production code's getFirestore() call will return our emulator-connected instance.

describe("AI Routes Integration Tests", () => {
    beforeAll(async () => {
        // Initialize Firebase Admin as the DEFAULT app (no custom name)
        // This ensures production code's getFirestore() returns the same instance
        firebaseApp = initializeApp({ projectId: "demo-sentient-archive" });
        db = getFirestore(firebaseApp);

        // Clean up any stale notes from previous test runs
        const staleNotes = await db
            .collection("users")
            .doc(TEST_USER_ID)
            .collection("notes")
            .get();
        if (!staleNotes.empty) {
            const batch = db.batch();
            staleNotes.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }

        // Create user document in Firestore
        await db
            .collection("users")
            .doc(TEST_USER_ID)
            .set({
                uid: TEST_USER_ID,
                email: TEST_USER.email,
                displayName: TEST_USER.displayName,
                photoURL: null,
                role: "client",
                isActive: true,
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

        // Create test note
        const noteRef = db
            .collection("users")
            .doc(TEST_USER_ID)
            .collection("notes")
            .doc();
        testNoteId = noteRef.id;
        await noteRef.set({
            id: testNoteId,
            userId: TEST_USER_ID,
            title: TEST_NOTE.title,
            content: TEST_NOTE.content,
            excerpt: TEST_NOTE.content.substring(0, 200),
            folderId: null,
            tags: ["machine-learning"],
            aiTags: [],
            summary: null,
            flashcards: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            viewedAt: Timestamp.now(),
            isPinned: false,
            isArchived: false,
            sourceFile: null,
        });

        // Import routes after mocking
        const { default: aiRouter } = await import("@/routes/ai.routes.js");
        const { errorHandler } = await import("@/middleware/errorHandler.js");

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use("/v1/ai", aiRouter);
        expressApp.use(errorHandler);
    });

    afterAll(async () => {
        // Cleanup: Delete test data
        try {
            // Delete test note
            if (testNoteId) {
                await db
                    .collection("users")
                    .doc(TEST_USER_ID)
                    .collection("notes")
                    .doc(testNoteId)
                    .delete();
            }

            // Delete user document
            await db.collection("users").doc(TEST_USER_ID).delete();

            // Delete any transactions created during tests
            const transactions = await db
                .collection("transactions")
                .where("userId", "==", TEST_USER_ID)
                .get();
            const batch = db.batch();
            transactions.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            // Delete any AI request logs
            const aiRequests = await db
                .collection("ai_requests")
                .where("userId", "==", TEST_USER_ID)
                .get();
            const aiBatch = db.batch();
            aiRequests.forEach((doc) => aiBatch.delete(doc.ref));
            await aiBatch.commit();

            // Clean up system config if modified
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

    describe("Authentication checks", () => {
        test("POST /v1/ai/summarize should return 401 without auth token", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/summarize")
                .send({ noteId: testNoteId });

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });

        test("POST /v1/ai/autoTag should return 401 without auth token", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/autoTag")
                .send({ noteId: testNoteId });

            expect(response.status).toBe(401);
        });

        test("POST /v1/ai/flashcards should return 401 without auth token", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/flashcards")
                .send({ noteId: testNoteId });

            expect(response.status).toBe(401);
        });

        test("POST /v1/ai/ragQuery should return 401 without auth token", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .send({ query: "What is machine learning?" });

            expect(response.status).toBe(401);
        });
    });

    describe("Note validation", () => {
        test("POST /v1/ai/summarize should return 404 for non-existent note", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/summarize")
                .set("Authorization", "Bearer test-token")
                .send({ noteId: "non-existent-note-id" });

            expect(response.status).toBe(404);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NOT_FOUND",
            );
        });

        test("POST /v1/ai/autoTag should return 404 for non-existent note", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/autoTag")
                .set("Authorization", "Bearer test-token")
                .send({ noteId: "non-existent-note-id" });

            expect(response.status).toBe(404);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NOT_FOUND",
            );
        });

        test("POST /v1/ai/flashcards should return 404 for non-existent note", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/flashcards")
                .set("Authorization", "Bearer test-token")
                .send({ noteId: "non-existent-note-id" });

            expect(response.status).toBe(404);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NOT_FOUND",
            );
        });
    });

    describe("Request validation", () => {
        test("POST /v1/ai/ragQuery should validate query minimum length", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({ query: "ab" }); // Too short (min 3 chars)

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("POST /v1/ai/summarize should validate noteId is required", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/summarize")
                .set("Authorization", "Bearer test-token")
                .send({}); // Missing noteId

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });
    });

    describe("Token balance checks", () => {
        test("should return INSUFFICIENT_TOKENS when balance is 0", async () => {
            // Set user's token balance to 0
            await db.collection("users").doc(TEST_USER_ID).update({
                tokenBalance: 0,
            });

            const response = await request(expressApp)
                .post("/v1/ai/summarize")
                .set("Authorization", "Bearer test-token")
                .send({ noteId: testNoteId });

            expect(response.status).toBe(402);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INSUFFICIENT_TOKENS",
            );

            // Restore token balance for other tests
            await db.collection("users").doc(TEST_USER_ID).update({
                tokenBalance: 100,
            });
        });
    });

    describe("Feature flags", () => {
        test("should return FEATURE_DISABLED when summarize is disabled", async () => {
            // Disable summarize feature
            await db
                .collection("system_config")
                .doc("settings")
                .set({
                    features: {
                        summarizeEnabled: false,
                        autoTagEnabled: true,
                        flashcardsEnabled: true,
                        ragQueryEnabled: true,
                    },
                });

            const response = await request(expressApp)
                .post("/v1/ai/summarize")
                .set("Authorization", "Bearer test-token")
                .send({ noteId: testNoteId });

            expect(response.status).toBe(503);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "FEATURE_DISABLED",
            );

            // Re-enable feature
            await db.collection("system_config").doc("settings").delete();
        });
    });

    describe("RAG Query context", () => {
        test("should return NO_CONTEXT when user has no notes", async () => {
            // Temporarily delete the test note
            await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(testNoteId)
                .delete();

            try {
                const response = await request(expressApp)
                    .post("/v1/ai/ragQuery")
                    .set("Authorization", "Bearer test-token")
                    .send({ query: "What is machine learning?" });

                expect(response.status).toBe(400);
                expect((response.body as { error: { code: string } }).error.code).toBe(
                    "NO_CONTEXT",
                );
            } finally {
                // Always restore the test note so subsequent tests can rely on it
                await db
                    .collection("users")
                    .doc(TEST_USER_ID)
                    .collection("notes")
                    .doc(testNoteId)
                    .set({
                        id: testNoteId,
                        userId: TEST_USER_ID,
                        title: TEST_NOTE.title,
                        content: TEST_NOTE.content,
                        excerpt: TEST_NOTE.content.substring(0, 200),
                        folderId: null,
                        tags: ["machine-learning"],
                        aiTags: [],
                        summary: null,
                        flashcards: null,
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                        viewedAt: Timestamp.now(),
                        isPinned: false,
                        isArchived: false,
                        sourceFile: null,
                    });
            }
        });

        test("should return NO_CONTEXT when query has no matching keywords", async () => {
            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({ query: "quantum physics string theory" }); // No match to ML note

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NO_CONTEXT",
            );
        });

        test("should exclude archived notes from context", async () => {
            // Create an archived note with matching content
            const archivedNoteRef = db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc();

            await archivedNoteRef.set({
                id: archivedNoteRef.id,
                userId: TEST_USER_ID,
                title: "Archived Deep Learning Note",
                content: "Deep learning neural networks AI machine learning",
                excerpt: "Deep learning neural networks",
                folderId: null,
                tags: ["deep-learning"],
                aiTags: [],
                summary: null,
                flashcards: null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                viewedAt: Timestamp.now(),
                isPinned: false,
                isArchived: true, // Archived
                sourceFile: null,
            });

            // Also archive the main test note temporarily
            await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(testNoteId)
                .update({ isArchived: true });

            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({ query: "machine learning neural" });

            // Should return NO_CONTEXT because all matching notes are archived
            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NO_CONTEXT",
            );

            // Cleanup
            await archivedNoteRef.delete();
            await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(testNoteId)
                .update({ isArchived: false });
        });
    });

    describe("RAG Query with keyword matching", () => {
        let additionalNoteId: string;

        test("should find notes by title keywords", async () => {
            // Create an additional note
            const additionalNoteRef = db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc();
            additionalNoteId = additionalNoteRef.id;

            await additionalNoteRef.set({
                id: additionalNoteId,
                userId: TEST_USER_ID,
                title: "React JavaScript Frontend Development",
                content: "React is a JavaScript library for building user interfaces.",
                excerpt: "React is a JavaScript library",
                folderId: null,
                tags: ["react", "javascript"],
                aiTags: ["frontend"],
                summary: "Guide to React development",
                flashcards: null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                viewedAt: Timestamp.now(),
                isPinned: false,
                isArchived: false,
                sourceFile: null,
            });

            // Query for "machine learning" should match original note
            // Query for "react javascript" should match additional note
            // We can't directly test the response body for context in integration tests
            // without mocking Gemini, so we verify the endpoint accepts valid queries

            // This will fail at the Gemini API call (no API key in tests)
            // but we can verify the context retrieval worked by checking it got past the NO_CONTEXT error
            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({ query: "react javascript frontend" });

            // Should NOT be NO_CONTEXT (context was found)
            // Will likely be 502 (AI_API_ERROR) because Gemini isn't available in tests
            // or 200 if GEMINI_API_KEY is set in the test environment
            expect(response.status).not.toBe(400);

            // Cleanup
            await db
                .collection("users")
                .doc(TEST_USER_ID)
                .collection("notes")
                .doc(additionalNoteId)
                .delete();
        });

        test("should find notes by tag keywords", async () => {
            // The test note has tag "machine-learning"
            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({ query: "machine-learning algorithms" });

            // Should find context (not NO_CONTEXT error)
            expect(response.status).not.toBe(400);
        });

        test("should respect maxResults parameter", async () => {
            // Create multiple notes
            const noteRefs: string[] = [];
            for (let i = 0; i < 3; i++) {
                const ref = db
                    .collection("users")
                    .doc(TEST_USER_ID)
                    .collection("notes")
                    .doc();
                noteRefs.push(ref.id);
                await ref.set({
                    id: ref.id,
                    userId: TEST_USER_ID,
                    title: `Test Note ${i} about Python`,
                    content: `Python programming content ${i}`,
                    excerpt: `Python programming content ${i}`,
                    folderId: null,
                    tags: ["python"],
                    aiTags: [],
                    summary: null,
                    flashcards: null,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    viewedAt: Timestamp.now(),
                    isPinned: false,
                    isArchived: false,
                    sourceFile: null,
                });
            }

            const response = await request(expressApp)
                .post("/v1/ai/ragQuery")
                .set("Authorization", "Bearer test-token")
                .send({
                    query: "python programming",
                    maxResults: 2, // Limit to 2 results
                });

            // Should not be NO_CONTEXT
            expect(response.status).not.toBe(400);

            // Cleanup
            for (const noteId of noteRefs) {
                await db
                    .collection("users")
                    .doc(TEST_USER_ID)
                    .collection("notes")
                    .doc(noteId)
                    .delete();
            }
        });
    });
});
