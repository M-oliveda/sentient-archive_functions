/** @type {import('jest').Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: {
        "^@/(.*)\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    module: "ES2022",
                    moduleResolution: "bundler",
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                },
            },
        ],
    },
    testMatch: [
        "**/tests/**/*.test.ts",
        "**/tests/**/*.spec.ts",
        "**/__tests__/**/*.ts",
    ],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/index.ts",
        "!src/types/**",
        "!src/routes/**",
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
    setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    testTimeout: 10000,
    verbose: true,
};
