/**
 * Activity Routes Tests
 */

import { describe, test, expect, jest, beforeAll } from "@jest/globals";

interface RouterLayer {
    route?: {
        path: string;
        methods?: Record<string, boolean>;
        stack?: unknown[];
    };
}

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
                collection: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(),
                    })),
                })),
            })),
            where: jest.fn(() => ({
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(),
                    })),
                })),
            })),
        })),
    })),
    Timestamp: {
        now: jest.fn(() => ({
            toDate: () => new Date("2024-01-15T00:00:00.000Z"),
        })),
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

let activityRouter: typeof import("@/routes/activity.routes.js").default;

describe("Activity Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/activity.routes.js");
        activityRouter = mod.default;
    });

    test("router should be defined", () => {
        expect(activityRouter).toBeDefined();
    });

    test("router should have GET / route", () => {
        const feedRoute = (activityRouter.stack as RouterLayer[]).find(
            (layer) =>
                layer.route?.path === "/" && layer.route?.methods?.["get"],
        );
        expect(feedRoute).toBeDefined();
    });

    test("router should have GET /stats route", () => {
        const statsRoute = (activityRouter.stack as RouterLayer[]).find(
            (layer) =>
                layer.route?.path === "/stats" && layer.route?.methods?.["get"],
        );
        expect(statsRoute).toBeDefined();
    });
});
