/**
 * TOML Configuration Loader
 *
 * Provides utilities for loading TOML configuration files.
 * Using TOML for ~10% token efficiency over JSON in AI communications.
 *
 * @see https://www.npmjs.com/package/smol-toml
 */

import { parse } from "smol-toml";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logInfo, logError } from "@/utils/logger.js";

/**
 * Get the directory path for config files
 */
function getConfigDir(): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Navigate from utils/ to config/
    return join(__dirname, "..", "config");
}

/**
 * Prompts TOML structure
 */
export interface PromptsConfig {
    metadata: {
        version: string;
        description: string;
        last_updated: string;
    };
    prompts: {
        summarize: PromptConfig;
        autoTag: PromptConfig;
        flashcards: PromptConfig;
        ragQuery: PromptConfig;
    };
    defaults: {
        temperature: number;
        max_tokens: number;
        model: string;
    };
}

export interface PromptConfig {
    role: string;
    task: string;
    instructions: string;
}

/**
 * Cache for loaded TOML configurations
 */
const configCache = new Map<string, unknown>();

/**
 * Load and parse a TOML configuration file
 *
 * @param filename - Name of the TOML file (without path)
 * @returns Parsed TOML content
 * @throws Error if file cannot be read or parsed
 */
export function loadToml<T>(filename: string): T {
    // Check cache first
    if (configCache.has(filename)) {
        return configCache.get(filename) as T;
    }

    const filePath = join(getConfigDir(), filename);

    try {
        const content = readFileSync(filePath, "utf-8");
        const parsed = parse(content) as T;

        // Cache the parsed content
        configCache.set(filename, parsed);

        logInfo(`Loaded TOML config: ${filename}`);
        return parsed;
    } catch (error) {
        logError(`Failed to load TOML config: ${filename}`, error as Error);
        throw new Error(
            `Failed to load TOML config ${filename}: ${(error as Error).message}`,
        );
    }
}

/**
 * Load the prompts configuration
 *
 * @returns PromptsConfig object
 */
export function loadPromptsConfig(): PromptsConfig {
    return loadToml<PromptsConfig>("prompts.toml");
}

/**
 * Get a specific prompt's instructions
 *
 * @param promptKey - The prompt key (summarize, autoTag, flashcards, ragQuery)
 * @returns The prompt instructions string
 */
export function getPromptInstructions(
    promptKey: "summarize" | "autoTag" | "flashcards" | "ragQuery",
): string {
    const config = loadPromptsConfig();
    return config.prompts[promptKey].instructions;
}

/**
 * Get default AI configuration from TOML
 *
 * @returns Default AI configuration
 */
export function getDefaultAIConfig(): {
    temperature: number;
    maxTokens: number;
    model: string;
} {
    const config = loadPromptsConfig();
    return {
        temperature: config.defaults.temperature,
        maxTokens: config.defaults.max_tokens,
        model: config.defaults.model,
    };
}

/**
 * Clear the configuration cache (useful for testing)
 */
export function clearConfigCache(): void {
    configCache.clear();
}

/**
 * Reload a specific configuration file
 *
 * @param filename - Name of the TOML file to reload
 */
export function reloadConfig<T>(filename: string): T {
    configCache.delete(filename);
    return loadToml<T>(filename);
}
