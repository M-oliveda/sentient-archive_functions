/**
 * Integration Tests Setup
 *
 * Configuration for integration tests that run against Firebase Emulators
 *
 * Prerequisites:
 * - Firebase Emulators must be running (npm run emulators:start)
 * - Or use: npm run test:ci (starts emulators automatically)
 */

import { beforeAll, afterAll, jest } from "@jest/globals";

// Set emulator environment variables
process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8081";
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
process.env["GCLOUD_PROJECT"] = "demo-sentient-archive";

// Increase timeout for integration tests
jest.setTimeout(30000);

beforeAll(() => {
    // eslint-disable-next-line no-console -- integration tests
    console.log("🔥 Integration tests starting...");
    // eslint-disable-next-line no-console -- integration tests
    console.log(`   Firestore: ${process.env["FIRESTORE_EMULATOR_HOST"]}`);
    // eslint-disable-next-line no-console -- integration tests
    console.log(`   Auth: ${process.env["FIREBASE_AUTH_EMULATOR_HOST"]}`);
});

afterAll(() => {
    // eslint-disable-next-line no-console -- integration tests
    console.log("✅ Integration tests complete");
});
