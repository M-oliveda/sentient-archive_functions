/**
 * Firestore Utilities
 *
 * Helpers for Firestore operations
 * Provides database connection and common queries
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { User } from "@/types/user.js";
import { logError } from "./logger.js";

/**
 * Initialize Firebase Admin SDK
 * Only initializes once (singleton pattern)
 */
function initializeFirebase(): void {
    if (getApps().length === 0) {
        initializeApp();
    }
}

/**
 * Get Firestore instance
 */
export function getDb(): Firestore {
    initializeFirebase();
    return getFirestore();
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
    initializeFirebase();
    return getAuth();
}

/**
 * Get user by UID from Firestore
 *
 * @param uid - User ID
 * @returns User document or null if not found
 */
export async function getUserByUid(uid: string): Promise<User | null> {
    try {
        const db = getDb();
        const userDoc = await db.collection("users").doc(uid).get();

        if (!userDoc.exists) {
            return null;
        }

        return userDoc.data() as User;
    } catch (error) {
        logError(
            "Failed to fetch user from Firestore",
            error instanceof Error ? error : undefined,
            { uid },
        );
        throw error;
    }
}

/**
 * Create or update user in Firestore
 *
 * @param uid - User ID
 * @param userData - User data to save
 */
export async function saveUser(uid: string, userData: Partial<User>): Promise<void> {
    try {
        const db = getDb();
        await db.collection("users").doc(uid).set(userData, { merge: true });
    } catch (error) {
        logError(
            "Failed to save user to Firestore",
            error instanceof Error ? error : undefined,
            { uid },
        );
        throw error;
    }
}

/**
 * Update user's last login timestamp
 *
 * @param uid - User ID
 */
export async function updateLastLogin(uid: string): Promise<void> {
    try {
        const db = getDb();
        await db.collection("users").doc(uid).update({
            lastLoginAt: new Date(),
        });
    } catch (error) {
        logError(
            "Failed to update last login",
            error instanceof Error ? error : undefined,
            { uid },
        );
        // Don't throw - this is a non-critical operation
    }
}

/**
 * Check if user is admin
 *
 * @param uid - User ID
 * @returns true if user is admin, false otherwise
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
    try {
        const user = await getUserByUid(uid);
        return user?.role === "admin" && user?.isActive === true;
    } catch (error) {
        logError(
            "Failed to check admin status",
            error instanceof Error ? error : undefined,
            { uid },
        );
        return false;
    }
}

/**
 * Get system configuration from Firestore
 *
 * @returns System configuration or null if not found
 */
export async function getSystemConfig(): Promise<Record<string, unknown> | null> {
    try {
        const db = getDb();
        const configDoc = await db.collection("system_config").doc("settings").get();

        if (!configDoc.exists) {
            return null;
        }

        return configDoc.data() as Record<string, unknown>;
    } catch (error) {
        logError(
            "Failed to fetch system config",
            error instanceof Error ? error : undefined,
        );
        return null;
    }
}

/**
 * Increment rate limit counter for a user
 *
 * @param uid - User ID
 * @param limitType - Type of rate limit (e.g., 'aiRequests', 'fileExtractions')
 * @param windowStart - Start of the current time window
 * @returns Current count for the window
 */
export async function incrementRateLimit(
    uid: string,
    limitType: string,
    windowStart: Date,
): Promise<number> {
    const db = getDb();
    const rateLimitRef = db
        .collection("rate_limits")
        .doc(`${uid}_${limitType}_${windowStart.getTime()}`);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);

            const docData = doc.data();
            const currentCount =
                doc.exists && docData ? ((docData["count"] as number) ?? 0) : 0;
            const newCount = currentCount + 1;

            if (doc.exists) {
                transaction.update(rateLimitRef, {
                    count: newCount,
                    lastUpdated: new Date(),
                });
            } else {
                transaction.set(rateLimitRef, {
                    uid,
                    limitType,
                    windowStart,
                    count: newCount,
                    lastUpdated: new Date(),
                    expiresAt: new Date(windowStart.getTime() + 24 * 60 * 60 * 1000), // 24 hours
                });
            }

            return newCount;
        });

        return result;
    } catch (error) {
        logError(
            "Failed to increment rate limit",
            error instanceof Error ? error : undefined,
            {
                uid,
                limitType,
            },
        );
        throw error;
    }
}

/**
 * Get current rate limit count for a user
 *
 * @param uid - User ID
 * @param limitType - Type of rate limit
 * @param windowStart - Start of the current time window
 * @returns Current count for the window
 */
export async function getRateLimitCount(
    uid: string,
    limitType: string,
    windowStart: Date,
): Promise<number> {
    try {
        const db = getDb();
        const rateLimitDoc = await db
            .collection("rate_limits")
            .doc(`${uid}_${limitType}_${windowStart.getTime()}`)
            .get();

        if (!rateLimitDoc.exists) {
            return 0;
        }

        const docData = rateLimitDoc.data();
        return docData ? ((docData["count"] as number) ?? 0) : 0;
    } catch (error) {
        logError(
            "Failed to get rate limit count",
            error instanceof Error ? error : undefined,
            {
                uid,
                limitType,
            },
        );
        return 0;
    }
}

/**
 * Options for listing users
 */
export interface ListUsersOptions {
    limit?: number;
    offset?: number;
    role?: "client" | "admin";
    isActive?: boolean;
    search?: string;
    sortBy?: "createdAt" | "lastLoginAt" | "tokenBalance";
    sortOrder?: "asc" | "desc";
}

/**
 * Result of listing users
 */
export interface ListUsersResult {
    users: User[];
    total: number;
}

/**
 * List users with filtering, search, and pagination
 *
 * @param options - List options
 * @returns Users and total count
 */
export async function listUsers(
    options: ListUsersOptions = {},
): Promise<ListUsersResult> {
    const {
        limit = 20,
        offset = 0,
        role,
        isActive,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = options;

    try {
        const db = getDb();
        let query: FirebaseFirestore.Query = db.collection("users");

        // Apply role filter
        if (role !== undefined) {
            query = query.where("role", "==", role);
        }

        // Apply isActive filter
        if (isActive !== undefined) {
            query = query.where("isActive", "==", isActive);
        }

        // Apply sorting
        query = query.orderBy(sortBy, sortOrder);

        // Get all matching documents for total count and search filtering
        const snapshot = await query.get();

        let users: User[] = [];
        snapshot.forEach((doc) => {
            users.push(doc.data() as User);
        });

        // Apply search filter (case-insensitive on email and displayName)
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter((user) => {
                const emailMatch = user.email?.toLowerCase().includes(searchLower);
                const nameMatch = user.displayName?.toLowerCase().includes(searchLower);
                return emailMatch || nameMatch;
            });
        }

        const total = users.length;

        // Apply pagination
        users = users.slice(offset, offset + limit);

        return { users, total };
    } catch (error) {
        logError("Failed to list users", error instanceof Error ? error : undefined, {
            limit: options.limit,
            offset: options.offset,
            role: options.role,
            search: options.search,
        });
        throw error;
    }
}

/**
 * Update options for admin user update
 */
export interface AdminUserUpdateOptions {
    role?: "client" | "admin";
    isActive?: boolean;
    tokenBalance?: number;
}

/**
 * Update a user as admin
 * Uses Firestore transaction for atomicity
 *
 * @param uid - User ID to update
 * @param updates - Fields to update
 * @returns Updated user data
 */
export async function updateUserAsAdmin(
    uid: string,
    updates: AdminUserUpdateOptions,
): Promise<User> {
    const db = getDb();
    const userRef = db.collection("users").doc(uid);

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User not found");
            }

            const currentUser = userDoc.data() as User;

            // Build update object
            const updateData: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (updates.role !== undefined) {
                updateData["role"] = updates.role;
            }

            if (updates.isActive !== undefined) {
                updateData["isActive"] = updates.isActive;
            }

            if (updates.tokenBalance !== undefined) {
                // Calculate the difference for totalTokensGranted adjustment
                const currentBalance = currentUser.tokenBalance ?? 0;
                const difference = updates.tokenBalance - currentBalance;

                updateData["tokenBalance"] = updates.tokenBalance;

                // If increasing balance, track it as granted
                if (difference > 0) {
                    updateData["totalTokensGranted"] =
                        (currentUser.totalTokensGranted ?? 0) + difference;
                }
            }

            transaction.update(userRef, updateData);

            return {
                ...currentUser,
                ...updateData,
            } as User;
        });

        return result;
    } catch (error) {
        logError(
            "Failed to update user as admin",
            error instanceof Error ? error : undefined,
            { uid, updates },
        );
        throw error;
    }
}
