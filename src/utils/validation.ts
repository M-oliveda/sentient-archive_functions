/**
 * Validation Schemas
 *
 * Zod schemas for request/response validation
 * All API endpoints use these schemas for type-safe validation
 */

import { z } from "zod";

/**
 * Common Schemas
 */

// Pagination
export const PaginationSchema = z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
});

// Generic ID
export const IdParamSchema = z.object({
    id: z.string().min(1),
});

/**
 * File Upload Schemas
 */

export const FileMetadataSchema = z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.enum([
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/x-markdown",
    ]),
    size: z
        .number()
        .int()
        .min(1)
        .max(10 * 1024 * 1024), // 10MB max
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

/**
 * AI Operation Schemas
 */

// Summarize
export const SummarizeRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    maxLength: z
        .number()
        .int()
        .min(50, "Summary must be at least 50 characters")
        .max(500, "Summary cannot exceed 500 characters")
        .optional()
        .default(200),
});

export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;

// Auto-Tag
export const AutoTagRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    maxTags: z
        .number()
        .int()
        .min(1, "Must generate at least 1 tag")
        .max(10, "Cannot generate more than 10 tags")
        .optional()
        .default(5),
});

export type AutoTagRequest = z.infer<typeof AutoTagRequestSchema>;

// Flashcards
export const FlashcardsRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    count: z
        .number()
        .int()
        .min(2, "Must generate at least 2 flashcards")
        .max(20, "Cannot generate more than 20 flashcards")
        .optional()
        .default(5),
});

export type FlashcardsRequest = z.infer<typeof FlashcardsRequestSchema>;

// RAG Query
export const RagQueryRequestSchema = z.object({
    query: z
        .string()
        .min(3, "Query must be at least 3 characters")
        .max(500, "Query cannot exceed 500 characters"),
    maxResults: z
        .number()
        .int()
        .min(1, "Must retrieve at least 1 result")
        .max(10, "Cannot retrieve more than 10 results")
        .optional()
        .default(5),
});

export type RagQueryRequest = z.infer<typeof RagQueryRequestSchema>;

/**
 * Token Operation Schemas
 */

// Token Balance Response
export const TokenBalanceResponseSchema = z.object({
    balance: z.number().int().min(0),
    totalGranted: z.number().int().min(0),
    totalSpent: z.number().int().min(0),
});

export type TokenBalanceResponse = z.infer<typeof TokenBalanceResponseSchema>;

// Token Mint Request (Admin only)
export const TokenMintRequestSchema = z
    .object({
        userId: z.string().min(1, "User ID is required"),
        amount: z
            .number()
            .int()
            .positive("Amount must be positive")
            .max(10000, "Cannot mint more than 10,000 tokens at once"),
        reason: z
            .string()
            .min(3, "Reason must be at least 3 characters")
            .max(200, "Reason cannot exceed 200 characters"),
    })
    .refine((data) => data.amount <= 10000, {
        message: "Cannot mint more than 10,000 tokens at once",
        path: ["amount"],
    });

export type TokenMintRequest = z.infer<typeof TokenMintRequestSchema>;

// Token Request (user requests tokens from admin)
export const TokenRequestSchema = z.object({
    amount: z
        .number()
        .int()
        .positive("Amount must be positive")
        .max(10000, "Cannot request more than 10,000 tokens at once"),
});

export type TokenRequestInput = z.infer<typeof TokenRequestSchema>;

// Token History Query (for pagination and filtering)
export const TokenHistoryQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit cannot exceed 100")
        .optional()
        .default(20),
    offset: z.coerce
        .number()
        .int()
        .min(0, "Offset cannot be negative")
        .optional()
        .default(0),
    type: z.enum(["grant", "deduction"]).optional(),
});

export type TokenHistoryQuery = z.infer<typeof TokenHistoryQuerySchema>;

/**
 * User Profile Schemas
 */

export const UpdateProfileRequestSchema = z.object({
    displayName: z
        .string()
        .trim()
        .min(1, "Display name is required")
        .max(80, "Display name cannot exceed 80 characters"),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

/**
 * Admin Schemas
 */

// User Update (Admin)
export const AdminUserUpdateSchema = z.object({
    role: z.enum(["client", "admin"]).optional(),
    isActive: z.boolean().optional(),
    tokenBalance: z.number().int().min(0).optional(),
});

export type AdminUserUpdate = z.infer<typeof AdminUserUpdateSchema>;

// System Config Update (Admin)
export const SystemConfigUpdateSchema = z.object({
    ai: z
        .object({
            model: z.string().optional(),
            maxTokensPerRequest: z.number().int().positive().optional(),
            temperature: z.number().min(0).max(2).optional(),
        })
        .optional(),
    tokens: z
        .object({
            initialGrant: z
                .object({
                    production: z.number().int().min(0).optional(),
                    development: z.number().int().min(0).optional(),
                    staging: z.number().int().min(0).optional(),
                    local: z.number().int().min(0).optional(),
                })
                .optional(),
            costs: z
                .object({
                    summarize: z.number().int().min(0).optional(),
                    autoTag: z.number().int().min(0).optional(),
                    flashcards: z.number().int().min(0).optional(),
                    ragQuery: z.number().int().min(0).optional(),
                })
                .optional(),
        })
        .optional(),
    features: z
        .object({
            summarizeEnabled: z.boolean().optional(),
            autoTagEnabled: z.boolean().optional(),
            flashcardsEnabled: z.boolean().optional(),
            ragQueryEnabled: z.boolean().optional(),
            fileExtractionEnabled: z.boolean().optional(),
        })
        .optional(),
    rateLimits: z
        .object({
            aiRequestsPerHour: z.number().int().positive().optional(),
            fileExtractionsPerDay: z.number().int().positive().optional(),
        })
        .optional(),
});

export type SystemConfigUpdate = z.infer<typeof SystemConfigUpdateSchema>;

// Admin Users Query (for listing users)
export const AdminUsersQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit cannot exceed 100")
        .optional()
        .default(20),
    offset: z.coerce
        .number()
        .int()
        .min(0, "Offset cannot be negative")
        .optional()
        .default(0),
    role: z.enum(["client", "admin"]).optional(),
    isActive: z
        .union([z.boolean(), z.string().transform((val) => val === "true")])
        .optional(),
    search: z.string().max(100, "Search query too long").optional(),
    sortBy: z
        .enum(["createdAt", "lastLoginAt", "tokenBalance"])
        .optional()
        .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

// Admin Analytics Query (for filtering analytics)
export const AdminAnalyticsQuerySchema = z.object({
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
        .optional(),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
        .optional(),
});

export type AdminAnalyticsQuery = z.infer<typeof AdminAnalyticsQuerySchema>;

/**
 * Response Schemas
 */

// Generic API Response
export const ApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z
        .object({
            code: z.string(),
            message: z.string(),
            details: z.record(z.unknown()).optional(),
        })
        .optional(),
    timestamp: z.string().optional(),
});

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    timestamp?: string;
}

/**
 * Validation Helper Functions
 */

/**
 * Validate request body against schema
 * Throws ZodError if validation fails
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data);
}

/**
 * Safe validation that returns result object
 */
export function safeValidateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    } else {
        return { success: false, error: result.error };
    }
}
