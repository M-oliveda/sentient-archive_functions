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
const mockCollectionGet =
    jest.fn<
        () => Promise<{ forEach: (cb: (doc: { data: () => unknown }) => void) => void }>
    >();
const mockDocGet = jest.fn<() => Promise<MockUserDoc>>();

// User doc mock
const createMockUserDoc = (
    exists: boolean,
    data?: Record<string, unknown>,
): MockUserDoc => ({
    exists,
    data: () => data,
});

// Mock query chain
interface MockQueryChain {
    where: jest.Mock<() => MockQueryChain>;
    orderBy: jest.Mock<() => MockQueryChain>;
    limit: jest.Mock<() => MockQueryChain>;
    get: typeof mockCollectionGet;
}

const createQueryChain = (): MockQueryChain => {
    const chain: MockQueryChain = {
        where: jest.fn(() => chain),
        orderBy: jest.fn(() => chain),
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
    getApps: jest.fn(() => []),
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
            mockCollectionGet.mockResolvedValue({
                forEach: jest.fn(),
            });

            await tokenService.getHistory("user-123", { limit: 10, offset: 5 });

            expect(mockQueryChain.limit).toHaveBeenCalledWith(15); // limit + offset
        });

        test("should filter by transaction type", async () => {
            mockCollectionGet.mockResolvedValue({
                forEach: jest.fn(),
            });

            await tokenService.getHistory("user-123", { type: "grant" });

            expect(mockQueryChain.where).toHaveBeenCalledWith("type", "==", "grant");
        });

        test("should skip offset records correctly", async () => {
            const mockTransactions = [
                { id: "tx1", data: () => ({ id: "tx1" }) },
                { id: "tx2", data: () => ({ id: "tx2" }) },
                { id: "tx3", data: () => ({ id: "tx3" }) },
                { id: "tx4", data: () => ({ id: "tx4" }) },
                { id: "tx5", data: () => ({ id: "tx5" }) },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockTransactions.forEach((tx) => callback(tx));
                },
            });

            const history = await tokenService.getHistory("user-123", {
                limit: 2,
                offset: 2,
            });

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

            expect(cost).toBe(2); // Default from MASTERPLAN
        });

        test("should return default cost when costs not in config", async () => {
            mockDocGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    tokens: {},
                }),
            });

            const cost = await tokenService.getOperationCost("autoTag");

            expect(cost).toBe(1); // Default from MASTERPLAN
        });

        test("should return correct default costs for all operations", async () => {
            mockDocGet.mockResolvedValue({
                exists: false,
                data: () => undefined,
            });

            expect(await tokenService.getOperationCost("summarize")).toBe(2);
            expect(await tokenService.getOperationCost("autoTag")).toBe(1);
            expect(await tokenService.getOperationCost("flashcards")).toBe(3);
            expect(await tokenService.getOperationCost("ragQuery")).toBe(4);
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
