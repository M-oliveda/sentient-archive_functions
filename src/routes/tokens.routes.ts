/**
 * Token Routes
 *
 * Handles token economy API endpoints:
 * - GET /balance - Get user's token balance
 * - GET /history - Get transaction history
 * - POST /mint - Grant tokens (admin only)
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { adminMiddleware } from "@/middleware/admin.js";
import { asyncHandler, AppError } from "@/middleware/errorHandler.js";
import { tokenService } from "@/services/token.service.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import {
    TokenMintRequestSchema,
    TokenHistoryQuerySchema,
    validateRequest,
} from "@/utils/validation.js";
import { ApiResponse } from "@/types/api.js";
import { TokenBalance } from "@/types/transaction.js";

const router = Router();

/**
 * GET /balance
 *
 * Get current user's token balance
 *
 * Response: TokenBalance
 */
router.get(
    "/balance",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        logInfo("Token balance request", { userId });

        const balance = await tokenService.getBalance(userId);

        logEvent("token_balance_queried", {
            userId,
            balance: balance.balance,
        });

        const response: ApiResponse<TokenBalance> = {
            success: true,
            data: balance,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /history
 *
 * Get transaction history for current user
 *
 * Query params:
 * - limit: number (1-100, default: 20)
 * - offset: number (default: 0)
 * - type: 'grant' | 'deduction' (optional)
 *
 * Response: Transaction[]
 */
router.get(
    "/history",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        // Validate query parameters
        const query = validateRequest(TokenHistoryQuerySchema, req.query);

        logInfo("Token history request", {
            userId,
            limit: query.limit,
            offset: query.offset,
            type: query.type,
        });

        const transactions = await tokenService.getHistory(userId, {
            limit: query.limit,
            offset: query.offset,
            type: query.type,
        });

        logEvent("token_history_queried", {
            userId,
            count: transactions.length,
        });

        // Convert Firestore Timestamps to ISO strings for response
        const serializedTransactions = transactions.map((tx) => ({
            ...tx,
            createdAt: tx.createdAt.toDate().toISOString(),
        }));

        const response: ApiResponse<typeof serializedTransactions> = {
            success: true,
            data: serializedTransactions,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /mint
 *
 * Grant tokens to a user (admin only)
 *
 * Request body:
 * - userId: string (required)
 * - amount: number (1-10000, required)
 * - reason: string (3-200 chars, required)
 *
 * Response: Transaction record
 */
router.post(
    "/mint",
    authMiddleware,
    adminMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        // Validate request body
        const { userId, amount, reason } = validateRequest(
            TokenMintRequestSchema,
            req.body,
        );

        logInfo("Token mint request", {
            adminId,
            targetUserId: userId,
            amount,
            reason,
        });

        // Prevent self-minting (optional security measure)
        if (userId === adminId) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "Cannot grant tokens to yourself",
            );
        }

        const result = await tokenService.grantTokens(userId, amount, adminId, reason);

        logEvent("tokens_minted", {
            adminId,
            targetUserId: userId,
            amount,
            newBalance: result.newBalance,
        });

        // Serialize transaction for response
        const serializedTransaction = {
            ...result.transaction,
            createdAt: result.transaction.createdAt.toDate().toISOString(),
        };

        const response: ApiResponse<typeof serializedTransaction> = {
            success: true,
            data: serializedTransaction,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
