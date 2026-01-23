/**
 * User Types
 *
 * Types for user accounts and profiles
 */

import { Timestamp } from "firebase-admin/firestore";

export type UserRole = "client" | "admin";

export interface User {
    // Identity
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;

    // Role & Access
    role: UserRole;
    isActive: boolean;

    // Token Economy
    tokenBalance: number;
    totalTokensGranted: number;
    totalTokensSpent: number;

    // Metadata
    createdAt: Timestamp;
    lastLoginAt: Timestamp;
    updatedAt: Timestamp;

    // Preferences
    preferences: UserPreferences;
}

export interface UserPreferences {
    language: "en" | "es";
    theme: "light" | "dark";
    notificationsEnabled: boolean;
}

export interface AuthenticatedRequest {
    user: User;
    uid: string;
}
