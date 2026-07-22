/**
 * Activity Routes
 *
 * Client activity feed and stats:
 * - GET / - Paginated activity feed
 * - GET /stats - Activity summary stats
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { asyncHandler } from "@/middleware/errorHandler.js";
import { activityService } from "@/services/activity.service.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import { ActivityQuerySchema, validateRequest } from "@/utils/validation.js";
import { ApiResponse } from "@/types/api.js";
import { ActivityEntry, ActivityStats } from "@/types/activity.js";

const router = Router();

router.use(authMiddleware);

/**
 * GET /
 *
 * Get activity feed for the authenticated user
 */
router.get(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;
        const query = validateRequest(ActivityQuerySchema, req.query);

        logInfo("Activity feed request", {
            userId,
            category: query.category,
            q: query.q,
            limit: query.limit,
            offset: query.offset,
        });

        const entries = await activityService.getFeed(userId, {
            category: query.category,
            q: query.q,
            limit: query.limit,
            offset: query.offset,
        });

        logEvent("activity_feed_queried", {
            userId,
            count: entries.length,
        });

        const response: ApiResponse<ActivityEntry[]> = {
            success: true,
            data: entries,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

/**
 * GET /stats
 *
 * Get activity summary stats for the authenticated user
 */
router.get(
    "/stats",
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        logInfo("Activity stats request", { userId });

        const stats = await activityService.getStats(userId);

        logEvent("activity_stats_queried", { userId });

        const response: ApiResponse<ActivityStats> = {
            success: true,
            data: stats,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
