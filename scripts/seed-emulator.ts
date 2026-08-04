/* eslint-disable no-console */
/**
 * Seed Emulator Script
 *
 * Seeds Firebase emulators with test data for local development.
 * Run with: npm run seed
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { faker } from "@faker-js/faker";

// Emulator configuration
const FIRESTORE_EMULATOR_HOST =
    process.env["FIRESTORE_EMULATOR_HOST"] ?? "localhost:8081";
const FIREBASE_AUTH_EMULATOR_HOST =
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] ?? "localhost:9099";

// Set emulator environment variables before initializing
process.env["FIRESTORE_EMULATOR_HOST"] = FIRESTORE_EMULATOR_HOST;
process.env["FIREBASE_AUTH_EMULATOR_HOST"] = FIREBASE_AUTH_EMULATOR_HOST;

// Initialize Firebase Admin SDK
const app = initializeApp({
    projectId: "demo-sentient-archive",
});

const db = getFirestore(app);
const auth = getAuth(app);

// Seed configuration
const NUM_ADMINS = 2;
const NUM_CLIENTS = 8;
const MIN_NOTES = 50;
const MAX_NOTES = 100;
const MIN_TRANSACTIONS_PER_USER = 3;
const MAX_TRANSACTIONS_PER_USER = 10;
const MIN_FOLDERS_PER_USER = 2;
const MAX_FOLDERS_PER_USER = 5;

// Store created user credentials for output
interface UserCredentials {
    email: string;
    password: string;
    uid: string;
    role: string;
    displayName: string;
}

const createdUsers: UserCredentials[] = [];

// Sample note content templates
const NOTE_TEMPLATES = [
    {
        title: "Meeting Notes: {topic}",
        content: `# Meeting Notes

## Date: {date}

### Attendees
- {person1}
- {person2}
- {person3}

### Agenda
1. {topic} discussion
2. Status updates
3. Next steps

### Key Points
{paragraph}

### Action Items
- [ ] {task1}
- [ ] {task2}
- [ ] {task3}

### Next Meeting
Scheduled for next {day}`,
        tags: ["meeting", "notes", "work"],
    },
    {
        title: "Book Summary: {bookTitle}",
        content: `# {bookTitle}

**Author:** {author}

## Overview
{paragraph}

## Key Takeaways
1. {takeaway1}
2. {takeaway2}
3. {takeaway3}

## Favorite Quotes
> "{quote}"

## My Thoughts
{paragraph}

## Rating: {rating}/5`,
        tags: ["book", "summary", "reading"],
    },
    {
        title: "Project Plan: {projectName}",
        content: `# {projectName}

## Objective
{sentence}

## Timeline
- **Start Date:** {startDate}
- **End Date:** {endDate}

## Milestones
1. Phase 1: Research - {milestone1}
2. Phase 2: Development - {milestone2}
3. Phase 3: Testing - {milestone3}
4. Phase 4: Launch - {milestone4}

## Resources Needed
- {resource1}
- {resource2}
- {resource3}

## Risks
{paragraph}

## Success Metrics
- {metric1}
- {metric2}`,
        tags: ["project", "planning", "work"],
    },
    {
        title: "Learning Notes: {subject}",
        content: `# {subject}

## Introduction
{paragraph}

## Key Concepts

### Concept 1: {concept1}
{paragraph}

### Concept 2: {concept2}
{paragraph}

## Examples
\`\`\`
{codeExample}
\`\`\`

## Questions
- {question1}
- {question2}

## Resources
- [Resource 1]({url})
- [Resource 2]({url})`,
        tags: ["learning", "education", "notes"],
    },
    {
        title: "Daily Journal: {date}",
        content: `# {date}

## Morning Thoughts
{paragraph}

## Today's Goals
- [ ] {goal1}
- [ ] {goal2}
- [ ] {goal3}

## What I Accomplished
{paragraph}

## Gratitude
1. {gratitude1}
2. {gratitude2}
3. {gratitude3}

## Tomorrow's Focus
{sentence}`,
        tags: ["journal", "daily", "personal"],
    },
    {
        title: "Recipe: {dishName}",
        content: `# {dishName}

**Prep Time:** {prepTime} minutes
**Cook Time:** {cookTime} minutes
**Servings:** {servings}

## Ingredients
- {ingredient1}
- {ingredient2}
- {ingredient3}
- {ingredient4}
- {ingredient5}

## Instructions
1. {step1}
2. {step2}
3. {step3}
4. {step4}

## Tips
{paragraph}

## Variations
- {variation1}
- {variation2}`,
        tags: ["recipe", "cooking", "food"],
    },
];

// Helper functions
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Mix of historical and recent dates so Activity stats cards are non-zero. */
function activityTimestamp(preferRecent = false): Timestamp {
    if (preferRecent || Math.random() > 0.55) {
        // Today or within the last 6 days (this week / recent)
        const hoursAgo = randomInt(0, 24 * 6);
        const date = new Date();
        date.setHours(date.getHours() - hoursAgo);
        return Timestamp.fromDate(date);
    }
    return Timestamp.fromDate(faker.date.past({ years: 1 }));
}

function generateNoteContent(template: (typeof NOTE_TEMPLATES)[0]): {
    title: string;
    content: string;
    tags: string[];
} {
    const replacements: Record<string, string> = {
        topic: faker.company.buzzPhrase(),
        date: faker.date.recent().toLocaleDateString(),
        person1: faker.person.fullName(),
        person2: faker.person.fullName(),
        person3: faker.person.fullName(),
        paragraph: faker.lorem.paragraph(),
        task1: faker.hacker.phrase(),
        task2: faker.hacker.phrase(),
        task3: faker.hacker.phrase(),
        day: faker.date.weekday(),
        bookTitle: faker.lorem.words(3),
        author: faker.person.fullName(),
        takeaway1: faker.lorem.sentence(),
        takeaway2: faker.lorem.sentence(),
        takeaway3: faker.lorem.sentence(),
        quote: faker.lorem.sentence(),
        rating: String(randomInt(3, 5)),
        projectName: faker.company.catchPhrase(),
        sentence: faker.lorem.sentence(),
        startDate: faker.date.soon().toLocaleDateString(),
        endDate: faker.date.future().toLocaleDateString(),
        milestone1: faker.lorem.sentence(),
        milestone2: faker.lorem.sentence(),
        milestone3: faker.lorem.sentence(),
        milestone4: faker.lorem.sentence(),
        resource1: faker.commerce.product(),
        resource2: faker.commerce.product(),
        resource3: faker.commerce.product(),
        metric1: faker.lorem.sentence(),
        metric2: faker.lorem.sentence(),
        subject: faker.science.chemicalElement().name + " Studies",
        concept1: faker.science.chemicalElement().name,
        concept2: faker.science.chemicalElement().name,
        codeExample: `const ${faker.hacker.noun()} = ${faker.hacker.verb()}();`,
        question1: faker.lorem.sentence() + "?",
        question2: faker.lorem.sentence() + "?",
        url: faker.internet.url(),
        goal1: faker.hacker.phrase(),
        goal2: faker.hacker.phrase(),
        goal3: faker.hacker.phrase(),
        gratitude1: faker.lorem.sentence(),
        gratitude2: faker.lorem.sentence(),
        gratitude3: faker.lorem.sentence(),
        dishName: faker.food.dish(),
        prepTime: String(randomInt(10, 30)),
        cookTime: String(randomInt(15, 60)),
        servings: String(randomInt(2, 6)),
        ingredient1: faker.food.ingredient(),
        ingredient2: faker.food.ingredient(),
        ingredient3: faker.food.ingredient(),
        ingredient4: faker.food.ingredient(),
        ingredient5: faker.food.ingredient(),
        step1: faker.lorem.sentence(),
        step2: faker.lorem.sentence(),
        step3: faker.lorem.sentence(),
        step4: faker.lorem.sentence(),
        variation1: faker.lorem.sentence(),
        variation2: faker.lorem.sentence(),
    };

    let title = template.title;
    let content = template.content;

    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{${key}\\}`, "g");
        title = title.replace(regex, value);
        content = content.replace(regex, value);
    }

    // Add some random additional tags
    const additionalTags = faker.helpers.arrayElements(
        ["important", "reference", "draft", "review", "archive", "favorite"],
        randomInt(0, 2),
    );

    return {
        title,
        content,
        tags: [...template.tags, ...additionalTags],
    };
}

// Seed functions
async function seedUsers(): Promise<void> {
    console.log("\n📝 Creating users...");

    const users = [];

    // Create admin users
    for (let i = 0; i < NUM_ADMINS; i++) {
        const email = `admin${i + 1}@sentientarchive.local`;
        const password = "Admin123!";
        const displayName = `Admin User ${i + 1}`;

        users.push({
            email,
            password,
            displayName,
            role: "admin" as const,
        });
    }

    // Create client users
    for (let i = 0; i < NUM_CLIENTS; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
        const password = "Client123!";
        const displayName = `${firstName} ${lastName}`;

        users.push({
            email,
            password,
            displayName,
            role: "client" as const,
        });
    }

    // Create users in Auth and Firestore
    for (const user of users) {
        try {
            // Create auth user
            const authUser = await auth.createUser({
                email: user.email,
                password: user.password,
                displayName: user.displayName,
                emailVerified: true,
            });

            // Set custom claims for role
            await auth.setCustomUserClaims(authUser.uid, { role: user.role });

            // Create Firestore user document
            const now = Timestamp.now();
            const initialTokens = user.role === "admin" ? 10000 : 1000;

            await db
                .collection("users")
                .doc(authUser.uid)
                .set({
                    uid: authUser.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: faker.image.avatar(),
                    role: user.role,
                    isActive: true,
                    tokenBalance: initialTokens,
                    totalTokensGranted: initialTokens,
                    totalTokensSpent: 0,
                    createdAt: now,
                    lastLoginAt: now,
                    updatedAt: now,
                    preferences: {
                        language: faker.helpers.arrayElement(["en", "es"]),
                        theme: faker.helpers.arrayElement(["light", "dark"]),
                        notificationsEnabled: true,
                    },
                });

            createdUsers.push({
                email: user.email,
                password: user.password,
                uid: authUser.uid,
                role: user.role,
                displayName: user.displayName,
            });

            console.log(`  ✓ Created ${user.role}: ${user.email}`);
        } catch (error) {
            console.error(`  ✗ Failed to create ${user.email}:`, error);
        }
    }
}

async function seedFolders(): Promise<Map<string, string[]>> {
    console.log("\n📁 Creating folders...");

    const folderIdsByUser = new Map<string, string[]>();
    const clientUsers = createdUsers.filter((u) => u.role === "client");
    const folderNames = [
        "Work",
        "Personal",
        "Research",
        "Projects",
        "Archive",
        "Ideas",
        "Learning",
        "Recipes",
    ];

    for (const user of clientUsers) {
        const folderCount = randomInt(MIN_FOLDERS_PER_USER, MAX_FOLDERS_PER_USER);
        const names = faker.helpers.arrayElements(folderNames, folderCount);
        const ids: string[] = [];

        for (const name of names) {
            const folderRef = db
                .collection("users")
                .doc(user.uid)
                .collection("folders")
                .doc();

            const createdAt = activityTimestamp(Math.random() > 0.5);
            await folderRef.set({
                id: folderRef.id,
                name,
                parentId: null,
                createdAt,
                updatedAt: createdAt,
            });
            ids.push(folderRef.id);
        }

        folderIdsByUser.set(user.uid, ids);
        console.log(`  ✓ Created ${ids.length} folders for ${user.email}`);
    }

    return folderIdsByUser;
}

async function seedNotes(
    folderIdsByUser: Map<string, string[]>,
): Promise<void> {
    console.log("\n📚 Creating notes...");

    const totalNotes = randomInt(MIN_NOTES, MAX_NOTES);
    let notesCreated = 0;

    // Distribute notes among client users
    const clientUsers = createdUsers.filter((u) => u.role === "client");

    for (const user of clientUsers) {
        const userNoteCount = Math.ceil(totalNotes / clientUsers.length);
        const userFolders = folderIdsByUser.get(user.uid) ?? [];

        for (let i = 0; i < userNoteCount && notesCreated < totalNotes; i++) {
            const template = faker.helpers.arrayElement(NOTE_TEMPLATES);
            const { title, content, tags } = generateNoteContent(template);

            const createdAt = activityTimestamp(i < 2);
            // Ensure some notes emit Activity "Note updated" events (>1 min after create)
            const updatedAt =
                Math.random() > 0.4
                    ? Timestamp.fromDate(
                          new Date(
                              createdAt.toDate().getTime() +
                                  randomInt(2, 48) * 60 * 60 * 1000,
                          ),
                      )
                    : createdAt;

            const folderId =
                userFolders.length > 0 && Math.random() > 0.35
                    ? faker.helpers.arrayElement(userFolders)
                    : null;

            const noteRef = db
                .collection("users")
                .doc(user.uid)
                .collection("notes")
                .doc();

            await noteRef.set({
                id: noteRef.id,
                userId: user.uid,
                title,
                content,
                excerpt: content.slice(0, 200),
                folderId,
                tags,
                aiTags: faker.helpers.arrayElements(
                    [
                        "technology",
                        "business",
                        "personal",
                        "creative",
                        "reference",
                        "learning",
                    ],
                    randomInt(1, 3),
                ),
                summary: Math.random() > 0.5 ? faker.lorem.paragraph() : null,
                flashcards:
                    Math.random() > 0.7
                        ? Array.from({ length: randomInt(2, 5) }, () => ({
                              front: faker.lorem.sentence(),
                              back: faker.lorem.paragraph(),
                          }))
                        : null,
                createdAt,
                updatedAt,
                viewedAt: updatedAt,
                isPinned: Math.random() > 0.9,
                isArchived: Math.random() > 0.95,
                sourceFile: null,
            });

            notesCreated++;
        }

        console.log(
            `  ✓ Created ${Math.min(userNoteCount, totalNotes)} notes for ${user.email}`,
        );
    }

    console.log(`  Total notes created: ${notesCreated}`);
}

/**
 * Write a transaction to both:
 * - top-level `transactions` (Activity API + token.service)
 * - `users/{uid}/transactions` (web Token Management page)
 */
async function writeTransaction(data: {
    userId: string;
    type: "grant" | "deduction";
    amount: number;
    operation: string;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: Timestamp;
    description: string;
    grantedBy?: string;
}): Promise<void> {
    const topLevelRef = db.collection("transactions").doc();
    const userSubRef = db
        .collection("users")
        .doc(data.userId)
        .collection("transactions")
        .doc(topLevelRef.id);

    const payload = {
        id: topLevelRef.id,
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        operation: data.operation,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        createdAt: data.createdAt,
        description: data.description,
        ...(data.grantedBy ? { grantedBy: data.grantedBy } : {}),
    };

    await Promise.all([topLevelRef.set(payload), userSubRef.set(payload)]);
}

async function seedTransactions(): Promise<void> {
    console.log("\n💰 Creating transactions...");

    const clientUsers = createdUsers.filter((u) => u.role === "client");
    const adminUser = createdUsers.find((u) => u.role === "admin");

    for (const user of clientUsers) {
        const transactionCount = randomInt(
            MIN_TRANSACTIONS_PER_USER,
            MAX_TRANSACTIONS_PER_USER,
        );
        let currentBalance = 1000; // Initial balance

        // First transaction: initial grant (historical)
        await writeTransaction({
            userId: user.uid,
            type: "grant",
            amount: 1000,
            operation: "admin_grant",
            balanceBefore: 0,
            balanceAfter: 1000,
            createdAt: Timestamp.fromDate(faker.date.past({ years: 1 })),
            description: "Welcome bonus - initial token grant",
            grantedBy: adminUser?.uid,
        });

        // Ensure at least one AI op today and one grant this week for Activity stats
        const todayAiCost = 10;
        await writeTransaction({
            userId: user.uid,
            type: "deduction",
            amount: todayAiCost,
            operation: "summarize",
            balanceBefore: currentBalance,
            balanceAfter: currentBalance - todayAiCost,
            createdAt: activityTimestamp(true),
            description: "summarize operation",
        });
        currentBalance -= todayAiCost;

        // Random transactions
        for (let i = 0; i < transactionCount - 1; i++) {
            type OperationType = "summarize" | "autoTag" | "flashcards" | "ragQuery";
            const operation: OperationType = faker.helpers.arrayElement([
                "summarize",
                "autoTag",
                "flashcards",
                "ragQuery",
            ]);

            const costs: Record<OperationType, number> = {
                summarize: 10,
                autoTag: 5,
                flashcards: 15,
                ragQuery: 20,
            };

            const cost = costs[operation];
            const balanceBefore = currentBalance;
            currentBalance -= cost;

            if (currentBalance < 0) {
                // Add a grant if balance goes negative
                const grantAmount = randomInt(100, 500);
                await writeTransaction({
                    userId: user.uid,
                    type: "grant",
                    amount: grantAmount,
                    operation: "admin_grant",
                    balanceBefore: balanceBefore - cost,
                    balanceAfter: balanceBefore - cost + grantAmount,
                    createdAt: activityTimestamp(true),
                    description: "Token replenishment",
                    grantedBy: adminUser?.uid,
                });
                currentBalance = balanceBefore - cost + grantAmount;
                continue;
            }

            await writeTransaction({
                userId: user.uid,
                type: "deduction",
                amount: cost,
                operation,
                balanceBefore,
                balanceAfter: currentBalance,
                createdAt: activityTimestamp(i < 2),
                description: `${operation} operation`,
            });
        }

        // Update user's final balance
        await db.collection("users").doc(user.uid).update({
            tokenBalance: currentBalance,
            totalTokensSpent: 1000 - currentBalance,
        });

        console.log(
            `  ✓ Created ${transactionCount + 1} transactions for ${user.email}`,
        );
    }
}

async function seedSystemConfig(): Promise<void> {
    console.log("\n⚙️ Creating system configuration...");

    const adminUser = createdUsers.find((u) => u.role === "admin");

    await db
        .collection("system_config")
        .doc("settings")
        .set({
            ai: {
                model: "gemini-3.5-flash",
                maxTokensPerRequest: 2048,
                temperature: 1.0,
                thinkingLevel: "low",
                thinkingBudget: 0,
                systemPrompts: {
                    summarize:
                        "You are a helpful assistant that summarizes notes concisely while preserving key information.",
                    autoTag:
                        "You are a helpful assistant that generates relevant tags for notes based on their content.",
                    flashcards:
                        "You are a helpful assistant that creates educational flashcards from note content.",
                    ragQuery:
                        "You are a helpful assistant that answers questions based on the user's notes.",
                },
            },
            tokens: {
                initialGrant: {
                    production: 25,
                    development: 50,
                    staging: 40,
                    local: 50,
                },
                costs: {
                    summarize: 5,
                    autoTag: 3,
                    flashcards: 8,
                    ragQuery: 10,
                },
                maxPerOperation: 100,
            },
            features: {
                summarizeEnabled: true,
                autoTagEnabled: true,
                flashcardsEnabled: true,
                ragQueryEnabled: true,
                fileExtractionEnabled: true,
            },
            fileUpload: {
                maxSizeBytes: 10485760, // 10MB
                allowedTypes: ["application/pdf", "text/plain", "text/markdown"],
                allowedExtensions: [".pdf", ".txt", ".md"],
            },
            rateLimits: {
                aiRequestsPerHour: 20,
                fileExtractionsPerDay: 10,
            },
            lastUpdatedBy: adminUser?.uid ?? "system",
            lastUpdatedAt: Timestamp.now(),
            version: 1,
        });

    console.log("  ✓ Created system configuration");
}

function printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 SEED COMPLETE!");
    console.log("=".repeat(60));

    console.log("\n📋 TEST CREDENTIALS:");
    console.log("-".repeat(60));

    console.log("\n🔐 ADMIN ACCOUNTS:");
    createdUsers
        .filter((u) => u.role === "admin")
        .forEach((u) => {
            console.log(`  Email:    ${u.email}`);
            console.log(`  Password: ${u.password}`);
            console.log(`  UID:      ${u.uid}`);
            console.log("");
        });

    console.log("👤 CLIENT ACCOUNTS:");
    createdUsers
        .filter((u) => u.role === "client")
        .forEach((u) => {
            console.log(`  ${u.displayName}`);
            console.log(`    Email:    ${u.email}`);
            console.log(`    Password: ${u.password}`);
            console.log("");
        });

    console.log("-".repeat(60));
    console.log("\n📊 SUMMARY:");
    console.log(`  Total Users:  ${createdUsers.length}`);
    console.log(
        `  - Admins:     ${createdUsers.filter((u) => u.role === "admin").length}`,
    );
    console.log(
        `  - Clients:    ${createdUsers.filter((u) => u.role === "client").length}`,
    );
    console.log("\n🌐 EMULATOR URLS:");
    console.log("  Emulator UI:  http://localhost:4000");
    console.log("  Auth:         http://localhost:9099");
    console.log("  Firestore:    http://localhost:8081");
    console.log("  Functions:    http://localhost:5001");
    console.log("  Storage:      http://localhost:9199");
    console.log("\n" + "=".repeat(60));
}

// Main execution
async function main(): Promise<void> {
    console.log("🚀 Starting Firebase Emulator Seed...");
    console.log(`   Firestore: ${FIRESTORE_EMULATOR_HOST}`);
    console.log(`   Auth: ${FIREBASE_AUTH_EMULATOR_HOST}`);

    try {
        await seedUsers();
        const folderIdsByUser = await seedFolders();
        await seedNotes(folderIdsByUser);
        await seedTransactions();
        await seedSystemConfig();
        printSummary();
    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        process.exit(1);
    }
}

void main();
