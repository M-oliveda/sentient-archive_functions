/**
 * Activity Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

type DocData = Record<string, unknown>;

interface IMockQueryBuilder {
    where: jest.Mock<() => IMockQueryBuilder>;
    limit: jest.Mock<() => IMockQueryBuilder>;
    get: jest.MockedFunction<() => Promise<ReturnType<typeof makeSnapshot>>>;
}

interface IMockTransactionQueryBuilder {
    where: jest.Mock<() => IMockTransactionQueryBuilder>;
    orderBy: jest.Mock<() => { limit: jest.Mock<() => { get: typeof mockTxGet }> }>;
    limit: jest.Mock<() => { get: typeof mockTxGet }>;
}

function ts(date: Date): { toDate: () => Date } {
    return { toDate: () => date };
}

function makeDoc(id: string, data: DocData): { id: string; data: () => DocData } {
    return { id, data: () => data };
}

function makeSnapshot(docs: ReturnType<typeof makeDoc>[]): {
    forEach: (cb: (doc: ReturnType<typeof makeDoc>) => void) => void;
} {
    return {
        forEach: (cb: (doc: ReturnType<typeof makeDoc>) => void) => docs.forEach(cb),
    };
}

const mockTxGet = jest.fn<() => Promise<ReturnType<typeof makeSnapshot>>>();
const mockNotesGet = jest.fn<() => Promise<ReturnType<typeof makeSnapshot>>>();
const mockFoldersGet = jest.fn<() => Promise<ReturnType<typeof makeSnapshot>>>();
const mockUsersGet = jest.fn<() => Promise<ReturnType<typeof makeSnapshot>>>();

jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApp: jest.fn(() => {
        throw new Error("No Firebase app initialized");
    }),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(),
    Timestamp: {
        fromDate: (date: Date) => ({
            toDate: () => date,
        }),
        now: jest.fn(() => ({
            toDate: () => new Date(),
        })),
    },
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
    getDb: jest.fn(() => ({
        collection: jest.fn((name: string) => {
            if (name === "transactions") {
                const buildQuery = (): IMockTransactionQueryBuilder => ({
                    where: jest.fn((): IMockTransactionQueryBuilder => buildQuery()),
                    orderBy: jest.fn(() => ({
                        limit: jest.fn(() => ({
                            get: mockTxGet,
                        })),
                    })),
                    limit: jest.fn(() => ({
                        get: mockTxGet,
                    })),
                });
                return buildQuery();
            }
            if (name === "users") {
                return {
                    doc: jest.fn(() => ({
                        collection: jest.fn((sub: string) => {
                            const buildQuery: () => IMockQueryBuilder = () => ({
                                where: jest.fn((): IMockQueryBuilder => buildQuery()),
                                limit: jest.fn((): IMockQueryBuilder => buildQuery()),
                                get: sub === "notes" ? mockNotesGet : mockFoldersGet,
                            });
                            return buildQuery();
                        }),
                    })),
                    get: mockUsersGet,
                };
            }
            return {};
        }),
        collectionGroup: jest.fn((name: string) => {
            const buildQuery: () => IMockQueryBuilder = () => ({
                where: jest.fn((): IMockQueryBuilder => buildQuery()),
                limit: jest.fn((): IMockQueryBuilder => buildQuery()),
                get: name === "notes" ? mockNotesGet : mockFoldersGet,
            });
            return buildQuery();
        }),
    })),
}));

let activityService: typeof import("@/services/activity.service.js").activityService;

describe("ActivityService", () => {
    beforeAll(async () => {
        const mod = await import("@/services/activity.service.js");
        activityService = mod.activityService;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        const today = new Date();
        today.setHours(10, 0, 0, 0);

        mockTxGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("tx1", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 2,
                    operation: "summarize",
                    balanceBefore: 10,
                    balanceAfter: 8,
                    createdAt: ts(today),
                    description: "Summarized note",
                }),
                makeDoc("tx2", {
                    userId: "user-1",
                    type: "grant",
                    amount: 20,
                    operation: "admin_grant",
                    balanceBefore: 0,
                    balanceAfter: 20,
                    createdAt: ts(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
                    description: "Admin grant",
                }),
            ]),
        );

        const noteCreated = new Date(today);
        noteCreated.setHours(9, 0, 0, 0);
        const noteUpdated = new Date(noteCreated.getTime() + 5 * 60 * 1000);

        mockNotesGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("note1", {
                    title: "Research notes",
                    createdAt: ts(noteCreated),
                    updatedAt: ts(noteUpdated),
                }),
            ]),
        );

        mockFoldersGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("folder1", {
                    name: "Projects",
                    createdAt: ts(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
                }),
            ]),
        );
    });

    test("getFeed returns mixed events sorted by date", async () => {
        const feed = await activityService.getFeed("user-1");

        expect(feed.length).toBeGreaterThanOrEqual(4);
        expect(feed[0]!.createdAt >= feed[1]!.createdAt).toBe(true);
    });

    test("getFeed filters by category ai", async () => {
        const feed = await activityService.getFeed("user-1", {
            category: "ai",
        });

        expect(feed.every((e) => e.category === "ai")).toBe(true);
        expect(feed.some((e) => e.title === "AI Summary")).toBe(true);
    });

    test("getFeed filters by search query", async () => {
        const feed = await activityService.getFeed("user-1", {
            q: "research",
        });

        expect(feed.length).toBeGreaterThan(0);
        expect(
            feed.every(
                (e) =>
                    e.title.toLowerCase().includes("research") ||
                    e.description.toLowerCase().includes("research"),
            ),
        ).toBe(true);
    });

    test("getFeed paginates with limit and offset", async () => {
        const page = await activityService.getFeed("user-1", {
            limit: 2,
            offset: 0,
        });
        expect(page).toHaveLength(2);
    });

    test("getStats returns totals and deltas", async () => {
        const stats = await activityService.getStats("user-1");

        expect(stats.totalActions).toBeGreaterThan(0);
        expect(stats.actionsToday).toBeGreaterThan(0);
        expect(typeof stats.actionsTodayDeltaPct).toBe("number");
        expect(typeof stats.aiOpsThisWeek).toBe("number");
        expect(typeof stats.aiOpsThisWeekDeltaPct).toBe("number");
    });

    test("getStats computes non-zero percent deltas when previous periods have activity", async () => {
        const today = new Date();
        today.setHours(10, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 8);

        mockTxGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("tx-today-1", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 2,
                    operation: "summarize",
                    balanceBefore: 10,
                    balanceAfter: 8,
                    createdAt: ts(today),
                    description: "Today AI 1",
                }),
                makeDoc("tx-today-2", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 1,
                    operation: "autoTag",
                    balanceBefore: 8,
                    balanceAfter: 7,
                    createdAt: ts(new Date(today.getTime() + 60_000)),
                    description: "Today AI 2",
                }),
                makeDoc("tx-yesterday", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 1,
                    operation: "ragQuery",
                    balanceBefore: 9,
                    balanceAfter: 8,
                    createdAt: ts(yesterday),
                    description: "Yesterday AI",
                }),
                makeDoc("tx-last-week", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 3,
                    operation: "flashcards",
                    balanceBefore: 12,
                    balanceAfter: 9,
                    createdAt: ts(lastWeek),
                    description: "Last week AI",
                }),
            ]),
        );
        mockNotesGet.mockResolvedValue(makeSnapshot([]));
        mockFoldersGet.mockResolvedValue(makeSnapshot([]));

        const stats = await activityService.getStats("user-1");

        // 2 today vs 1 yesterday => +100%; this week vs last week also non-zero
        expect(stats.actionsToday).toBe(2);
        expect(stats.actionsTodayDeltaPct).toBe(100);
        expect(stats.aiOpsThisWeek).toBeGreaterThan(0);
        expect(stats.aiOpsThisWeekDeltaPct).not.toBe(0);
    });

    test("timestampToDate accepts Date, string, number, and invalid values", async () => {
        const dateInstance = new Date("2024-03-15T12:00:00.000Z");
        const stringDate = "2024-04-01T08:30:00.000Z";
        const numberDate = Date.parse("2024-05-20T16:45:00.000Z");

        mockTxGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("tx-date", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 1,
                    operation: "ragQuery",
                    balanceBefore: 5,
                    balanceAfter: 4,
                    createdAt: dateInstance,
                    description: "Date instance",
                }),
                makeDoc("tx-string", {
                    userId: "user-1",
                    type: "grant",
                    amount: 5,
                    operation: "unknown_op",
                    balanceBefore: 0,
                    balanceAfter: 5,
                    createdAt: stringDate,
                }),
                makeDoc("tx-number", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 1,
                    operation: "summarize",
                    balanceBefore: 5,
                    balanceAfter: 4,
                    createdAt: numberDate,
                    description: "Number timestamp",
                }),
                makeDoc("tx-invalid", {
                    userId: "user-1",
                    type: "deduction",
                    amount: 1,
                    operation: "summarize",
                    balanceBefore: 4,
                    balanceAfter: 3,
                    createdAt: "not-a-valid-date",
                    description: "Invalid timestamp",
                }),
            ]),
        );
        mockNotesGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("note-untitled", {
                    createdAt: null,
                    updatedAt: null,
                }),
                makeDoc("note-no-update", {
                    title: "Stable note",
                    createdAt: ts(new Date("2024-01-01T00:00:00.000Z")),
                    updatedAt: ts(new Date("2024-01-01T00:00:30.000Z")),
                }),
            ]),
        );
        mockFoldersGet.mockResolvedValue(
            makeSnapshot([
                makeDoc("folder-untitled", {
                    createdAt: {},
                }),
            ]),
        );

        const feed = await activityService.getFeed("user-1");

        const dateEvent = feed.find((e) => e.id === "tx-tx-date");
        const stringEvent = feed.find((e) => e.id === "tx-tx-string");
        const numberEvent = feed.find((e) => e.id === "tx-tx-number");
        const invalidEvent = feed.find((e) => e.id === "tx-tx-invalid");
        const untitledNote = feed.find((e) => e.id === "note-create-note-untitled");
        const noteUpdate = feed.find((e) => e.id === "note-update-note-no-update");
        const untitledFolder = feed.find(
            (e) => e.id === "folder-create-folder-untitled",
        );

        expect(dateEvent?.createdAt).toBe(dateInstance.toISOString());
        expect(stringEvent?.createdAt).toBe(new Date(stringDate).toISOString());
        expect(stringEvent?.title).toBe("unknown_op");
        expect(stringEvent?.description).toContain("+5 tokens");
        expect(numberEvent?.createdAt).toBe(new Date(numberDate).toISOString());
        expect(invalidEvent?.createdAt).toBe(new Date(0).toISOString());
        expect(untitledNote?.description).toBe("Untitled note");
        expect(noteUpdate).toBeUndefined();
        expect(untitledFolder?.description).toBe("Untitled folder");
    });

    describe("Admin methods", () => {
        beforeEach(() => {
            // Mock user data for enrichment
            mockUsersGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("user-1", {
                        email: "user1@example.com",
                        displayName: "User One",
                    }),
                    makeDoc("user-2", {
                        email: "user2@example.com",
                    }),
                ]),
            );
        });

        test("getSystemWideFeed returns all activity with user info", async () => {
            const today = new Date();
            today.setHours(10, 0, 0, 0);

            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                        description: "AI Summary",
                    }),
                ]),
            );

            // Mock notes with proper ref structure for collectionGroup
            mockNotesGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "note1",
                        data: () => ({
                            title: "Test note",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            // Mock folders with proper ref structure for collectionGroup
            mockFoldersGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "folder1",
                        data: () => ({
                            name: "Test folder",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            const result = await activityService.getSystemWideFeed();

            expect(result.entries.length).toBeGreaterThan(0);
            expect(result.total).toBeGreaterThan(0);
            expect(result.entries[0]).toHaveProperty("userId");
            expect(result.entries[0]).toHaveProperty("userEmail");
        });

        test("getSystemWideFeed filters by category", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            const result = await activityService.getSystemWideFeed({
                category: "ai",
            });

            expect(result.entries.every((e) => e.category === "ai")).toBe(true);
        });

        test("getSystemWideFeed filters by userId", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                userId: "user-1",
            });

            expect(result.entries.every((e) => e.userId === "user-1")).toBe(true);
        });

        test("getSystemWideFeed filters by search query", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                        description: "AI Summary",
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                q: "summary",
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed filters by date range", async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            // Test with userId to avoid collectionGroup path
            const result = await activityService.getSystemWideFeed({
                userId: "user-1",
                startDate: yesterday.toISOString(),
                endDate: today.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed paginates results", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                    makeDoc("tx2", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 1,
                        operation: "autoTag",
                        balanceBefore: 8,
                        balanceAfter: 7,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                limit: 1,
                offset: 0,
            });

            expect(result.entries.length).toBe(1);
        });

        test("getSystemWideFeed handles notes with missing parent userId", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(makeSnapshot([]));

            mockNotesGet.mockResolvedValue({
                forEach: (
                    cb: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } | null } };
                        },
                    ) => void,
                ) => {
                    cb({
                        id: "note1",
                        data: () => ({
                            title: "Test",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: null,
                            },
                        },
                    });
                },
            });

            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "notes",
            });

            // Should skip notes without parent userId
            expect(result.entries.length).toBe(0);
        });

        test("getSystemWideFeed handles folders with missing parent userId", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(makeSnapshot([]));
            mockNotesGet.mockResolvedValue(makeSnapshot([]));

            mockFoldersGet.mockResolvedValue({
                forEach: (
                    cb: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } | null } };
                        },
                    ) => void,
                ) => {
                    cb({
                        id: "folder1",
                        data: () => ({
                            name: "Test",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: null,
                            },
                        },
                    });
                },
            });

            const result = await activityService.getSystemWideFeed({
                category: "folders",
            });

            // Should skip folders without parent userId
            expect(result.entries.length).toBe(0);
        });

        test("getSystemWideFeed enriches events with unknown user info", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "unknown-user",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed();

            expect(result.entries[0]?.userEmail).toBe("Unknown");
        });

        test("getSystemWideFeed searches by user email", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                q: "user1@example.com",
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed searches by user name", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                q: "User One",
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed handles token category transactions", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "grant",
                        amount: 100,
                        operation: "admin_grant",
                        balanceBefore: 0,
                        balanceAfter: 100,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "tokens",
            });

            expect(result.entries.length).toBeGreaterThan(0);
            expect(result.entries.every((e) => e.category === "tokens")).toBe(true);
        });

        test("getSystemWideFeed filters AI transactions when category is ai", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                    makeDoc("tx2", {
                        userId: "user-1",
                        type: "grant",
                        amount: 100,
                        operation: "admin_grant",
                        balanceBefore: 0,
                        balanceAfter: 100,
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "ai",
            });

            expect(result.entries.length).toBe(1);
            expect(result.entries[0]?.category).toBe("ai");
        });

        test("getSystemWideFeed with userId and date filters for notes", async () => {
            const today = new Date();
            const startDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
            const endDate = today;

            mockTxGet.mockResolvedValue(makeSnapshot([]));

            mockNotesGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("note1", {
                        title: "Recent note",
                        createdAt: ts(today),
                    }),
                ]),
            );

            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                userId: "user-1",
                category: "notes",
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed with userId and date filters for folders", async () => {
            const today = new Date();
            const startDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
            const endDate = today;

            mockTxGet.mockResolvedValue(makeSnapshot([]));
            mockNotesGet.mockResolvedValue(makeSnapshot([]));

            mockFoldersGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("folder1", {
                        name: "Recent folder",
                        createdAt: ts(today),
                    }),
                ]),
            );

            const result = await activityService.getSystemWideFeed({
                userId: "user-1",
                category: "folders",
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed without userId applies startDate filter for notes", async () => {
            const today = new Date();
            const startDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

            mockTxGet.mockResolvedValue(makeSnapshot([]));

            mockNotesGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "note1",
                        data: () => ({
                            title: "Test note",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "notes",
                startDate: startDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed without userId applies endDate filter for notes", async () => {
            const today = new Date();
            const endDate = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);

            mockTxGet.mockResolvedValue(makeSnapshot([]));

            mockNotesGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "note1",
                        data: () => ({
                            title: "Test note",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "notes",
                endDate: endDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed without userId applies startDate filter for folders", async () => {
            const today = new Date();
            const startDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

            mockTxGet.mockResolvedValue(makeSnapshot([]));
            mockNotesGet.mockResolvedValue(makeSnapshot([]));

            mockFoldersGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "folder1",
                        data: () => ({
                            name: "Test folder",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            const result = await activityService.getSystemWideFeed({
                category: "folders",
                startDate: startDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed without userId applies endDate filter for folders", async () => {
            const today = new Date();
            const endDate = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);

            mockTxGet.mockResolvedValue(makeSnapshot([]));
            mockNotesGet.mockResolvedValue(makeSnapshot([]));

            mockFoldersGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "folder1",
                        data: () => ({
                            name: "Test folder",
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "user-1" },
                            },
                        },
                    });
                },
            });

            const result = await activityService.getSystemWideFeed({
                category: "folders",
                endDate: endDate.toISOString(),
            });

            expect(result.entries.length).toBeGreaterThan(0);
        });

        test("getSystemWideFeed maps users with missing email to Unknown", async () => {
            const today = new Date();
            mockUsersGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("user-no-email", {
                        displayName: "No Email User",
                    }),
                ]),
            );
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-no-email",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );
            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed();

            expect(result.entries[0]?.userEmail).toBe("Unknown");
            expect(result.entries[0]?.userName).toBe("No Email User");
        });

        test("getSystemWideFeed falls back to operation name when label is missing", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "grant",
                        amount: 5,
                        operation: "unknown_op",
                        balanceBefore: 0,
                        balanceAfter: 5,
                        createdAt: ts(today),
                    }),
                ]),
            );
            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                category: "tokens",
            });

            expect(result.entries[0]?.title).toBe("unknown_op");
        });

        test("getSystemWideFeed uses Untitled defaults for notes and folders by userId", async () => {
            const today = new Date();
            mockUsersGet.mockResolvedValue(makeSnapshot([]));
            mockTxGet.mockResolvedValue(makeSnapshot([]));
            mockNotesGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("note1", {
                        createdAt: ts(today),
                    }),
                ]),
            );
            mockFoldersGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("folder1", {
                        createdAt: ts(today),
                    }),
                ]),
            );

            const notesResult = await activityService.getSystemWideFeed({
                userId: "missing-user",
                category: "notes",
            });
            const foldersResult = await activityService.getSystemWideFeed({
                userId: "missing-user",
                category: "folders",
            });

            expect(notesResult.entries[0]?.description).toBe("Untitled note");
            expect(notesResult.entries[0]?.userEmail).toBe("Unknown");
            expect(foldersResult.entries[0]?.description).toBe("Untitled folder");
            expect(foldersResult.entries[0]?.userEmail).toBe("Unknown");
        });

        test("getSystemWideFeed uses Untitled defaults for collection-group notes and folders", async () => {
            const today = new Date();
            mockUsersGet.mockResolvedValue(makeSnapshot([]));
            mockTxGet.mockResolvedValue(makeSnapshot([]));

            mockNotesGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "note1",
                        data: () => ({
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "orphan-user" },
                            },
                        },
                    });
                },
            });

            mockFoldersGet.mockResolvedValue({
                forEach: (
                    callback: (
                        doc: ReturnType<typeof makeDoc> & {
                            ref: { parent: { parent: { id: string } } };
                        },
                    ) => void,
                ) => {
                    callback({
                        id: "folder1",
                        data: () => ({
                            createdAt: ts(today),
                        }),
                        ref: {
                            parent: {
                                parent: { id: "orphan-user" },
                            },
                        },
                    });
                },
            });

            const notesResult = await activityService.getSystemWideFeed({
                category: "notes",
            });
            const foldersResult = await activityService.getSystemWideFeed({
                category: "folders",
            });

            expect(notesResult.entries[0]?.description).toBe("Untitled note");
            expect(notesResult.entries[0]?.userEmail).toBe("Unknown");
            expect(foldersResult.entries[0]?.description).toBe("Untitled folder");
            expect(foldersResult.entries[0]?.userEmail).toBe("Unknown");
        });

        test("getSystemWideFeed search treats missing userName as non-match", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-2",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                        description: "AI Summary",
                    }),
                ]),
            );
            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const result = await activityService.getSystemWideFeed({
                q: "definitely-not-a-match",
            });

            expect(result.entries.length).toBe(0);
        });

        test("collectSystemWideEvents defaults category to all", async () => {
            const today = new Date();
            mockTxGet.mockResolvedValue(
                makeSnapshot([
                    makeDoc("tx1", {
                        userId: "user-1",
                        type: "deduction",
                        amount: 2,
                        operation: "summarize",
                        balanceBefore: 10,
                        balanceAfter: 8,
                        createdAt: ts(today),
                    }),
                ]),
            );
            mockNotesGet.mockResolvedValue(makeSnapshot([]));
            mockFoldersGet.mockResolvedValue(makeSnapshot([]));

            const collectSystemWideEvents = (
                activityService as unknown as {
                    collectSystemWideEvents: (options: {
                        userId?: string;
                        startDate?: string;
                        endDate?: string;
                    }) => Promise<unknown[]>;
                }
            ).collectSystemWideEvents.bind(activityService);

            const events = await collectSystemWideEvents({});

            expect(events.length).toBeGreaterThan(0);
        });
    });
});
