/**
 * Admin Routes
 *
 * Handles admin API endpoints:
 * - GET /analytics - Get system-wide analytics
 * - GET /users - List users with filtering and pagination
 * - PUT /users/:id - Update user (role, isActive, tokenBalance)
 * - GET /config - Get system configuration
 * - POST /config - Update system configuration
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { adminMiddleware } from "@/middleware/admin.js";
import { asyncHandler, AppError } from "@/middleware/errorHandler.js";
import { analyticsService } from "@/services/analytics.service.js";
import { configService } from "@/services/config.service.js";
import { statsService, AdminStats } from "@/services/stats.service.js";
import { listUsers, updateUserAsAdmin, getUserByUid } from "@/utils/firestore.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import {
    AdminUsersQuerySchema,
    AdminUserUpdateSchema,
    SystemConfigUpdateSchema,
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

export default router;
