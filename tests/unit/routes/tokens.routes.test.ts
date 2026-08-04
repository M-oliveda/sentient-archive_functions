/**
 * Token Routes Tests
 *
 * Note: Full integration testing of the routes requires the Firebase emulator.
 * These unit tests verify route configuration and basic structure.
 */

import { describe, test, expect, jest, beforeAll } from "@jest/globals";

// Type for Express router layer (internal structure)
interface RouterLayer {
    route?: {
        path: string;
        methods?: Record<string, boolean>;
        stack?: unknown[];
    };
}

// Mock Firebase modules before any imports
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApp: jest.fn(() => {
        throw new Error("No Firebase app initialized");
    }),
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: jest.fn(() => ({
        verifyIdToken: jest.fn(),
    })),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
            })),
            where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(),
                    })),
                })),
            })),
        })),
        runTransaction: jest.fn(),
    })),
    Timestamp: {
        now: jest.fn(() => ({
            toDate: () => new Date("2024-01-15T00:00:00.000Z"),
        })),
        fromDate: (date: Date) => ({ toDate: () => date }),
    },
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import router after mocking
let tokensRouter: typeof import("@/routes/tokens.routes.js").default;

describe("Token Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/tokens.routes.js");
        tokensRouter = mod.default;
    });

    describe("Router Configuration", () => {
        test("router should be defined", () => {
            expect(tokensRouter).toBeDefined();
        });

        test("router should have routes", () => {
            expect(tokensRouter.stack).toBeDefined();
            expect(tokensRouter.stack.length).toBeGreaterThan(0);
        });

        test("router should have GET /balance route", () => {
            const balanceRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/balance" && layer.route?.methods?.["get"],
            );
            expect(balanceRoute).toBeDefined();
        });

        test("router should have GET /history route", () => {
            const historyRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/history" && layer.route?.methods?.["get"],
            );
            expect(historyRoute).toBeDefined();
        });

        test("router should have POST /mint route", () => {
            const mintRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/mint" && layer.route?.methods?.["post"],
            );
            expect(mintRoute).toBeDefined();
        });

        test("GET /balance should have middleware stack", () => {
            const balanceRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/balance",
            );
            // Route should have middleware (auth, handler)
            expect(balanceRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("GET /history should have middleware stack", () => {
            const historyRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/history",
            );
            // Route should have middleware (auth, handler)
            expect(historyRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("POST /mint should have middleware stack with admin middleware", () => {
            const mintRoute = (tokensRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/mint",
            );
            // Route should have middleware (auth, admin, handler)
            expect(mintRoute?.route?.stack?.length).toBeGreaterThanOrEqual(3);
        });
    });
});
