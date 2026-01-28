/**
 * API Types
 *
 * Common types for API requests and responses
 */

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    timestamp?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export type ApiErrorCode =
    | "UNAUTHENTICATED"
    | "UNAUTHORIZED"
    | "INSUFFICIENT_TOKENS"
    | "RATE_LIMIT_EXCEEDED"
    | "NOT_FOUND"
    | "INVALID_REQUEST"
    | "INVALID_FILE"
    | "FILE_TOO_LARGE"
    | "UNSUPPORTED_FILE_TYPE"
    | "EXTRACTION_FAILED"
    | "AI_API_ERROR"
    | "INTERNAL_ERROR"
    | "FILE_EXTRACTION_DISABLED"
    | "FEATURE_DISABLED"
    | "NO_CONTEXT";
