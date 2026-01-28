/**
 * AI Routes Tests
 *
 * Tests for the AI-powered API endpoints
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import type { Router } from "express";

// Mock dependencies before importing the module
jest.unstable_mockModule("@/middleware/auth.js", () => ({
    authMiddleware: jest.fn((_req, _res, next) => next()),
}));

jest.unstable_mockModule("@/middleware/errorHandler.js", () => ({
    asyncHandler:
        (fn: Function) =>
        (req: unknown, res: unknown, next: unknown) =>
            Promise.resolve(fn(req, res, next)).catch(next),
    AppError: class AppError extends Error {
        constructor(
            public code: string,
            public statusCode: number,
            message: string,
        ) {
            super(message);
            this.name = "AppError";
        }
    },
}));

jest.unstable_mockModule("@/services/ai.service.js", () => ({
    aiService: {
        isFeatureEnabled: jest.fn(),
        summarize: jest.fn(),
        autoTag: jest.fn(),
        generateFlashcards: jest.fn(),
        ragQuery: jest.fn(),
    },
}));

jest.unstable_mockModule("@/services/token.service.js", () => ({
    tokenService: {
        getOperationCost: jest.fn(),
        hasEnoughTokens: jest.fn(),
        getBalance: jest.fn(),
        deductTokens: jest.fn(),
    },
}));

jest.unstable_mockModule("@/utils/firestore.js", () => ({
    getDb: jest.fn(),
}));

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logInfo: jest.fn(),
    logEvent: jest.fn(),
}));

jest.unstable_mockModule("@/utils/validation.js", () => ({
    validateRequest: jest.fn((schema, data) => data),
    SummarizeRequestSchema: {},
    AutoTagRequestSchema: {},
    FlashcardsRequestSchema: {},
    RagQueryRequestSchema: {},
}));

describe("AI Routes", () => {
    describe("Router Configuration", () => {
        let router: Router;

        beforeEach(async () => {
            jest.clearAllMocks();
            const module = await import("@/routes/ai.routes.js");
            router = module.default;
        });

        test("router should be defined", () => {
            expect(router).toBeDefined();
        });

        test("router should have routes", () => {
            const stack = router.stack;
            expect(stack.length).toBeGreaterThan(0);
        });

        test("router should have POST /summarize route", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/summarize",
            );
            expect(route).toBeDefined();
            expect(route?.route?.methods.post).toBe(true);
        });

        test("router should have POST /autoTag route", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/autoTag",
            );
            expect(route).toBeDefined();
            expect(route?.route?.methods.post).toBe(true);
        });

        test("router should have POST /flashcards route", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/flashcards",
            );
            expect(route).toBeDefined();
            expect(route?.route?.methods.post).toBe(true);
        });

        test("router should have POST /ragQuery route", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/ragQuery",
            );
            expect(route).toBeDefined();
            expect(route?.route?.methods.post).toBe(true);
        });

        test("POST /summarize should have middleware stack", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/summarize",
            );
            // Should have authMiddleware and asyncHandler wrapped handler
            expect(route?.route?.stack.length).toBeGreaterThanOrEqual(2);
        });

        test("POST /autoTag should have middleware stack", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/autoTag",
            );
            expect(route?.route?.stack.length).toBeGreaterThanOrEqual(2);
        });

        test("POST /flashcards should have middleware stack", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/flashcards",
            );
            expect(route?.route?.stack.length).toBeGreaterThanOrEqual(2);
        });

        test("POST /ragQuery should have middleware stack", () => {
            const route = router.stack.find(
                (layer) => layer.route?.path === "/ragQuery",
            );
            expect(route?.route?.stack.length).toBeGreaterThanOrEqual(2);
        });
    });
});
