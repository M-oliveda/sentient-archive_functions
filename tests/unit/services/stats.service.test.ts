/**
 * Stats Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock Firestore timestamp helper
const mockTimestampNow = jest.fn(() => ({
    toDate: () => new Date("2024-01-15T00:00:00.000Z"),
    toMillis: () => new Date("2024-01-15T00:00:00.000Z").getTime(),
}));

const makeTimestamp = (date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
});

// Mock data for analytics
const mockAnalytics = {
    users: { total: 10, active: 8, inactive: 2, admins: 1, clients: 9 },
    notes: { total: 50 },
    tokens: { totalGranted: 5000, totalSpent: 1000, netBalance: 4000 },
    aiOperations: {
        total: 20,
        byType: { summarize: 5, autoTag: 10, flashcards: 3, ragQuery: 2 },
    },
};

// Mock analytics service
const mockGetAnalytics = jest.fn<() => Promise<typeof mockAnalytics>>();
jest.unstable_mockModule("@/services/analytics.service.js", () => ({
    analyticsService: { getAnalytics: mockGetAnalytics },
}));

// Firestore mocks
const mockConfigDocGet = jest
    .fn<() => Promise<{ exists: boolean; data: () => unknown }>>()
    .mockResolvedValue({ exists: true, data: () => ({}) });

const mockTransactionsSnapshot = {
    empty: false,
    docs: [] as { data: () => unknown }[],
};

const mockUserDocGet =
    jest.fn<
        (id?: string) => Promise<{ exists: boolean; id: string; data: () => unknown }>
    >();

const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockTransactionCollectionGet =
    jest.fn<() => Promise<typeof mockTransactionsSnapshot>>();

const mockDb = {
    collection: jest.fn((name: string) => {
        if (name === "system_config") {
            return {
                doc: jest.fn(() => ({
                    get: mockConfigDocGet,
                })),
            };
        }
        if (name === "transactions") {
            const chain = {
                orderBy: mockOrderBy,
                limit: mockLimit,
                get: mockTransactionCollectionGet,
            };
            mockOrderBy.mockReturnValue(chain);
            mockLimit.mockReturnValue(chain);
            return chain;
        }
        if (name === "users") {
            return {
                doc: jest.fn((id: string) => ({
                    get: () => mockUserDocGet(id),
                })),
            };
        }
        return {};
    }),
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
        now: mockTimestampNow,
        fromDate: (date: Date) => ({ toDate: () => date }),
    },
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: jest.fn(() => ({})),
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let StatsService: typeof import("@/services/stats.service.js").StatsService;
let statsService: import("@/services/stats.service.js").StatsService;

describe("Stats Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/stats.service.js");
        StatsService = mod.StatsService;
        statsService = mod.statsService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAnalytics.mockResolvedValue(mockAnalytics);
        mockConfigDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
        mockOrderBy.mockReturnValue({
            limit: mockLimit,
            get: mockTransactionCollectionGet,
        });
        mockLimit.mockReturnValue({ get: mockTransactionCollectionGet });
    });

    describe("getSystemHealth", () => {
        test("returns Operational for all services when Firestore is reachable", async () => {
            const health = await statsService.getSystemHealth();

            expect(health).toEqual([
                { service: "Core API", status: "Operational" },
                { service: "Firestore", status: "Operational" },
                { service: "Auth Service", status: "Operational" },
                { service: "AI Service", status: "Operational" },
            ]);
        });

        test("returns Down for Firestore when the health check read fails", async () => {
            mockConfigDocGet.mockRejectedValue(new Error("Firestore unavailable"));

            const health = await statsService.getSystemHealth();

            const firestoreEntry = health.find((h) => h.service === "Firestore");
            expect(firestoreEntry?.status).toBe("Down");

            const apiEntry = health.find((h) => h.service === "Core API");
            expect(apiEntry?.status).toBe("Operational");
        });
    });

    describe("getRecentActivity", () => {
        test("returns empty array when there are no transactions", async () => {
            mockTransactionCollectionGet.mockResolvedValue({
                empty: true,
                docs: [],
            });

            const activity = await statsService.getRecentActivity();

            expect(activity).toEqual([]);
        });

        test("formats grant transactions correctly", async () => {
            const createdAt = makeTimestamp(new Date(Date.now() - 90 * 1000)); // 90s ago → 1m ago
            mockTransactionCollectionGet.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            id: "tx1",
                            userId: "user1",
                            type: "grant",
                            amount: 100,
                            operation: "admin_grant",
                            balanceBefore: 0,
                            balanceAfter: 100,
                            createdAt,
                            description: "Welcome grant",
                        }),
                    },
                ],
            });
            mockUserDocGet.mockResolvedValue({
                exists: true,
                id: "user1",
                data: () => ({ displayName: "Alice" }),
            });

            const activity = await statsService.getRecentActivity();

            expect(activity).toHaveLength(1);
            expect(activity[0]?.name).toBe("Alice");
            expect(activity[0]?.action).toBe("received 100 tokens.");
            expect(activity[0]?.timeAgo).toBe("1m ago");
        });

        test("formats deduction transactions for each operation type", async () => {
            const operations: Array<[string, string]> = [
                ["summarize", "generated a summary"],
                ["autoTag", "auto-tagged notes"],
                ["flashcards", "created flashcards"],
                ["ragQuery", "queried the AI assistant"],
            ];

            for (const [operation, expectedLabel] of operations) {
                jest.clearAllMocks();
                mockGetAnalytics.mockResolvedValue(mockAnalytics);
                mockConfigDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

                const createdAt = makeTimestamp(new Date(Date.now() - 5 * 60 * 1000)); // 5m ago
                mockTransactionCollectionGet.mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            data: () => ({
                                id: `tx-${operation}`,
                                userId: "user1",
                                type: "deduction",
                                amount: 2,
                                operation,
                                balanceBefore: 100,
                                balanceAfter: 98,
                                createdAt,
                                description: "op",
                            }),
                        },
                    ],
                });
                mockUserDocGet.mockResolvedValue({
                    exists: true,
                    id: "user1",
                    data: () => ({ displayName: "Bob" }),
                });
                mockOrderBy.mockReturnValue({
                    limit: mockLimit,
                    get: mockTransactionCollectionGet,
                });
                mockLimit.mockReturnValue({ get: mockTransactionCollectionGet });

                const activity = await statsService.getRecentActivity();
                expect(activity[0]?.action).toBe(`${expectedLabel} (2 tokens).`);
            }
        });

        test("falls back to email when displayName is absent", async () => {
            const createdAt = makeTimestamp(new Date(Date.now() - 30 * 1000));
            mockTransactionCollectionGet.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            id: "tx2",
                            userId: "user2",
                            type: "deduction",
                            amount: 1,
                            operation: "autoTag",
                            balanceBefore: 50,
                            balanceAfter: 49,
                            createdAt,
                            description: "op",
                        }),
                    },
                ],
            });
            mockUserDocGet.mockResolvedValue({
                exists: true,
                id: "user2",
                data: () => ({ email: "carol@example.com" }),
            });

            const activity = await statsService.getRecentActivity();

            expect(activity[0]?.name).toBe("carol@example.com");
        });

        test("falls back to Unknown User when user doc does not exist", async () => {
            const createdAt = makeTimestamp(new Date(Date.now() - 30 * 1000));
            mockTransactionCollectionGet.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            id: "tx3",
                            userId: "ghost",
                            type: "deduction",
                            amount: 1,
                            operation: "autoTag",
                            balanceBefore: 10,
                            balanceAfter: 9,
                            createdAt,
                            description: "op",
                        }),
                    },
                ],
            });
            mockUserDocGet.mockResolvedValue({
                exists: false,
                id: "ghost",
                data: () => undefined,
            });

            const activity = await statsService.getRecentActivity();

            expect(activity[0]?.name).toBe("Unknown User");
        });

        test("falls back to Unknown User when user doc exists but has no displayName or email", async () => {
            const createdAt = makeTimestamp(new Date(Date.now() - 30 * 1000));
            mockTransactionCollectionGet.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            id: "tx5",
                            userId: "user5",
                            type: "deduction",
                            amount: 1,
                            operation: "autoTag",
                            balanceBefore: 10,
                            balanceAfter: 9,
                            createdAt,
                            description: "op",
                        }),
                    },
                ],
            });
            mockUserDocGet.mockResolvedValue({
                exists: true,
                id: "user5",
                data: () => ({}),
            });

            const activity = await statsService.getRecentActivity();

            expect(activity[0]?.name).toBe("Unknown User");
        });

        test("formats unknown operation type with generic label", async () => {
            const createdAt = makeTimestamp(new Date(Date.now() - 30 * 1000));
            mockTransactionCollectionGet.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            id: "tx4",
                            userId: "user1",
                            type: "deduction",
                            amount: 5,
                            operation: "unknownOp",
                            balanceBefore: 50,
                            balanceAfter: 45,
                            createdAt,
                            description: "op",
                        }),
                    },
                ],
            });
            mockUserDocGet.mockResolvedValue({
                exists: true,
                id: "user1",
                data: () => ({ displayName: "Dave" }),
            });

            const activity = await statsService.getRecentActivity();

            expect(activity[0]?.action).toBe("performed an AI operation (5 tokens).");
        });

        describe("timeAgo formatting", () => {
            test("returns seconds format for less than 60s", async () => {
                const createdAt = makeTimestamp(new Date(Date.now() - 45 * 1000));
                mockTransactionCollectionGet.mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            data: () => ({
                                id: "tx",
                                userId: "u1",
                                type: "grant",
                                amount: 10,
                                operation: "admin_grant",
                                balanceBefore: 0,
                                balanceAfter: 10,
                                createdAt,
                                description: "",
                            }),
                        },
                    ],
                });
                mockUserDocGet.mockResolvedValue({
                    exists: true,
                    id: "u1",
                    data: () => ({ displayName: "X" }),
                });

                const [entry] = await statsService.getRecentActivity();
                expect(entry?.timeAgo).toMatch(/^\d+s ago$/);
            });

            test("returns minutes format for 1–59 minutes", async () => {
                const createdAt = makeTimestamp(new Date(Date.now() - 10 * 60 * 1000));
                mockTransactionCollectionGet.mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            data: () => ({
                                id: "tx",
                                userId: "u1",
                                type: "grant",
                                amount: 10,
                                operation: "admin_grant",
                                balanceBefore: 0,
                                balanceAfter: 10,
                                createdAt,
                                description: "",
                            }),
                        },
                    ],
                });
                mockUserDocGet.mockResolvedValue({
                    exists: true,
                    id: "u1",
                    data: () => ({ displayName: "X" }),
                });

                const [entry] = await statsService.getRecentActivity();
                expect(entry?.timeAgo).toMatch(/^\d+m ago$/);
            });

            test("returns hours format for 1–23 hours", async () => {
                const createdAt = makeTimestamp(
                    new Date(Date.now() - 3 * 60 * 60 * 1000),
                );
                mockTransactionCollectionGet.mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            data: () => ({
                                id: "tx",
                                userId: "u1",
                                type: "grant",
                                amount: 10,
                                operation: "admin_grant",
                                balanceBefore: 0,
                                balanceAfter: 10,
                                createdAt,
                                description: "",
                            }),
                        },
                    ],
                });
                mockUserDocGet.mockResolvedValue({
                    exists: true,
                    id: "u1",
                    data: () => ({ displayName: "X" }),
                });

                const [entry] = await statsService.getRecentActivity();
                expect(entry?.timeAgo).toMatch(/^\d+h ago$/);
            });

            test("returns days format for 24+ hours", async () => {
                const createdAt = makeTimestamp(
                    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                );
                mockTransactionCollectionGet.mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            data: () => ({
                                id: "tx",
                                userId: "u1",
                                type: "grant",
                                amount: 10,
                                operation: "admin_grant",
                                balanceBefore: 0,
                                balanceAfter: 10,
                                createdAt,
                                description: "",
                            }),
                        },
                    ],
                });
                mockUserDocGet.mockResolvedValue({
                    exists: true,
                    id: "u1",
                    data: () => ({ displayName: "X" }),
                });

                const [entry] = await statsService.getRecentActivity();
                expect(entry?.timeAgo).toMatch(/^\d+d ago$/);
            });
        });
    });

    describe("getAdminStats", () => {
        test("maps analytics data to flat AdminStats shape", async () => {
            mockTransactionCollectionGet.mockResolvedValue({ empty: true, docs: [] });

            const stats = await statsService.getAdminStats();

            expect(stats.totalUsers).toBe(10);
            expect(stats.totalNotes).toBe(50);
            expect(stats.totalTokens).toBe(4000);
            expect(stats.totalAIOperations).toBe(20);
            expect(Array.isArray(stats.systemHealth)).toBe(true);
            expect(Array.isArray(stats.recentActivity)).toBe(true);
        });

        test("throws AppError when analytics service fails", async () => {
            mockGetAnalytics.mockRejectedValue(new Error("Analytics failure"));

            await expect(statsService.getAdminStats()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("re-throws AppError directly without wrapping", async () => {
            const { AppError } = await import("@/middleware/errorHandler.js");
            const originalError = new AppError("NOT_FOUND", 404, "Resource not found");
            mockGetAnalytics.mockRejectedValue(originalError);

            await expect(statsService.getAdminStats()).rejects.toBe(originalError);
        });

        test("wraps non-Error thrown objects in INTERNAL_ERROR AppError", async () => {
            mockGetAnalytics.mockRejectedValue("string error");

            await expect(statsService.getAdminStats()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("StatsService class", () => {
        test("statsService singleton is an instance of StatsService", () => {
            expect(statsService).toBeInstanceOf(StatsService);
        });
    });
});
