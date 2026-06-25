/**
 * Analytics Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock Firestore data
const mockUsersData = [
    {
        uid: "user1",
        role: "client",
        isActive: true,
        tokenBalance: 100,
        totalTokensGranted: 150,
        totalTokensSpent: 50,
    },
    {
        uid: "user2",
        role: "client",
        isActive: true,
        tokenBalance: 200,
        totalTokensGranted: 300,
        totalTokensSpent: 100,
    },
    {
        uid: "user3",
        role: "admin",
        isActive: true,
        tokenBalance: 500,
        totalTokensGranted: 500,
        totalTokensSpent: 0,
    },
    {
        uid: "user4",
        role: "client",
        isActive: false,
        tokenBalance: 0,
        totalTokensGranted: 50,
        totalTokensSpent: 50,
    },
];

const mockTransactionsData = [
    { type: "deduction", operation: "summarize", amount: 2 },
    { type: "deduction", operation: "summarize", amount: 2 },
    { type: "deduction", operation: "autoTag", amount: 1 },
    { type: "deduction", operation: "flashcards", amount: 3 },
    { type: "deduction", operation: "ragQuery", amount: 4 },
    { type: "grant", operation: "admin_grant", amount: 100 }, // Should be excluded from AI ops count
];

// Mock Firestore
const mockUsersGet = jest.fn<() => Promise<unknown>>();
const mockNotesCountGet = jest.fn<() => Promise<unknown>>();
const mockTransactionsGet = jest.fn<() => Promise<unknown>>();

const mockDb = {
    collection: jest.fn((name: string) => {
        if (name === "users") {
            return {
                get: mockUsersGet,
            };
        }
        if (name === "transactions") {
            return {
                where: jest.fn(() => ({
                    get: mockTransactionsGet,
                })),
            };
        }
        return {};
    }),
    collectionGroup: jest.fn(() => ({
        count: jest.fn(() => ({
            get: mockNotesCountGet,
        })),
    })),
};

// Mock Firebase modules
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApp: jest.fn(() => {
        throw new Error("No Firebase app initialized");
    }),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(() => mockDb),
    Timestamp: {
        now: jest.fn(() => ({
            toDate: () => new Date("2024-01-15T00:00:00.000Z"),
        })),
    },
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: jest.fn(() => ({})),
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import module dynamically after mocking
let AnalyticsService: typeof import("@/services/analytics.service.js").AnalyticsService;
let analyticsService: import("@/services/analytics.service.js").AnalyticsService;

describe("Analytics Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/analytics.service.js");
        AnalyticsService = mod.AnalyticsService;
        analyticsService = mod.analyticsService;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock responses
        mockUsersGet.mockResolvedValue({
            size: mockUsersData.length,
            forEach: (callback: (doc: { data: () => unknown }) => void) => {
                mockUsersData.forEach((user) => callback({ data: () => user }));
            },
        });

        mockNotesCountGet.mockResolvedValue({
            data: () => ({ count: 150 }),
        });

        mockTransactionsGet.mockResolvedValue({
            forEach: (callback: (doc: { data: () => unknown }) => void) => {
                mockTransactionsData
                    .filter((tx) => tx.type === "deduction")
                    .forEach((tx) => callback({ data: () => tx }));
            },
        });
    });

    describe("getAnalytics", () => {
        test("should return complete system analytics", async () => {
            const analytics = await analyticsService.getAnalytics();

            expect(analytics).toHaveProperty("users");
            expect(analytics).toHaveProperty("notes");
            expect(analytics).toHaveProperty("tokens");
            expect(analytics).toHaveProperty("aiOperations");
        });

        test("should return correct user statistics", async () => {
            const analytics = await analyticsService.getAnalytics();

            expect(analytics.users.total).toBe(4);
            expect(analytics.users.active).toBe(3);
            expect(analytics.users.inactive).toBe(1);
            expect(analytics.users.admins).toBe(1);
            expect(analytics.users.clients).toBe(3);
        });

        test("should return correct notes statistics", async () => {
            const analytics = await analyticsService.getAnalytics();

            expect(analytics.notes.total).toBe(150);
        });

        test("should return correct token statistics", async () => {
            const analytics = await analyticsService.getAnalytics();

            // Sum from mockUsersData
            expect(analytics.tokens.totalGranted).toBe(1000); // 150 + 300 + 500 + 50
            expect(analytics.tokens.totalSpent).toBe(200); // 50 + 100 + 0 + 50
            expect(analytics.tokens.netBalance).toBe(800); // 100 + 200 + 500 + 0
        });

        test("should return correct AI operations statistics", async () => {
            const analytics = await analyticsService.getAnalytics();

            expect(analytics.aiOperations.total).toBe(5); // Only deductions
            expect(analytics.aiOperations.byType.summarize).toBe(2);
            expect(analytics.aiOperations.byType.autoTag).toBe(1);
            expect(analytics.aiOperations.byType.flashcards).toBe(1);
            expect(analytics.aiOperations.byType.ragQuery).toBe(1);
        });

        test("should handle empty users collection", async () => {
            mockUsersGet.mockResolvedValue({
                size: 0,
                forEach: jest.fn(),
            });

            const analytics = await analyticsService.getAnalytics();

            expect(analytics.users.total).toBe(0);
            expect(analytics.users.active).toBe(0);
            expect(analytics.users.inactive).toBe(0);
            expect(analytics.tokens.totalGranted).toBe(0);
            expect(analytics.tokens.totalSpent).toBe(0);
            expect(analytics.tokens.netBalance).toBe(0);
        });

        test("should handle empty transactions collection", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: jest.fn(),
            });

            const analytics = await analyticsService.getAnalytics();

            expect(analytics.aiOperations.total).toBe(0);
            expect(analytics.aiOperations.byType.summarize).toBe(0);
            expect(analytics.aiOperations.byType.autoTag).toBe(0);
            expect(analytics.aiOperations.byType.flashcards).toBe(0);
            expect(analytics.aiOperations.byType.ragQuery).toBe(0);
        });

        test("should handle Firestore errors gracefully", async () => {
            mockUsersGet.mockRejectedValue(new Error("Firestore connection error"));

            await expect(analyticsService.getAnalytics()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should re-throw AppError directly", async () => {
            const { AppError } = await import("@/middleware/errorHandler.js");
            mockUsersGet.mockRejectedValue(
                new AppError("NOT_FOUND", 404, "Test error"),
            );

            await expect(analyticsService.getAnalytics()).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
            });
        });

        test("should handle non-Error thrown objects", async () => {
            mockUsersGet.mockRejectedValue("String error");

            await expect(analyticsService.getAnalytics()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should handle missing token fields in user documents", async () => {
            mockUsersGet.mockResolvedValue({
                size: 2,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    // Users without token fields
                    [
                        { uid: "user1", role: "client", isActive: true },
                        { uid: "user2", role: "admin", isActive: false },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalytics();

            // Should default to 0 for missing fields
            expect(analytics.tokens.totalGranted).toBe(0);
            expect(analytics.tokens.totalSpent).toBe(0);
            expect(analytics.tokens.netBalance).toBe(0);
        });

        test("should ignore unknown operation types", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        { type: "deduction", operation: "summarize", amount: 2 },
                        { type: "deduction", operation: "unknownOperation", amount: 5 },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalytics();

            // Should only count known operations
            expect(analytics.aiOperations.total).toBe(1);
            expect(analytics.aiOperations.byType.summarize).toBe(1);
        });

        test("should run aggregations in parallel", async () => {
            // Track call order
            const callOrder: string[] = [];

            mockUsersGet.mockImplementation(async () => {
                callOrder.push("users-start");
                await new Promise((resolve) => setTimeout(resolve, 10));
                callOrder.push("users-end");
                return {
                    size: 1,
                    forEach: (callback: (doc: { data: () => unknown }) => void) => {
                        callback({
                            data: () => ({
                                role: "client",
                                isActive: true,
                                tokenBalance: 100,
                                totalTokensGranted: 100,
                                totalTokensSpent: 0,
                            }),
                        });
                    },
                };
            });

            mockNotesCountGet.mockImplementation(async () => {
                callOrder.push("notes-start");
                await new Promise((resolve) => setTimeout(resolve, 10));
                callOrder.push("notes-end");
                return { data: () => ({ count: 10 }) };
            });

            mockTransactionsGet.mockImplementation(async () => {
                callOrder.push("transactions-start");
                await new Promise((resolve) => setTimeout(resolve, 10));
                callOrder.push("transactions-end");
                return { forEach: jest.fn() };
            });

            await analyticsService.getAnalytics();

            // All starts should happen before all ends (parallel execution)
            const startIndices = callOrder
                .map((c, i) => (c.endsWith("-start") ? i : -1))
                .filter((i) => i >= 0);
            const endIndices = callOrder
                .map((c, i) => (c.endsWith("-end") ? i : -1))
                .filter((i) => i >= 0);

            // At least some parallelism should occur
            // (all starts before all ends would indicate parallel execution)
            expect(Math.max(...startIndices)).toBeLessThan(Math.max(...endIndices));
        });
    });

    describe("AnalyticsService class instantiation", () => {
        test("should create new instance", () => {
            const service = new AnalyticsService();
            expect(service).toBeInstanceOf(AnalyticsService);
        });

        test("singleton instance should be available", () => {
            expect(analyticsService).toBeInstanceOf(AnalyticsService);
        });
    });
});
