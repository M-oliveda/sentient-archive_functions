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
        model: "gemini-1.5-flash",
        maxTokensPerRequest: 4096,
        temperature: 0.7,
    },
    tokens: {
        initialGrant: {
            production: 100,
            development: 500,
            staging: 200,
            local: 1000,
        },
        costs: {
            summarize: 2,
            autoTag: 1,
            flashcards: 3,
            ragQuery: 4,
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
        aiRequestsPerHour: 100,
        fileExtractionsPerDay: 50,
    },
    version: 1,
    lastUpdatedBy: null,
};

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Partial<T>,
): T {
    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (
                sourceValue !== null &&
                typeof sourceValue === "object" &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                typeof targetValue === "object" &&
                !Array.isArray(targetValue)
            ) {
                (result as Record<string, unknown>)[key] = deepMerge(
                    targetValue as Record<string, unknown>,
                    sourceValue as Record<string, unknown>,
                );
            } else if (sourceValue !== undefined) {
                (result as Record<string, unknown>)[key] = sourceValue;
            }
        }
    }

    return result;
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
                    currentConfig as unknown as Record<string, unknown>,
                    safeUpdates as Record<string, unknown>,
                ) as unknown as SystemConfig;

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
