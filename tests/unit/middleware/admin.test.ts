import { describe, test, expect, jest, beforeEach, beforeAll } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { User } from "@/types/user.js";
import { Timestamp } from "firebase-admin/firestore";

// Define mock function
const mockLogWarn = jest.fn();

// Mock logger
jest.unstable_mockModule("@/utils/logger.js", () => ({
    __esModule: true,
    logWarn: mockLogWarn,
    logError: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logEvent: jest.fn(),
    createContextLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        event: jest.fn(),
    })),
}));

describe("Admin Middleware", () => {
    let adminMiddleware: (req: Request, res: Response, next: NextFunction) => void;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.Mock;

    beforeAll(async () => {
        const module = await import("@/middleware/admin.js");
        adminMiddleware = module.adminMiddleware;
    });

    beforeEach(() => {
        mockRequest = {
            path: "/admin/test",
        };

        mockResponse = {};
        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    test("should allow active admin user", () => {
        const adminUser: User = {
            uid: "admin123",
            email: "admin@example.com",
            displayName: "Admin User",
            photoURL: null,
            role: "admin",
            isActive: true,
            tokenBalance: 1000,
            totalTokensGranted: 1000,
            totalTokensSpent: 0,
            createdAt: {} as unknown as Timestamp,
            lastLoginAt: {} as unknown as Timestamp,
            updatedAt: {} as unknown as Timestamp,
            preferences: {
                language: "en",
                theme: "light",
                notificationsEnabled: true,
            },
        };

        mockRequest.user = adminUser;
        mockRequest.uid = "admin123";

        adminMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext as unknown as NextFunction,
        );

        expect(mockNext).toHaveBeenCalledWith();
    });

    test("should reject request without user", () => {
        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "UNAUTHENTICATED",
                statusCode: 401,
                message: "Authentication required",
            }),
        );
    });

    test("should reject request without uid", () => {
        mockRequest.user = {} as User;

        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "UNAUTHENTICATED",
                statusCode: 401,
                message: "Authentication required",
            }),
        );
    });

    test("should reject client user", () => {
        const clientUser: User = {
            uid: "user123",
            email: "user@example.com",
            displayName: "Client User",
            photoURL: null,
            role: "client",
            isActive: true,
            tokenBalance: 500,
            totalTokensGranted: 500,
            totalTokensSpent: 0,
            createdAt: {} as unknown as Timestamp,
            lastLoginAt: {} as unknown as Timestamp,
            updatedAt: {} as unknown as Timestamp,
            preferences: {
                language: "en",
                theme: "light",
                notificationsEnabled: true,
            },
        };

        mockRequest.user = clientUser;
        mockRequest.uid = "user123";

        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "UNAUTHORIZED",
                statusCode: 403,
                message: "Admin access required",
            }),
        );
    });

    test("should reject inactive admin user", () => {
        const inactiveAdmin: User = {
            uid: "admin123",
            email: "admin@example.com",
            displayName: "Inactive Admin",
            photoURL: null,
            role: "admin",
            isActive: false,
            tokenBalance: 1000,
            totalTokensGranted: 1000,
            totalTokensSpent: 0,
            createdAt: {} as unknown as Timestamp,
            lastLoginAt: {} as unknown as Timestamp,
            updatedAt: {} as unknown as Timestamp,
            preferences: {
                language: "en",
                theme: "light",
                notificationsEnabled: false,
            },
        };

        mockRequest.user = inactiveAdmin;
        mockRequest.uid = "admin123";

        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "UNAUTHORIZED",
                statusCode: 403,
                message: "Admin account is inactive",
            }),
        );
    });

    test("should log unauthorized access attempt", () => {
        const clientUser: User = {
            uid: "user123",
            email: "user@example.com",
            displayName: "Client User",
            photoURL: null,
            role: "client",
            isActive: true,
            tokenBalance: 500,
            totalTokensGranted: 500,
            totalTokensSpent: 0,
            createdAt: {} as unknown as Timestamp,
            lastLoginAt: {} as unknown as Timestamp,
            updatedAt: {} as unknown as Timestamp,
            preferences: {
                language: "en",
                theme: "light",
                notificationsEnabled: true,
            },
        };

        mockRequest.user = clientUser;
        mockRequest.uid = "user123";

        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockLogWarn).toHaveBeenCalledWith(
            "Unauthorized admin access attempt",
            expect.objectContaining({
                userId: "user123",
                email: "user@example.com",
                role: "client",
                path: "/admin/test",
            }),
        );
    });

    test("should handle errors in middleware", () => {
        // Simulate an error by passing null user
        mockRequest.user = null as unknown as User;

        adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "UNAUTHENTICATED",
            }),
        );
    });
});
