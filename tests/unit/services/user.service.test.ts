/**
 * User Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

const mockUpdate = jest.fn<() => Promise<void>>();
const mockAuthUpdateUser = jest.fn<() => Promise<void>>();
const mockGetUserByUid = jest.fn<(uid: string) => Promise<typeof mockUser | null>>();

const mockUser = {
    uid: "user-1",
    email: "jane@example.com",
    displayName: "Old Name",
    photoURL: null,
    role: "client" as const,
    isActive: true,
    tokenBalance: 10,
    totalTokensGranted: 10,
    totalTokensSpent: 0,
    createdAt: { toDate: () => new Date("2024-01-01T00:00:00.000Z") },
    lastLoginAt: { toDate: () => new Date("2024-01-10T00:00:00.000Z") },
    updatedAt: { toDate: () => new Date("2024-01-10T00:00:00.000Z") },
    preferences: {
        language: "en" as const,
        theme: "light" as const,
        notificationsEnabled: true,
    },
};

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
        updateUser: mockAuthUpdateUser,
    })),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                update: mockUpdate,
            })),
        })),
    })),
    Timestamp: {
        now: jest.fn(() => ({
            toDate: () => new Date("2024-06-01T12:00:00.000Z"),
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

jest.unstable_mockModule("@/utils/firestore.js", () => ({
    getDb: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                update: mockUpdate,
            })),
        })),
    })),
    getFirebaseAuth: jest.fn(() => ({
        updateUser: mockAuthUpdateUser,
    })),
    getUserByUid: mockGetUserByUid,
}));

let userService: typeof import("@/services/user.service.js").userService;

describe("UserService", () => {
    beforeAll(async () => {
        const mod = await import("@/services/user.service.js");
        userService = mod.userService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUserByUid.mockResolvedValue(mockUser);
        mockUpdate.mockResolvedValue(undefined);
        mockAuthUpdateUser.mockResolvedValue(undefined);
    });

    test("updateProfile updates Firestore and Auth", async () => {
        const result = await userService.updateProfile("user-1", "Jane Doe");

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ displayName: "Jane Doe" }),
        );
        expect(mockAuthUpdateUser).toHaveBeenCalledWith("user-1", {
            displayName: "Jane Doe",
        });
        expect(result.displayName).toBe("Jane Doe");
        expect(result.email).toBe("jane@example.com");
        expect(result.updatedAt).toBe("2024-06-01T12:00:00.000Z");
    });

    test("updateProfile throws when user is missing", async () => {
        mockGetUserByUid.mockResolvedValue(null);

        await expect(
            userService.updateProfile("missing", "Name"),
        ).rejects.toMatchObject({
            code: "NOT_FOUND",
            statusCode: 404,
        });
    });

    test("updateProfile serializes null timestamps as null", async () => {
        mockGetUserByUid.mockResolvedValue({
            ...mockUser,
            createdAt: null,
            lastLoginAt: null,
            updatedAt: null,
        });

        const result = await userService.updateProfile("user-1", "Jane Doe");

        expect(result.createdAt).toBeNull();
        expect(result.lastLoginAt).toBeNull();
        expect(result.updatedAt).toBe("2024-06-01T12:00:00.000Z");
    });

    test("updateProfile serializes timestamps without toDate as null", async () => {
        const { Timestamp } = await import("firebase-admin/firestore");
        (Timestamp.now as jest.Mock).mockReturnValueOnce({});

        mockGetUserByUid.mockResolvedValue({
            ...mockUser,
            createdAt: undefined,
            lastLoginAt: undefined,
            updatedAt: undefined,
        });

        const result = await userService.updateProfile("user-1", "Jane Doe");

        expect(result.createdAt).toBeNull();
        expect(result.lastLoginAt).toBeNull();
        expect(result.updatedAt).toBeNull();
    });
});
