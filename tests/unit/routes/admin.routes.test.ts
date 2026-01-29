/**
 * Admin Routes Tests
 *
 * Unit tests for admin route configuration and basic structure.
 */

import { describe, test, expect, jest, beforeAll } from "@jest/globals";

// Type for Express router layer (internal structure)
interface RouterLayer {
    route?: {
        path: string;
        methods?: Record<string, boolean>;
        stack?: unknown[];
    };
    name?: string;
}

// Mock Firebase modules before any imports
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApps: jest.fn(() => []),
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
                get: jest.fn(),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(),
                    })),
                })),
            })),
            get: jest.fn(),
        })),
        collectionGroup: jest.fn(() => ({
            count: jest.fn(() => ({
                get: jest.fn(),
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
let adminRouter: typeof import("@/routes/admin.routes.js").default;

describe("Admin Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/admin.routes.js");
        adminRouter = mod.default;
    });

    describe("Router Configuration", () => {
        test("router should be defined", () => {
            expect(adminRouter).toBeDefined();
        });

        test("router should have routes", () => {
            expect(adminRouter.stack).toBeDefined();
            expect(adminRouter.stack.length).toBeGreaterThan(0);
        });

        test("router should apply auth middleware to all routes", () => {
            // First two layers should be auth and admin middleware
            const stack = adminRouter.stack as RouterLayer[];

            // Check for middleware layers (they don't have route property)
            const middlewareLayers = stack.filter(
                (layer) => !layer.route && layer.name,
            );

            // Should have at least authMiddleware and adminMiddleware
            expect(middlewareLayers.length).toBeGreaterThanOrEqual(2);
        });

        test("router should have GET /analytics route", () => {
            const analyticsRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/analytics" && layer.route?.methods?.["get"],
            );
            expect(analyticsRoute).toBeDefined();
        });

        test("router should have GET /users route", () => {
            const usersRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/users" && layer.route?.methods?.["get"],
            );
            expect(usersRoute).toBeDefined();
        });

        test("router should have PUT /users/:id route", () => {
            const userUpdateRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/users/:id" && layer.route?.methods?.["put"],
            );
            expect(userUpdateRoute).toBeDefined();
        });

        test("router should have GET /config route", () => {
            const configGetRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/config" && layer.route?.methods?.["get"],
            );
            expect(configGetRoute).toBeDefined();
        });

        test("router should have POST /config route", () => {
            const configPostRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/config" && layer.route?.methods?.["post"],
            );
            expect(configPostRoute).toBeDefined();
        });

        test("GET /analytics should have handler in stack", () => {
            const analyticsRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/analytics",
            );
            expect(analyticsRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("GET /users should have handler in stack", () => {
            const usersRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/users",
            );
            expect(usersRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("PUT /users/:id should have handler in stack", () => {
            const userUpdateRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/users/:id",
            );
            expect(userUpdateRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("GET /config should have handler in stack", () => {
            const configGetRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/config" && layer.route?.methods?.["get"],
            );
            expect(configGetRoute?.route?.stack?.length).toBeGreaterThan(0);
        });

        test("POST /config should have handler in stack", () => {
            const configPostRoute = (adminRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/config" && layer.route?.methods?.["post"],
            );
            expect(configPostRoute?.route?.stack?.length).toBeGreaterThan(0);
        });
    });

    describe("Route count", () => {
        test("should have exactly 5 route endpoints", () => {
            const routeLayers = (adminRouter.stack as RouterLayer[]).filter(
                (layer) => layer.route,
            );

            // Count unique paths with methods
            const routes = new Set(
                routeLayers.map(
                    (layer) =>
                        `${Object.keys(layer.route?.methods ?? {})[0]}:${layer.route?.path}`,
                ),
            );

            expect(routes.size).toBe(5);
        });
    });
});
