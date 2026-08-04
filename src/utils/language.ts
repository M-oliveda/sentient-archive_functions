/**
 * Language Utilities
 *
 * Helpers for managing user preferred language in AI responses
 */

/**
 * Supported languages in the application
 */
export type SupportedLanguage = "en" | "es" | "fr" | "pt";

/**
 * Minimal user shape needed to resolve preferred language
 */
export interface LanguagePreferencesUser {
    preferences?: {
        language?: SupportedLanguage;
    };
}

/**
 * Language code to full language name mapping
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    pt: "Portuguese",
};

/**
 * Build language instruction for AI prompts
 *
 * @param language - Language code
 * @returns Instruction string to append to prompts
 *
 * @example
 * buildLanguageInstruction("es") // "Respond entirely in Spanish."
 */
export function buildLanguageInstruction(language: SupportedLanguage): string {
    const languageName = LANGUAGE_NAMES[language];
    return `Respond entirely in ${languageName}.`;
}

/**
 * Resolve user's preferred language, defaulting to English
 *
 * @param user - User-like object with optional preferences (may be undefined)
 * @returns User's preferred language or "en" as default
 *
 * @example
 * resolveUserLanguage(user) // "es" if user.preferences.language is "es"
 * resolveUserLanguage(undefined) // "en"
 */
export function resolveUserLanguage(
    user: LanguagePreferencesUser | undefined,
): SupportedLanguage {
    return user?.preferences?.language ?? "en";
}
