/**
 * Admin Routes Integration Tests
 *
 * Tests the admin endpoints against Firebase Emulators
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
const TEST_ADMIN_ID = "test-admin-integration";
const TEST_CLIENT_ID = "test-client-integration";
const ANOTHER_CLIENT_ID = "another-client-integration";

const TEST_ADMIN = {
    email: "admin@example.com",
    displayName: "Test Admin",
    role: "admin" as const,
    isActive: true,
};

const TEST_CLIENT = {
    email: "client@example.com",
    displayName: "Test Client",
    role: "client" as const,
    isActive: true,
};

const ANOTHER_CLIENT = {
    email: "another@example.com",
    displayName: "Another Client",
    role: "client" as const,
    isActive: true,
};

// Variables to hold app instances
let firebaseApp: App;
let db: Firestore;
let expressApp: Express;
let currentTestUserId: string = TEST_ADMIN_ID;

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

describe("Admin Routes Integration Tests", () => {
    beforeAll(async () => {
        // Initialize Firebase Admin as the DEFAULT app
        firebaseApp = initializeApp({ projectId: "demo-sentient-archive" });
        db = getFirestore(firebaseApp);

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

        // Create client user documents
        await db
            .collection("users")
            .doc(TEST_CLIENT_ID)
            .set({
                uid: TEST_CLIENT_ID,
                email: TEST_CLIENT.email,
                displayName: TEST_CLIENT.displayName,
                photoURL: null,
                role: TEST_CLIENT.role,
                isActive: TEST_CLIENT.isActive,
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

        await db
            .collection("users")
            .doc(ANOTHER_CLIENT_ID)
            .set({
                uid: ANOTHER_CLIENT_ID,
                email: ANOTHER_CLIENT.email,
                displayName: ANOTHER_CLIENT.displayName,
                photoURL: null,
                role: ANOTHER_CLIENT.role,
                isActive: ANOTHER_CLIENT.isActive,
                tokenBalance: 200,
                totalTokensGranted: 250,
                totalTokensSpent: 50,
                createdAt: Timestamp.now(),
                lastLoginAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                preferences: {
                    language: "es",
                    theme: "dark",
                    notificationsEnabled: false,
                },
            });

        // Create some test notes
        await db
            .collection("users")
            .doc(TEST_CLIENT_ID)
            .collection("notes")
            .doc("note1")
            .set({
                id: "note1",
                userId: TEST_CLIENT_ID,
                title: "Test Note",
                content: "Test content",
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

        // Create some test transactions
        await db.collection("transactions").doc("tx1").set({
            id: "tx1",
            userId: TEST_CLIENT_ID,
            type: "deduction",
            operation: "summarize",
            amount: 2,
            createdAt: Timestamp.now(),
        });

        await db.collection("transactions").doc("tx2").set({
            id: "tx2",
            userId: TEST_CLIENT_ID,
            type: "deduction",
            operation: "autoTag",
            amount: 1,
            createdAt: Timestamp.now(),
        });

        // Import routes after mocking
        const { default: adminRouter } = await import("@/routes/admin.routes.js");
        const { errorHandler } = await import("@/middleware/errorHandler.js");

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use("/v1/admin", adminRouter);
        expressApp.use(errorHandler);

        // Set default test user to admin
        currentTestUserId = TEST_ADMIN_ID;
    });

    afterAll(async () => {
        // Cleanup: Delete test data
        try {
            // Delete test notes
            await db
                .collection("users")
                .doc(TEST_CLIENT_ID)
                .collection("notes")
                .doc("note1")
                .delete();

            // Delete test transactions
            await db.collection("transactions").doc("tx1").delete();
            await db.collection("transactions").doc("tx2").delete();

            // Delete user documents
            await db.collection("users").doc(TEST_ADMIN_ID).delete();
            await db.collection("users").doc(TEST_CLIENT_ID).delete();
            await db.collection("users").doc(ANOTHER_CLIENT_ID).delete();

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

    describe("Authentication and Authorization", () => {
        test("should return 401 without auth token", async () => {
            const response = await request(expressApp).get("/v1/admin/analytics");

            expect(response.status).toBe(401);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHENTICATED",
            );
        });

        test("should return 403 for non-admin users", async () => {
            // Switch to client user
            currentTestUserId = TEST_CLIENT_ID;

            const response = await request(expressApp)
                .get("/v1/admin/analytics")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(403);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "UNAUTHORIZED",
            );

            // Switch back to admin
            currentTestUserId = TEST_ADMIN_ID;
        });
    });

    describe("GET /v1/admin/analytics", () => {
        test("should return system analytics for admin", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .get("/v1/admin/analytics")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);
            expect((response.body as { success: boolean }).success).toBe(true);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("users");
            expect(data).toHaveProperty("notes");
            expect(data).toHaveProperty("tokens");
            expect(data).toHaveProperty("aiOperations");

            // Verify user stats
            const users = data["users"] as Record<string, number>;
            expect(users["total"]).toBeGreaterThanOrEqual(3);
            expect(users["admins"]).toBeGreaterThanOrEqual(1);
            expect(users["clients"]).toBeGreaterThanOrEqual(2);
        });
    });

    describe("GET /v1/admin/users", () => {
        test("should return list of users with pagination", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .get("/v1/admin/users")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("users");
            expect(data).toHaveProperty("total");
            expect(data).toHaveProperty("limit");
            expect(data).toHaveProperty("offset");

            const users = data["users"] as unknown[];
            expect(Array.isArray(users)).toBe(true);
            expect(users.length).toBeGreaterThanOrEqual(3);
        });

        test("should filter users by role", async () => {
            const response = await request(expressApp)
                .get("/v1/admin/users?role=client")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const users = data["users"] as { role: string }[];

            users.forEach((user) => {
                expect(user.role).toBe("client");
            });
        });

        test("should filter users by isActive", async () => {
            const response = await request(expressApp)
                .get("/v1/admin/users?isActive=true")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const users = data["users"] as { isActive: boolean }[];

            users.forEach((user) => {
                expect(user.isActive).toBe(true);
            });
        });

        test("should search users by email", async () => {
            const response = await request(expressApp)
                .get("/v1/admin/users?search=client")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const users = data["users"] as {
                email: string;
                displayName: string;
            }[];

            // At least one user should match "client" in email or displayName
            const hasMatch = users.some(
                (user) =>
                    user.email.toLowerCase().includes("client") ||
                    user.displayName?.toLowerCase().includes("client"),
            );
            expect(hasMatch).toBe(true);
        });

        test("should respect limit parameter", async () => {
            const response = await request(expressApp)
                .get("/v1/admin/users?limit=2")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const users = data["users"] as unknown[];

            expect(users.length).toBeLessThanOrEqual(2);
            expect(data["limit"]).toBe(2);
        });
    });

    describe("PUT /v1/admin/users/:id", () => {
        test("should update user role", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .put(`/v1/admin/users/${ANOTHER_CLIENT_ID}`)
                .set("Authorization", "Bearer test-token")
                .send({ role: "admin" });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, string> }).data;
            expect(data["role"]).toBe("admin");

            // Restore original role
            await db
                .collection("users")
                .doc(ANOTHER_CLIENT_ID)
                .update({ role: "client" });
        });

        test("should update user isActive status", async () => {
            const response = await request(expressApp)
                .put(`/v1/admin/users/${ANOTHER_CLIENT_ID}`)
                .set("Authorization", "Bearer test-token")
                .send({ isActive: false });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, boolean> }).data;
            expect(data["isActive"]).toBe(false);

            // Restore original status
            await db
                .collection("users")
                .doc(ANOTHER_CLIENT_ID)
                .update({ isActive: true });
        });

        test("should update user tokenBalance", async () => {
            const response = await request(expressApp)
                .put(`/v1/admin/users/${ANOTHER_CLIENT_ID}`)
                .set("Authorization", "Bearer test-token")
                .send({ tokenBalance: 500 });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, number> }).data;
            expect(data["tokenBalance"]).toBe(500);

            // Restore original balance
            await db
                .collection("users")
                .doc(ANOTHER_CLIENT_ID)
                .update({ tokenBalance: 200 });
        });

        test("should prevent self-modification", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .put(`/v1/admin/users/${TEST_ADMIN_ID}`)
                .set("Authorization", "Bearer test-token")
                .send({ role: "client" });

            expect(response.status).toBe(403);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "SELF_MODIFICATION_NOT_ALLOWED",
            );
        });

        test("should return 404 for non-existent user", async () => {
            const response = await request(expressApp)
                .put("/v1/admin/users/non-existent-user-id")
                .set("Authorization", "Bearer test-token")
                .send({ isActive: false });

            expect(response.status).toBe(404);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "NOT_FOUND",
            );
        });

        test("should return 400 when no fields provided", async () => {
            const response = await request(expressApp)
                .put(`/v1/admin/users/${ANOTHER_CLIENT_ID}`)
                .set("Authorization", "Bearer test-token")
                .send({});

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });
    });

    describe("GET /v1/admin/config", () => {
        test("should return system configuration", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .get("/v1/admin/config")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data).toHaveProperty("ai");
            expect(data).toHaveProperty("tokens");
            expect(data).toHaveProperty("features");
            expect(data).toHaveProperty("rateLimits");
            expect(data).toHaveProperty("version");
        });

        test("should return default config when not set", async () => {
            // Ensure no config exists
            await db
                .collection("system_config")
                .doc("settings")
                .delete()
                .catch(() => {
                    // Ignore if doesn't exist
                });

            const response = await request(expressApp)
                .get("/v1/admin/config")
                .set("Authorization", "Bearer test-token");

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const features = data["features"] as Record<string, boolean>;

            // Should have default values
            expect(features["summarizeEnabled"]).toBe(true);
            expect(features["autoTagEnabled"]).toBe(true);
        });
    });

    describe("POST /v1/admin/config", () => {
        test("should update system configuration", async () => {
            currentTestUserId = TEST_ADMIN_ID;

            const response = await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({
                    features: {
                        summarizeEnabled: false,
                    },
                });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const features = data["features"] as Record<string, boolean>;

            expect(features["summarizeEnabled"]).toBe(false);
            // Other features should remain true
            expect(features["autoTagEnabled"]).toBe(true);
        });

        test("should increment version on update", async () => {
            // Get current version
            const getResponse = await request(expressApp)
                .get("/v1/admin/config")
                .set("Authorization", "Bearer test-token");

            const currentVersion = (getResponse.body as { data: { version: number } })
                .data.version;

            // Update config
            const updateResponse = await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({
                    ai: {
                        temperature: 0.8,
                    },
                });

            expect(updateResponse.status).toBe(200);

            const newVersion = (updateResponse.body as { data: { version: number } })
                .data.version;
            expect(newVersion).toBe(currentVersion + 1);
        });

        test("should track lastUpdatedBy", async () => {
            const response = await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({
                    rateLimits: {
                        aiRequestsPerHour: 150,
                    },
                });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            expect(data["lastUpdatedBy"]).toBe(TEST_ADMIN_ID);
        });

        test("should return 400 when no fields provided", async () => {
            const response = await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({});

            expect(response.status).toBe(400);
            expect((response.body as { error: { code: string } }).error.code).toBe(
                "INVALID_REQUEST",
            );
        });

        test("should perform deep merge on nested updates", async () => {
            // First set a known state
            await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({
                    tokens: {
                        costs: {
                            summarize: 5,
                            autoTag: 3,
                        },
                    },
                });

            // Update only one cost
            const response = await request(expressApp)
                .post("/v1/admin/config")
                .set("Authorization", "Bearer test-token")
                .send({
                    tokens: {
                        costs: {
                            summarize: 10,
                        },
                    },
                });

            expect(response.status).toBe(200);

            const data = (response.body as { data: Record<string, unknown> }).data;
            const tokens = data["tokens"] as Record<string, unknown>;
            const costs = tokens["costs"] as Record<string, number>;

            // summarize should be updated
            expect(costs["summarize"]).toBe(10);
            // autoTag should be preserved from previous update
            expect(costs["autoTag"]).toBe(3);
        });
    });
});
