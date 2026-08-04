/**
 * Config Routes (client-facing)
 *
 * Exposes a safe subset of system configuration for authenticated users:
 * - GET / - Feature flags and token costs
 *
 * Admin-only full config remains at /v1/admin/config.
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "@/middleware/auth.js";
import { asyncHandler } from "@/middleware/errorHandler.js";
import { configService } from "@/services/config.service.js";
import { logInfo, logEvent } from "@/utils/logger.js";
import { ApiResponse } from "@/types/api.js";

const router = Router();

export interface ClientConfig {
    features: {
        summarizeEnabled: boolean;
        autoTagEnabled: boolean;
        flashcardsEnabled: boolean;
        ragQueryEnabled: boolean;
        fileExtractionEnabled: boolean;
    };
    tokens: {
        costs: {
            summarize: number;
            autoTag: number;
            flashcards: number;
            ragQuery: number;
        };
    };
}

/**
 * GET /
 *
 * Return feature flags and token costs for the authenticated client.
 * Does not expose AI model settings, prompts, or rate limits.
 */
router.get(
    "/",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.uid!;

        logInfo("Client config request", { userId });

        const config = await configService.getConfig();

        const data: ClientConfig = {
            features: { ...config.features },
            tokens: {
                costs: { ...config.tokens.costs },
            },
        };

        logEvent("client_config_queried", { userId });

        const response: ApiResponse<ClientConfig> = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
        };

        res.status(200).json(response);
    }),
);

export default router;
