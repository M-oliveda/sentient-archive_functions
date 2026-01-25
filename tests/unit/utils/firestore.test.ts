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

const mockCollection = jest.fn(() => ({
    doc: mockDoc,
}));

// Define module-level mocks
const mockGetFirestore = jest.fn(() => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
}));

const mockGetAuth = jest.fn(() => ({}));
const mockInitializeApp = jest.fn();
const mockGetApps = jest.fn(() => []);

// Configure ESM mocks
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: mockInitializeApp,
    getApps: mockGetApps,
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
        mockGetApps.mockReturnValue([]);
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
});
