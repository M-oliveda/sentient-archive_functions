/**
 * Firestore Utility Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";

// Define mock functions for Firestore operations
const mockGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockSet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRunTransaction = jest.fn<(...args: unknown[]) => Promise<unknown>>();

const mockDoc = jest.fn(() => ({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
}));

const mockOrderBy = jest.fn();
const mockWhere = jest.fn();
const mockCollectionGet = jest.fn<(...args: unknown[]) => Promise<unknown>>();

const mockCollection = jest.fn(() => ({
    doc: mockDoc,
    get: mockCollectionGet,
    where: mockWhere,
    orderBy: mockOrderBy,
}));

// Define module-level mocks
const mockGetFirestore = jest.fn(() => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
}));

const mockGetAuth = jest.fn(() => ({}));
const mockInitializeApp = jest.fn();
const mockGetApp = jest.fn(() => {
    throw new Error("No Firebase app initialized");
});

// Configure ESM mocks
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: mockInitializeApp,
    getApp: mockGetApp,
    applicationDefault: jest.fn(),
    cert: jest.fn(),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: mockGetFirestore,
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: mockGetAuth,
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import modules dynamically after mocking
const {
    getDb,
    getFirebaseAuth,
    getUserByUid,
    saveUser,
    updateLastLogin,
    isUserAdmin,
    getSystemConfig,
    incrementRateLimit,
    getRateLimitCount,
    listUsers,
    updateUserAsAdmin,
} = await import("@/utils/firestore.js");

const { getFirestore } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");

describe("Firestore Utility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default mock implementations if needed
        mockGet.mockReset();
        mockSet.mockReset();
        mockUpdate.mockReset();
        mockRunTransaction.mockReset();

        // Restore default behavior locally if changed in tests
        mockGetApp.mockImplementation(() => {
            throw new Error("No Firebase app initialized");
        });
        mockGetFirestore.mockClear();
        // Note: mockGetFirestore implementation is fixed in the factory to return the object tree,
        // which is fine as strict functional mocks usually just call the function.
    });

    describe("getDb", () => {
        test("should return Firestore instance", () => {
            const db = getDb();

            expect(db).toBeDefined();
            expect(getFirestore).toHaveBeenCalled();
        });

        test("should initialize Firebase with projectId when GCLOUD_PROJECT is set", () => {
            process.env["GCLOUD_PROJECT"] = "test-project";
            const db = getDb();

            expect(db).toBeDefined();
            expect(mockInitializeApp).toHaveBeenCalledWith({
                projectId: "test-project",
            });

            delete process.env["GCLOUD_PROJECT"];
        });

        test("should initialize Firebase without projectId when GCLOUD_PROJECT is not set", () => {
            // Ensure GCLOUD_PROJECT is not set
            delete process.env["GCLOUD_PROJECT"];

            const db = getDb();

            expect(db).toBeDefined();
            expect(mockInitializeApp).toHaveBeenCalledWith(undefined);
        });
    });

    describe("getFirebaseAuth", () => {
        test("should return Auth instance", () => {
            const auth = getFirebaseAuth();

            expect(auth).toBeDefined();
            expect(getAuth).toHaveBeenCalled();
        });
    });

    describe("getUserByUid", () => {
        test("should return user when found", async () => {
            const mockUser = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: true,
            };

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            const result = await getUserByUid("user123");

            expect(result).toEqual(mockUser);
            expect(mockCollection).toHaveBeenCalledWith("users");
            expect(mockDoc).toHaveBeenCalledWith("user123");
        });

        test("should return null when user not found", async () => {
            mockGet.mockResolvedValue({
                exists: false,
            });

            const result = await getUserByUid("nonexistent");

            expect(result).toBeNull();
        });

        test("should throw error on Firestore failure", async () => {
            mockGet.mockRejectedValue(new Error("Firestore error"));

            await expect(getUserByUid("user123")).rejects.toThrow("Firestore error");
        });
    });

    describe("saveUser", () => {
        test("should save user data", async () => {
            const userData = {
                email: "test@example.com",
                displayName: "Test User",
            };

            mockSet.mockResolvedValue(undefined);

            await saveUser("user123", userData);

            expect(mockCollection).toHaveBeenCalledWith("users");
            expect(mockDoc).toHaveBeenCalledWith("user123");
            expect(mockSet).toHaveBeenCalledWith(userData, { merge: true });
        });

        test("should throw error on save failure", async () => {
            mockSet.mockRejectedValue(new Error("Save error"));

            await expect(saveUser("user123", {})).rejects.toThrow("Save error");
        });
    });

    describe("updateLastLogin", () => {
        test("should update last login timestamp", async () => {
            mockUpdate.mockResolvedValue(undefined);

            await updateLastLogin("user123");

            expect(mockCollection).toHaveBeenCalledWith("users");
            expect(mockDoc).toHaveBeenCalledWith("user123");
            expect(mockUpdate).toHaveBeenCalledWith({
                lastLoginAt: expect.any(Date),
            });
        });

        test("should not throw error on update failure", async () => {
            mockUpdate.mockRejectedValue(new Error("Update error"));

            await expect(updateLastLogin("user123")).resolves.not.toThrow();
        });
    });

    describe("isUserAdmin", () => {
        test("should return true for active admin user", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    role: "admin",
                    isActive: true,
                }),
            });

            const result = await isUserAdmin("admin123");

            expect(result).toBe(true);
        });

        test("should return false for inactive admin user", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    role: "admin",
                    isActive: false,
                }),
            });

            const result = await isUserAdmin("admin123");

            expect(result).toBe(false);
        });

        test("should return false for client user", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    role: "client",
                    isActive: true,
                }),
            });

            const result = await isUserAdmin("user123");

            expect(result).toBe(false);
        });

        test("should return false when user not found", async () => {
            mockGet.mockResolvedValue({
                exists: false,
            });

            const result = await isUserAdmin("nonexistent");

            expect(result).toBe(false);
        });

        test("should return false on error", async () => {
            mockGet.mockRejectedValue(new Error("Firestore error"));

            const result = await isUserAdmin("user123");

            expect(result).toBe(false);
        });
    });

    describe("getSystemConfig", () => {
        test("should return system config when found", async () => {
            const mockConfig = {
                ai: { model: "gemini-1.5-flash" },
                tokens: { costs: { summarize: 10 } },
            };

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockConfig,
            });

            const result = await getSystemConfig();

            expect(result).toEqual(mockConfig);
            expect(mockCollection).toHaveBeenCalledWith("system_config");
            expect(mockDoc).toHaveBeenCalledWith("settings");
        });

        test("should return null when config not found", async () => {
            mockGet.mockResolvedValue({
                exists: false,
            });

            const result = await getSystemConfig();

            expect(result).toBeNull();
        });

        test("should return null on error", async () => {
            mockGet.mockRejectedValue(new Error("Firestore error"));

            const result = await getSystemConfig();

            expect(result).toBeNull();
        });
    });

    describe("incrementRateLimit", () => {
        test("should increment existing rate limit", async () => {
            const windowStart = new Date("2024-01-01T00:00:00Z");

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                    set: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => ({ count: 5 }),
                        }),
                    update: jest.fn(),
                    set: jest.fn(),
                };

                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await incrementRateLimit(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(6);
        });

        test("should create new rate limit when not exists", async () => {
            const windowStart = new Date("2024-01-01T00:00:00Z");

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                    set: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: false,
                            data: () => undefined,
                        }),
                    update: jest.fn(),
                    set: jest.fn(),
                };

                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await incrementRateLimit(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(1);
        });

        test("should throw error on transaction failure", async () => {
            const windowStart = new Date("2024-01-01T00:00:00Z");

            mockRunTransaction.mockRejectedValue(new Error("Transaction error"));

            await expect(
                incrementRateLimit("user123", "aiRequests", windowStart),
            ).rejects.toThrow("Transaction error");
        });
    });

    describe("getRateLimitCount", () => {
        test("should return count when rate limit exists", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({ count: 10 }),
            });

            const windowStart = new Date("2024-01-01T00:00:00Z");
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(10);
        });

        test("should return 0 when rate limit not exists", async () => {
            mockGet.mockResolvedValue({
                exists: false,
            });

            const windowStart = new Date("2024-01-01T00:00:00Z");
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(0);
        });

        test("should return 0 when data is null", async () => {
            mockGet.mockResolvedValue({
                exists: true,
                data: () => null,
            });

            const windowStart = new Date("2024-01-01T00:00:00Z");
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(0);
        });

        test("should return 0 on error", async () => {
            mockGet.mockRejectedValue(new Error("Firestore error"));

            const windowStart = new Date("2024-01-01T00:00:00Z");
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );

            expect(result).toBe(0);
        });
    });
    describe("Branch Coverage", () => {
        test("should handle non-Error throw in getUserByUid", async () => {
            mockGet.mockRejectedValue("String error");
            // getUserByUid rethrows, but logs first.
            // We check if it throws what we expect.
            await expect(getUserByUid("user123")).rejects.toEqual("String error");
        });

        test("should handle non-Error throw in saveUser", async () => {
            mockSet.mockRejectedValue("String error");
            await expect(saveUser("user123", {})).rejects.toEqual("String error");
        });

        test("should handle non-Error throw in updateLastLogin", async () => {
            mockUpdate.mockRejectedValue("String error");
            await expect(updateLastLogin("user123")).resolves.not.toThrow();
        });

        test("should handle non-Error throw in isUserAdmin", async () => {
            mockGet.mockRejectedValue("String error");
            const result = await isUserAdmin("user123");
            expect(result).toBe(false);
        });

        test("should handle non-Error throw in getSystemConfig", async () => {
            mockGet.mockRejectedValue("String error");
            const result = await getSystemConfig();
            expect(result).toBeNull();
        });

        test("should handle non-Error throw in incrementRateLimit", async () => {
            const windowStart = new Date();
            mockRunTransaction.mockRejectedValue("String error");
            await expect(
                incrementRateLimit("user123", "aiRequests", windowStart),
            ).rejects.toEqual("String error");
        });

        test("should handle non-Error throw in getRateLimitCount", async () => {
            const windowStart = new Date();
            mockGet.mockRejectedValue("String error");
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );
            expect(result).toBe(0);
        });

        test("incrementRateLimit should handle missing docData gracefully", async () => {
            const windowStart = new Date();
            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                    set: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => null, // doc exists but data is null
                        }),
                    update: jest.fn(),
                    set: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await incrementRateLimit(
                "user123",
                "aiRequests",
                windowStart,
            );
            expect(result).toBe(1);
        });

        test("incrementRateLimit should handle missing count in docData", async () => {
            const windowStart = new Date();
            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                    set: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => ({ someOtherField: 1 }), // count missing
                        }),
                    update: jest.fn(),
                    set: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await incrementRateLimit(
                "user123",
                "aiRequests",
                windowStart,
            );
            expect(result).toBe(1);
        });

        test("getRateLimitCount should handle missing count in docData", async () => {
            const windowStart = new Date();
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({ someOtherField: 1 }),
            });
            const result = await getRateLimitCount(
                "user123",
                "aiRequests",
                windowStart,
            );
            expect(result).toBe(0);
        });
    });

    describe("listUsers", () => {
        beforeEach(() => {
            // Setup query chain mock
            mockWhere.mockReturnValue({
                where: mockWhere,
                orderBy: mockOrderBy,
                get: mockCollectionGet,
            });
            mockOrderBy.mockReturnValue({
                where: mockWhere,
                orderBy: mockOrderBy,
                get: mockCollectionGet,
            });
        });

        test("should return list of users with defaults", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    displayName: "User One",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user2",
                    email: "user2@example.com",
                    displayName: "User Two",
                    role: "admin",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            const result = await listUsers();

            expect(result.users).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
        });

        test("should filter users by role", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            await listUsers({ role: "client" });

            expect(mockWhere).toHaveBeenCalledWith("role", "==", "client");
        });

        test("should filter users by isActive", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            await listUsers({ isActive: true });

            expect(mockWhere).toHaveBeenCalledWith("isActive", "==", true);
        });

        test("should search users by email", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "john@example.com",
                    displayName: "John Doe",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user2",
                    email: "jane@example.com",
                    displayName: "Jane Doe",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            const result = await listUsers({ search: "john" });

            expect(result.users).toHaveLength(1);
            expect(result.users[0]?.email).toBe("john@example.com");
        });

        test("should search users by displayName", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    displayName: "John Smith",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user2",
                    email: "user2@example.com",
                    displayName: "Jane Doe",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            const result = await listUsers({ search: "smith" });

            expect(result.users).toHaveLength(1);
            expect(result.users[0]?.displayName).toBe("John Smith");
        });

        test("should apply pagination with limit and offset", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user2",
                    email: "user2@example.com",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user3",
                    email: "user3@example.com",
                    role: "client",
                    isActive: true,
                },
                {
                    uid: "user4",
                    email: "user4@example.com",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            const result = await listUsers({ limit: 2, offset: 1 });

            expect(result.users).toHaveLength(2);
            expect(result.total).toBe(4);
            expect(result.users[0]?.uid).toBe("user2");
            expect(result.users[1]?.uid).toBe("user3");
        });

        test("should sort by specified field and order", async () => {
            const mockUsers = [
                {
                    uid: "user1",
                    email: "user1@example.com",
                    role: "client",
                    isActive: true,
                },
            ];

            mockCollectionGet.mockResolvedValue({
                forEach: (callback: (doc: { data: () => unknown }) => void) => {
                    mockUsers.forEach((user) => callback({ data: () => user }));
                },
            });

            await listUsers({ sortBy: "tokenBalance", sortOrder: "asc" });

            expect(mockOrderBy).toHaveBeenCalledWith("tokenBalance", "asc");
        });

        test("should throw error on Firestore failure", async () => {
            mockCollectionGet.mockRejectedValue(new Error("Firestore error"));

            await expect(listUsers()).rejects.toThrow("Firestore error");
        });

        test("should handle non-Error throw in listUsers", async () => {
            mockCollectionGet.mockRejectedValue("String error");

            await expect(listUsers()).rejects.toEqual("String error");
        });
    });

    describe("updateUserAsAdmin", () => {
        test("should update user role", async () => {
            const existingUser = {
                uid: "user123",
                email: "user@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 100,
                totalTokensGranted: 100,
            };

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => existingUser,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await updateUserAsAdmin("user123", { role: "admin" });

            expect(result.role).toBe("admin");
        });

        test("should update user isActive status", async () => {
            const existingUser = {
                uid: "user123",
                email: "user@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 100,
                totalTokensGranted: 100,
            };

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => existingUser,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await updateUserAsAdmin("user123", { isActive: false });

            expect(result.isActive).toBe(false);
        });

        test("should update token balance and track granted tokens", async () => {
            const existingUser = {
                uid: "user123",
                email: "user@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 100,
                totalTokensGranted: 100,
            };

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => existingUser,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await updateUserAsAdmin("user123", { tokenBalance: 200 });

            expect(result.tokenBalance).toBe(200);
            expect(result.totalTokensGranted).toBe(200); // 100 + (200 - 100)
        });

        test("should not increase totalTokensGranted when reducing balance", async () => {
            const existingUser = {
                uid: "user123",
                email: "user@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 100,
                totalTokensGranted: 100,
            };

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => existingUser,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await updateUserAsAdmin("user123", { tokenBalance: 50 });

            expect(result.tokenBalance).toBe(50);
            // totalTokensGranted should not increase when reducing balance
            expect(result.totalTokensGranted).toBe(100);
        });

        test("should throw error when user not found", async () => {
            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: false,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            await expect(
                updateUserAsAdmin("nonexistent", { role: "admin" }),
            ).rejects.toThrow("User not found");
        });

        test("should throw error on transaction failure", async () => {
            mockRunTransaction.mockRejectedValue(new Error("Transaction error"));

            await expect(
                updateUserAsAdmin("user123", { role: "admin" }),
            ).rejects.toThrow("Transaction error");
        });

        test("should handle non-Error throw in updateUserAsAdmin", async () => {
            mockRunTransaction.mockRejectedValue("String error");

            await expect(
                updateUserAsAdmin("user123", { role: "admin" }),
            ).rejects.toEqual("String error");
        });

        test("should handle user with missing tokenBalance field", async () => {
            const existingUser = {
                uid: "user123",
                email: "user@example.com",
                role: "client",
                isActive: true,
                // tokenBalance is undefined
                // totalTokensGranted is undefined
            };

            mockRunTransaction.mockImplementation((async (
                callback: (t: {
                    get: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
                    update: jest.Mock<(...args: unknown[]) => unknown>;
                }) => Promise<unknown>,
            ) => {
                const mockTransaction = {
                    get: jest
                        .fn<(...args: unknown[]) => Promise<unknown>>()
                        .mockResolvedValue({
                            exists: true,
                            data: () => existingUser,
                        }),
                    update: jest.fn(),
                };
                return await callback(mockTransaction);
            }) as (...args: unknown[]) => Promise<unknown>);

            const result = await updateUserAsAdmin("user123", { tokenBalance: 100 });

            expect(result.tokenBalance).toBe(100);
            // Both tokenBalance and totalTokensGranted default to 0, so:
            // difference = 100 - 0 = 100, totalTokensGranted = 0 + 100 = 100
            expect(result.totalTokensGranted).toBe(100);
        });
    });
});
