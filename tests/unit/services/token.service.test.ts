/**
 * Token Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock data types
interface MockUserDoc {
    exists: boolean;
    data: () => Record<string, unknown> | undefined;
}

interface MockTransactionRef {
    id: string;
    set: jest.Mock;
}

interface MockFirestoreTransaction {
    get: jest.Mock<(ref: unknown) => Promise<MockUserDoc>>;
    update: jest.Mock;
    set: jest.Mock;
}

// Mock Firestore
const mockTimestampNow = jest.fn(() => ({
    toDate: () => new Date("2024-01-15T00:00:00.000Z"),
}));

const mockRunTransaction =
    jest.fn<
        (
            updateFunction: (transaction: MockFirestoreTransaction) => Promise<unknown>,
        ) => Promise<unknown>
    >();
interface MockSnapshot {
    docs: { data: () => unknown }[];
    forEach: (cb: (doc: { data: () => unknown }) => void) => void;
}

const mockCollectionGet = jest.fn<() => Promise<MockSnapshot>>();
const mockDocGet = jest.fn<() => Promise<MockUserDoc>>();

// User doc mock
const createMockUserDoc = (
    exists: boolean,
    data?: Record<string, unknown>,
): MockUserDoc => ({
    exists,
    data: () => data,
});

const createSnapshot = (items: unknown[]): MockSnapshot => ({
    docs: items.map((data) => ({ data: () => data })),
    forEach: (callback: (doc: { data: () => unknown }) => void) => {
        items.forEach((data) => callback({ data: () => data }));
    },
});

// Mock query chain
interface MockQueryChain {
    where: jest.Mock<() => MockQueryChain>;
    orderBy: jest.Mock<() => MockQueryChain>;
    offset: jest.Mock<() => MockQueryChain>;
    limit: jest.Mock<() => MockQueryChain>;
    get: typeof mockCollectionGet;
}

const createQueryChain = (): MockQueryChain => {
    const chain: MockQueryChain = {
        where: jest.fn(() => chain),
        orderBy: jest.fn(() => chain),
        offset: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        get: mockCollectionGet,
    };
    return chain;
};

const mockQueryChain = createQueryChain();

const mockTransactionRef: MockTransactionRef = {
    id: "test-transaction-id",
    set: jest.fn(),
};

const mockTokenRequestRef = {
    id: "test-request-id",
    set: jest.fn<() => Promise<void>>(),
    get: jest.fn<() => Promise<MockUserDoc>>(),
    update: jest.fn<() => Promise<void>>(),
};

// Helper to create properly typed transaction mock
const createMockTransaction = (userDoc: MockUserDoc): MockFirestoreTransaction => ({
    get: jest.fn<(ref: unknown) => Promise<MockUserDoc>>().mockResolvedValue(userDoc),
    update: jest.fn(),
    set: jest.fn(),
});

const mockDb = {
    collection: jest.fn((name: string) => {
        if (name === "transactions") {
            return {
                doc: jest.fn(() => mockTransactionRef),
                where: mockQueryChain.where,
                orderBy: mockQueryChain.orderBy,
                offset: mockQueryChain.offset,
                limit: mockQueryChain.limit,
                get: mockCollectionGet,
            };
        }
        if (name === "users") {
            return {
                doc: jest.fn(() => ({
                    get: mockDocGet,
                    update: jest.fn(),
                })),
            };
        }
        if (name === "system_config") {
            return {
                doc: jest.fn(() => ({
                    get: mockDocGet,
                })),
            };
        }
        if (name === "tokenRequests") {
            return {
                doc: jest.fn(() => mockTokenRequestRef),
                where: mockQueryChain.where,
                orderBy: mockQueryChain.orderBy,
                offset: mockQueryChain.offset,
                limit: mockQueryChain.limit,
                get: mockCollectionGet,
            };
        }
        return {
            doc: jest.fn(() => ({
                get: mockDocGet,
            })),
        };
    }),
    runTransaction: mockRunTransaction,
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
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import module dynamically after mocking
let TokenService: typeof import("@/services/token.service.js").TokenService;
let tokenService: import("@/services/token.service.js").TokenService;

describe("Token Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/token.service.js");
        TokenService = mod.TokenService;
        tokenService = mod.tokenService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset query chain
        mockQueryChain.where.mockReturnValue(mockQueryChain);
        mockQueryChain.orderBy.mockReturnValue(mockQueryChain);
        mockQueryChain.offset.mockReturnValue(mockQueryChain);
        mockQueryChain.limit.mockReturnValue(mockQueryChain);
    });

    describe("getBalance", () => {
        test("should return token balance for existing user", async () => {
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    tokenBalance: 100,
                    totalTokensGranted: 200,
                    totalTokensSpent: 100,
                }),
            );

            const balance = await tokenService.getBalance("user-123");

            expect(balance).toEqual({
                balance: 100,
                totalGranted: 200,
                totalSpent: 100,
            });
        });

        test("should throw NOT_FOUND error for non-existing user", async () => {
            mockDocGet.mockResolvedValue(createMockUserDoc(false));

            await expect(tokenService.getBalance("non-existing")).rejects.toMatchObject(
                {
                    code: "NOT_FOUND",
                    statusCode: 404,
                    message: "User not found",
                },
            );
        });
    });

    describe("getHistory", () => {
        test("should return transaction history", async () => {
            const mockTransactions = [
                {
                    id: "tx1",
                    userId: "user-123",
                    type: "deduction",
                    amount: 10,
                    operation: "summarize",
                    balanceBefore: 100,
                    balanceAfter: 90,
                    createdAt: { toDate: () => new Date() },
                    description: "Test deduction",
                },
                {
                    id: "tx2",
                    userId: "user-123",
                    type: "grant",
                    amount: 50,
                    operation: "admin_grant",
                    balanceBefore: 50,
                    balanceAfter: 100,
                    createdAt: { toDate: () => new Date() },
                    description: "Test grant",
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockTransactions.forEach((tx) => callback({ data: () => tx }));
                },
                docs: mockTransactions.map((tx) => ({ data: () => tx })),
            });

            const history = await tokenService.getHistory("user-123");

            expect(history).toHaveLength(2);
            expect(mockQueryChain.where).toHaveBeenCalledWith(
                "userId",
                "==",
                "user-123",
            );
            expect(mockQueryChain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
        });

        test("should apply pagination options", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getHistory("user-123", { limit: 10, offset: 5 });

            expect(mockQueryChain.offset).toHaveBeenCalledWith(5);
            expect(mockQueryChain.limit).toHaveBeenCalledWith(10);
        });

        test("should filter by transaction type", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getHistory("user-123", { type: "grant" });

            expect(mockQueryChain.where).toHaveBeenCalledWith("type", "==", "grant");
        });

        test("should delegate offset to Firestore and return all docs in snapshot", async () => {
            const mockTransactions = [{ id: "tx3" }, { id: "tx4" }];

            mockCollectionGet.mockResolvedValue(createSnapshot(mockTransactions));

            const history = await tokenService.getHistory("user-123", {
                limit: 2,
                offset: 2,
            });

            expect(mockQueryChain.offset).toHaveBeenCalledWith(2);
            expect(mockQueryChain.limit).toHaveBeenCalledWith(2);
            expect(history).toHaveLength(2);
            expect(history[0]).toEqual({ id: "tx3" });
            expect(history[1]).toEqual({ id: "tx4" });
        });
    });

    describe("hasEnoughTokens", () => {
        test("should return true when balance is sufficient", async () => {
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    tokenBalance: 100,
                    totalTokensGranted: 100,
                    totalTokensSpent: 0,
                }),
            );

            const result = await tokenService.hasEnoughTokens("user-123", 50);

            expect(result).toBe(true);
        });

        test("should return false when balance is insufficient", async () => {
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    tokenBalance: 10,
                    totalTokensGranted: 10,
                    totalTokensSpent: 0,
                }),
            );

            const result = await tokenService.hasEnoughTokens("user-123", 50);

            expect(result).toBe(false);
        });

        test("should return true when balance equals required amount", async () => {
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    tokenBalance: 50,
                    totalTokensGranted: 50,
                    totalTokensSpent: 0,
                }),
            );

            const result = await tokenService.hasEnoughTokens("user-123", 50);

            expect(result).toBe(true);
        });
    });

    describe("deductTokens", () => {
        test("should successfully deduct tokens", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 100,
                totalTokensSpent: 50,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.deductTokens(
                "user-123",
                10,
                "summarize",
                "Test deduction",
            );

            expect(result.success).toBe(true);
            expect(result.newBalance).toBe(90);
            expect(result.transaction.type).toBe("deduction");
            expect(result.transaction.amount).toBe(10);
            expect(result.transaction.operation).toBe("summarize");
        });

        test("should throw INSUFFICIENT_TOKENS when balance too low", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 5,
                totalTokensSpent: 95,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            await expect(
                tokenService.deductTokens("user-123", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "INSUFFICIENT_TOKENS",
                statusCode: 402,
            });
        });

        test("should throw NOT_FOUND when user does not exist", async () => {
            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(createMockUserDoc(false)));
            });

            await expect(
                tokenService.deductTokens("non-existing", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
            });
        });

        test("should use default description when not provided", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 100,
                totalTokensSpent: 0,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.deductTokens("user-123", 10, "autoTag");

            expect(result.transaction.description).toBe("Token deduction for autoTag");
        });

        test("should handle transaction errors", async () => {
            mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

            await expect(
                tokenService.deductTokens("user-123", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should handle zero token balance gracefully", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 0,
                totalTokensSpent: 100,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            await expect(
                tokenService.deductTokens("user-123", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "INSUFFICIENT_TOKENS",
            });
        });

        test("should handle undefined token fields with defaults", async () => {
            // User exists but has no token fields defined
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {});

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            // Should default to 0 balance, which means insufficient tokens
            await expect(
                tokenService.deductTokens("user-123", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "INSUFFICIENT_TOKENS",
            });
        });

        test("should handle non-Error thrown from transaction", async () => {
            mockRunTransaction.mockRejectedValue("string error");

            await expect(
                tokenService.deductTokens("user-123", 10, "summarize"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("grantTokens", () => {
        test("should successfully grant tokens", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 50,
                totalTokensGranted: 50,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.grantTokens(
                "user-123",
                100,
                "admin-456",
                "Welcome bonus",
            );

            expect(result.success).toBe(true);
            expect(result.newBalance).toBe(150);
            expect(result.transaction.type).toBe("grant");
            expect(result.transaction.amount).toBe(100);
            expect(result.transaction.operation).toBe("admin_grant");
            expect(result.transaction.grantedBy).toBe("admin-456");
            expect(result.transaction.description).toBe("Welcome bonus");
        });

        test("should throw NOT_FOUND when user does not exist", async () => {
            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(createMockUserDoc(false)));
            });

            await expect(
                tokenService.grantTokens("non-existing", 100, "admin-456", "Test"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
            });
        });

        test("should handle transaction errors", async () => {
            mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

            await expect(
                tokenService.grantTokens("user-123", 100, "admin-456", "Test"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should handle zero initial balance", async () => {
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {
                tokenBalance: 0,
                totalTokensGranted: 0,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.grantTokens(
                "user-123",
                100,
                "admin-456",
                "Initial grant",
            );

            expect(result.newBalance).toBe(100);
            expect(result.transaction.balanceBefore).toBe(0);
            expect(result.transaction.balanceAfter).toBe(100);
        });

        test("should handle undefined token fields with defaults", async () => {
            // User exists but has no token fields defined
            const mockUserDoc: MockUserDoc = createMockUserDoc(true, {});

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.grantTokens(
                "user-123",
                100,
                "admin-456",
                "Initial grant",
            );

            // Should default to 0 balance, so new balance is just the grant amount
            expect(result.newBalance).toBe(100);
            expect(result.transaction.balanceBefore).toBe(0);
            expect(result.transaction.balanceAfter).toBe(100);
        });

        test("should handle non-Error thrown from transaction", async () => {
            mockRunTransaction.mockRejectedValue("string error");

            await expect(
                tokenService.grantTokens("user-123", 100, "admin-456", "Test"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("requestTokens", () => {
        test("should create a token request and return it", async () => {
            mockTokenRequestRef.set.mockResolvedValue(undefined);

            const result = await tokenService.requestTokens("user-123", 50);

            expect(result).toEqual({
                id: "test-request-id",
                userId: "user-123",
                amount: 50,
                status: "pending",
                createdAt: expect.anything(),
            });
            expect(mockTokenRequestRef.set).toHaveBeenCalledWith(result);
        });

        test("should include justification when provided", async () => {
            mockTokenRequestRef.set.mockResolvedValue(undefined);

            const result = await tokenService.requestTokens(
                "user-123",
                50,
                "Need tokens for embeddings",
            );

            expect(result.justification).toBe("Need tokens for embeddings");
            expect(mockTokenRequestRef.set).toHaveBeenCalledWith(result);
        });

        test("should use the generated document ID as the request id", async () => {
            mockTokenRequestRef.set.mockResolvedValue(undefined);

            const result = await tokenService.requestTokens("user-456", 100);

            expect(result.id).toBe("test-request-id");
            expect(result.userId).toBe("user-456");
            expect(result.amount).toBe(100);
            expect(result.status).toBe("pending");
        });
    });

    describe("getRequests", () => {
        test("should return token requests for a user", async () => {
            const mockRequests = [
                {
                    id: "req-1",
                    userId: "user-123",
                    amount: 50,
                    status: "pending",
                    createdAt: mockTimestampNow(),
                },
                {
                    id: "req-2",
                    userId: "user-123",
                    amount: 100,
                    status: "approved",
                    createdAt: mockTimestampNow(),
                },
            ];

            mockCollectionGet.mockResolvedValue(createSnapshot(mockRequests));

            const requests = await tokenService.getRequests("user-123");

            expect(requests).toHaveLength(2);
            expect(requests[0]).toEqual(mockRequests[0]);
            expect(requests[1]).toEqual(mockRequests[1]);
            expect(mockQueryChain.where).toHaveBeenCalledWith("userId", "==", "user-123");
            expect(mockQueryChain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
            expect(mockQueryChain.limit).toHaveBeenCalledWith(20);
        });

        test("should use custom limit when provided", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getRequests("user-123", 5);

            expect(mockQueryChain.limit).toHaveBeenCalledWith(5);
        });

        test("should return empty array when no requests exist", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            const requests = await tokenService.getRequests("user-123");

            expect(requests).toEqual([]);
        });
    });

    describe("getAdminTokenRequests", () => {
        const createRequest = (
            overrides: Partial<{
                id: string;
                userId: string;
                amount: number;
                status: string;
                createdAt: { toDate: () => Date };
            }> = {},
        ) => ({
            id: "req-1",
            userId: "user-123",
            amount: 50,
            status: "pending",
            createdAt: {
                toDate: () => new Date("2024-01-15T12:00:00.000Z"),
            },
            ...overrides,
        });

        test("should return requests with user info", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([createRequest()]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    email: "user@example.com",
                    displayName: "Test User",
                    photoURL: "https://example.com/avatar.png",
                    tokenBalance: 5,
                }),
            );

            const requests = await tokenService.getAdminTokenRequests();

            expect(requests).toHaveLength(1);
            expect(requests[0]).toMatchObject({
                id: "req-1",
                userEmail: "user@example.com",
                userDisplayName: "Test User",
                userName: "Test User",
                userAvatarUrl: "https://example.com/avatar.png",
                currentBalance: 5,
                isUrgent: true,
            });
            expect(mockQueryChain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
            expect(mockQueryChain.offset).toHaveBeenCalledWith(0);
            expect(mockQueryChain.limit).toHaveBeenCalledWith(20);
        });

        test("should mark non-urgent when balance is at or above threshold", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([createRequest()]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    email: "user@example.com",
                    displayName: "Test User",
                    tokenBalance: 20,
                }),
            );

            const requests = await tokenService.getAdminTokenRequests();

            expect(requests[0]?.currentBalance).toBe(20);
            expect(requests[0]?.isUrgent).toBe(false);
        });

        test("should fall back to email when displayName is missing", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([createRequest()]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, {
                    email: "user@example.com",
                    displayName: null,
                }),
            );

            const requests = await tokenService.getAdminTokenRequests();

            expect(requests[0]?.userDisplayName).toBeUndefined();
            expect(requests[0]?.userName).toBe("user@example.com");
        });

        test("should handle missing user gracefully", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([createRequest()]));
            mockDocGet.mockResolvedValue(createMockUserDoc(false));

            const requests = await tokenService.getAdminTokenRequests();

            expect(requests[0]?.userEmail).toBeUndefined();
            expect(requests[0]?.userDisplayName).toBeUndefined();
            expect(requests[0]?.userName).toBeUndefined();
        });

        test("should filter by status when not all", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getAdminTokenRequests({ status: "pending" });

            expect(mockQueryChain.where).toHaveBeenCalledWith("status", "==", "pending");
        });

        test("should not filter by status when status is all", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getAdminTokenRequests({ status: "all" });

            expect(mockQueryChain.where).not.toHaveBeenCalledWith(
                "status",
                "==",
                "all",
            );
        });

        test("should filter by userId", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getAdminTokenRequests({ userId: "user-456" });

            expect(mockQueryChain.where).toHaveBeenCalledWith(
                "userId",
                "==",
                "user-456",
            );
        });

        test("should apply custom pagination", async () => {
            mockCollectionGet.mockResolvedValue(createSnapshot([]));

            await tokenService.getAdminTokenRequests({ limit: 5, offset: 10 });

            expect(mockQueryChain.offset).toHaveBeenCalledWith(10);
            expect(mockQueryChain.limit).toHaveBeenCalledWith(5);
        });

        test("should filter by startDate", async () => {
            const inRange = createRequest({
                id: "in-range",
                createdAt: { toDate: () => new Date("2024-01-20T00:00:00.000Z") },
            });
            const beforeStart = createRequest({
                id: "before",
                createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            });

            mockCollectionGet.mockResolvedValue(createSnapshot([inRange, beforeStart]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, { email: "u@test.com", displayName: "U" }),
            );

            const requests = await tokenService.getAdminTokenRequests({
                startDate: "2024-01-15T00:00:00.000Z",
            });

            expect(requests).toHaveLength(1);
            expect(requests[0]?.id).toBe("in-range");
        });

        test("should filter by endDate", async () => {
            const inRange = createRequest({
                id: "in-range",
                createdAt: { toDate: () => new Date("2024-01-10T00:00:00.000Z") },
            });
            const afterEnd = createRequest({
                id: "after",
                createdAt: { toDate: () => new Date("2024-01-25T00:00:00.000Z") },
            });

            mockCollectionGet.mockResolvedValue(createSnapshot([inRange, afterEnd]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, { email: "u@test.com", displayName: "U" }),
            );

            const requests = await tokenService.getAdminTokenRequests({
                endDate: "2024-01-15T00:00:00.000Z",
            });

            expect(requests).toHaveLength(1);
            expect(requests[0]?.id).toBe("in-range");
        });

        test("should filter by date range", async () => {
            const inRange = createRequest({
                id: "in-range",
                createdAt: { toDate: () => new Date("2024-01-15T00:00:00.000Z") },
            });
            const before = createRequest({
                id: "before",
                createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            });
            const after = createRequest({
                id: "after",
                createdAt: { toDate: () => new Date("2024-01-30T00:00:00.000Z") },
            });

            mockCollectionGet.mockResolvedValue(createSnapshot([inRange, before, after]));
            mockDocGet.mockResolvedValue(
                createMockUserDoc(true, { email: "u@test.com", displayName: "U" }),
            );

            const requests = await tokenService.getAdminTokenRequests({
                startDate: "2024-01-10T00:00:00.000Z",
                endDate: "2024-01-20T00:00:00.000Z",
            });

            expect(requests).toHaveLength(1);
            expect(requests[0]?.id).toBe("in-range");
        });
    });

    describe("approveTokenRequest", () => {
        const pendingRequest = {
            id: "req-1",
            userId: "user-123",
            amount: 50,
            status: "pending",
            createdAt: mockTimestampNow(),
        };

        test("should approve request and grant tokens", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            const mockUserDoc = createMockUserDoc(true, {
                tokenBalance: 100,
                totalTokensGranted: 100,
            });

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(mockUserDoc));
            });

            const result = await tokenService.approveTokenRequest("req-1", "admin-456");

            expect(result).toMatchObject({
                id: "req-1",
                status: "approved",
                reviewedBy: "admin-456",
            });
            expect(result.reviewedAt).toBeDefined();
        });

        test("should use override amount when provided", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            const mockUserDoc = createMockUserDoc(true, {
                tokenBalance: 100,
                totalTokensGranted: 100,
            });
            const mockTx = createMockTransaction(mockUserDoc);

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTx);
            });

            await tokenService.approveTokenRequest("req-1", "admin-456", 75);

            expect(mockTx.set).toHaveBeenCalledWith(
                mockTransactionRef,
                expect.objectContaining({
                    amount: 75,
                    balanceBefore: 100,
                    balanceAfter: 175,
                }),
            );
        });

        test("should use notes in transaction description when provided", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            const mockUserDoc = createMockUserDoc(true, {
                tokenBalance: 50,
                totalTokensGranted: 50,
            });
            const mockTx = createMockTransaction(mockUserDoc);

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTx);
            });

            await tokenService.approveTokenRequest(
                "req-1",
                "admin-456",
                undefined,
                "Approved after review",
            );

            expect(mockTx.set).toHaveBeenCalledWith(
                mockTransactionRef,
                expect.objectContaining({
                    description: "Approved after review",
                }),
            );
        });

        test("should use default description when notes not provided", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            const mockUserDoc = createMockUserDoc(true, {
                tokenBalance: 0,
            });
            const mockTx = createMockTransaction(mockUserDoc);

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTx);
            });

            await tokenService.approveTokenRequest("req-1", "admin-456");

            expect(mockTx.set).toHaveBeenCalledWith(
                mockTransactionRef,
                expect.objectContaining({
                    description: "Approved token request #req-1",
                    amount: 50,
                }),
            );
        });

        test("should throw NOT_FOUND when request does not exist", async () => {
            mockTokenRequestRef.get.mockResolvedValue(createMockUserDoc(false));

            await expect(
                tokenService.approveTokenRequest("missing", "admin-456"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
                message: "Token request not found",
            });
        });

        test("should throw INVALID_REQUEST when request is not pending", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, { ...pendingRequest, status: "approved" }),
            );

            await expect(
                tokenService.approveTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INVALID_REQUEST",
                statusCode: 400,
                message: "Cannot approve request with status: approved",
            });
        });

        test("should re-throw AppError when user not found in transaction", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(createMockTransaction(createMockUserDoc(false)));
            });

            await expect(
                tokenService.approveTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
                message: "User not found",
            });
        });

        test("should handle transaction errors", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

            await expect(
                tokenService.approveTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
                message: "Failed to approve token request",
            });
        });

        test("should handle non-Error thrown from transaction", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockRunTransaction.mockRejectedValue("string error");

            await expect(
                tokenService.approveTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should handle undefined token fields with defaults", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );

            const mockUserDoc = createMockUserDoc(true, {});
            const mockTx = createMockTransaction(mockUserDoc);

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTx);
            });

            await tokenService.approveTokenRequest("req-1", "admin-456");

            expect(mockTx.update).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    tokenBalance: 50,
                    totalTokensGranted: 50,
                }),
            );
        });
    });

    describe("rejectTokenRequest", () => {
        const pendingRequest = {
            id: "req-1",
            userId: "user-123",
            amount: 50,
            status: "pending",
            createdAt: mockTimestampNow(),
        };

        test("should reject request successfully", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockTokenRequestRef.update.mockResolvedValue(undefined);

            const result = await tokenService.rejectTokenRequest(
                "req-1",
                "admin-456",
                "Insufficient justification",
            );

            expect(result).toMatchObject({
                id: "req-1",
                status: "rejected",
                reviewedBy: "admin-456",
            });
            expect(result.reviewedAt).toBeDefined();
            expect(mockTokenRequestRef.update).toHaveBeenCalledWith({
                status: "rejected",
                reviewedAt: expect.anything(),
                reviewedBy: "admin-456",
                reason: "Insufficient justification",
            });
        });

        test("should use default reason when not provided", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockTokenRequestRef.update.mockResolvedValue(undefined);

            await tokenService.rejectTokenRequest("req-1", "admin-456");

            expect(mockTokenRequestRef.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: "No reason provided",
                }),
            );
        });

        test("should throw NOT_FOUND when request does not exist", async () => {
            mockTokenRequestRef.get.mockResolvedValue(createMockUserDoc(false));

            await expect(
                tokenService.rejectTokenRequest("missing", "admin-456"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
                message: "Token request not found",
            });
        });

        test("should throw INVALID_REQUEST when request is not pending", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, { ...pendingRequest, status: "rejected" }),
            );

            await expect(
                tokenService.rejectTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INVALID_REQUEST",
                statusCode: 400,
                message: "Cannot reject request with status: rejected",
            });
        });

        test("should handle update errors", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockTokenRequestRef.update.mockRejectedValue(new Error("Update failed"));

            await expect(
                tokenService.rejectTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
                message: "Failed to reject token request",
            });
        });

        test("should handle non-Error thrown from update", async () => {
            mockTokenRequestRef.get.mockResolvedValue(
                createMockUserDoc(true, pendingRequest),
            );
            mockTokenRequestRef.update.mockRejectedValue("string error");

            await expect(
                tokenService.rejectTokenRequest("req-1", "admin-456"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("getOperationCost", () => {
        test("should return cost from system config", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tokens: {
                        costs: {
                            summarize: 5,
                            autoTag: 2,
                            flashcards: 8,
                            ragQuery: 10,
                        },
                    },
                }),
            });

            const cost = await tokenService.getOperationCost("summarize");

            expect(cost).toBe(5);
        });

        test("should return default cost when config not found", async () => {
            mockDocGet.mockResolvedValue({
                exists: false,
                data: () => undefined,
            });

            const cost = await tokenService.getOperationCost("summarize");

            expect(cost).toBe(5); // Default for learning/demo anti-abuse
        });

        test("should return default cost when costs not in config", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tokens: {},
                }),
            });

            const cost = await tokenService.getOperationCost("autoTag");

            expect(cost).toBe(3); // Default for learning/demo anti-abuse
        });

        test("should return correct default costs for all operations", async () => {
            mockDocGet.mockResolvedValue({
                exists: false,
                data: () => undefined,
            });

            expect(await tokenService.getOperationCost("summarize")).toBe(5);
            expect(await tokenService.getOperationCost("autoTag")).toBe(3);
            expect(await tokenService.getOperationCost("flashcards")).toBe(8);
            expect(await tokenService.getOperationCost("ragQuery")).toBe(10);
        });
    });

    describe("TokenService class instantiation", () => {
        test("should create new instance", () => {
            const service = new TokenService();
            expect(service).toBeInstanceOf(TokenService);
        });

        test("singleton instance should be available", () => {
            expect(tokenService).toBeInstanceOf(TokenService);
        });
    });
});
