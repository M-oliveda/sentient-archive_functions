/**
 * Config Routes Tests
 *
 * Verifies client-facing config route registration.
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
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
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

let configRouter: typeof import("@/routes/config.routes.js").default;

describe("Config Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/config.routes.js");
        configRouter = mod.default;
    });

    describe("Router Configuration", () => {
        test("router should be defined", () => {
            expect(configRouter).toBeDefined();
        });

        test("router should have GET / route", () => {
            const rootRoute = (configRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/" && layer.route?.methods?.["get"],
            );
            expect(rootRoute).toBeDefined();
        });
    });
});
