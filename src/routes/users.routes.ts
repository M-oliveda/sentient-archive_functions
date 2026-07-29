/**
 * User Routes
 *
 * Client-facing user profile endpoints:
 * - PUT /me - Update current user's display name
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { asyncHandler } from "@/middleware/errorHandler.js";
import { userService } from "@/services/user.service.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import { UpdateProfileRequestSchema, validateRequest } from "@/utils/validation.js";
import { ApiResponse } from "@/types/api.js";
import { SerializedUser } from "@/services/user.service.js";

const router = Router();

/**
 * PUT /me
 *
 * Update the authenticated user's profile (displayName and/or language preference)
 */
router.put(
    "/me",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;
        const body = validateRequest(UpdateProfileRequestSchema, req.body);

        logInfo("Update profile request", { userId, updates: body });

        const updatedUser = await userService.updateProfile(userId, body);

        logEvent("user_profile_updated", {
            userId,
            updates: body,
        });

        const response: ApiResponse<SerializedUser> = {
            success: true,
            data: updatedUser,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
