/**
 * Notes Routes Tests
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
                collection: jest.fn(() => ({
                    doc: jest.fn(() => ({
                        id: "test-note-id",
                        set: jest.fn(),
                    })),
                })),
            })),
        })),
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
let notesRouter: typeof import("@/routes/notes.routes.js").default;

describe("Notes Routes", () => {
    beforeAll(async () => {
        const mod = await import("@/routes/notes.routes.js");
        notesRouter = mod.default;
    });

    describe("Router Configuration", () => {
        test("router should be defined", () => {
            expect(notesRouter).toBeDefined();
        });

        test("router should have routes", () => {
            expect(notesRouter.stack).toBeDefined();
            expect(notesRouter.stack.length).toBeGreaterThan(0);
        });

        test("router should have POST /extract route", () => {
            const extractRoute = (notesRouter.stack as RouterLayer[]).find(
                (layer) =>
                    layer.route?.path === "/extract" && layer.route?.methods?.["post"],
            );
            expect(extractRoute).toBeDefined();
        });

        test("POST /extract should have middleware stack", () => {
            const extractRoute = (notesRouter.stack as RouterLayer[]).find(
                (layer) => layer.route?.path === "/extract",
            );
            // Route should have middleware (auth, fileUpload, handler)
            expect(extractRoute?.route?.stack?.length).toBeGreaterThan(0);
        });
    });
});
