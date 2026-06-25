/**
 * SentientArchive Cloud Functions
 *
 * Entry point for Firebase Cloud Functions Gen 2
 * Exports all HTTP functions for the SentientArchive backend API
 */

import { onRequest } from "firebase-functions/v2/https";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { setGlobalOptions } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import express, { Request, Response } from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { logInfo, logError } from "./utils/logger.js";
import { saveUser } from "./utils/firestore.js";
import { User } from "./types/user.js";
import notesRouter from "./routes/notes.routes.js";
import tokensRouter from "./routes/tokens.routes.js";
import aiRouter from "./routes/ai.routes.js";
import adminRouter from "./routes/admin.routes.js";

// Set global options for all functions
setGlobalOptions({
    region: "us-central1",
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "256MiB",
});

/**
 * Create Express app
 */
const app = express();

/**
 * Global Middleware
 */

// Parse JSON bodies
app.use(express.json({ limit: "1mb" }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Request logging
app.use((req, _res, next) => {
    logInfo("Incoming request", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    });
    next();
});

/**
 * Health check endpoint
 */
app.get("/health", (_req: Request, response: Response) => {
    response.status(200).json({
        success: true,
        message: "SentientArchive API is healthy",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
    });
});

/**
 * API Routes
 */

// v1 API routes
app.use("/v1/notes", notesRouter);
app.use("/v1/tokens", tokensRouter);
app.use("/v1/ai", aiRouter);
app.use("/v1/admin", adminRouter);

/**
 * Error Handling
 */

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

/**
 * Main API endpoint
 *
 * Handles all HTTP requests to the SentientArchive API
 * Routes are defined in the Express app above
 */
export const sentientArchiveApi = onRequest(
    {
        cors: true,
        invoker: "public",
    },
    app,
);

/**
 * Auth trigger: create Firestore user profile on signup
 *
 * Fires before the user record is committed to Firebase Auth, so the
 * document exists by the time createUserWithEmailAndPassword resolves
 * on the client and waitForUserProfile starts polling.
 */
export const createUserProfile = beforeUserCreated(async (event) => {
    if (!event.data) return;
    const { uid, email, displayName, photoURL } = event.data;

    const now = Timestamp.now();
    const newUser: User = {
        uid,
        email: email ?? "",
        displayName: displayName ?? null,
        photoURL: photoURL ?? null,
        role: "client",
        isActive: true,
        tokenBalance: 0,
        totalTokensGranted: 0,
        totalTokensSpent: 0,
        createdAt: now,
        lastLoginAt: now,
        updatedAt: now,
        preferences: {
            language: "en",
            theme: "light",
            notificationsEnabled: true,
        },
    };

    try {
        await saveUser(uid, newUser);
        logInfo("User profile created", { uid });
    } catch (error) {
        logError(
            "Failed to create user profile",
            error instanceof Error ? error : undefined,
            { uid },
        );
        throw error;
    }
});
