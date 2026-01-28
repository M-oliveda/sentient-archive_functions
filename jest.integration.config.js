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
    // Only run integration tests
    testMatch: ["**/tests/integration/**/*.test.ts", "**/tests/integration/**/*.spec.ts"],
    // Integration tests setup
    setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
    // Longer timeout for integration tests (30 seconds)
    testTimeout: 30000,
    verbose: true,
    // No coverage threshold for integration tests (unit tests handle coverage)
    collectCoverage: false,
};
