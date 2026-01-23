/**
 * Jest Test Setup
 *
 * Global setup and configuration for all tests
 */

import { jest } from "@jest/globals";

// Set test environment variables
process.env["NODE_ENV"] = "test";
process.env["FIREBASE_PROJECT_ID"] = "demo-sentient-archive";
process.env["FUNCTIONS_EMULATOR"] = "true";
process.env["GEMINI_API_KEY"] = "test-api-key";

// Increase test timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
const mockConsole = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

global.console = mockConsole as unknown as Console;
