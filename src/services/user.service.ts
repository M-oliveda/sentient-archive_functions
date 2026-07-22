/**
 * User Service
 *
 * Client-facing user profile operations
 */

import { Timestamp } from "firebase-admin/firestore";
import { getDb, getFirebaseAuth, getUserByUid } from "@/utils/firestore.js";
import { AppError } from "@/middleware/errorHandler.js";
import { logInfo } from "@/utils/logger.js";
import { User } from "@/types/user.js";

export interface SerializedUser {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    role: User["role"];
    isActive: boolean;
    tokenBalance: number;
    totalTokensGranted: number;
    totalTokensSpent: number;
    createdAt: string | null;
    lastLoginAt: string | null;
    updatedAt: string | null;
    preferences: User["preferences"];
}

function serializeUser(user: User): SerializedUser {
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role,
        isActive: user.isActive,
        tokenBalance: user.tokenBalance,
        totalTokensGranted: user.totalTokensGranted,
        totalTokensSpent: user.totalTokensSpent,
        createdAt: user.createdAt?.toDate?.()?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: user.updatedAt?.toDate?.()?.toISOString() ?? null,
        preferences: user.preferences,
    };
}

export class UserService {
    /**
     * Update the authenticated user's display name in Firestore and Auth
     */
    async updateProfile(uid: string, displayName: string): Promise<SerializedUser> {
        const db = getDb();
        const userRef = db.collection("users").doc(uid);
        const existing = await getUserByUid(uid);

        if (!existing) {
            throw new AppError("NOT_FOUND", 404, "User not found");
        }

        const updatedAt = Timestamp.now();

        await userRef.update({
            displayName,
            updatedAt,
        });

        const auth = getFirebaseAuth();
        await auth.updateUser(uid, { displayName });

        logInfo("User profile updated", { uid, displayName });

        return serializeUser({
            ...existing,
            displayName,
            updatedAt,
        });
    }
}

export const userService = new UserService();
