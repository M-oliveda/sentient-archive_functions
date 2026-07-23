/**
 * Config Service
 *
 * Manages system configuration stored in Firestore.
 * Provides get and update operations with deep merge and version tracking.
 */

import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/utils/firestore.js";
import { logInfo, logError } from "@/utils/logger.js";
import { AppError } from "@/middleware/errorHandler.js";

/**
 * System configuration structure
 */
export interface SystemConfig {
    ai: {
        model: string;
        maxTokensPerRequest: number;
        temperature: number;
        /**
         * Thinking level for Gemini 3+ models
         * Values: "minimal" | "low" | "medium" | "high"
         */
        thinkingLevel?: "minimal" | "low" | "medium" | "high";
        /**
         * Thinking budget for Gemini 2.5 models (numeric)
         * -1 = dynamic, 0 = disabled, >0 = specific token count
         */
        thinkingBudget?: number;
    };
    tokens: {
        initialGrant: {
            production: number;
            development: number;
            staging: number;
            local: number;
        };
        costs: {
            summarize: number;
            autoTag: number;
            flashcards: number;
            ragQuery: number;
        };
    };
    features: {
        summarizeEnabled: boolean;
        autoTagEnabled: boolean;
        flashcardsEnabled: boolean;
        ragQueryEnabled: boolean;
        fileExtractionEnabled: boolean;
    };
    fileUpload: {
        maxSizeBytes: number;
        allowedTypes: string[];
        allowedExtensions: string[];
    };
    rateLimits: {
        aiRequestsPerHour: number;
        fileExtractionsPerDay: number;
    };
    version: number;
    lastUpdatedBy: string | null;
    lastUpdatedAt: Timestamp | null;
    createdAt: Timestamp;
}

/**
 * Default system configuration
 */
const DEFAULT_CONFIG: Omit<SystemConfig, "createdAt" | "lastUpdatedAt"> = {
    ai: {
        model: "gemini-3.5-flash",
        maxTokensPerRequest: 2048,
        temperature: 1.0,
        thinkingLevel: "low",
        thinkingBudget: 0,
    },
    tokens: {
        initialGrant: {
            production: 25,
            development: 50,
            staging: 40,
            local: 50,
        },
        costs: {
            summarize: 5,
            autoTag: 3,
            flashcards: 8,
            ragQuery: 10,
        },
    },
    features: {
        summarizeEnabled: true,
        autoTagEnabled: true,
        flashcardsEnabled: true,
        ragQueryEnabled: true,
        fileExtractionEnabled: true,
    },
    rateLimits: {
        aiRequestsPerHour: 20,
        fileExtractionsPerDay: 10,
    },
    fileUpload: {
        maxSizeBytes: 10485760, // 10 MB
        allowedTypes: ["application/pdf", "text/plain", "text/markdown"],
        allowedExtensions: [".pdf", ".txt", ".md"],
    },
    version: 1,
    lastUpdatedBy: null,
};

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key as keyof typeof source];
            const targetValue = (target as Record<string, unknown>)[key];

            if (
                sourceValue !== null &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                typeof targetValue === "object" &&
                !Array.isArray(targetValue)
            ) {
                result[key] = deepMerge(
                    targetValue as Record<string, unknown>,
                    sourceValue as Record<string, unknown>,
                );
            } else if (sourceValue !== undefined) {
                result[key] = sourceValue as unknown;
            }
        }
    }

    return result as T;
}

/**
 * Config Service class
 * Manages system configuration
 */
export class ConfigService {
    /**
     * Get current system configuration
     *
     * @returns System configuration
     */
    async getConfig(): Promise<SystemConfig> {
        try {
            const db = getDb();
            const configDoc = await db
                .collection("system_config")
                .doc("settings")
                .get();

            if (!configDoc.exists) {
                logInfo("System config not found, returning defaults");
                return {
                    ...DEFAULT_CONFIG,
                    createdAt: Timestamp.now(),
                    lastUpdatedAt: null,
                };
            }

            const data = configDoc.data() as Partial<SystemConfig>;

            // Merge with defaults to ensure all fields exist
            return deepMerge(
                {
                    ...DEFAULT_CONFIG,
                    createdAt: data.createdAt ?? Timestamp.now(),
                    lastUpdatedAt: data.lastUpdatedAt ?? null,
                },
                data,
            );
        } catch (error) {
            logError(
                "Failed to get system config",
                error instanceof Error ? error : undefined,
            );
            throw new AppError(
                "INTERNAL_ERROR",
                500,
                "Failed to retrieve system configuration",
            );
        }
    }

    /**
     * Update system configuration with partial data
     * Uses deep merge to preserve existing values
     *
     * @param updates - Partial configuration updates
     * @param adminId - ID of the admin making the update
     * @returns Updated configuration
     */
    async updateConfig(
        updates: Partial<SystemConfig>,
        adminId: string,
    ): Promise<SystemConfig> {
        const db = getDb();
        const configRef = db.collection("system_config").doc("settings");

        try {
            const result = await db.runTransaction(async (transaction) => {
                const configDoc = await transaction.get(configRef);

                let currentConfig: SystemConfig;

                if (!configDoc.exists) {
                    // Initialize with defaults
                    currentConfig = {
                        ...DEFAULT_CONFIG,
                        createdAt: Timestamp.now(),
                        lastUpdatedAt: null,
                    };
                } else {
                    const data = configDoc.data() as Partial<SystemConfig>;
                    currentConfig = deepMerge(
                        {
                            ...DEFAULT_CONFIG,
                            createdAt: data.createdAt ?? Timestamp.now(),
                            lastUpdatedAt: data.lastUpdatedAt ?? null,
                        },
                        data,
                    );
                }

                // Remove metadata fields from updates (they are managed internally)
                const {
                    version: _v,
                    lastUpdatedBy: _l,
                    lastUpdatedAt: _u,
                    createdAt: _c,
                    ...safeUpdates
                } = updates;

                // Deep merge the updates
                const newConfig = deepMerge(
                    currentConfig,
                    safeUpdates as Partial<SystemConfig>,
                );

                // Update metadata
                newConfig.version = currentConfig.version + 1;
                newConfig.lastUpdatedBy = adminId;
                newConfig.lastUpdatedAt = Timestamp.now();

                // Preserve original createdAt
                newConfig.createdAt = currentConfig.createdAt;

                transaction.set(configRef, newConfig);

                return newConfig;
            });

            logInfo("System config updated", {
                adminId,
                newVersion: result.version,
            });

            return result;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logError(
                "Failed to update system config",
                error instanceof Error ? error : undefined,
                { adminId },
            );
            throw new AppError(
                "INTERNAL_ERROR",
                500,
                "Failed to update system configuration",
            );
        }
    }
}

/**
 * Singleton instance of ConfigService
 */
export const configService = new ConfigService();
