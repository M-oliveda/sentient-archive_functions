/**
 * User Routes Tests
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
        updateUser: jest.fn(),
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

let usersRouter: typeof import("@/routes/users.routes.js").default;

describe("User Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/users.routes.js");
        usersRouter = mod.default;
    });

    test("router should be defined", () => {
        expect(usersRouter).toBeDefined();
    });

    test("router should have PUT /me route", () => {
        const meRoute = (usersRouter.stack as RouterLayer[]).find(
            (layer) =>
                layer.route?.path === "/me" && layer.route?.methods?.["put"],
        );
        expect(meRoute).toBeDefined();
        expect(meRoute?.route?.stack?.length).toBeGreaterThan(0);
    });
});
