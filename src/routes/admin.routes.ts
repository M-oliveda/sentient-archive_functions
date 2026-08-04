/**
 * Admin Routes
 *
 * Handles admin API endpoints:
 * - GET /analytics - Get system-wide analytics
 * - GET /users - List users with filtering and pagination
 * - PUT /users/:id - Update user (role, isActive, tokenBalance)
 * - GET /config - Get system configuration
 * - POST /config - Update system configuration
 * - GET /token-requests - List token requests for admin review
 * - POST /token-requests/:id/approve - Approve a token request
 * - POST /token-requests/:id/reject - Reject a token request
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { adminMiddleware } from "@/middleware/admin.js";
import { asyncHandler, AppError } from "@/middleware/errorHandler.js";
import { analyticsService } from "@/services/analytics.service.js";
import { configService } from "@/services/config.service.js";
import { statsService, AdminStats } from "@/services/stats.service.js";
import { tokenService } from "@/services/token.service.js";
import { activityService } from "@/services/activity.service.js";
import { listUsers, updateUserAsAdmin, getUserByUid } from "@/utils/firestore.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import {
    AdminUsersQuerySchema,
    AdminUserUpdateSchema,
    SystemConfigUpdateSchema,
    AdminTokenRequestsQuerySchema,
    AdminApproveTokenRequestSchema,
    AdminRejectTokenRequestSchema,
    validateRequest,
} from "@/utils/validation.js";
import { ApiResponse } from "@/types/api.js";
import { SystemAnalytics } from "@/services/analytics.service.js";
import { SystemConfig } from "@/services/config.service.js";

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /stats
 *
 * Get admin dashboard stats: summary counts, system health, and recent activity.
 *
 * Response: AdminStats
 */
router.get(
    "/stats",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        logInfo("Admin stats request", { adminId });

        const stats = await statsService.getAdminStats();

        logEvent("admin_stats_queried", { adminId });

        const response: ApiResponse<AdminStats> = {
            success: true,
            data: stats,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /analytics
 *
 * Get system-wide analytics
 *
 * Response: SystemAnalytics
 */
router.get(
    "/analytics",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        logInfo("Admin analytics request", { adminId });

        const analytics = await analyticsService.getAnalytics();

        logEvent("admin_analytics_queried", { adminId });

        const response: ApiResponse<SystemAnalytics> = {
            success: true,
            data: analytics,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /analytics/trends
 *
 * Get system-wide analytics with time-series trends
 *
 * Query params:
 * - dateRange: '7d' | '30d' | '90d' (default: '30d')
 *
 * Response: SystemAnalyticsWithTrends
 */
router.get(
    "/analytics/trends",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;
        const dateRange = (req.query["dateRange"] as "7d" | "30d" | "90d") || "30d";

        // Validate dateRange
        if (!["7d", "30d", "90d"].includes(dateRange)) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "Invalid dateRange. Must be '7d', '30d', or '90d'",
            );
        }

        logInfo("Admin analytics trends request", { adminId, dateRange });

        const analytics = await analyticsService.getAnalyticsWithTrends(dateRange);

        logEvent("admin_analytics_trends_queried", { adminId, dateRange });

        const response: ApiResponse<typeof analytics> = {
            success: true,
            data: analytics,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /users
 *
 * List users with filtering, search, and pagination
 *
 * Query params:
 * - limit: number (1-100, default: 20)
 * - offset: number (default: 0)
 * - role: 'client' | 'admin' (optional)
 * - isActive: boolean (optional)
 * - search: string (optional, searches email and displayName)
 * - sortBy: 'createdAt' | 'lastLoginAt' | 'tokenBalance' (default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 *
 * Response: { users: User[], total: number, limit: number, offset: number }
 */
router.get(
    "/users",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        // Validate query parameters
        const query = validateRequest(AdminUsersQuerySchema, req.query);

        logInfo("Admin users list request", {
            adminId,
            ...query,
        });

        const isActiveFilter =
            typeof query.isActive === "boolean" ? query.isActive : undefined;

        const { users, total } = await listUsers({
            limit: query.limit,
            offset: query.offset,
            role: query.role,
            isActive: isActiveFilter,
            search: query.search,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        logEvent("admin_users_listed", {
            adminId,
            count: users.length,
            total,
        });

        // Serialize users for response (convert Timestamps)
        const serializedUsers = users.map((user) => ({
            ...user,
            createdAt: user.createdAt?.toDate?.()?.toISOString() ?? null,
            lastLoginAt: user.lastLoginAt?.toDate?.()?.toISOString() ?? null,
            updatedAt: user.updatedAt?.toDate?.()?.toISOString() ?? null,
        }));

        const response: ApiResponse<{
            users: typeof serializedUsers;
            total: number;
            limit: number;
            offset: number;
        }> = {
            success: true,
            data: {
                users: serializedUsers,
                total,
                limit: query.limit ?? 20,
                offset: query.offset ?? 0,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * PUT /users/:id
 *
 * Update a user (admin operation)
 *
 * Request body:
 * - role: 'client' | 'admin' (optional)
 * - isActive: boolean (optional)
 * - tokenBalance: number (optional)
 *
 * Response: Updated user
 */
router.put(
    "/users/:id",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;
        const targetUserIdParam = req.params["id"];
        const targetUserId = Array.isArray(targetUserIdParam)
            ? targetUserIdParam[0]
            : targetUserIdParam;

        if (!targetUserId) {
            throw new AppError("INVALID_REQUEST", 400, "User ID is required");
        }

        // Prevent self-modification
        if (targetUserId === adminId) {
            throw new AppError(
                "SELF_MODIFICATION_NOT_ALLOWED",
                403,
                "Cannot modify your own account",
            );
        }

        // Validate request body
        const updates = validateRequest(AdminUserUpdateSchema, req.body);

        // Check if at least one field is being updated
        if (
            updates.role === undefined &&
            updates.isActive === undefined &&
            updates.tokenBalance === undefined
        ) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "At least one field must be provided for update",
            );
        }

        logInfo("Admin user update request", {
            adminId,
            targetUserId,
            updates,
        });

        // Verify target user exists
        const existingUser = await getUserByUid(targetUserId);
        if (!existingUser) {
            throw new AppError("NOT_FOUND", 404, "User not found");
        }

        const updatedUser = await updateUserAsAdmin(targetUserId, updates);

        logEvent("admin_user_updated", {
            adminId,
            targetUserId,
            changes: updates,
        });

        // Serialize for response
        const serializedUser = {
            ...updatedUser,
            createdAt: updatedUser.createdAt?.toDate?.()?.toISOString() ?? null,
            lastLoginAt: updatedUser.lastLoginAt?.toDate?.()?.toISOString() ?? null,
            updatedAt: updatedUser.updatedAt?.toDate?.()?.toISOString() ?? null,
        };

        const response: ApiResponse<typeof serializedUser> = {
            success: true,
            data: serializedUser,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /config
 *
 * Get system configuration
 *
 * Response: SystemConfig
 */
router.get(
    "/config",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        logInfo("Admin config get request", { adminId });

        const config = await configService.getConfig();

        logEvent("admin_config_queried", { adminId });

        // Serialize config for response
        const serializedConfig = {
            ...config,
            createdAt: config.createdAt?.toDate?.()?.toISOString() ?? null,
            lastUpdatedAt: config.lastUpdatedAt?.toDate?.()?.toISOString() ?? null,
        };

        const response: ApiResponse<typeof serializedConfig> = {
            success: true,
            data: serializedConfig,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /config
 *
 * Update system configuration (partial, deep merge)
 *
 * Request body: Partial<SystemConfig>
 *
 * Response: Updated SystemConfig
 */
router.post(
    "/config",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        // Validate request body
        const updates = validateRequest(SystemConfigUpdateSchema, req.body);

        // Check if at least one field is being updated
        if (Object.keys(updates).length === 0) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "At least one configuration field must be provided",
            );
        }

        logInfo("Admin config update request", {
            adminId,
            updates: Object.keys(updates),
        });

        const updatedConfig = await configService.updateConfig(
            updates as Partial<SystemConfig>,
            adminId,
        );

        logEvent("admin_config_updated", {
            adminId,
            newVersion: updatedConfig.version,
        });

        // Serialize config for response
        const serializedConfig = {
            ...updatedConfig,
            createdAt: updatedConfig.createdAt?.toDate?.()?.toISOString() ?? null,
            lastUpdatedAt:
                updatedConfig.lastUpdatedAt?.toDate?.()?.toISOString() ?? null,
        };

        const response: ApiResponse<typeof serializedConfig> = {
            success: true,
            data: serializedConfig,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /token-requests
 *
 * List token requests for admin review with filtering
 *
 * Query params:
 * - limit: number (1-100, default: 20)
 * - offset: number (default: 0)
 * - status: 'pending' | 'approved' | 'rejected' | 'all' (default: 'all')
 * - userId: string (optional, filter by user)
 * - startDate: string (YYYY-MM-DD format, optional)
 * - endDate: string (YYYY-MM-DD format, optional)
 *
 * Response: { requests: TokenRequest[], total: number, limit: number, offset: number }
 */
router.get(
    "/token-requests",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        // Validate query parameters
        const query = validateRequest(AdminTokenRequestsQuerySchema, req.query);

        logInfo("Admin token requests list", {
            adminId,
            status: query.status,
            userId: query.userId,
        });

        const requests = await tokenService.getAdminTokenRequests({
            limit: query.limit,
            offset: query.offset,
            status: query.status === "all" ? undefined : query.status,
            userId: query.userId,
            startDate: query.startDate,
            endDate: query.endDate,
        });

        logEvent("admin_token_requests_listed", {
            adminId,
            count: requests.length,
        });

        // Serialize requests for response
        const serializedRequests = requests.map((req) => ({
            ...req,
            createdAt: req.createdAt?.toDate?.()?.toISOString() ?? null,
            reviewedAt: req.reviewedAt?.toDate?.()?.toISOString() ?? null,
        }));

        const response: ApiResponse<{
            requests: typeof serializedRequests;
            total: number;
            limit: number;
            offset: number;
        }> = {
            success: true,
            data: {
                requests: serializedRequests,
                total: serializedRequests.length, // Note: this is approximate; a full count query would be needed for exact total
                limit: query.limit ?? 20,
                offset: query.offset ?? 0,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /token-requests/:id/approve
 *
 * Approve a token request and grant tokens to the user
 *
 * Request body:
 * - amount: number (optional, overrides requested amount)
 * - notes: string (optional, approval notes)
 *
 * Response: Approved TokenRequest
 */
router.post(
    "/token-requests/:id/approve",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;
        const requestIdParam = req.params["id"];
        const requestId = Array.isArray(requestIdParam)
            ? requestIdParam[0]
            : requestIdParam;

        if (!requestId) {
            throw new AppError("INVALID_REQUEST", 400, "Request ID is required");
        }

        // Validate request body
        const { amount, notes } = validateRequest(
            AdminApproveTokenRequestSchema,
            req.body,
        );

        logInfo("Admin token request approval", {
            adminId,
            requestId,
            amount,
        });

        const approvedRequest = await tokenService.approveTokenRequest(
            requestId,
            adminId,
            amount,
            notes,
        );

        logEvent("admin_token_request_approved", {
            adminId,
            requestId,
            userId: approvedRequest.userId,
        });

        // Serialize for response
        const serialized = {
            ...approvedRequest,
            createdAt: approvedRequest.createdAt?.toDate?.()?.toISOString() ?? null,
            reviewedAt: approvedRequest.reviewedAt?.toDate?.()?.toISOString() ?? null,
        };

        const response: ApiResponse<typeof serialized> = {
            success: true,
            data: serialized,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * POST /token-requests/:id/reject
 *
 * Reject a token request
 *
 * Request body:
 * - reason: string (optional, rejection reason)
 *
 * Response: Rejected TokenRequest
 */
router.post(
    "/token-requests/:id/reject",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;
        const requestIdParam = req.params["id"];
        const requestId = Array.isArray(requestIdParam)
            ? requestIdParam[0]
            : requestIdParam;

        if (!requestId) {
            throw new AppError("INVALID_REQUEST", 400, "Request ID is required");
        }

        // Validate request body
        const { reason } = validateRequest(AdminRejectTokenRequestSchema, req.body);

        logInfo("Admin token request rejection", {
            adminId,
            requestId,
            reason,
        });

        const rejectedRequest = await tokenService.rejectTokenRequest(
            requestId,
            adminId,
            reason,
        );

        logEvent("admin_token_request_rejected", {
            adminId,
            requestId,
            userId: rejectedRequest.userId,
        });

        // Serialize for response
        const serialized = {
            ...rejectedRequest,
            createdAt: rejectedRequest.createdAt?.toDate?.()?.toISOString() ?? null,
            reviewedAt: rejectedRequest.reviewedAt?.toDate?.()?.toISOString() ?? null,
        };

        const response: ApiResponse<typeof serialized> = {
            success: true,
            data: serialized,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /activity-logs
 *
 * Get system-wide activity logs (admin only)
 *
 * Query params:
 * - limit: number (1-100, default 50)
 * - offset: number (default 0)
 * - category: 'all' | 'ai' | 'tokens' | 'notes' | 'folders' (default 'all')
 * - userId: string (optional, filter by user)
 * - q: string (optional, search query)
 * - startDate: string (optional, ISO date)
 * - endDate: string (optional, ISO date)
 *
 * Response: { entries: AdminActivityEntry[], total: number, limit: number, offset: number }
 */
router.get(
    "/activity-logs",
    asyncHandler(async (req: Request, res: Response) => {
        const adminId = req.uid!;

        // Parse and validate query parameters
        const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 100);
        const offset = parseInt(req.query["offset"] as string) || 0;
        const category = (req.query["category"] as string) || "all";
        const userId = req.query["userId"] as string | undefined;
        const q = (req.query["q"] as string) || "";
        const startDate = req.query["startDate"] as string | undefined;
        const endDate = req.query["endDate"] as string | undefined;

        // Validate category
        if (!["all", "ai", "tokens", "notes", "folders"].includes(category)) {
            throw new AppError(
                "INVALID_REQUEST",
                400,
                "Invalid category. Must be 'all', 'ai', 'tokens', 'notes', or 'folders'",
            );
        }

        logInfo("Admin activity logs request", {
            adminId,
            category,
            userId,
            q,
            startDate,
            endDate,
            limit,
            offset,
        });

        const { entries, total } = await activityService.getSystemWideFeed({
            category: category as "all" | "ai" | "tokens" | "notes" | "folders",
            userId,
            q,
            startDate,
            endDate,
            limit,
            offset,
        });

        logEvent("admin_activity_logs_queried", {
            adminId,
            count: entries.length,
            total,
        });

        const response: ApiResponse<{
            entries: typeof entries;
            total: number;
            limit: number;
            offset: number;
        }> = {
            success: true,
            data: {
                entries,
                total,
                limit,
                offset,
            },
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
