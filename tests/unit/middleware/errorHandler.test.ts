/**
 * Error Handler Middleware Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import {
    AppError,
    errorHandler,
    notFoundHandler,
    asyncHandler,
} from "@/middleware/errorHandler.js";

// Mock logger
jest.mock("@/utils/logger.js", () => ({
    logError: jest.fn(),
}));

describe("Error Handler Middleware", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            path: "/test",
            method: "GET",
            uid: "user123",
        } as unknown as Request;

        mockResponse = {
            status: jest.fn().mockReturnThis() as unknown as Response["status"],
            json: jest.fn().mockReturnThis() as unknown as Response["json"],
        };

        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    describe("AppError", () => {
        test("should create error with all properties", () => {
            const error = new AppError("INVALID_REQUEST", 400, "Test error", {
                field: "test",
            });

            expect(error.code).toBe("INVALID_REQUEST");
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe("Test error");
            expect(error.details).toEqual({ field: "test" });
            expect(error.name).toBe("AppError");
        });

        test("should create error without details", () => {
            const error = new AppError("UNAUTHENTICATED", 401, "Unauthorized");

            expect(error.details).toBeUndefined();
        });

        test("should have stack trace", () => {
            const error = new AppError("INTERNAL_ERROR", 500, "Server error");

            expect(error.stack).toBeDefined();
        });
    });

    describe("errorHandler", () => {
        test("should handle ZodError", () => {
            const schema = z.object({ name: z.string() });
            let zodError: ZodError | null = null;

            try {
                schema.parse({ name: 123 });
            } catch (error) {
                if (error instanceof ZodError) {
                    zodError = error;
                }
            }

            if (!zodError) {
                throw new Error("ZodError not created");
            }

            errorHandler(
                zodError,
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({
                        code: "INVALID_REQUEST",
                        message: "Validation failed",
                        details: expect.objectContaining({
                            errors: expect.any(Array),
                        }),
                    }),
                    timestamp: expect.any(String),
                }),
            );
        });

        test("should handle AppError", () => {
            const error = new AppError("UNAUTHORIZED", 403, "Access denied", {
                reason: "insufficient permissions",
            });

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "Access denied",
                    details: { reason: "insufficient permissions" },
                },
                timestamp: expect.any(String),
            });
        });

        test("should handle generic Error in production", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "production";

            const error = new Error("Database connection failed");

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "An internal error occurred",
                },
                timestamp: expect.any(String),
            });

            process.env["NODE_ENV"] = originalEnv;
        });

        test("should handle generic Error in development", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "development";

            const error = new Error("Database connection failed");

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Database connection failed",
                },
                timestamp: expect.any(String),
            });

            process.env["NODE_ENV"] = originalEnv;
        });

        test("should include timestamp in error response", () => {
            const error = new AppError("NOT_FOUND", 404, "Resource not found");

            errorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0]?.[0] as
                | { timestamp: string }
                | undefined;
            expect(jsonCall?.timestamp).toBeDefined();
            if (jsonCall) {
                expect(new Date(jsonCall.timestamp).toISOString()).toBe(
                    jsonCall.timestamp,
                );
            }
        });
    });

    describe("notFoundHandler", () => {
        test("should return 404 response", () => {
            notFoundHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: "Route GET /test not found",
                },
                timestamp: expect.any(String),
            });
        });

        test("should include method and path in message", () => {
            mockRequest = Object.assign(mockRequest, {
                method: "POST",
                path: "/api/users",
            });

            notFoundHandler(mockRequest as Request, mockResponse as Response);

            const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0]?.[0] as
                | { error: { message: string } }
                | undefined;
            expect(jsonCall?.error.message).toBe("Route POST /api/users not found");
        });
    });

    describe("asyncHandler", () => {
        test("should handle successful async function", async () => {
            const asyncFn = async (
                _req: Request,
                res: Response,
                _next: NextFunction,
            ): Promise<void> => {
                await Promise.resolve();
                res.status(200).json({ success: true });
            };

            const wrappedFn = asyncHandler(asyncFn);

            wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
        });

        test("should catch and pass async errors to next", async () => {
            const error = new Error("Async error");
            const asyncFn = async (): Promise<void> => {
                await Promise.resolve();
                throw error;
            };

            const wrappedFn = asyncHandler(asyncFn);

            wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        test("should catch and pass AppError to next", async () => {
            const error = new AppError("UNAUTHORIZED", 403, "Access denied");
            const asyncFn = async (): Promise<void> => {
                await Promise.resolve();
                throw error;
            };

            const wrappedFn = asyncHandler(asyncFn);

            wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        test("should handle Promise rejection", async () => {
            const error = new Error("Promise rejected");
            const asyncFn = async (): Promise<void> => {
                await new Promise((resolve) => setTimeout(resolve, 0));
                return Promise.reject(error);
            };

            const wrappedFn = asyncHandler(asyncFn);

            wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});
