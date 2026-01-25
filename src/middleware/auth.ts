/**
 * Authentication Middleware
 *
 * Verifies Firebase ID tokens and loads user data
 * Attaches user object to request for downstream handlers
 */

import { Request, Response, NextFunction } from "express";
import { getFirebaseAuth, getUserByUid, updateLastLogin } from "@/utils/firestore.js";
import { logInfo, logWarn } from "@/utils/logger.js";
import { AppError } from "./errorHandler.js";

/**
 * Authentication middleware
 * Verifies Firebase ID token and loads user data
 *
 * Usage:
 *   app.get('/protected', authMiddleware, (req, res) => {
 *     // req.user and req.uid are now available
 *   });
 */
export async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            throw new AppError(
                "UNAUTHENTICATED",
                401,
                "Missing or invalid authorization header",
            );
        }

        const token = authHeader.split("Bearer ")[1];

        if (!token) {
            throw new AppError("UNAUTHENTICATED", 401, "No token provided");
        }

        // Verify Firebase ID token
        const auth = getFirebaseAuth();
        let decodedToken;

        try {
            decodedToken = await auth.verifyIdToken(token);
        } catch (error) {
            logWarn("Invalid Firebase token", {
                error: error instanceof Error ? error.message : String(error),
                path: req.path,
            });

            throw new AppError("UNAUTHENTICATED", 401, "Invalid or expired token");
        }

        const uid = decodedToken.uid;

        // Load user from Firestore
        const user = await getUserByUid(uid);

        if (!user) {
            throw new AppError("UNAUTHENTICATED", 401, "User not found");
        }

        // Check if user is active
        if (!user.isActive) {
            throw new AppError("UNAUTHORIZED", 403, "User account is inactive");
        }

        // Attach user and uid to request
        req.user = user;
        req.uid = uid;

        // Update last login timestamp (non-blocking)
        void updateLastLogin(uid);

        logInfo("User authenticated", {
            userId: uid,
            email: user.email,
            role: user.role,
            path: req.path,
        });

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Optional auth middleware
 * Attempts to load user but doesn't fail if not authenticated
 * Useful for endpoints that have different behavior for authenticated users
 */
export async function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            // No token provided, continue without authentication
            next();
            return;
        }

        const token = authHeader.split("Bearer ")[1];

        if (!token) {
            next();
            return;
        }

        // Verify token
        const auth = getFirebaseAuth();
        const decodedToken = await auth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Load user
        const user = await getUserByUid(uid);

        if (user?.isActive) {
            req.user = user;
            req.uid = uid;

            logInfo("User optionally authenticated", {
                userId: uid,
                path: req.path,
            });
        }

        next();
    } catch (error) {
        // Ignore authentication errors in optional mode
        logWarn("Optional auth failed", {
            error: error instanceof Error ? error.message : String(error),
            path: req.path,
        });
        next();
    }
}
