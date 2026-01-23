/**
 * SentientArchive Cloud Functions
 *
 * Entry point for Firebase Cloud Functions Gen 2
 * Exports all HTTP functions for the SentientArchive backend API
 */

import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

// Set global options for all functions
setGlobalOptions({
    region: "us-central1",
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "256MiB",
});

/**
 * Main API endpoint
 *
 * Handles all HTTP requests to the SentientArchive API
 * Routes are defined in the routes directory
 */
export const api = onRequest(
    {
        cors: true,
        invoker: "public",
    },
    (_request, response) => {
        // TODO: Implement routing logic
        response.status(200).json({
            success: true,
            message: "SentientArchive API - Coming Soon",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
        });
    },
);
