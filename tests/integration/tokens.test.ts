/**
 * Token Routes Integration Tests
 *
 * Tests the token endpoints against Firebase Emulators
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
const TEST_USER_ID = "test-tokens-integration-user";
const TEST_ADMIN_ID = "test-tokens-admin-user";
const TEST_TARGET_USER_ID = "test-tokens-target-user";

const TEST_USER = {
    email: "tokens-user@example.com",
    displayName: "Token Test User",
    role: "client" as const,
    isActive: true,
};

const TEST_ADMIN = {
    email: "tokens-admin@example.com",
    displayName: "Token Admin User",
    role: "admin" as const,
    isActive: true,
};

const TEST_TARGET_USER = {
    email: "tokens-target@example.com",
    displayName: "Token Target User",
    role: "client" as const,
    isActive: true,
};

// Variables to hold app instances
let firebaseApp: App;
let db: Firestore;
let expressApp: Express;
let currentTestUserId: string = TEST_USER_ID;

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
            const userDoc = await db.collection("users").doc(currentTestUserId).get();
            if (userDoc.exists) {
                req.user = userDoc.data() as typeof req.user;
                req.uid = currentTestUserId;
            }
        }
        next();
    },
}));

describe("Token Routes Integration Tests", () => {
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

        // Create admin user document
        await db
            .collection("users")
            .doc(TEST_ADMIN_ID)
            .set({
                uid: TEST_ADMIN_ID,
                email: TEST_ADMIN.email,
                displayName: TEST_ADMIN.displayName,
                photoURL: null,
                role: TEST_ADMIN.role,
                isActive: TEST_ADMIN.isActive,
                tokenBalance: 1000,
                totalTokensGranted: 1000,
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

        // Create target user document (for mint tests)
        await db
            .collection("users")
            .doc(TEST_TARGET_USER_ID)
            .set({
                uid: TEST_TARGET_USER_ID,
                email: TEST_TARGET_USER.email,
                displayName: TEST_TARGET_USER.displayName,
                photoURL: null,
                role: TEST_TARGET_USER.role,
                isActive: TEST_TARGET_USER.isActive,
                tokenBalance: 50,
                totalTokensGranted: 50,
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

        // Create some transaction history for the test user
        await db
            .collection("transactions")
            .doc("tx-balance-1")
            .set({
                id: "tx-balance-1",
                userId: TEST_USER_ID,
                type: "grant",
                operation: "initial_grant",
                amount: 100,
                balanceBefore: 0,
                balanceAfter: 100,
                description: "Initial token grant",
                grantedBy: "system",
                createdAt: Timestamp.fromDate(new Date("2024-01-01T00:00:00Z")),
            });

        await db
            .collection("transactions")
            .doc("tx-balance-2")
            .set({
                id: "tx-balance-2",
                userId: TEST_USER_ID,
                type: "deduction",
                operation: "summarize",
                amount: 2,
                balanceBefore: 100,
                balanceAfter: 98,
                description: "AI summarization",
                noteId: "test-note-id",
                createdAt: Timestamp.fromDate(new Date("2024-01-02T00:00:00Z")),
            });

        await db
            .collection("transactions")
            .doc("tx-balance-3")
            .set({
                id: "tx-balance-3",
                userId: TEST_USER_ID,
                type: "deduction",
                operation: "autoTag",
                amount: 1,
                balanceBefore: 98,
                balanceAfter: 97,
                description: "AI auto-tagging",
                noteId: "test-note-id",
                createdAt: Timestamp.fromDate(new Date("2024-01-03T00:00:00Z")),
            });

        // Import routes after mocking
        const { default: tokensRouter } = await import("@/routes/tokens.routes.js");
        const { errorHandler } = await import("@/middleware/errorHandler.js");

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use("/v1/tokens", tokensRouter);
        expressApp.use(errorHandler);

        // Set default test user
        currentTestUserId = TEST_USER_ID;
    });

    afterAll(async () => {
        // Cleanup: Delete test data
        try {
            // Delete test transactions
            const transactions = await db
                .collection("transactions")
                .where("userId", "in", [TEST_USER_ID, TEST_TARGET_USER_ID])
                .get();
            const batch = db.batch();
            transactions.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            // Delete additional test transactions
            await db
                .collection("transactions")
                .doc("tx-balance-1")
                .delete()
                .catch(() => {
                    // Ignore if doesn't exist
                });
            await db
                .collection("transactions")
                .doc("tx-balance-2")
                .delete()
                .catch(() => {
                    // Ignore if doesn't exist
                });
            await db
                .collection("transactions")
                .doc("tx-balance-3")
                .delete()
                .catch(() => {
                    // Ignore if doesn't exist
                });

            // Delete user documents
            await db.collection("users").doc(TEST_USER_ID).delete();
            await db.collection("users").doc(TEST_ADMIN_ID).delete();
            await db.collection("users").doc(TEST_TARGET_USER_ID).delete();
        } catch (error) {
            console.error("Cleanup error:", error);
        }

        // Delete app
        await deleteApp(firebaseApp);
    });

    describe("Authentication", () => {
        test("GET /v1/tokens/balance should return 401 without auth token", async () => {
            const response = await request(expressApp).get("/v1/tokens/balance");

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });

        test("GET /v1/tokens/history should return 401 without auth token", async () => {
            const response = await request(expressApp).get("/v1/tokens/history");

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });

        test("POST /v1/tokens/mint should return 401 without auth token", async () => {
            const response = await request(expressApp).post("/v1/tokens/mint").send({
                userId: TEST_TARGET_USER_ID,
                amount: 50,
                reason: "Test grant",
            });

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });
    });

    describe("GET /v1/tokens/balance", () => {
        test("should return token balance for authenticated user", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/balance")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("balance");
            expect(data).toHaveProperty("totalGranted");
            expect(data).toHaveProperty("totalSpent");
            expect(typeof data["balance"]).toBe("number");
        });

        test("should return correct balance values", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/balance")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, number> }).data;
            expect(data["balance"]).toBe(100);
            expect(data["totalGranted"]).toBe(100);
            expect(data["totalSpent"]).toBe(0);
        });
    });

    describe("GET /v1/tokens/history", () => {
        test("should return transaction history for authenticated user", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: unknown[] }).data;
            expect(Array.isArray(data)).toBe(true);
        });

        test("should respect limit parameter", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history?limit=2")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: unknown[] }).data;
            expect(data.length).toBeLessThanOrEqual(2);
        });

        test("should filter by type=grant", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history?type=grant")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: { type: string }[] }).data;
            data.forEach((tx) => {
                expect(tx.type).toBe("grant");
            });
        });

        test("should filter by type=deduction", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history?type=deduction")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: { type: string }[] }).data;
            data.forEach((tx) => {
                expect(tx.type).toBe("deduction");
            });
        });

        test("should return 400 for invalid limit", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history?limit=200") // Max is 100
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("should return 400 for invalid type", async () => {
            currentTestUserId = TEST_USER_ID;

            const response = await request(expressApp)
                .get("/v1/tokens/history?type=invalid")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });
    });

    describe("POST /v1/tokens/mint", () => {
        test("should return 403 for non-admin users", async () => {
            currentTestUserId = TEST_USER_ID; // Regular client user

            const response = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 50,
                    reason: "Test grant",
                });

            expect(response.status).toBe(403);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHORIZED",
            );
        });

        test("should allow admin to grant tokens", async () => {
            currentTestUserId = TEST_ADMIN_ID; // Admin user

            const response = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 100,
                    reason: "Integration test grant",
                });

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("type");
            expect(data["type"]).toBe("grant");
            expect(data["amount"]).toBe(100);
            expect(data["userId"]).toBe(TEST_TARGET_USER_ID);
        });

        test("should update target user balance after mint", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            // Get initial balance
            const userDoc = await db.collection("users").doc(TEST_TARGET_USER_ID).get();
            const initialBalance = (userDoc.data() as { tokenBalance: number })
                .tokenBalance;

            await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 25,
                    reason: "Balance update test",
                });

            // Verify balance was updated
            const updatedUserDoc = await db
                .collection("users")
                .doc(TEST_TARGET_USER_ID)
                .get();
            const newBalance = (updatedUserDoc.data() as { tokenBalance: number })
                .tokenBalance;

            expect(newBalance).toBe(initialBalance + 25);
        });

        test("should prevent self-minting", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_ADMIN_ID, // Trying to grant to self
                    amount: 1000,
                    reason: "Self grant attempt",
                });

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("should return 404 for non-existent user", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: "non-existent-user-id",
                    amount: 50,
                    reason: "Grant to non-existent user",
                });

            expect(response.status).toBe(404);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NOT_FOUND",
            );
        });

        test("should validate amount range", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            // Test amount too low
            const responseLow = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 0,
                    reason: "Invalid amount",
                });

            expect(responseLow.status).toBe(400);

            // Test amount too high
            const responseHigh = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 50000, // Max is 10000
                    reason: "Invalid amount",
                });

            expect(responseHigh.status).toBe(400);
        });

        test("should validate reason length", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            // Test reason too short
            const responseShort = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 50,
                    reason: "ab", // Min is 3 chars
                });

            expect(responseShort.status).toBe(400);
            expect((responseShort.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("should require all fields", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            // Missing userId
            const response1 = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    amount: 50,
                    reason: "Test grant",
                });

            expect(response1.status).toBe(400);

            // Missing amount
            const response2 = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    reason: "Test grant",
                });

            expect(response2.status).toBe(400);

            // Missing reason
            const response3 = await request(expressApp)
                .post("/v1/tokens/mint")
                .set("Authorization", "Bearer test-token")
                .send({
                    userId: TEST_TARGET_USER_ID,
                    amount: 50,
                });

            expect(response3.status).toBe(400);
        });
    });
});
