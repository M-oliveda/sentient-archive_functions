/**
 * Token Service
 *
 * Handles token economy operations including:
 * - Balance queries
 * - Transaction history
 * - Token deductions for AI operations
 * - Token grants by admins
 */

import { Timestamp } from "firebase-admin/firestore";
import { getDb, getUserByUid } from "@/utils/firestore.js";
import { logInfo, logError, logEvent } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";
import {
    Transaction,
    TokenBalance,
    TokenRequest,
    OperationType,
    TransactionType,
} from "@/types/transaction.js";

/**
 * Pagination options for transaction history
 */
export interface HistoryOptions {
    /** Maximum number of transactions to return (default: 20) */
    limit?: number;
    /** Number of transactions to skip (default: 0) */
    offset?: number;
    /** Filter by transaction type */
    type?: TransactionType;
}

/**
 * Result of token deduction operation
 */
export interface DeductionResult {
    /** Whether the deduction was successful */
    success: boolean;
    /** The transaction record */
    transaction: Transaction;
    /** New balance after deduction */
    newBalance: number;
}

/**
 * Result of token grant operation
 */
export interface GrantResult {
    /** Whether the grant was successful */
    success: boolean;
    /** The transaction record */
    transaction: Transaction;
    /** New balance after grant */
    newBalance: number;
}

/**
 * Token Service class
 * Manages token economy operations
 */
export class TokenService {
    /**
     * Get user's token balance
     *
     * @param userId - The user ID
     * @returns Token balance information
     * @throws AppError if user not found
     */
    async getBalance(userId: string): Promise<TokenBalance> {
        const user = await getUserByUid(userId);

        if (!user) {
            throw new AppError("NOT_FOUND", 404, "User not found");
        }

        return {
            balance: user.tokenBalance,
            totalGranted: user.totalTokensGranted,
            totalSpent: user.totalTokensSpent,
        };
    }

    /**
     * Get transaction history for a user
     *
     * @param userId - The user ID
     * @param options - Pagination and filter options
     * @returns Array of transactions
     */
    async getHistory(
        userId: string,
        options: HistoryOptions = {},
    ): Promise<Transaction[]> {
        const { limit = 20, offset = 0, type } = options;

        const db = getDb();
        let query = db
            .collection("transactions")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc");

        if (type) {
            query = query.where("type", "==", type);
        }

        const snapshot = await query.offset(offset).limit(limit).get();

        const transactions: Transaction[] = [];
        snapshot.forEach((doc) => {
            transactions.push(doc.data() as Transaction);
        });

        return transactions;
    }

    /**
     * Check if user has enough tokens for an operation
     *
     * @param userId - The user ID
     * @param amount - The required token amount
     * @returns true if user has sufficient balance
     */
    async hasEnoughTokens(userId: string, amount: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        return balance.balance >= amount;
    }

    /**
     * Deduct tokens for an AI operation
     * Uses Firestore transaction for atomicity
     *
     * @param userId - The user ID
     * @param amount - The number of tokens to deduct
     * @param operation - The operation type (summarize, autoTag, etc.)
     * @param description - Optional description
     * @returns Deduction result
     * @throws AppError if insufficient tokens
     */
    async deductTokens(
        userId: string,
        amount: number,
        operation: OperationType,
        description?: string,
    ): Promise<DeductionResult> {
        const db = getDb();
        const userRef = db.collection("users").doc(userId);
        const transactionRef = db.collection("transactions").doc();

        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw new AppError("NOT_FOUND", 404, "User not found");
                }

                const userData = userDoc.data();
                const currentBalance = (userData?.["tokenBalance"] as number) ?? 0;
                const totalSpent = (userData?.["totalTokensSpent"] as number) ?? 0;

                if (currentBalance < amount) {
                    throw new AppError(
                        "INSUFFICIENT_TOKENS",
                        402,
                        `Insufficient tokens. Required: ${amount}, Available: ${currentBalance}`,
                    );
                }

                const newBalance = currentBalance - amount;
                const now = Timestamp.now();

                // Create transaction record
                const transactionData: Transaction = {
                    id: transactionRef.id,
                    userId,
                    type: "deduction",
                    amount,
                    operation,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: now,
                    description: description ?? `Token deduction for ${operation}`,
                };

                // Update user balance
                transaction.update(userRef, {
                    tokenBalance: newBalance,
                    totalTokensSpent: totalSpent + amount,
                    updatedAt: now,
                });

                // Save transaction record
                transaction.set(transactionRef, transactionData);

                return {
                    success: true,
                    transaction: transactionData,
                    newBalance,
                };
            });

            logEvent("tokens_deducted", {
                userId,
                amount,
                operation,
                newBalance: result.newBalance,
            });

            return result;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError(
                "Token deduction failed",
                error instanceof Error ? error : undefined,
                { userId, amount, operation },
            );
            throw new AppError("INTERNAL_ERROR", 500, "Failed to deduct tokens");
        }
    }

    /**
     * Grant tokens to a user (admin operation)
     * Uses Firestore transaction for atomicity
     *
     * @param userId - The user ID to grant tokens to
     * @param amount - The number of tokens to grant
     * @param grantedBy - The admin user ID
     * @param reason - The reason for the grant
     * @returns Grant result
     * @throws AppError if user not found
     */
    async grantTokens(
        userId: string,
        amount: number,
        grantedBy: string,
        reason: string,
    ): Promise<GrantResult> {
        const db = getDb();
        const userRef = db.collection("users").doc(userId);
        const transactionRef = db.collection("transactions").doc();

        try {
            const result = await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw new AppError("NOT_FOUND", 404, "User not found");
                }

                const userData = userDoc.data();
                const currentBalance = (userData?.["tokenBalance"] as number) ?? 0;
                const totalGranted = (userData?.["totalTokensGranted"] as number) ?? 0;

                const newBalance = currentBalance + amount;
                const now = Timestamp.now();

                // Create transaction record
                const transactionData: Transaction = {
                    id: transactionRef.id,
                    userId,
                    type: "grant",
                    amount,
                    operation: "admin_grant",
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: now,
                    description: reason,
                    grantedBy,
                };

                // Update user balance
                transaction.update(userRef, {
                    tokenBalance: newBalance,
                    totalTokensGranted: totalGranted + amount,
                    updatedAt: now,
                });

                // Save transaction record
                transaction.set(transactionRef, transactionData);

                return {
                    success: true,
                    transaction: transactionData,
                    newBalance,
                };
            });

            logInfo("Tokens granted", {
                userId,
                amount,
                grantedBy,
                reason,
                newBalance: result.newBalance,
            });

            logEvent("tokens_granted", {
                userId,
                amount,
                grantedBy,
                newBalance: result.newBalance,
            });

            return result;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError("Token grant failed", error instanceof Error ? error : undefined, {
                userId,
                amount,
                grantedBy,
            });
            throw new AppError("INTERNAL_ERROR", 500, "Failed to grant tokens");
        }
    }

    /**
     * Get token requests for a user
     *
     * @param userId - The user ID
     * @param limit - Maximum number of requests to return
     * @returns Array of token requests ordered newest-first
     */
    async getRequests(userId: string, limit = 20): Promise<TokenRequest[]> {
        const db = getDb();
        const snapshot = await db
            .collection("tokenRequests")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        const requests: TokenRequest[] = [];
        snapshot.forEach((doc) => {
            requests.push(doc.data() as TokenRequest);
        });

        return requests;
    }

    /**
     * Create a token request from a user
     *
     * @param userId - The requesting user's ID
     * @param amount - The number of tokens requested
     * @param justification - Optional reason for the request
     * @returns The created token request record
     */
    async requestTokens(
        userId: string,
        amount: number,
        justification?: string,
    ): Promise<TokenRequest> {
        const db = getDb();
        const requestRef = db.collection("tokenRequests").doc();
        const now = Timestamp.now();

        const requestData: TokenRequest = {
            id: requestRef.id,
            userId,
            amount,
            status: "pending",
            createdAt: now,
            ...(justification ? { justification } : {}),
        };

        await requestRef.set(requestData);

        logEvent("token_request_created", { userId, amount, requestId: requestRef.id });

        return requestData;
    }

    /**
     * Get token requests for admin review (with filtering)
     *
     * @param options - Filter options (status, userId, date range, pagination)
     * @returns Array of token requests with user info
     */
    async getAdminTokenRequests(
        options: {
            limit?: number;
            offset?: number;
            status?: "pending" | "approved" | "rejected" | "all";
            userId?: string;
            startDate?: string;
            endDate?: string;
        } = {},
    ): Promise<
        (TokenRequest & {
            userEmail?: string;
            userDisplayName?: string;
            userName?: string;
            userAvatarUrl?: string;
            currentBalance?: number;
            isUrgent?: boolean;
        })[]
    > {
        const db = getDb();
        const { limit = 20, offset = 0, status, userId, startDate, endDate } = options;
        const LOW_BALANCE_THRESHOLD = 20;

        let query = db.collection("tokenRequests").orderBy("createdAt", "desc");

        // Filter by status
        if (status && status !== "all") {
            query = query.where("status", "==", status);
        }

        // Filter by userId
        if (userId) {
            query = query.where("userId", "==", userId);
        }

        const snapshot = await query.offset(offset).limit(limit).get();

        const requests: (TokenRequest & {
            userEmail?: string;
            userDisplayName?: string;
            userName?: string;
            userAvatarUrl?: string;
            currentBalance?: number;
            isUrgent?: boolean;
        })[] = [];

        for (const doc of snapshot.docs) {
            const requestData = doc.data() as TokenRequest;
            const user = await getUserByUid(requestData.userId);
            const currentBalance = user ? (user.tokenBalance ?? 0) : undefined;

            requests.push({
                ...requestData,
                userEmail: user?.email,
                userDisplayName: user?.displayName ?? undefined,
                userName: user?.displayName ?? user?.email,
                userAvatarUrl: user?.photoURL ?? undefined,
                currentBalance,
                isUrgent:
                    requestData.status === "pending" &&
                    typeof currentBalance === "number" &&
                    currentBalance < LOW_BALANCE_THRESHOLD,
            });
        }

        // Filter by date range if provided
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            return requests.filter((req) => {
                const reqDate = req.createdAt.toDate();
                if (start && reqDate < start) return false;
                if (end && reqDate > end) return false;
                return true;
            });
        }

        return requests;
    }

    /**
     * Approve a token request
     *
     * @param requestId - The token request ID
     * @param approvedBy - The admin user ID
     * @param overrideAmount - Optional amount override
     * @param notes - Optional approval notes
     * @returns Updated token request
     * @throws AppError if request not found or already reviewed
     */
    async approveTokenRequest(
        requestId: string,
        approvedBy: string,
        overrideAmount?: number,
        notes?: string,
    ): Promise<TokenRequest> {
        const db = getDb();
        const requestRef = db.collection("tokenRequests").doc(requestId);
        const transactionRef = db.collection("transactions").doc();
        const now = Timestamp.now();

        try {
            // All reads must complete before any writes in a Firestore transaction
            const approved = await db.runTransaction(async (transaction) => {
                const requestSnap = await transaction.get(requestRef);

                if (!requestSnap.exists) {
                    throw new AppError("NOT_FOUND", 404, "Token request not found");
                }

                const requestData = requestSnap.data() as TokenRequest;

                if (requestData.status !== "pending") {
                    throw new AppError(
                        "INVALID_REQUEST",
                        400,
                        `Cannot approve request with status: ${requestData.status}`,
                    );
                }

                const grantAmount = overrideAmount ?? requestData.amount;
                const userRef = db.collection("users").doc(requestData.userId);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw new AppError("NOT_FOUND", 404, "User not found");
                }

                const userData = userDoc.data();
                const currentBalance = (userData?.["tokenBalance"] as number) ?? 0;
                const totalGranted = (userData?.["totalTokensGranted"] as number) ?? 0;
                const newBalance = currentBalance + grantAmount;

                const transactionData: Transaction = {
                    id: transactionRef.id,
                    userId: requestData.userId,
                    type: "grant",
                    amount: grantAmount,
                    operation: "admin_grant",
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    createdAt: now,
                    description: notes ?? `Approved token request #${requestId}`,
                    grantedBy: approvedBy,
                };

                transaction.update(requestRef, {
                    status: "approved",
                    reviewedAt: now,
                    reviewedBy: approvedBy,
                });

                transaction.update(userRef, {
                    tokenBalance: newBalance,
                    totalTokensGranted: totalGranted + grantAmount,
                    updatedAt: now,
                });

                transaction.set(transactionRef, transactionData);

                return {
                    request: requestData,
                    grantAmount,
                };
            });

            logEvent("token_request_approved", {
                requestId,
                userId: approved.request.userId,
                amount: approved.grantAmount,
                approvedBy,
            });

            return {
                ...approved.request,
                status: "approved",
                reviewedAt: now,
                reviewedBy: approvedBy,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError(
                "Failed to approve token request",
                error instanceof Error ? error : undefined,
                {
                    requestId,
                },
            );
            throw new AppError(
                "INTERNAL_ERROR",
                500,
                "Failed to approve token request",
            );
        }
    }

    /**
     * Reject a token request
     *
     * @param requestId - The token request ID
     * @param rejectedBy - The admin user ID
     * @param reason - Optional rejection reason
     * @returns Updated token request
     * @throws AppError if request not found or already reviewed
     */
    async rejectTokenRequest(
        requestId: string,
        rejectedBy: string,
        reason?: string,
    ): Promise<TokenRequest> {
        const db = getDb();
        const requestRef = db.collection("tokenRequests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new AppError("NOT_FOUND", 404, "Token request not found");
        }

        const request = requestDoc.data() as TokenRequest;

        if (request.status !== "pending") {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                `Cannot reject request with status: ${request.status}`,
            );
        }

        const now = Timestamp.now();

        try {
            await requestRef.update({
                status: "rejected",
                reviewedAt: now,
                reviewedBy: rejectedBy,
                reason: reason ?? "No reason provided",
            });

            logEvent("token_request_rejected", {
                requestId,
                userId: request.userId,
                rejectedBy,
            });

            // Return updated request
            return {
                ...request,
                status: "rejected",
                reviewedAt: now,
                reviewedBy: rejectedBy,
                reason: reason ?? "No reason provided",
            };
        } catch (error) {
            logError(
                "Failed to reject token request",
                error instanceof Error ? error : undefined,
                {
                    requestId,
                    userId: request.userId,
                },
            );
            throw new AppError("INTERNAL_ERROR", 500, "Failed to reject token request");
        }
    }

    /**
     * Get the token cost for an operation from system config
     *
     * @param operation - The operation type
     * @returns The token cost
     */
    async getOperationCost(
        operation: Exclude<OperationType, "admin_grant">,
    ): Promise<number> {
        const db = getDb();
        const configDoc = await db.collection("system_config").doc("settings").get();

        if (!configDoc.exists) {
            // Default costs tuned for learning/demo anti-abuse
            const defaultCosts: Record<
                Exclude<OperationType, "admin_grant">,
                number
            > = {
                summarize: 5,
                autoTag: 3,
                flashcards: 8,
                ragQuery: 10,
            };
            return defaultCosts[operation];
        }

        const config = configDoc.data();
        const tokensConfig = config?.["tokens"] as
            | { costs?: Record<string, number> }
            | undefined;
        const costs = tokensConfig?.costs;

        if (costs && typeof costs[operation] === "number") {
            return costs[operation];
        }

        // Default costs tuned for learning/demo anti-abuse
        const defaultCosts: Record<Exclude<OperationType, "admin_grant">, number> = {
            summarize: 5,
            autoTag: 3,
            flashcards: 8,
            ragQuery: 10,
        };
        return defaultCosts[operation];
    }
}

/**
 * Singleton instance of TokenService
 */
export const tokenService = new TokenService();
