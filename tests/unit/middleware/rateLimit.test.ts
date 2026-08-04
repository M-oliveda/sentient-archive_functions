/**
 * Rate Limit Middleware Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";

// Mock dependencies
const mockGetRateLimitCount = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockIncrementRateLimit = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockGetSystemConfig = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule("@/utils/firestore.js", () => ({
    getRateLimitCount: mockGetRateLimitCount,
    incrementRateLimit: mockIncrementRateLimit,
    getSystemConfig: mockGetSystemConfig,
}));

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logWarn: mockLogWarn,
    logError: mockLogError,
}));

const {
    rateLimitMiddleware,
    aiRateLimitMiddleware,
    fileExtractionRateLimitMiddleware,
} = await import("@/middleware/rateLimit.js");

describe("Rate Limit Middleware", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
        mockRequest = {
            path: "/test",
            uid: "user123",
            user: {
                uid: "user123",
                email: "test@example.com",
            } as unknown as Request["user"],
        };

        mockResponse = {
            setHeader: jest.fn().mockReturnThis() as unknown as Response["setHeader"],
        };

        mockNext = jest.fn();

        jest.clearAllMocks();

        // Default mock responses
        mockGetSystemConfig.mockResolvedValue(null);
        mockGetRateLimitCount.mockResolvedValue(0);
        mockIncrementRateLimit.mockResolvedValue(1);
    });

    describe("rateLimitMiddleware", () => {
        test("should allow request under rate limit", async () => {
            mockGetRateLimitCount.mockResolvedValue(5);
            mockIncrementRateLimit.mockResolvedValue(6);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext as unknown as NextFunction,
            );

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Limit",
                "20",
            );
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Remaining",
                "14",
            );
        });

        test("should reject request exceeding rate limit", async () => {
            mockGetRateLimitCount.mockResolvedValue(20);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "RATE_LIMIT_EXCEEDED",
                    statusCode: 429,
                    message: expect.stringContaining("Rate limit exceeded"),
                }),
            );
        });

        test("should use custom rate limits from system config", async () => {
            mockGetSystemConfig.mockResolvedValue({
                rateLimits: {
                    aiRequestsPerHour: 100,
                },
            });
            mockGetRateLimitCount.mockResolvedValue(50);
            mockIncrementRateLimit.mockResolvedValue(51);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Limit",
                "100",
            );
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Remaining",
                "49",
            );
        });

        test("should reject unauthenticated request", async () => {
            mockRequest.user = undefined;
            mockRequest.uid = undefined;

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: "UNAUTHENTICATED",
                    statusCode: 401,
                    message: "Authentication required for rate limiting",
                }),
            );
        });

        test("should set rate limit reset header", async () => {
            mockGetRateLimitCount.mockResolvedValue(0);
            mockIncrementRateLimit.mockResolvedValue(1);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Reset",
                expect.any(String),
            );

            const resetCall = (mockResponse.setHeader as jest.Mock).mock.calls.find(
                (call) => call[0] === "X-RateLimit-Reset",
            ) as [string, string];
            expect(new Date(resetCall[1]).toISOString()).toBe(resetCall[1]);
        });

        test("should handle file extraction rate limit", async () => {
            mockGetSystemConfig.mockResolvedValue({
                rateLimits: {
                    fileExtractionsPerDay: 20,
                },
            });
            mockGetRateLimitCount.mockResolvedValue(10);
            mockIncrementRateLimit.mockResolvedValue(11);

            const middleware = rateLimitMiddleware("fileExtractions");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Limit",
                "20",
            );
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Remaining",
                "9",
            );
        });

        test("should fall back to default limits on config error", async () => {
            mockGetSystemConfig.mockRejectedValue(new Error("Config error"));
            mockGetRateLimitCount.mockResolvedValue(5);
            mockIncrementRateLimit.mockResolvedValue(6);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith();
            expect(mockResponse.setHeader).toHaveBeenCalledWith(
                "X-RateLimit-Limit",
                "20",
            );
        });

        test("should handle increment error", async () => {
            mockGetRateLimitCount.mockResolvedValue(5);
            mockIncrementRateLimit.mockRejectedValue(new Error("Increment error"));

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });

        test("should calculate correct reset time", async () => {
            mockGetRateLimitCount.mockResolvedValue(60);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const error = (mockNext.mock.calls[0]?.[0] ?? {}) as {
                details?: { resetInSeconds: number };
            };
            expect(error.details?.resetInSeconds).toBeGreaterThan(0);
            if (error.details) {
                expect(error.details.resetInSeconds).toBeLessThanOrEqual(3600);
            }
        });
    });

    describe("aiRateLimitMiddleware", () => {
        test("should apply AI request rate limit", async () => {
            mockGetRateLimitCount.mockResolvedValue(0);
            mockIncrementRateLimit.mockResolvedValue(1);

            await aiRateLimitMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockIncrementRateLimit).toHaveBeenCalledWith(
                "user123",
                "aiRequests",
                expect.any(Date),
            );
            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe("fileExtractionRateLimitMiddleware", () => {
        test("should apply file extraction rate limit", async () => {
            mockGetRateLimitCount.mockResolvedValue(0);
            mockIncrementRateLimit.mockResolvedValue(1);

            await fileExtractionRateLimitMiddleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            expect(mockIncrementRateLimit).toHaveBeenCalledWith(
                "user123",
                "fileExtractions",
                expect.any(Date),
            );
            expect(mockNext).toHaveBeenCalledWith();
        });
    });

    describe("rate limit window calculation", () => {
        test("should use hourly window for AI requests", async () => {
            mockGetRateLimitCount.mockResolvedValue(0);
            mockIncrementRateLimit.mockResolvedValue(1);

            const middleware = rateLimitMiddleware("aiRequests");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const incrementCall = mockIncrementRateLimit.mock.calls[0]!;
            const windowStart = incrementCall[2] as Date;

            // Window should align to hour boundaries
            expect(windowStart.getUTCMinutes()).toBe(0);
            expect(windowStart.getUTCSeconds()).toBe(0);
            expect(windowStart.getUTCMilliseconds()).toBe(0);
        });

        test("should use daily window for file extractions", async () => {
            mockGetRateLimitCount.mockResolvedValue(0);
            mockIncrementRateLimit.mockResolvedValue(1);

            const middleware = rateLimitMiddleware("fileExtractions");
            await middleware(
                mockRequest as Request,
                mockResponse as Response,
                mockNext,
            );

            const incrementCall = mockIncrementRateLimit.mock.calls[0]!;
            const windowStart = incrementCall[2] as Date;

            // Window should align to day boundaries
            expect(windowStart.getUTCHours()).toBe(0);
            expect(windowStart.getUTCMinutes()).toBe(0);
            expect(windowStart.getUTCSeconds()).toBe(0);
        });
    });
});
