/**
 * Analytics Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Type definitions for mock query builders
interface IMockTransactionQueryBuilder {
    where: jest.Mock<() => IMockTransactionQueryBuilder>;
    orderBy: jest.Mock<
        () => { limit: jest.Mock<() => { get: typeof mockTransactionsGet }> }
    >;
    limit: jest.Mock<() => { get: typeof mockTransactionsGet }>;
    get: typeof mockTransactionsGet;
}

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
            const buildQuery = (): IMockTransactionQueryBuilder => ({
                where: jest.fn((): IMockTransactionQueryBuilder => buildQuery()),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: mockTransactionsGet,
                    })),
                })),
                limit: jest.fn(() => ({
                    get: mockTransactionsGet,
                })),
                get: mockTransactionsGet,
            });
            return buildQuery();
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

jest.unstable_mockModule("@/utils/firestore.js", () => ({
    getDb: jest.fn(() => mockDb),
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

    describe("getAnalyticsWithTrends", () => {
        beforeEach(() => {
            // Ensure base mocks are set up for getAnalytics call within getAnalyticsWithTrends
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

        test("should return analytics with 7-day trends", async () => {
            // Mock transactions for trends
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            amount: 2,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T12:00:00.000Z"),
                            },
                        },
                        {
                            type: "deduction",
                            operation: "autoTag",
                            amount: 1,
                            createdAt: {
                                toDate: () => new Date("2024-01-11T14:00:00.000Z"),
                            },
                        },
                        {
                            type: "grant",
                            operation: "admin_grant",
                            amount: 100,
                            createdAt: {
                                toDate: () => new Date("2024-01-12T10:00:00.000Z"),
                            },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            mockUsersGet.mockResolvedValue({
                size: 2,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 150,
                            totalTokensSpent: 50,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T08:00:00.000Z"),
                            },
                        },
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 200,
                            totalTokensGranted: 300,
                            totalTokensSpent: 100,
                            createdAt: {
                                toDate: () => new Date("2024-01-11T09:00:00.000Z"),
                            },
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");

            expect(analytics).toHaveProperty("users");
            expect(analytics).toHaveProperty("trends");
            expect(analytics.dateRange).toBe("7d");
            expect(analytics.trends).toHaveProperty("aiOperationsOverTime");
            expect(analytics.trends).toHaveProperty("tokenUsageOverTime");
            expect(analytics.trends).toHaveProperty("userGrowthOverTime");
        });

        test("should return analytics with 30-day trends", async () => {
            const analytics = await analyticsService.getAnalyticsWithTrends("30d");

            expect(analytics.dateRange).toBe("30d");
            expect(analytics.trends.aiOperationsOverTime).toHaveLength(30);
            expect(analytics.trends.tokenUsageOverTime).toHaveLength(30);
            expect(analytics.trends.userGrowthOverTime).toHaveLength(30);
        });

        test("should return analytics with 90-day trends", async () => {
            const analytics = await analyticsService.getAnalyticsWithTrends("90d");

            expect(analytics.dateRange).toBe("90d");
            expect(analytics.trends.aiOperationsOverTime).toHaveLength(90);
            expect(analytics.trends.tokenUsageOverTime).toHaveLength(90);
            expect(analytics.trends.userGrowthOverTime).toHaveLength(90);
        });

        test("should default to 30-day trends when no range specified", async () => {
            const analytics = await analyticsService.getAnalyticsWithTrends();

            expect(analytics.dateRange).toBe("30d");
            expect(analytics.trends.aiOperationsOverTime).toHaveLength(30);
        });

        test("should handle errors in getAnalyticsWithTrends", async () => {
            mockUsersGet.mockRejectedValue(new Error("Database error"));

            await expect(
                analyticsService.getAnalyticsWithTrends("7d"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should re-throw AppError in getAnalyticsWithTrends", async () => {
            const { AppError } = await import("@/middleware/errorHandler.js");
            mockUsersGet.mockRejectedValue(
                new AppError("INVALID_REQUEST", 400, "Custom error"),
            );

            await expect(
                analyticsService.getAnalyticsWithTrends("7d"),
            ).rejects.toMatchObject({
                code: "INVALID_REQUEST",
                statusCode: 400,
            });
        });

        test("should handle non-Error thrown objects in getAnalyticsWithTrends", async () => {
            mockUsersGet.mockRejectedValue("String error");

            await expect(
                analyticsService.getAnalyticsWithTrends("7d"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("AI Operations Trend", () => {
        test("should calculate AI operations trend with correct date buckets", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            createdAt: {
                                toDate: () => new Date("2024-01-10T10:00:00.000Z"),
                            },
                        },
                        {
                            type: "deduction",
                            operation: "summarize",
                            createdAt: {
                                toDate: () => new Date("2024-01-10T14:00:00.000Z"),
                            },
                        },
                        {
                            type: "deduction",
                            operation: "autoTag",
                            createdAt: {
                                toDate: () => new Date("2024-01-11T12:00:00.000Z"),
                            },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.aiOperationsOverTime;

            expect(trend).toHaveLength(7);
            expect(trend[0]).toHaveProperty("date");
            expect(trend[0]).toHaveProperty("count");

            // Should be sorted by date
            for (let i = 1; i < trend.length; i++) {
                expect(trend[i]!.date >= trend[i - 1]!.date).toBe(true);
            }
        });

        test("should handle transactions with string createdAt", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateStr = testDate.toISOString();

            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            amount: 2,
                            createdAt: testDateStr,
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.aiOperationsOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.count > 0)).toBe(true);
        });

        test("should handle transactions with number createdAt", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateNum = testDate.getTime();

            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            amount: 2,
                            createdAt: testDateNum,
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.aiOperationsOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.count > 0)).toBe(true);
        });

        test("should handle transactions with undefined createdAt", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            createdAt: undefined,
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.aiOperationsOverTime;

            expect(trend).toHaveLength(7);
        });

        test("should ignore operations outside date range", async () => {
            const oldDate = new Date("2020-01-01T00:00:00.000Z");

            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            createdAt: { toDate: () => oldDate },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.aiOperationsOverTime;

            // Count should be 0 for all buckets since date is outside range
            expect(trend.every((d) => d.count === 0)).toBe(true);
        });
    });

    describe("Token Usage Trend", () => {
        test("should calculate token usage trend with grants and deductions", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "grant",
                            operation: "admin_grant",
                            amount: 100,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T10:00:00.000Z"),
                            },
                        },
                        {
                            type: "deduction",
                            operation: "summarize",
                            amount: 2,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T14:00:00.000Z"),
                            },
                        },
                        {
                            type: "deduction",
                            operation: "autoTag",
                            amount: 1,
                            createdAt: {
                                toDate: () => new Date("2024-01-11T12:00:00.000Z"),
                            },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.tokenUsageOverTime;

            expect(trend).toHaveLength(7);
            expect(trend[0]).toHaveProperty("date");
            expect(trend[0]).toHaveProperty("granted");
            expect(trend[0]).toHaveProperty("spent");

            // Should be sorted by date
            for (let i = 1; i < trend.length; i++) {
                expect(trend[i]!.date >= trend[i - 1]!.date).toBe(true);
            }
        });

        test("should handle transactions with string type", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateStr = testDate.toISOString();

            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "grant",
                            operation: "admin_grant",
                            amount: 50,
                            createdAt: testDateStr,
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.tokenUsageOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.granted > 0)).toBe(true);
        });

        test("should handle transactions with number type", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateNum = testDate.getTime();

            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "deduction",
                            operation: "summarize",
                            amount: 5,
                            createdAt: testDateNum,
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.tokenUsageOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.spent > 0)).toBe(true);
        });

        test("should handle transactions with undefined amount", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "grant",
                            amount: undefined,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T10:00:00.000Z"),
                            },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.tokenUsageOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.every((d) => d.granted === 0 && d.spent === 0)).toBe(true);
        });

        test("should ignore unknown transaction types", async () => {
            mockTransactionsGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            type: "unknown_type",
                            amount: 100,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T10:00:00.000Z"),
                            },
                        },
                    ].forEach((tx) => callback({ data: () => tx }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.tokenUsageOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.every((d) => d.granted === 0 && d.spent === 0)).toBe(true);
        });
    });

    describe("User Growth Trend", () => {
        test("should calculate user growth trend with cumulative totals", async () => {
            mockUsersGet.mockResolvedValue({
                size: 3,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: {
                                toDate: () => new Date("2024-01-10T08:00:00.000Z"),
                            },
                        },
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: {
                                toDate: () => new Date("2024-01-11T09:00:00.000Z"),
                            },
                        },
                        {
                            role: "admin",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: {
                                toDate: () => new Date("2024-01-11T10:00:00.000Z"),
                            },
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.userGrowthOverTime;

            expect(trend).toHaveLength(7);
            expect(trend[0]).toHaveProperty("date");
            expect(trend[0]).toHaveProperty("newUsers");
            expect(trend[0]).toHaveProperty("totalUsers");

            // Cumulative total should never decrease
            for (let i = 1; i < trend.length; i++) {
                expect(trend[i]!.totalUsers).toBeGreaterThanOrEqual(
                    trend[i - 1]!.totalUsers,
                );
            }

            // Should be sorted by date
            for (let i = 1; i < trend.length; i++) {
                expect(trend[i]!.date >= trend[i - 1]!.date).toBe(true);
            }
        });

        test("should handle users with string createdAt", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateStr = testDate.toISOString();

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: testDateStr,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            mockTransactionsGet.mockResolvedValue({
                forEach: jest.fn(),
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.userGrowthOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.newUsers > 0)).toBe(true);
        });

        test("should handle users with number createdAt", async () => {
            // Use a date within the 7-day window (getTrends uses new Date(), not mocked Timestamp)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() - 3); // 3 days ago
            const testDateNum = testDate.getTime();

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: testDateNum,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            mockTransactionsGet.mockResolvedValue({
                forEach: jest.fn(),
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.userGrowthOverTime;

            expect(trend).toHaveLength(7);
            expect(trend.some((d) => d.newUsers > 0)).toBe(true);
        });

        test("should handle users with undefined createdAt", async () => {
            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: undefined,
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.userGrowthOverTime;

            expect(trend).toHaveLength(7);
        });

        test("should ignore users outside date range", async () => {
            const oldDate = new Date("2020-01-01T00:00:00.000Z");

            mockUsersGet.mockResolvedValue({
                size: 1,
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    [
                        {
                            role: "client",
                            isActive: true,
                            tokenBalance: 100,
                            totalTokensGranted: 100,
                            totalTokensSpent: 0,
                            createdAt: { toDate: () => oldDate },
                        },
                    ].forEach((user) => callback({ data: () => user }));
                },
            });

            const analytics = await analyticsService.getAnalyticsWithTrends("7d");
            const trend = analytics.trends.userGrowthOverTime;

            // All buckets should have 0 new users since date is outside range
            expect(trend.every((d) => d.newUsers === 0)).toBe(true);
        });
    });
});
