/**
 * RAG Service Tests
 */

import { describe, test, expect, jest, beforeAll, beforeEach } from "@jest/globals";

// Mock data types
interface MockNote {
    id: string;
    title: string;
    content: string;
    tags: string[];
    aiTags: string[];
    summary: string | null;
    isArchived: boolean;
}

interface MockDocSnapshot {
    id: string;
    data: () => MockNote;
}

interface MockQuerySnapshot {
    empty: boolean;
    size: number;
    forEach: (callback: (doc: MockDocSnapshot) => void) => void;
}

// Create mock notes for testing
const createMockNote = (overrides: Partial<MockNote> = {}): MockNote => ({
    id: "note-1",
    title: "Test Note",
    content: "This is test content about JavaScript and React.",
    tags: ["javascript", "web-development"],
    aiTags: ["programming", "frontend"],
    summary: "A note about JavaScript frameworks.",
    isArchived: false,
    ...overrides,
});

// Mock Firestore
const mockCollectionGet = jest.fn<() => Promise<MockQuerySnapshot>>();

const mockDb = {
    collection: jest.fn(() => ({
        doc: jest.fn(() => ({
            collection: jest.fn(() => ({
                where: jest.fn(() => ({
                    get: mockCollectionGet,
                })),
            })),
        })),
    })),
};

// Mock Firebase modules
jest.unstable_mockModule("firebase-admin/app", () => ({
    __esModule: true,
    initializeApp: jest.fn(),
    getApp: jest.fn(() => {
        throw new Error("No Firebase app initialized");
    }),
}));

jest.unstable_mockModule("firebase-admin/firestore", () => ({
    __esModule: true,
    getFirestore: jest.fn(() => mockDb),
    Timestamp: {
        now: jest.fn(() => ({
            toDate: () => new Date("2024-01-15T00:00:00.000Z"),
        })),
        fromDate: (date: Date) => ({ toDate: () => date }),
    },
}));

jest.unstable_mockModule("firebase-admin/auth", () => ({
    __esModule: true,
    getAuth: jest.fn(() => ({})),
}));

jest.unstable_mockModule("firebase-functions/v2", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import module dynamically after mocking
let RAGService: typeof import("@/services/rag.service.js").RAGService;
let ragService: import("@/services/rag.service.js").RAGService;

describe("RAG Service", () => {
    beforeAll(async () => {
        const mod = await import("@/services/rag.service.js");
        RAGService = mod.RAGService;
        ragService = mod.ragService;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("extractKeywords", () => {
        test("should extract keywords from a simple query", () => {
            const keywords = ragService.extractKeywords("What is React?");
            expect(keywords).toContain("react");
        });

        test("should remove stop words", () => {
            const keywords = ragService.extractKeywords(
                "What is the best way to learn JavaScript?",
            );
            expect(keywords).not.toContain("what");
            expect(keywords).not.toContain("is");
            expect(keywords).not.toContain("the");
            expect(keywords).not.toContain("to");
            expect(keywords).toContain("best");
            expect(keywords).toContain("way");
            expect(keywords).toContain("learn");
            expect(keywords).toContain("javascript");
        });

        test("should convert to lowercase", () => {
            const keywords = ragService.extractKeywords("JAVASCRIPT React NodeJS");
            expect(keywords).toContain("javascript");
            expect(keywords).toContain("react");
            expect(keywords).toContain("nodejs");
        });

        test("should remove punctuation", () => {
            const keywords = ragService.extractKeywords(
                "What's the best API? (REST or GraphQL)",
            );
            expect(keywords).toContain("best");
            expect(keywords).toContain("api");
            expect(keywords).toContain("rest");
            expect(keywords).toContain("graphql");
        });

        test("should remove short words (less than 2 characters)", () => {
            const keywords = ragService.extractKeywords("I use A B C tools");
            expect(keywords).not.toContain("a");
            expect(keywords).not.toContain("b");
            expect(keywords).not.toContain("c");
            expect(keywords).toContain("use");
            expect(keywords).toContain("tools");
        });

        test("should remove duplicates", () => {
            const keywords = ragService.extractKeywords(
                "React React react REACT JavaScript",
            );
            const reactCount = keywords.filter((k) => k === "react").length;
            expect(reactCount).toBe(1);
        });

        test("should return empty array for only stop words", () => {
            const keywords = ragService.extractKeywords("what is the and or");
            expect(keywords).toEqual([]);
        });

        test("should handle empty query", () => {
            const keywords = ragService.extractKeywords("");
            expect(keywords).toEqual([]);
        });

        test("should preserve hyphenated words", () => {
            const keywords = ragService.extractKeywords("web-development server-side");
            expect(keywords).toContain("web-development");
            expect(keywords).toContain("server-side");
        });
    });

    describe("calculateRelevance", () => {
        test("should score title matches highly", () => {
            const note = createMockNote({
                title: "React Tutorial for Beginners",
                content: "Some content",
                tags: [],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["react"]);
            expect(result.score).toBeGreaterThan(0);
            expect(result.matchedKeywords).toContain("react");
        });

        test("should score tag matches", () => {
            const note = createMockNote({
                title: "Some Note",
                content: "Some content",
                tags: ["javascript", "typescript"],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["javascript"]);
            expect(result.score).toBeGreaterThan(0);
            expect(result.matchedKeywords).toContain("javascript");
        });

        test("should score AI tag matches", () => {
            const note = createMockNote({
                title: "Some Note",
                content: "Some content",
                tags: [],
                aiTags: ["machine-learning", "ai"],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["machine-learning"]);
            expect(result.score).toBeGreaterThan(0);
            expect(result.matchedKeywords).toContain("machine-learning");
        });

        test("should score summary matches", () => {
            const note = createMockNote({
                title: "Some Note",
                content: "Some content",
                tags: [],
                aiTags: [],
                summary: "This note covers Python programming basics.",
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["python"]);
            expect(result.score).toBeGreaterThan(0);
            expect(result.matchedKeywords).toContain("python");
        });

        test("should score content matches", () => {
            const note = createMockNote({
                title: "Some Note",
                content: "Firebase is a powerful platform for building applications.",
                tags: [],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["firebase"]);
            expect(result.score).toBeGreaterThan(0);
            expect(result.matchedKeywords).toContain("firebase");
        });

        test("should accumulate scores for multiple keyword matches", () => {
            const note = createMockNote({
                title: "React and JavaScript Tutorial",
                content: "Learn React with JavaScript",
                tags: ["react", "javascript"],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["react", "javascript"]);
            expect(result.matchedKeywords).toContain("react");
            expect(result.matchedKeywords).toContain("javascript");
            // Score should be higher with multiple matches
            const singleResult = ragService.calculateRelevance(note, ["react"]);
            expect(result.score).toBeGreaterThan(singleResult.score);
        });

        test("should return zero score for no matches", () => {
            const note = createMockNote({
                title: "JavaScript Basics",
                content: "Learn JavaScript fundamentals",
                tags: ["javascript"],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["python", "rust"]);
            expect(result.score).toBe(0);
            expect(result.matchedKeywords).toEqual([]);
        });

        test("should cap content occurrences at 10", () => {
            const repeatedContent = "javascript ".repeat(100);
            const note = createMockNote({
                title: "Some Note",
                content: repeatedContent,
                tags: [],
                aiTags: [],
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["javascript"]);
            // Score should be capped, not proportional to 100 occurrences
            expect(result.score).toBeLessThanOrEqual(10); // Max 10 content matches * weight 1
        });

        test("should handle null summary", () => {
            const note = createMockNote({
                summary: null,
            }) as import("@/types/note.js").Note;

            const result = ragService.calculateRelevance(note, ["test"]);
            // Should not throw, score from other fields
            expect(typeof result.score).toBe("number");
        });
    });

    describe("buildContext", () => {
        test("should build context from notes", () => {
            const notes = [
                {
                    noteId: "note-1",
                    title: "React Basics",
                    content: "React is a JavaScript library.",
                    score: 10,
                    matchedKeywords: ["react"],
                },
            ];

            const context = ragService.buildContext(notes);
            expect(context).toContain("## React Basics");
            expect(context).toContain("React is a JavaScript library.");
        });

        test("should separate multiple notes with dividers", () => {
            const notes = [
                {
                    noteId: "note-1",
                    title: "Note 1",
                    content: "Content 1",
                    score: 10,
                    matchedKeywords: ["test"],
                },
                {
                    noteId: "note-2",
                    title: "Note 2",
                    content: "Content 2",
                    score: 5,
                    matchedKeywords: ["test"],
                },
            ];

            const context = ragService.buildContext(notes);
            expect(context).toContain("## Note 1");
            expect(context).toContain("## Note 2");
            expect(context).toContain("---");
        });

        test("should return empty string for empty notes array", () => {
            const context = ragService.buildContext([]);
            expect(context).toBe("");
        });

        test("should truncate long note content", () => {
            const longContent = "a".repeat(5000);
            const notes = [
                {
                    noteId: "note-1",
                    title: "Long Note",
                    content: longContent,
                    score: 10,
                    matchedKeywords: ["test"],
                },
            ];

            const context = ragService.buildContext(notes);
            // Content should be truncated with ellipsis
            expect(context.length).toBeLessThan(5000 + 100);
            expect(context).toContain("...");
        });

        test("should respect max context length", () => {
            const notes = Array.from({ length: 20 }, (_, i) => ({
                noteId: `note-${i}`,
                title: `Note ${i}`,
                content: "x".repeat(1000),
                score: 20 - i,
                matchedKeywords: ["test"],
            }));

            const context = ragService.buildContext(notes);
            // Context should not exceed max length (8000 chars by default)
            expect(context.length).toBeLessThanOrEqual(8500); // Some buffer for formatting
        });
    });

    describe("retrieveNotes", () => {
        test("should return empty array when no keywords extracted", async () => {
            const result = await ragService.retrieveNotes("user-123", "the and", 5);
            expect(result).toEqual([]);
        });

        test("should return empty array when no notes found", async () => {
            mockCollectionGet.mockResolvedValue({
                empty: true,
                size: 0,
                forEach: () => {
                    // Empty - no notes to iterate
                },
            });

            const result = await ragService.retrieveNotes(
                "user-123",
                "react tutorial",
                5,
            );
            expect(result).toEqual([]);
        });

        test("should filter and score notes by relevance", async () => {
            const mockNotes = [
                createMockNote({
                    id: "note-1",
                    title: "React Tutorial",
                    content: "Learn React basics",
                    tags: ["react"],
                }),
                createMockNote({
                    id: "note-2",
                    title: "Python Basics",
                    content: "Learn Python",
                    tags: ["python"],
                }),
            ];

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 2,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i + 1}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.retrieveNotes("user-123", "react", 5);

            // Should find the React note
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]?.matchedKeywords).toContain("react");
        });

        test("should sort notes by score descending", async () => {
            const mockNotes = [
                createMockNote({
                    id: "note-1",
                    title: "JavaScript Intro",
                    content: "Basic JavaScript",
                    tags: ["javascript"],
                }),
                createMockNote({
                    id: "note-2",
                    title: "Advanced JavaScript Patterns",
                    content: "JavaScript JavaScript JavaScript",
                    tags: ["javascript", "advanced"],
                    aiTags: ["javascript"],
                }),
            ];

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 2,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i + 1}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.retrieveNotes("user-123", "javascript", 5);

            // Note 2 should be first (more matches)
            expect(result.length).toBe(2);
            expect(result[0]?.score).toBeGreaterThanOrEqual(result[1]?.score ?? 0);
        });

        test("should respect maxResults limit", async () => {
            const mockNotes = Array.from({ length: 10 }, (_, i) =>
                createMockNote({
                    id: `note-${i}`,
                    title: `Test Note ${i}`,
                    content: "Test content",
                    tags: ["test"],
                }),
            );

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 10,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.retrieveNotes("user-123", "test", 3);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        test("should handle Firestore errors", async () => {
            mockCollectionGet.mockRejectedValue(new Error("Firestore error"));

            await expect(
                ragService.retrieveNotes("user-123", "test", 5),
            ).rejects.toThrow("Firestore error");
        });

        test("should handle non-Error thrown objects", async () => {
            mockCollectionGet.mockRejectedValue("String error");

            await expect(ragService.retrieveNotes("user-123", "test", 5)).rejects.toBe(
                "String error",
            );
        });

        test("should exclude notes below minimum relevance score", async () => {
            const mockNotes = [
                createMockNote({
                    id: "note-1",
                    title: "React Tutorial",
                    content: "Learn React",
                    tags: ["react"],
                }),
                createMockNote({
                    id: "note-2",
                    title: "Unrelated Note",
                    content: "Nothing about the search term",
                    tags: ["other"],
                }),
            ];

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 2,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i + 1}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.retrieveNotes("user-123", "react", 5);

            // Only the relevant note should be returned
            expect(result.every((n) => n.score > 0)).toBe(true);
        });
    });

    describe("getContext", () => {
        test("should return empty context when no notes found", async () => {
            mockCollectionGet.mockResolvedValue({
                empty: true,
                size: 0,
                forEach: () => {
                    // Empty - no notes to iterate
                },
            });

            const result = await ragService.getContext(
                "user-123",
                "nonexistent topic",
                5,
            );

            expect(result.context).toBe("");
            expect(result.noteIds).toEqual([]);
            expect(result.notesFound).toBe(0);
            expect(result.totalScore).toBe(0);
        });

        test("should return context with note metadata", async () => {
            const mockNotes = [
                createMockNote({
                    id: "note-1",
                    title: "React Guide",
                    content: "Comprehensive React guide",
                    tags: ["react", "guide"],
                }),
            ];

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 1,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i + 1}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.getContext("user-123", "react guide", 5);

            expect(result.context).toContain("React Guide");
            expect(result.noteIds).toContain("note-1");
            expect(result.notesFound).toBe(1);
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test("should use default maxResults when not specified", async () => {
            const mockNotes = Array.from({ length: 10 }, (_, i) =>
                createMockNote({
                    id: `note-${i}`,
                    title: `Test Note ${i}`,
                    content: "Test content",
                    tags: ["test"],
                }),
            );

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 10,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.getContext("user-123", "test");

            // Default is 5 results
            expect(result.noteIds.length).toBeLessThanOrEqual(5);
        });

        test("should calculate total score correctly", async () => {
            const mockNotes = [
                createMockNote({
                    id: "note-1",
                    title: "JavaScript",
                    content: "JavaScript content",
                    tags: ["javascript"],
                }),
                createMockNote({
                    id: "note-2",
                    title: "More JavaScript",
                    content: "More JavaScript stuff",
                    tags: ["javascript", "advanced"],
                }),
            ];

            mockCollectionGet.mockResolvedValue({
                empty: false,
                size: 2,
                forEach: (callback) => {
                    mockNotes.forEach((note, i) =>
                        callback({
                            id: `note-${i + 1}`,
                            data: () => note,
                        }),
                    );
                },
            });

            const result = await ragService.getContext("user-123", "javascript", 5);

            // Total score should be sum of individual scores
            expect(result.totalScore).toBeGreaterThan(0);
        });
    });

    describe("RAGService class", () => {
        test("should create new instance", () => {
            const service = new RAGService();
            expect(service).toBeInstanceOf(RAGService);
        });

        test("singleton instance should be available", () => {
            expect(ragService).toBeInstanceOf(RAGService);
        });
    });
});
