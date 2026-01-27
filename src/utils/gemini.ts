/**
 * Gemini Client Utility
 *
 * Provides configured Google Gemini AI client
 * with proper model selection and default settings
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { logWarn } from "@/utils/logger.js";

/**
 * Default model configuration from MASTERPLAN
 */
export const DEFAULT_MODEL = "gemini-flash-lite-latest";
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_TEMPERATURE = 1;

/**
 * Gemini client singleton
 */
let genAIClient: GoogleGenerativeAI | null = null;

/**
 * Get or create the Gemini AI client
 * @returns GoogleGenerativeAI client instance
 * @throws Error if GEMINI_API_KEY is not set
 */
export function getGeminiClient(): GoogleGenerativeAI {
    if (genAIClient) {
        return genAIClient;
    }

    const apiKey = process.env["GEMINI_API_KEY"];

    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY environment variable is not set. " +
                "Please configure it in your .env file or Cloud Functions configuration.",
        );
    }

    genAIClient = new GoogleGenerativeAI(apiKey);
    return genAIClient;
}

/**
 * Get a configured generative model
 * @param modelName - Model name (defaults to gemini-1.5-flash-latest)
 * @returns GenerativeModel instance
 */
export function getGenerativeModel(modelName?: string): GenerativeModel {
    const client = getGeminiClient();
    return client.getGenerativeModel({
        model: modelName ?? DEFAULT_MODEL,
    });
}

/**
 * Reset the client (useful for testing)
 */
export function resetGeminiClient(): void {
    genAIClient = null;
}

/**
 * Check if Gemini API is configured
 * @returns true if API key is available
 */
export function isGeminiConfigured(): boolean {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
        logWarn("GEMINI_API_KEY is not configured");
        return false;
    }
    return true;
}
