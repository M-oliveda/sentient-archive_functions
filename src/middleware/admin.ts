/**
 * Admin Middleware
 *
 * Verifies that the authenticated user has admin role
 * Must be used after authMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { logWarn } from "@/utils/logger.js";
import { AppError } from "./errorHandler.js";

/**
 * Admin authorization middleware
 * Checks if authenticated user has admin role
 *
 * Usage:
 *   app.get('/admin', authMiddleware, adminMiddleware, (req, res) => {
 *     // User is verified to be an admin
 *   });
 *
 * Note: Must be used AFTER authMiddleware
 */
export function adminMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    try {
        // Check if user is authenticated
        if (!req.user || !req.uid) {
            throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
        }

        // Check if user has admin role
        if (req.user.role !== "admin") {
            logWarn("Unauthorized admin access attempt", {
                userId: req.uid,
                email: req.user.email,
                role: req.user.role,
                path: req.path,
            });

            throw new AppError("UNAUTHORIZED", 403, "Admin access required");
        }

        // Check if admin account is active
        if (!req.user.isActive) {
            throw new AppError("UNAUTHORIZED", 403, "Admin account is inactive");
        }

        next();
    } catch (error) {
        next(error);
    }
}
