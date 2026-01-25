/**
 * Logger Utility Tests
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";

// Create mock functions
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

// Mock firebase-functions logger before importing
jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: mockLoggerInfo,
        warn: mockLoggerWarn,
        error: mockLoggerError,
        debug: mockLoggerDebug,
    },
}));

// Import after mocking
const { logInfo, logWarn, logError, logDebug, logEvent, createContextLogger } =
    await import("@/utils/logger.js");

describe("Logger Utility", () => {
    beforeEach(() => {
        mockLoggerInfo.mockClear();
        mockLoggerWarn.mockClear();
        mockLoggerError.mockClear();
        mockLoggerDebug.mockClear();
    });

    describe("logInfo", () => {
        test("should log info message without context", () => {
            logInfo("Test message");
            expect(mockLoggerInfo).toHaveBeenCalledWith("Test message", undefined);
        });

        test("should log info message with context", () => {
            const context = { userId: "user123", requestId: "req456" };
            logInfo("Test message", context);
            expect(mockLoggerInfo).toHaveBeenCalledWith("Test message", context);
        });
    });

    describe("logWarn", () => {
        test("should log warning message without context", () => {
            logWarn("Warning message");
            expect(mockLoggerWarn).toHaveBeenCalledWith("Warning message", undefined);
        });

        test("should log warning message with context", () => {
            const context = { userId: "user123" };
            logWarn("Warning message", context);
            expect(mockLoggerWarn).toHaveBeenCalledWith("Warning message", context);
        });
    });

    describe("logError", () => {
        test("should log error message without error object", () => {
            logError("Error message");
            expect(mockLoggerError).toHaveBeenCalledWith("Error message", {
                error: "undefined",
            });
        });

        test("should log error message with Error object", () => {
            const error = new Error("Test error");
            logError("Error message", error);
            expect(mockLoggerError).toHaveBeenCalledWith("Error message", {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        });

        test("should log error message with Error and context", () => {
            const error = new Error("Test error");
            const context = { userId: "user123" };
            logError("Error message", error, context);
            expect(mockLoggerError).toHaveBeenCalledWith("Error message", {
                userId: "user123",
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        });

        test("should handle undefined error", () => {
            logError("Error message", undefined);
            expect(mockLoggerError).toHaveBeenCalledWith("Error message", {
                error: "undefined",
            });
        });
    });

    describe("logDebug", () => {
        test("should log debug message in development", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "development";
            logDebug("Debug message");
            expect(mockLoggerDebug).toHaveBeenCalledWith("Debug message", undefined);
            process.env["NODE_ENV"] = originalEnv;
        });

        test("should not log debug message in production", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "production";
            logDebug("Debug message");
            expect(mockLoggerDebug).not.toHaveBeenCalled();
            process.env["NODE_ENV"] = originalEnv;
        });

        test("should log debug message with context in development", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "development";
            const context = { userId: "user123" };
            logDebug("Debug message", context);
            expect(mockLoggerDebug).toHaveBeenCalledWith("Debug message", context);
            process.env["NODE_ENV"] = originalEnv;
        });
    });

    describe("logEvent", () => {
        test("should log event with data", () => {
            const eventData = { action: "user_login", userId: "user123" };
            logEvent("UserLogin", eventData);
            expect(mockLoggerInfo).toHaveBeenCalledWith("Event: UserLogin", {
                event: "UserLogin",
                action: "user_login",
                userId: "user123",
                timestamp: expect.any(String),
            });
        });

        test("should include timestamp in event", () => {
            const eventData = { action: "test" };
            logEvent("TestEvent", eventData);
            const callArgs = mockLoggerInfo.mock.calls[0]?.[1] as
                | {
                      timestamp: string;
                  }
                | undefined;
            expect(callArgs?.timestamp).toBeTruthy();
            if (callArgs) {
                expect(new Date(callArgs.timestamp).toISOString()).toBe(
                    callArgs.timestamp,
                );
            }
        });
    });

    describe("createContextLogger", () => {
        test("should create logger with base context", () => {
            const baseContext = { userId: "user123", requestId: "req456" };
            const contextLogger = createContextLogger(baseContext);
            contextLogger.info("Test message");
            expect(mockLoggerInfo).toHaveBeenCalledWith("Test message", baseContext);
        });

        test("should merge additional context with base context", () => {
            const baseContext = { userId: "user123" };
            const additionalContext = { action: "login" };
            const contextLogger = createContextLogger(baseContext);
            contextLogger.info("Test message", additionalContext);
            expect(mockLoggerInfo).toHaveBeenCalledWith("Test message", {
                userId: "user123",
                action: "login",
            });
        });

        test("should support all log levels", () => {
            const baseContext = { userId: "user123" };
            const contextLogger = createContextLogger(baseContext);
            contextLogger.info("Info message");
            contextLogger.warn("Warn message");
            contextLogger.error("Error message");
            expect(mockLoggerInfo).toHaveBeenCalledWith("Info message", baseContext);
            expect(mockLoggerWarn).toHaveBeenCalledWith("Warn message", baseContext);
            expect(mockLoggerError).toHaveBeenCalledWith("Error message", {
                ...baseContext,
                error: "undefined",
            });
        });

        test("should support event logging", () => {
            const baseContext = { userId: "user123" };
            const contextLogger = createContextLogger(baseContext);
            contextLogger.event("TestEvent", { action: "test" });
            expect(mockLoggerInfo).toHaveBeenCalledWith("Event: TestEvent", {
                event: "TestEvent",
                userId: "user123",
                action: "test",
                timestamp: expect.any(String),
            });
        });

        test("should handle error objects in context logger", () => {
            const baseContext = { userId: "user123" };
            const contextLogger = createContextLogger(baseContext);
            const error = new Error("Test error");
            contextLogger.error("Error occurred", error);
            expect(mockLoggerError).toHaveBeenCalledWith("Error occurred", {
                userId: "user123",
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
            });
        });

        test("should support debug logging in context logger", () => {
            const originalEnv = process.env["NODE_ENV"];
            process.env["NODE_ENV"] = "development";
            const baseContext = { userId: "user123" };
            const contextLogger = createContextLogger(baseContext);
            contextLogger.debug("Debug message");
            expect(mockLoggerDebug).toHaveBeenCalledWith("Debug message", baseContext);
            process.env["NODE_ENV"] = originalEnv;
        });
    });
});
