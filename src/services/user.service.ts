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
     * Update the authenticated user's profile (displayName and/or language preference)
     */
    async updateProfile(
        uid: string,
        updates: { displayName?: string; language?: "en" | "es" | "fr" | "pt" },
    ): Promise<SerializedUser> {
        const db = getDb();
        const userRef = db.collection("users").doc(uid);
        const existing = await getUserByUid(uid);

        if (!existing) {
            throw new AppError("NOT_FOUND", 404, "User not found");
        }

        const updatedAt = Timestamp.now();

        // Build the update object dynamically
        const firestoreUpdate: Record<string, unknown> = {
            updatedAt,
        };

        if (updates.displayName !== undefined) {
            firestoreUpdate["displayName"] = updates.displayName;
        }

        if (updates.language !== undefined) {
            firestoreUpdate["preferences.language"] = updates.language;
        }

        await userRef.update(firestoreUpdate);

        // Only update Firebase Auth displayName if provided
        if (updates.displayName !== undefined) {
            const auth = getFirebaseAuth();
            await auth.updateUser(uid, { displayName: updates.displayName });
        }

        logInfo("User profile updated", { uid, updates });

        // Build the updated user object for serialization
        const updatedUser: User = {
            ...existing,
            updatedAt,
        };

        if (updates.displayName !== undefined) {
            updatedUser.displayName = updates.displayName;
        }

        if (updates.language !== undefined) {
            updatedUser.preferences = {
                ...existing.preferences,
                language: updates.language,
            };
        }

        return serializeUser(updatedUser);
    }
}

export const userService = new UserService();
