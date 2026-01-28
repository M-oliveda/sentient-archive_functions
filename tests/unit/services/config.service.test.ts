/**
 * Config Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock data types
interface MockConfigDoc {
    exists: boolean;
    data: () => Record<string, unknown> | undefined;
}

interface MockFirestoreTransaction {
    get: jest.Mock<(ref: unknown) => Promise<MockConfigDoc>>;
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
const mockDocGet = jest.fn<() => Promise<MockConfigDoc>>();
const mockDocSet = jest.fn();

const createMockConfigDoc = (
    exists: boolean,
    data?: Record<string, unknown>,
): MockConfigDoc => ({
    exists,
    data: () => data,
});

const mockDb = {
    collection: jest.fn(() => ({
        doc: jest.fn(() => ({
            get: mockDocGet,
            set: mockDocSet,
        })),
    })),
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
let ConfigService: typeof import("@/services/config.service.js").ConfigService;
let configService: import("@/services/config.service.js").ConfigService;

describe("Config Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/config.service.js");
        ConfigService = mod.ConfigService;
        configService = mod.configService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("getConfig", () => {
        test("should return default config when document does not exist", async () => {
            mockDocGet.mockResolvedValue(createMockConfigDoc(false));

            const config = await configService.getConfig();

            expect(config.ai.model).toBe("gemini-1.5-flash");
            expect(config.tokens.costs.summarize).toBe(2);
            expect(config.features.summarizeEnabled).toBe(true);
            expect(config.version).toBe(1);
        });

        test("should return stored config when document exists", async () => {
            const storedConfig = {
                ai: {
                    model: "custom-model",
                    maxTokensPerRequest: 8192,
                    temperature: 0.5,
                },
                tokens: {
                    initialGrant: {
                        production: 200,
                        development: 1000,
                        staging: 400,
                        local: 2000,
                    },
                    costs: {
                        summarize: 5,
                        autoTag: 2,
                        flashcards: 6,
                        ragQuery: 8,
                    },
                },
                features: {
                    summarizeEnabled: false,
                    autoTagEnabled: true,
                    flashcardsEnabled: true,
                    ragQueryEnabled: true,
                    fileExtractionEnabled: false,
                },
                rateLimits: {
                    aiRequestsPerHour: 200,
                    fileExtractionsPerDay: 100,
                },
                version: 5,
                lastUpdatedBy: "admin-123",
                lastUpdatedAt: { toDate: () => new Date("2024-01-10T00:00:00.000Z") },
                createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            };

            mockDocGet.mockResolvedValue(createMockConfigDoc(true, storedConfig));

            const config = await configService.getConfig();

            expect(config.ai.model).toBe("custom-model");
            expect(config.tokens.costs.summarize).toBe(5);
            expect(config.features.summarizeEnabled).toBe(false);
            expect(config.version).toBe(5);
        });

        test("should merge stored config with defaults for missing fields", async () => {
            // Partial config missing some fields
            const partialConfig = {
                ai: {
                    model: "partial-model",
                },
                version: 3,
            };

            mockDocGet.mockResolvedValue(createMockConfigDoc(true, partialConfig));

            const config = await configService.getConfig();

            // Should have stored value
            expect(config.ai.model).toBe("partial-model");
            // Should have defaults for missing nested fields
            expect(config.ai.maxTokensPerRequest).toBe(4096);
            expect(config.ai.temperature).toBe(0.7);
            // Should have defaults for missing sections
            expect(config.tokens.costs.summarize).toBe(2);
            expect(config.features.summarizeEnabled).toBe(true);
        });

        test("should handle Firestore errors gracefully", async () => {
            mockDocGet.mockRejectedValue(new Error("Firestore connection error"));

            await expect(configService.getConfig()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should handle non-Error thrown objects", async () => {
            mockDocGet.mockRejectedValue("String error");

            await expect(configService.getConfig()).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });
    });

    describe("updateConfig", () => {
        test("should update config with deep merge", async () => {
            const existingConfig = {
                ai: {
                    model: "gemini-1.5-flash",
                    maxTokensPerRequest: 4096,
                    temperature: 0.7,
                },
                tokens: {
                    initialGrant: {
                        production: 100,
                        development: 500,
                        staging: 200,
                        local: 1000,
                    },
                    costs: {
                        summarize: 2,
                        autoTag: 1,
                        flashcards: 3,
                        ragQuery: 4,
                    },
                },
                features: {
                    summarizeEnabled: true,
                    autoTagEnabled: true,
                    flashcardsEnabled: true,
                    ragQueryEnabled: true,
                    fileExtractionEnabled: true,
                },
                rateLimits: {
                    aiRequestsPerHour: 100,
                    fileExtractionsPerDay: 50,
                },
                version: 1,
                lastUpdatedBy: null,
                lastUpdatedAt: null,
                createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            };

            const mockTransaction: MockFirestoreTransaction = {
                get: jest.fn().mockResolvedValue(createMockConfigDoc(true, existingConfig)),
                set: jest.fn(),
            };

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTransaction);
            });

            const updates = {
                features: {
                    summarizeEnabled: false,
                },
            };

            const result = await configService.updateConfig(updates, "admin-456");

            // Should preserve other values
            expect(result.ai.model).toBe("gemini-1.5-flash");
            expect(result.features.autoTagEnabled).toBe(true);
            // Should update specified value
            expect(result.features.summarizeEnabled).toBe(false);
            // Should increment version
            expect(result.version).toBe(2);
            // Should set lastUpdatedBy
            expect(result.lastUpdatedBy).toBe("admin-456");
        });

        test("should create config if it does not exist", async () => {
            const mockTransaction: MockFirestoreTransaction = {
                get: jest.fn().mockResolvedValue(createMockConfigDoc(false)),
                set: jest.fn(),
            };

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTransaction);
            });

            const updates = {
                ai: {
                    model: "new-model",
                },
            };

            const result = await configService.updateConfig(updates, "admin-789");

            expect(result.ai.model).toBe("new-model");
            // Should use defaults for everything else
            expect(result.tokens.costs.summarize).toBe(2);
            expect(result.version).toBe(2); // Started at 1, incremented to 2
        });

        test("should ignore metadata fields in updates", async () => {
            const existingConfig = {
                version: 5,
                lastUpdatedBy: "old-admin",
                lastUpdatedAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
                createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
            };

            const mockTransaction: MockFirestoreTransaction = {
                get: jest.fn().mockResolvedValue(createMockConfigDoc(true, existingConfig)),
                set: jest.fn(),
            };

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTransaction);
            });

            // Try to manually set version and metadata (should be ignored)
            const updates = {
                version: 100,
                lastUpdatedBy: "hacker",
                createdAt: { toDate: () => new Date("2000-01-01T00:00:00.000Z") },
            } as Parameters<typeof configService.updateConfig>[0];

            const result = await configService.updateConfig(updates, "admin-123");

            // Version should be incremented, not set to 100
            expect(result.version).toBe(6);
            // lastUpdatedBy should be the actual admin
            expect(result.lastUpdatedBy).toBe("admin-123");
        });

        test("should handle transaction errors", async () => {
            mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

            await expect(
                configService.updateConfig({ ai: { model: "test" } }, "admin-123"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should re-throw AppError directly", async () => {
            const { AppError } = await import("@/middleware/errorHandler.js");
            mockRunTransaction.mockRejectedValue(
                new AppError("NOT_FOUND", 404, "Test error"),
            );

            await expect(
                configService.updateConfig({ ai: { model: "test" } }, "admin-123"),
            ).rejects.toMatchObject({
                code: "NOT_FOUND",
                statusCode: 404,
            });
        });

        test("should handle non-Error thrown objects in updateConfig", async () => {
            mockRunTransaction.mockRejectedValue("String error");

            await expect(
                configService.updateConfig({ ai: { model: "test" } }, "admin-123"),
            ).rejects.toMatchObject({
                code: "INTERNAL_ERROR",
                statusCode: 500,
            });
        });

        test("should perform deep merge for nested objects", async () => {
            const existingConfig = {
                tokens: {
                    costs: {
                        summarize: 2,
                        autoTag: 1,
                        flashcards: 3,
                        ragQuery: 4,
                    },
                },
                version: 1,
            };

            const mockTransaction: MockFirestoreTransaction = {
                get: jest.fn().mockResolvedValue(createMockConfigDoc(true, existingConfig)),
                set: jest.fn(),
            };

            mockRunTransaction.mockImplementation(async (updateFunction) => {
                return updateFunction(mockTransaction);
            });

            // Only update one cost
            const updates = {
                tokens: {
                    costs: {
                        summarize: 10,
                    },
                },
            };

            const result = await configService.updateConfig(updates, "admin-123");

            // Should update summarize
            expect(result.tokens.costs.summarize).toBe(10);
            // Should preserve other costs
            expect(result.tokens.costs.autoTag).toBe(1);
            expect(result.tokens.costs.flashcards).toBe(3);
            expect(result.tokens.costs.ragQuery).toBe(4);
        });
    });

    describe("ConfigService class instantiation", () => {
        test("should create new instance", () => {
            const service = new ConfigService();
            expect(service).toBeInstanceOf(ConfigService);
        });

        test("singleton instance should be available", () => {
            expect(configService).toBeInstanceOf(ConfigService);
        });
    });
});
