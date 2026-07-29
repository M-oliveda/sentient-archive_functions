/**
 * Language Utility Tests
 *
 * Tests for language helper functions
 */

import { describe, test, expect } from "@jest/globals";
import {
    buildLanguageInstruction,
    resolveUserLanguage,
    LANGUAGE_NAMES,
    SupportedLanguage,
} from "../../../src/utils/language.js";

describe("Language Utilities", () => {
    describe("LANGUAGE_NAMES", () => {
        test("should have correct language names for all codes", () => {
            expect(LANGUAGE_NAMES.en).toBe("English");
            expect(LANGUAGE_NAMES.es).toBe("Spanish");
            expect(LANGUAGE_NAMES.fr).toBe("French");
            expect(LANGUAGE_NAMES.pt).toBe("Portuguese");
        });

        test("should have entries for all supported languages", () => {
            const languages: SupportedLanguage[] = ["en", "es", "fr", "pt"];
            languages.forEach((lang) => {
                expect(LANGUAGE_NAMES[lang]).toBeDefined();
                expect(typeof LANGUAGE_NAMES[lang]).toBe("string");
            });
        });
    });

    describe("buildLanguageInstruction", () => {
        test("should build instruction for English", () => {
            const instruction = buildLanguageInstruction("en");
            expect(instruction).toBe("Respond entirely in English.");
        });

        test("should build instruction for Spanish", () => {
            const instruction = buildLanguageInstruction("es");
            expect(instruction).toBe("Respond entirely in Spanish.");
        });

        test("should build instruction for French", () => {
            const instruction = buildLanguageInstruction("fr");
            expect(instruction).toBe("Respond entirely in French.");
        });

        test("should build instruction for Portuguese", () => {
            const instruction = buildLanguageInstruction("pt");
            expect(instruction).toBe("Respond entirely in Portuguese.");
        });

        test("should follow consistent instruction format", () => {
            const languages: SupportedLanguage[] = ["en", "es", "fr", "pt"];
            languages.forEach((lang) => {
                const instruction = buildLanguageInstruction(lang);
                expect(instruction).toMatch(/^Respond entirely in .+\.$/);
            });
        });
    });

    describe("resolveUserLanguage", () => {
        test("should return user's preferred language when available", () => {
            const user = {
                preferences: {
                    language: "es" as SupportedLanguage,
                },
            };

            expect(resolveUserLanguage(user)).toBe("es");
        });

        test("should return 'en' when user is undefined", () => {
            expect(resolveUserLanguage(undefined)).toBe("en");
        });

        test("should return 'en' when preferences are missing", () => {
            expect(resolveUserLanguage({})).toBe("en");
        });

        test("should return 'en' when language is missing from preferences", () => {
            const user = {
                preferences: {},
            };

            expect(resolveUserLanguage(user)).toBe("en");
        });

        test("should handle all supported languages", () => {
            const languages: SupportedLanguage[] = ["en", "es", "fr", "pt"];
            languages.forEach((lang) => {
                const user = {
                    preferences: {
                        language: lang,
                    },
                };

                expect(resolveUserLanguage(user)).toBe(lang);
            });
        });
    });
});
