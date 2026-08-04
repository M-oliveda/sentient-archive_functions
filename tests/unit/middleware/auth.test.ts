/**
 * Auth Middleware Tests
 */

import { describe, test, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { User } from "@/types/user.js";
import type { Timestamp } from "firebase-admin/firestore";

// Define mock functions for Firebase Auth
const mockVerifyIdToken = jest.fn<(token: string) => Promise<DecodedIdToken>>();
const mockGetAuth = jest.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
}));

// Define mock functions for Firestore
const mockGet = jest.fn<() => Promise<{ exists: boolean; data: () => User | null }>>();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
}));
const mockCollection = jest.fn(() => ({
    doc: mockDoc,
}));
const mockGetFirestore = jest.fn(() => ({
    collection: mockCollection,
}));

// Define mock for Firebase App
const mockInitializeApp = jest.fn();
const mockGetApp = jest.fn(() => {
    throw new Error("No Firebase app initialized");
});

// Configure ESM mocks for External Libraries
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: mockInitializeApp,
    getApp: mockGetApp,
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: mockGetAuth,
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: mockGetFirestore,
    Timestamp: {
        now: () => ({ toDate: () => new Date() }),
        fromDate: (date: Date) => ({ toDate: () => date }),
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

// Import module dynamically
let authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
let optionalAuthMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction,
) => Promise<void>;

// Helper to create mock timestamp
const createMockTimestamp = (): Timestamp =>
    ({
        toDate: () => new Date(),
        seconds: 0,
        nanoseconds: 0,
        toMillis: () => 0,
        isEqual: () => false,
        valueOf: () => "",
    }) as unknown as Timestamp;

describe("Auth Middleware", () => {
    beforeAll(async () => {
        const mod = await import("@/middleware/auth.js");
        authMiddleware = mod.authMiddleware;
        optionalAuthMiddleware = mod.optionalAuthMiddleware;
    });

    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.Mock<NextFunction>;

    beforeEach(() => {
        mockRequest = {
            headers: {},
            path: "/test",
        };

        mockResponse = {};
        mockNext = jest.fn();

        jest.clearAllMocks();

        // Ensure default mock behavior
        mockGetApp.mockImplementation(() => {
            throw new Error("No Firebase app initialized");
        });
        mockGetAuth.mockClear();
        mockGetFirestore.mockClear();
    });

    describe("authMiddleware", () => {
        test("should authenticate valid token", async () => {
            const mockUser: User = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 0,
                totalTokensGranted: 0,
                totalTokensSpent: 0,
                createdAt: createMockTimestamp(),
                lastLoginAt: createMockTimestamp(),
                updatedAt: createMockTimestamp(),
                displayName: "Test User",
                photoURL: null,
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            };

            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockVerifyIdToken).toHaveBeenCalledWith("valid-token");
            expect(mockRequest.user).toEqual(mockUser);
            expect(mockRequest.uid).toBe("user123");
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should reject request without authorization header", async () => {
            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                }),
            );
        });

        test("should reject request with invalid authorization format", async () => {
            mockRequest.headers = {
                authorization: "InvalidFormat token",
            };

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                }),
            );
        });

        test("should reject request with empty token", async () => {
            mockRequest.headers = {
                authorization: "Bearer ",
            };

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                    message: "No token provided",
                }),
            );
        });

        test("should reject invalid token", async () => {
            mockRequest.headers = {
                authorization: "Bearer invalid-token",
            };

            mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                    message: "Invalid or expired token",
                }),
            );
        });

        test("should reject when user not found", async () => {
            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: false,
                data: () => null,
            });

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                    message: "User not found",
                }),
            );
        });

        test("should reject inactive user", async () => {
            const mockUser: User = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: false,
                tokenBalance: 0,
                totalTokensGranted: 0,
                totalTokensSpent: 0,
                createdAt: createMockTimestamp(),
                lastLoginAt: createMockTimestamp(),
                updatedAt: createMockTimestamp(),
                displayName: "Test User",
                photoURL: null,
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            };

            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHORIZED",
                    statusCode: 403,
                    message: "User account is inactive",
                }),
            );
        });

        test("should update last login", async () => {
            const mockUser: User = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 0,
                totalTokensGranted: 0,
                totalTokensSpent: 0,
                createdAt: createMockTimestamp(),
                lastLoginAt: createMockTimestamp(),
                updatedAt: createMockTimestamp(),
                displayName: "Test User",
                photoURL: null,
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            };

            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockUpdate).toHaveBeenCalled();
        });

        test("should handle errors during authentication", async () => {
            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            const error = new Error("Firestore error");
            mockVerifyIdToken.mockRejectedValue(error);

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });

        test("should handle non-Error rejection in authentication", async () => {
            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockRejectedValue("String error");

            await authMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe("optionalAuthMiddleware", () => {
        test("should authenticate valid token", async () => {
            const mockUser: User = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: true,
                tokenBalance: 0,
                totalTokensGranted: 0,
                totalTokensSpent: 0,
                createdAt: createMockTimestamp(),
                lastLoginAt: createMockTimestamp(),
                updatedAt: createMockTimestamp(),
                displayName: "Test User",
                photoURL: null,
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            };

            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toEqual(mockUser);
            expect(mockRequest.uid).toBe("user123");
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should continue without authentication when no token", async () => {
            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toBeUndefined();
            expect(mockRequest.uid).toBeUndefined();
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should continue when token is invalid", async () => {
            mockRequest.headers = {
                authorization: "Bearer invalid-token",
            };

            mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toBeUndefined();
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should continue when user not found", async () => {
            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: false,
                data: () => null,
            });

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toBeUndefined();
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should not attach inactive user", async () => {
            const mockUser: User = {
                uid: "user123",
                email: "test@example.com",
                role: "client",
                isActive: false,
                tokenBalance: 0,
                totalTokensGranted: 0,
                totalTokensSpent: 0,
                createdAt: createMockTimestamp(),
                lastLoginAt: createMockTimestamp(),
                updatedAt: createMockTimestamp(),
                displayName: "Test User",
                photoURL: null,
                preferences: {
                    language: "en",
                    theme: "light",
                    notificationsEnabled: true,
                },
            };

            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };

            mockVerifyIdToken.mockResolvedValue({
                uid: "user123",
                aud: "test-project",
                auth_time: 123,
                exp: 123,
                firebase: { identities: {}, sign_in_provider: "custom" },
                iat: 123,
                iss: "https://securetoken.google.com/test-project",
                sub: "user123",
            } as DecodedIdToken);

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockUser,
            });

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toBeUndefined();
            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should handle non-Error rejection in optional authentication", async () => {
            mockRequest.headers = {
                authorization: "Bearer valid-token",
            };
            mockVerifyIdToken.mockRejectedValue("String error");

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith();
        });

        test("should continue on empty token", async () => {
            mockRequest.headers = {
                authorization: "Bearer ",
            };

            await optionalAuthMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockRequest.user).toBeUndefined();
            expect(mockNext).toHaveBeenCalledWith();
        });
    });
});
