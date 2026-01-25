import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { EventEmitter } from "events";

// 1. Define the mock instance
const mockBusboyInstance = new EventEmitter();

// 2. Define the mock factory
const mockBusboyFactory = jest.fn(() => mockBusboyInstance);

// 3. Mock the module using unstable_mockModule
jest.unstable_mockModule("busboy", () => ({
    default: mockBusboyFactory,
    // Add named export if needed, but 'import Busboy from "busboy"' uses default.
}));

// 4. Mock logger
const mockLogDebug = jest.fn();
const mockLogWarn = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();
const mockLogEvent = jest.fn();
const mockCreateContextLogger = jest.fn();

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logDebug: mockLogDebug,
    logWarn: mockLogWarn,
    logInfo: mockLogInfo,
    logError: mockLogError,
    logEvent: mockLogEvent,
    createContextLogger: mockCreateContextLogger,
}));

// 5. Import the module under test dynamically
const { fileUploadMiddleware } = await import("@/middleware/fileUpload.js");

interface MockFileStream extends EventEmitter {
    resume: jest.Mock<() => void>;
}

describe("File Upload Middleware (Mocked Busboy)", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            headers: {
                "content-type": "multipart/form-data; boundary=boundary",
            },
            pipe: jest.fn(),
            uid: "user123",
            path: "/upload",
        } as unknown as Request;

        mockResponse = {};
        mockNext = jest.fn();

        // Reset listeners on mockBusboyInstance
        mockBusboyInstance.removeAllListeners();

        // Clear mocks
        mockBusboyFactory.mockClear();
        mockLogDebug.mockClear();
        mockLogWarn.mockClear();
        (mockNext as unknown as jest.Mock).mockClear();
        (mockRequest.pipe as unknown as jest.Mock).mockClear();
    });

    test("should handle busboy error", () => {
        fileUploadMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        // Verify busboy was created
        expect(mockBusboyFactory).toHaveBeenCalled();

        // Simulate busboy error
        mockBusboyInstance.emit("error", new Error("Busboy error"));

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Failed to parse file upload",
                code: "INVALID_REQUEST",
                statusCode: 400,
            }),
        );
    });

    test("should handle file stream error", () => {
        fileUploadMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        const mockFileStream = new EventEmitter() as MockFileStream;
        mockFileStream.resume = jest.fn();

        // Simulate file event
        mockBusboyInstance.emit("file", "fieldname", mockFileStream, {
            filename: "test.pdf",
            mimeType: "application/pdf",
            encoding: "7bit",
        });

        // Simulate file stream error
        mockFileStream.emit("error", new Error("Stream error"));

        // Assert logWarn was called
        expect(mockLogWarn).toHaveBeenCalledWith(
            "File stream error",
            expect.objectContaining({ error: "Stream error" }),
        );

        // Finish busboy
        mockBusboyInstance.emit("finish");

        // Should return error because no file buffer collected
        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "No file uploaded",
            }),
        );
    });

    test("should handle multiple files (ignore second)", () => {
        fileUploadMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        const mockFileStream1 = new EventEmitter() as MockFileStream;
        mockFileStream1.resume = jest.fn();
        const mockFileStream2 = new EventEmitter() as MockFileStream;
        mockFileStream2.resume = jest.fn();

        // First file
        mockBusboyInstance.emit("file", "fieldname1", mockFileStream1, {
            filename: "first.pdf",
            mimeType: "application/pdf",
        });

        // Second file
        mockBusboyInstance.emit("file", "fieldname2", mockFileStream2, {
            filename: "second.pdf",
            mimeType: "application/pdf",
        });

        expect(mockFileStream2.resume).toHaveBeenCalled();

        // Finish
        mockBusboyInstance.emit("finish");

        // Expect next with "No file uploaded" (since we didn't provide data)
        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({ message: "No file uploaded" }),
        );
    });

    test("should handle manual size limit check during upload", () => {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;

        fileUploadMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        const mockFileStream = new EventEmitter() as MockFileStream;
        mockFileStream.resume = jest.fn();

        mockBusboyInstance.emit("file", "fieldname", mockFileStream, {
            filename: "large.pdf",
            mimeType: "application/pdf",
        });

        // Emit data larger than MAX_FILE_SIZE
        const largeChunk = Buffer.alloc(MAX_FILE_SIZE + 100);
        mockFileStream.emit("data", largeChunk);

        expect(mockFileStream.resume).toHaveBeenCalled();

        // Finish
        mockFileStream.emit("end");
        mockBusboyInstance.emit("finish");

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "FILE_TOO_LARGE",
            }),
        );
    });

    test("should handle filesLimit event", () => {
        fileUploadMiddleware(
            mockRequest as Request,
            mockResponse as Response,
            mockNext,
        );

        mockBusboyInstance.emit("filesLimit");
        mockBusboyInstance.emit("finish");

        expect(mockNext).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "FILE_TOO_LARGE",
            }),
        );
    });
});
