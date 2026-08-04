/**
 * Transaction Types
 *
 * Types for token transactions and history
 */

import { Timestamp } from "firebase-admin/firestore";

export type TransactionType = "grant" | "deduction";

export type OperationType =
    | "summarize"
    | "autoTag"
    | "flashcards"
    | "ragQuery"
    | "admin_grant";

export interface Transaction {
    id: string;
    userId: string;

    // Transaction details
    type: TransactionType;
    amount: number;
    operation: OperationType;

    // Balance tracking
    balanceBefore: number;
    balanceAfter: number;

    // Metadata
    createdAt: Timestamp;
    description: string;
    grantedBy?: string; // Admin UID for grants
}

export interface TokenBalance {
    balance: number;
    totalGranted: number;
    totalSpent: number;
}

export interface MintTokensInput {
    userId: string;
    amount: number;
    description?: string;
}

export type TokenRequestStatus = "pending" | "approved" | "rejected";

export interface TokenRequest {
    id: string;
    userId: string;
    amount: number;
    status: TokenRequestStatus;
    createdAt: Timestamp;
    reviewedAt?: Timestamp;
    reviewedBy?: string;
    /** User-provided reason for the token request */
    justification?: string;
    /** Admin-provided rejection reason */
    reason?: string;
}
