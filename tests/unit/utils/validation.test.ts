/**
 * Validation Utility Tests
 */

import { describe, test, expect } from "@jest/globals";
import { z } from "zod";
import {
    FileMetadataSchema,
    SummarizeRequestSchema,
    AutoTagRequestSchema,
    FlashcardsRequestSchema,
    RagQueryRequestSchema,
    TokenMintRequestSchema,
    TokenHistoryQuerySchema,
    UpdateProfileRequestSchema,
    AdminUserUpdateSchema,
    AdminUsersQuerySchema,
    AdminAnalyticsQuerySchema,
    SystemConfigUpdateSchema,
    validateRequest,
    safeValidateRequest,
} from "@/utils/validation.js";

describe("Validation Utility", () => {
    describe("FileMetadataSchema", () => {
        test("should validate valid PDF metadata", () => {
            const data = {
                filename: "document.pdf",
                mimeType: "application/pdf",
                size: 1024,
            };

            expect(() => FileMetadataSchema.parse(data)).not.toThrow();
        });

        test("should validate valid TXT metadata", () => {
            const data = {
                filename: "notes.txt",
                mimeType: "text/plain",
                size: 512,
            };

            expect(() => FileMetadataSchema.parse(data)).not.toThrow();
        });

        test("should validate valid Markdown metadata", () => {
            const data = {
                filename: "readme.md",
                mimeType: "text/markdown",
                size: 2048,
            };

            expect(() => FileMetadataSchema.parse(data)).not.toThrow();
        });

        test("should reject invalid MIME type", () => {
            const data = {
                filename: "image.jpg",
                mimeType: "image/jpeg",
                size: 1024,
            };

            expect(() => FileMetadataSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject file size exceeding 10MB", () => {
            const data = {
                filename: "large.pdf",
                mimeType: "application/pdf",
                size: 11 * 1024 * 1024,
            };

            expect(() => FileMetadataSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject empty filename", () => {
            const data = {
                filename: "",
                mimeType: "application/pdf",
                size: 1024,
            };

            expect(() => FileMetadataSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("SummarizeRequestSchema", () => {
        test("should validate valid request", () => {
            const data = {
                noteId: "note123",
                maxLength: 150,
            };

            expect(() => SummarizeRequestSchema.parse(data)).not.toThrow();
        });

        test("should use default maxLength", () => {
            const data = { noteId: "note123" };
            const result = SummarizeRequestSchema.parse(data);

            expect(result.maxLength).toBe(200);
        });

        test("should reject maxLength below minimum", () => {
            const data = {
                noteId: "note123",
                maxLength: 30,
            };

            expect(() => SummarizeRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject maxLength above maximum", () => {
            const data = {
                noteId: "note123",
                maxLength: 600,
            };

            expect(() => SummarizeRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject empty noteId", () => {
            const data = {
                noteId: "",
                maxLength: 150,
            };

            expect(() => SummarizeRequestSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("AutoTagRequestSchema", () => {
        test("should validate valid request", () => {
            const data = {
                noteId: "note123",
                maxTags: 7,
            };

            expect(() => AutoTagRequestSchema.parse(data)).not.toThrow();
        });

        test("should use default maxTags", () => {
            const data = { noteId: "note123" };
            const result = AutoTagRequestSchema.parse(data);

            expect(result.maxTags).toBe(5);
        });

        test("should reject maxTags below minimum", () => {
            const data = {
                noteId: "note123",
                maxTags: 0,
            };

            expect(() => AutoTagRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject maxTags above maximum", () => {
            const data = {
                noteId: "note123",
                maxTags: 15,
            };

            expect(() => AutoTagRequestSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("FlashcardsRequestSchema", () => {
        test("should validate valid request", () => {
            const data = {
                noteId: "note123",
                count: 10,
            };

            expect(() => FlashcardsRequestSchema.parse(data)).not.toThrow();
        });

        test("should use default count", () => {
            const data = { noteId: "note123" };
            const result = FlashcardsRequestSchema.parse(data);

            expect(result.count).toBe(5);
        });

        test("should reject count below minimum", () => {
            const data = {
                noteId: "note123",
                count: 1,
            };

            expect(() => FlashcardsRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject count above maximum", () => {
            const data = {
                noteId: "note123",
                count: 25,
            };

            expect(() => FlashcardsRequestSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("RagQueryRequestSchema", () => {
        test("should validate valid request", () => {
            const data = {
                query: "What is machine learning?",
                maxResults: 8,
            };

            expect(() => RagQueryRequestSchema.parse(data)).not.toThrow();
        });

        test("should use default maxResults", () => {
            const data = { query: "Test query" };
            const result = RagQueryRequestSchema.parse(data);

            expect(result.maxResults).toBe(5);
        });

        test("should reject query too short", () => {
            const data = {
                query: "ab",
                maxResults: 5,
            };

            expect(() => RagQueryRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject query too long", () => {
            const data = {
                query: "a".repeat(501),
                maxResults: 5,
            };

            expect(() => RagQueryRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject maxResults above maximum", () => {
            const data = {
                query: "Test query",
                maxResults: 15,
            };

            expect(() => RagQueryRequestSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("TokenMintRequestSchema", () => {
        test("should validate valid request", () => {
            const data = {
                userId: "user123",
                amount: 500,
                reason: "Monthly grant",
            };

            expect(() => TokenMintRequestSchema.parse(data)).not.toThrow();
        });

        test("should reject negative amount", () => {
            const data = {
                userId: "user123",
                amount: -100,
                reason: "Test",
            };

            expect(() => TokenMintRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject amount exceeding maximum", () => {
            const data = {
                userId: "user123",
                amount: 15000,
                reason: "Too many tokens",
            };

            expect(() => TokenMintRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject short reason", () => {
            const data = {
                userId: "user123",
                amount: 500,
                reason: "ab",
            };

            expect(() => TokenMintRequestSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject empty userId", () => {
            const data = {
                userId: "",
                amount: 500,
                reason: "Test reason",
            };

            expect(() => TokenMintRequestSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("TokenHistoryQuerySchema", () => {
        test("should validate valid query with all options", () => {
            const data = {
                limit: "50",
                offset: "10",
                type: "grant",
            };

            const result = TokenHistoryQuerySchema.parse(data);

            expect(result.limit).toBe(50);
            expect(result.offset).toBe(10);
            expect(result.type).toBe("grant");
        });

        test("should use default values when not provided", () => {
            const data = {};
            const result = TokenHistoryQuerySchema.parse(data);

            expect(result.limit).toBe(20);
            expect(result.offset).toBe(0);
            expect(result.type).toBeUndefined();
        });

        test("should coerce string numbers to numbers", () => {
            const data = {
                limit: "25",
                offset: "5",
            };

            const result = TokenHistoryQuerySchema.parse(data);

            expect(result.limit).toBe(25);
            expect(result.offset).toBe(5);
        });

        test("should accept deduction type", () => {
            const data = { type: "deduction" };
            const result = TokenHistoryQuerySchema.parse(data);

            expect(result.type).toBe("deduction");
        });

        test("should reject limit below minimum", () => {
            const data = { limit: "0" };

            expect(() => TokenHistoryQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject limit above maximum", () => {
            const data = { limit: "150" };

            expect(() => TokenHistoryQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject negative offset", () => {
            const data = { offset: "-5" };

            expect(() => TokenHistoryQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject invalid type", () => {
            const data = { type: "invalid" };

            expect(() => TokenHistoryQuerySchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("UpdateProfileRequestSchema", () => {
        test("should validate displayName only", () => {
            const data = { displayName: "Jane Doe" };
            const result = UpdateProfileRequestSchema.parse(data);

            expect(result.displayName).toBe("Jane Doe");
            expect(result.language).toBeUndefined();
        });

        test("should validate language only", () => {
            const data = { language: "es" };
            const result = UpdateProfileRequestSchema.parse(data);

            expect(result.language).toBe("es");
            expect(result.displayName).toBeUndefined();
        });

        test("should validate displayName and language together", () => {
            const data = { displayName: "Jane Doe", language: "fr" };
            const result = UpdateProfileRequestSchema.parse(data);

            expect(result.displayName).toBe("Jane Doe");
            expect(result.language).toBe("fr");
        });

        test("should accept all supported languages", () => {
            for (const language of ["en", "es", "fr", "pt"] as const) {
                const result = UpdateProfileRequestSchema.parse({ language });
                expect(result.language).toBe(language);
            }
        });

        test("should trim displayName", () => {
            const result = UpdateProfileRequestSchema.parse({
                displayName: "  Jane Doe  ",
            });

            expect(result.displayName).toBe("Jane Doe");
        });

        test("should reject empty object (neither field provided)", () => {
            expect(() => UpdateProfileRequestSchema.parse({})).toThrow(z.ZodError);
        });

        test("should reject empty displayName after trim", () => {
            expect(() =>
                UpdateProfileRequestSchema.parse({ displayName: "   " }),
            ).toThrow(z.ZodError);
        });

        test("should reject displayName exceeding 80 characters", () => {
            expect(() =>
                UpdateProfileRequestSchema.parse({ displayName: "a".repeat(81) }),
            ).toThrow(z.ZodError);
        });

        test("should reject invalid language", () => {
            expect(() =>
                UpdateProfileRequestSchema.parse({ language: "de" }),
            ).toThrow(z.ZodError);
        });
    });

    describe("AdminUserUpdateSchema", () => {
        test("should validate role update", () => {
            const data = { role: "admin" };

            expect(() => AdminUserUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate isActive update", () => {
            const data = { isActive: false };

            expect(() => AdminUserUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate tokenBalance update", () => {
            const data = { tokenBalance: 1000 };

            expect(() => AdminUserUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate multiple fields", () => {
            const data = {
                role: "client",
                isActive: true,
                tokenBalance: 500,
            };

            expect(() => AdminUserUpdateSchema.parse(data)).not.toThrow();
        });

        test("should reject invalid role", () => {
            const data = { role: "superadmin" };

            expect(() => AdminUserUpdateSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject negative tokenBalance", () => {
            const data = { tokenBalance: -100 };

            expect(() => AdminUserUpdateSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("SystemConfigUpdateSchema", () => {
        test("should validate AI config update", () => {
            const data = {
                ai: {
                    model: "gemini-1.5-flash",
                    temperature: 0.7,
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate AI config with thinking parameters", () => {
            const data = {
                ai: {
                    model: "gemini-3.5-flash",
                    temperature: 1.0,
                    thinkingLevel: "medium",
                    thinkingBudget: 1024,
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate thinkingLevel enum values", () => {
            const validLevels = ["minimal", "low", "medium", "high"];

            validLevels.forEach((level) => {
                const data = {
                    ai: {
                        thinkingLevel: level,
                    },
                };

                expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
            });
        });

        test("should reject invalid thinkingLevel", () => {
            const data = {
                ai: {
                    thinkingLevel: "invalid",
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should validate token costs update", () => {
            const data = {
                tokens: {
                    costs: {
                        summarize: 10,
                        autoTag: 5,
                    },
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate features update", () => {
            const data = {
                features: {
                    summarizeEnabled: true,
                    flashcardsEnabled: false,
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
        });

        test("should validate rate limits update", () => {
            const data = {
                rateLimits: {
                    aiRequestsPerHour: 100,
                    fileExtractionsPerDay: 50,
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).not.toThrow();
        });

        test("should reject temperature out of range", () => {
            const data = {
                ai: {
                    temperature: 3.0,
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject negative token cost", () => {
            const data = {
                tokens: {
                    costs: {
                        summarize: -5,
                    },
                },
            };

            expect(() => SystemConfigUpdateSchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("validateRequest", () => {
        test("should return parsed data on valid input", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const data = { name: "John", age: 30 };
            const result = validateRequest(schema, data);

            expect(result).toEqual(data);
        });

        test("should throw ZodError on invalid input", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const data = { name: "John", age: "thirty" };

            expect(() => validateRequest(schema, data)).toThrow(z.ZodError);
        });
    });

    describe("AdminUsersQuerySchema", () => {
        test("should validate valid query with all options", () => {
            const data = {
                limit: "50",
                offset: "10",
                role: "client",
                isActive: true,
                search: "john",
                sortBy: "lastLoginAt",
                sortOrder: "asc",
            };

            const result = AdminUsersQuerySchema.parse(data);

            expect(result.limit).toBe(50);
            expect(result.offset).toBe(10);
            expect(result.role).toBe("client");
            expect(result.isActive).toBe(true);
            expect(result.search).toBe("john");
            expect(result.sortBy).toBe("lastLoginAt");
            expect(result.sortOrder).toBe("asc");
        });

        test("should use default values when not provided", () => {
            const data = {};
            const result = AdminUsersQuerySchema.parse(data);

            expect(result.limit).toBe(20);
            expect(result.offset).toBe(0);
            expect(result.sortBy).toBe("createdAt");
            expect(result.sortOrder).toBe("desc");
        });

        test("should transform string 'true' to boolean true for isActive", () => {
            const data = { isActive: "true" };
            const result = AdminUsersQuerySchema.parse(data);

            expect(result.isActive).toBe(true);
        });

        test("should transform string 'false' to boolean false for isActive", () => {
            const data = { isActive: "false" };
            const result = AdminUsersQuerySchema.parse(data);

            expect(result.isActive).toBe(false);
        });

        test("should accept boolean true for isActive", () => {
            const data = { isActive: true };
            const result = AdminUsersQuerySchema.parse(data);

            expect(result.isActive).toBe(true);
        });

        test("should accept boolean false for isActive", () => {
            const data = { isActive: false };
            const result = AdminUsersQuerySchema.parse(data);

            expect(result.isActive).toBe(false);
        });

        test("should reject limit below minimum", () => {
            const data = { limit: "0" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject limit above maximum", () => {
            const data = { limit: "150" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject negative offset", () => {
            const data = { offset: "-5" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject invalid role", () => {
            const data = { role: "superadmin" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject invalid sortBy", () => {
            const data = { sortBy: "email" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject invalid sortOrder", () => {
            const data = { sortOrder: "random" };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject search query that is too long", () => {
            const data = { search: "a".repeat(101) };

            expect(() => AdminUsersQuerySchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("AdminAnalyticsQuerySchema", () => {
        test("should validate valid date range", () => {
            const data = {
                startDate: "2024-01-01",
                endDate: "2024-12-31",
            };

            const result = AdminAnalyticsQuerySchema.parse(data);

            expect(result.startDate).toBe("2024-01-01");
            expect(result.endDate).toBe("2024-12-31");
        });

        test("should accept empty query", () => {
            const data = {};
            const result = AdminAnalyticsQuerySchema.parse(data);

            expect(result.startDate).toBeUndefined();
            expect(result.endDate).toBeUndefined();
        });

        test("should reject invalid date format for startDate", () => {
            const data = { startDate: "01-01-2024" };

            expect(() => AdminAnalyticsQuerySchema.parse(data)).toThrow(z.ZodError);
        });

        test("should reject invalid date format for endDate", () => {
            const data = { endDate: "2024/12/31" };

            expect(() => AdminAnalyticsQuerySchema.parse(data)).toThrow(z.ZodError);
        });
    });

    describe("safeValidateRequest", () => {
        test("should return success result on valid input", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const data = { name: "John", age: 30 };
            const result = safeValidateRequest(schema, data);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(data);
            }
        });

        test("should return error result on invalid input", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const data = { name: "John", age: "thirty" };
            const result = safeValidateRequest(schema, data);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(z.ZodError);
            }
        });
    });
});
