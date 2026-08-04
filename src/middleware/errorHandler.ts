/**
 * Error Handler Middleware
 *
 * Centralized error handling for Express
 * Catches all errors and returns consistent API responses
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logError } from "@/utils/logger.js";
import { ApiResponse, ApiErrorCode } from "@/types/api.js";

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
    constructor(
        public code: ApiErrorCode,
        public statusCode: number,
        message: string,
        public details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error handler middleware
 * Must be the last middleware in the chain
 */
export function errorHandler(
    error: Error | AppError | ZodError,
    req: Request,
    res: Response,

    _next: NextFunction,
): void {
    // Log the error
    logError("Request error", error, {
        path: req.path,
        method: req.method,
        userId: req.uid,
    });

    // Handle Zod validation errors
    if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
        }));

        const response: ApiResponse = {
            success: false,
            error: {
                code: "INVALID_REQUEST",
                message: "Validation failed",
                details: { errors: validationErrors },
            },
            timestamp: new Date().toISOString(),
        };

        res.status(400).json(response);
        return;
    }

    // Handle application errors
    if (error instanceof AppError) {
        const response: ApiResponse = {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(error.statusCode).json(response);
        return;
    }

    // Handle Firestore index errors (FAILED_PRECONDITION)
    if (
        error.message &&
        error.message.includes("FAILED_PRECONDITION") &&
        error.message.includes("requires an index")
    ) {
        const details: Record<string, unknown> = {};

        // In non-production, include the index creation URL for debugging
        if (process.env["NODE_ENV"] !== "production") {
            const urlRegex = /https:\/\/console\.firebase\.google\.com[^\s]+/;
            const urlMatch = urlRegex.exec(error.message);
            if (urlMatch) {
                details["indexUrl"] = urlMatch[0];
            }
        }

        const response: ApiResponse = {
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "Database index is building or missing. Please retry shortly.",
                ...(Object.keys(details).length > 0 && { details }),
            },
            timestamp: new Date().toISOString(),
        };

        res.status(503).json(response);
        return;
    }

    // Handle unknown errors
    const response: ApiResponse = {
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message:
                process.env["NODE_ENV"] === "production"
                    ? "An internal error occurred"
                    : error.message,
        },
        timestamp: new Date().toISOString(),
    };

    res.status(500).json(response);
}

/**
 * Not Found handler
 * Returns 404 for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
    const response: ApiResponse = {
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Route ${req.method} ${req.path} not found`,
        },
        timestamp: new Date().toISOString(),
    };

    res.status(404).json(response);
}

/**
 * Async handler wrapper
 * Catches async errors and passes them to error handler
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
