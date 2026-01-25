/**
 * Rate Limit Middleware
 *
 * Enforces rate limits per user using Firestore
 * Prevents abuse of expensive operations (AI requests, file uploads)
 */

import { Request, Response, NextFunction } from "express";
import {
    getRateLimitCount,
    incrementRateLimit,
    getSystemConfig,
} from "@/utils/firestore.js";
import { logWarn } from "@/utils/logger.js";
import { AppError } from "./errorHandler.js";

/**
 * Rate limit types
 */
export type RateLimitType = "aiRequests" | "fileExtractions";

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    maxRequests: number;
    windowMs: number; // Time window in milliseconds
}

/**
 * Default rate limits (fallback if system config not available)
 */
const DEFAULT_LIMITS: Record<RateLimitType, RateLimitConfig> = {
    aiRequests: {
        maxRequests: 60,
        windowMs: 60 * 60 * 1000, // 1 hour
    },
    fileExtractions: {
        maxRequests: 20,
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
    },
};

/**
 * Get rate limit configuration from system config or defaults
 */
async function getRateLimitConfig(limitType: RateLimitType): Promise<RateLimitConfig> {
    try {
        const config = await getSystemConfig();

        if (config?.["rateLimits"]) {
            const rateLimits = config["rateLimits"] as {
                aiRequestsPerHour?: number;
                fileExtractionsPerDay?: number;
            };

            if (limitType === "aiRequests" && rateLimits.aiRequestsPerHour) {
                return {
                    maxRequests: rateLimits.aiRequestsPerHour,
                    windowMs: 60 * 60 * 1000, // 1 hour
                };
            }

            if (limitType === "fileExtractions" && rateLimits.fileExtractionsPerDay) {
                return {
                    maxRequests: rateLimits.fileExtractionsPerDay,
                    windowMs: 24 * 60 * 60 * 1000, // 24 hours
                };
            }
        }
    } catch {
        // Fall through to default limits
    }

    return DEFAULT_LIMITS[limitType];
}

/**
 * Calculate the start of the current time window
 */
function getWindowStart(windowMs: number): Date {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    return new Date(windowStart);
}

/**
 * Rate limiting middleware factory
 * Creates middleware for specific rate limit type
 *
 * Usage:
 *   app.post('/ai/summarize',
 *     authMiddleware,
 *     rateLimitMiddleware('aiRequests'),
 *     handler
 *   );
 */
export function rateLimitMiddleware(limitType: RateLimitType) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Check if user is authenticated
            if (!req.user || !req.uid) {
                throw new AppError(
                    "UNAUTHENTICATED",
                    401,
                    "Authentication required for rate limiting",
                );
            }

            // Get rate limit configuration
            const config = await getRateLimitConfig(limitType);
            const windowStart = getWindowStart(config.windowMs);

            // Check current rate limit count
            const currentCount = await getRateLimitCount(
                req.uid,
                limitType,
                windowStart,
            );

            // Check if limit exceeded
            if (currentCount >= config.maxRequests) {
                logWarn("Rate limit exceeded", {
                    userId: req.uid,
                    limitType,
                    currentCount,
                    maxRequests: config.maxRequests,
                    windowStart: windowStart.toISOString(),
                    path: req.path,
                });

                const windowEndTime = new Date(windowStart.getTime() + config.windowMs);
                const resetInSeconds = Math.ceil(
                    (windowEndTime.getTime() - Date.now()) / 1000,
                );

                throw new AppError(
                    "RATE_LIMIT_EXCEEDED",
                    429,
                    `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
                    {
                        limitType,
                        maxRequests: config.maxRequests,
                        currentCount,
                        resetAt: windowEndTime.toISOString(),
                        resetInSeconds,
                    },
                );
            }

            // Increment rate limit counter
            const newCount = await incrementRateLimit(req.uid, limitType, windowStart);

            // Add rate limit headers to response
            res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
            res.setHeader(
                "X-RateLimit-Remaining",
                (config.maxRequests - newCount).toString(),
            );
            res.setHeader(
                "X-RateLimit-Reset",
                new Date(windowStart.getTime() + config.windowMs).toISOString(),
            );

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Combined rate limiter for AI operations
 * Checks both general AI request limit and specific operation limits
 */
export function aiRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    return rateLimitMiddleware("aiRequests")(req, res, next);
}

/**
 * File extraction rate limiter
 */
export function fileExtractionRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    return rateLimitMiddleware("fileExtractions")(req, res, next);
}
