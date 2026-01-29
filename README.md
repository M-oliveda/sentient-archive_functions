# 🧠 SentientArchive Functions - AI-Powered Backend API

> **A serverless backend API for the SentientArchive Personal Knowledge Base, built with
> Firebase Cloud Functions, Node.js 24, TypeScript, and Google Gemini AI.**

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [License](#license)

## Overview

SentientArchive Functions is the serverless backend API for the SentientArchive
ecosystem. It provides secure, scalable endpoints for file content extraction,
AI-powered knowledge management, token economy management, and administrative
operations.

### This Repository Contains

- 🔥 **Firebase Cloud Functions:** Serverless HTTP endpoints (Gen 2)
- 📄 **File Content Extraction:** PDF/TXT/MD text extraction for note creation
- 🤖 **AI Integration:** Google Gemini Flash API for text generation
- 🪙 **Token Economy:** Resource-constrained quota system
- 🔐 **Security:** Role-based access control (RBAC) and authentication
- 📊 **Analytics:** Usage tracking and cost monitoring
- 🗄️ **Data Management:** Firestore operations and transactions

### Related Repository

This backend works in conjunction with the frontend application:

- **Frontend Repository:**
  [`m-oliveda/sentient-archive_web`](https://github.com/m-oliveda/sentient-archive_web)

## Key Features

### 1. File Content Extraction

| Endpoint                   | Token Cost | Description                        |
| :------------------------- | :--------- | :--------------------------------- |
| **POST /v1/notes/extract** | 0 tokens   | Extract text from PDF/TXT/MD files |

**Supported file types:**

- **PDF:** Extract text using pdf-parse library
- **TXT:** Plain text extraction
- **MD:** Markdown extraction

**File constraints:**

- Maximum file size: 10MB
- Files are processed in memory and immediately discarded
- Only extracted text is stored as note content

### 2. AI-Powered Endpoints

| Endpoint                   | Token Cost | Description                         |
| :------------------------- | :--------- | :---------------------------------- |
| **POST /v1/ai/summarize**  | 2 tokens   | Summarize note content using Gemini |
| **POST /v1/ai/autoTag**    | 1 token    | Generate semantic tags              |
| **POST /v1/ai/flashcards** | 3 tokens   | Create study flashcards             |
| **POST /v1/ai/ragQuery**   | 4 tokens   | Answer questions using RAG          |

### 3. Token Economy System

- **Atomic Deductions:** Firestore transactions ensure consistency
- **Transaction Ledger:** Immutable audit trail of all operations
- **Admin Minting:** Admins can grant tokens to users
- **Balance Checking:** Real-time balance queries
- **Initial Grants:**
  - Production: 20 tokens
  - Staging: 50 tokens
  - Development: 100 tokens
  - Local: 1000 tokens

### 4. Admin Operations

- **User Management:** CRUD operations for user accounts
- **Analytics:** Pre-aggregated usage statistics
- **System Configuration:** Dynamic AI model and prompt settings
- **Activity Logs:** Complete audit trail of AI and file extraction operations

### 5. Security & Performance

- **Firebase Authentication:** Token verification on every request
- **Role-Based Access Control:** Admin and Client roles
- **Rate Limiting:** Per-user hourly limits
- **Input Validation:** Zod schemas for all requests
- **File Validation:** MIME type and extension checking, size limits
- **Error Handling:** Graceful degradation and retry logic

## Technology Stack

### Core Technologies

| Category     | Technology               | Version | Purpose            |
| :----------- | :----------------------- | :------ | :----------------- |
| **Runtime**  | Node.js                  | 24 LTS  | JavaScript runtime |
| **Language** | TypeScript               | 5.7.x   | Type safety        |
| **Platform** | Firebase Cloud Functions | Gen 2   | Serverless compute |
| **Database** | Cloud Firestore          | Latest  | NoSQL database     |

### Backend Libraries

| Category            | Technology            | Version | Purpose                     |
| :------------------ | :-------------------- | :------ | :-------------------------- |
| **AI SDK**          | @google/generative-ai | Latest  | Gemini API client           |
| **File Processing** | pdf-parse             | Latest  | PDF text extraction         |
| **File Processing** | busboy                | Latest  | Multipart form parsing      |
| **Validation**      | Zod                   | 3.x     | Request/response validation |
| **Firebase Admin**  | firebase-admin        | Latest  | Server-side Firebase SDK    |
| **Date Utils**      | date-fns              | 4.x     | Date manipulation           |

### Development Tools

| Category             | Technology                   | Version | Purpose                    |
| :------------------- | :--------------------------- | :------ | :------------------------- |
| **Testing**          | Jest                         | 29.x    | Unit testing               |
| **Firebase Testing** | @firebase/rules-unit-testing | Latest  | Firestore emulator testing |
| **HTTP Testing**     | Supertest                    | Latest  | Integration testing        |
| **Linting**          | ESLint                       | 9.x     | Code quality               |
| **Formatting**       | Prettier                     | 3.x     | Code formatting            |
| **Git Hooks**        | Husky                        | Latest  | Pre-commit checks          |
| **Container**        | Docker                       | 27.x    | Firebase emulators         |

## API Endpoints

### Authentication

All endpoints require Firebase ID Token in the `Authorization` header:

```text
Authorization: Bearer <firebase_id_token>
```

### Response Format

```typescript
// Success
{
  success: true,
  data: { ... },
  message?: string
}

// Error
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: object
  }
}
```

### File Extraction Endpoint

#### POST `/v1/notes/extract`

Extract text content from uploaded files and create a new note.

**Token Cost:** 0 tokens (free feature)

**Request:**

```text
Content-Type: multipart/form-data

file: <binary data>
```

**Constraints:**

- **Max file size:** 10MB
- **Allowed types:** PDF, TXT, MD
- **Allowed MIME types:** `application/pdf`, `text/plain`, `text/markdown`
- **Allowed extensions:** `.pdf`, `.txt`, `.md`

**Response:**

```json
{
  "success": true,
  "data": {
    "noteId": "abc123",
    "title": "Document Title",
    "content": "Extracted text content from the file...",
    "excerpt": "Extracted text content from the file... (first 200 chars)",
    "sourceFile": {
      "name": "document.pdf",
      "type": "pdf",
      "size": 1048576,
      "extractedAt": "2025-12-29T12:00:00Z"
    },
    "createdAt": "2025-12-29T12:00:00Z"
  }
}
```

**Important Notes:**

- Files are **NEVER** stored permanently
- Files exist only in memory during extraction
- Only extracted text is saved as note content
- File metadata is retained for user reference

**Example cURL:**

```bash
curl -X POST http://localhost:5001/demo-sentient-archive/us-central1/v1/notes/extract \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@document.pdf"
```

### AI Endpoints

#### POST `/v1/ai/summarize`

Summarize note content using Gemini AI.

**Token Cost:** 2 tokens

**Request Body:**

```json
{
  "noteId": "note123",
  "maxLength": 150
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": "This note discusses quantum computing fundamentals...",
    "tokensUsed": 2,
    "latencyMs": 1234,
    "balanceAfter": 18
  }
}
```

#### POST `/v1/ai/autoTag`

Generate semantic tags for a note.

**Token Cost:** 1 token

**Request Body:**

```json
{
  "noteId": "note123",
  "maxTags": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tags": ["quantum", "computing", "physics", "science"],
    "tokensUsed": 1,
    "latencyMs": 892,
    "balanceAfter": 17
  }
}
```

#### POST `/v1/ai/flashcards`

Generate flashcards from note content.

**Token Cost:** 3 tokens

**Request Body:**

```json
{
  "noteId": "note123",
  "count": 10,
  "difficulty": "medium"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "flashcards": [
      {
        "front": "What is a qubit?",
        "back": "The basic unit of quantum information..."
      }
    ],
    "tokensUsed": 3,
    "latencyMs": 1567,
    "balanceAfter": 14
  }
}
```

#### POST `/v1/ai/ragQuery`

Answer questions using Retrieval-Augmented Generation.

**Token Cost:** 4 tokens

**Request Body:**

```json
{
  "query": "What are the main principles of quantum computing?",
  "noteIds": ["note123", "note456"],
  "maxResults": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "answer": "The main principles of quantum computing include...",
    "sources": [
      {
        "noteId": "note123",
        "title": "Quantum Computing Basics",
        "relevanceScore": 0.95
      }
    ],
    "tokensUsed": 4,
    "latencyMs": 2134,
    "balanceAfter": 10
  }
}
```

### Token Endpoints

#### GET `/v1/tokens/balance`

Get user's current token balance.

**Response:**

```json
{
  "success": true,
  "data": {
    "balance": 10,
    "totalGranted": 20,
    "totalSpent": 10,
    "lastTransaction": {
      "type": "deduction",
      "amount": 2,
      "timestamp": "2025-12-28T12:00:00Z",
      "reason": "AI feature: summarize"
    }
  }
}
```

#### GET `/v1/tokens/history`

Get transaction history.

**Query Parameters:**

- `limit` (default: 50)
- `offset` (default: 0)
- `type` (optional: 'grant' | 'deduction')
- `startDate` (optional: ISO 8601)
- `endDate` (optional: ISO 8601)

#### POST `/v1/tokens/mint` (Admin Only)

Grant tokens to a user.

**Request Body:**

```json
{
  "userId": "user123",
  "amount": 50,
  "reason": "Monthly grant",
  "notes": "Premium user subscription"
}
```

### Admin Endpoints

#### GET `/v1/admin/analytics` (Admin Only)

Get system-wide analytics including file extraction statistics.

**Query Parameters:**

- `period` (optional: 'daily' | 'weekly' | 'monthly')
- `startDate` (optional: ISO 8601)
- `endDate` (optional: ISO 8601)

**Response includes:**

- Total AI requests by feature
- File extraction counts by type (PDF, TXT, MD)
- Token usage statistics
- User activity metrics

#### GET `/v1/admin/users` (Admin Only)

List and filter users.

#### PUT `/v1/admin/users/:userId` (Admin Only)

Update user details.

#### GET/POST `/v1/admin/config` (Admin Only)

Get or update system configuration including file upload settings.

### Error Codes

| Code                       | HTTP Status | Description                    |
| :------------------------- | :---------- | :----------------------------- |
| `UNAUTHENTICATED`          | 401         | Missing/invalid auth token     |
| `UNAUTHORIZED`             | 403         | Insufficient permissions       |
| `INSUFFICIENT_TOKENS`      | 402         | Not enough tokens              |
| `RATE_LIMIT_EXCEEDED`      | 429         | Rate limit exceeded            |
| `NOT_FOUND`                | 404         | Resource not found             |
| `INVALID_REQUEST`          | 400         | Validation failed              |
| `INVALID_FILE`             | 400         | File validation failed         |
| `FILE_TOO_LARGE`           | 413         | File exceeds size limit (10MB) |
| `UNSUPPORTED_FILE_TYPE`    | 415         | File type not supported        |
| `EXTRACTION_FAILED`        | 500         | File content extraction failed |
| `AI_API_ERROR`             | 502         | Gemini API error               |
| `INTERNAL_ERROR`           | 500         | Server error                   |
| `FILE_EXTRACTION_DISABLED` | 503         | Feature disabled by admin      |

## Getting Started

### Prerequisites

- **Node.js 24 (LTS)** - [Download](https://nodejs.org/)
- **npm 10.x** - Comes with Node.js
- **Docker Desktop 27.x** - [Download](https://www.docker.com/products/docker-desktop)
- **Docker Compose 2.x** - Included with Docker Desktop
- **Firebase CLI** - Install via: `npm install -g firebase-tools`
- **Git** - [Download](https://git-scm.com/)
- **Gemini API Key** - Get from
  [Google AI Studio](https://makersuite.google.com/app/apikey)

### Quick Start (5 Minutes)

**1. Clone the repository:**

```bash
git clone https://github.com/m-oliveda/sentient-archive_functions.git
cd sentient-archive_functions
```

**2. Install dependencies:**

```bash
npm install
```

**3. Configure environment:**

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
FUNCTIONS_EMULATOR=true
GCP_PROJECT_ID=demo-sentient-archive
```

**4. Start Firebase Emulators:**

```bash
docker compose up -d
```

**5. Seed test data:**

```bash
# Wait for emulators to be ready (about 10 seconds)
npm run seed
```

**6. Start development server:**

```bash
npm run dev
```

**7. Access the emulators:**

- **Emulator UI:** <http://localhost:4000>
- **Functions:** <http://localhost:5001>
- **Firestore:** <http://localhost:8080>
- **Auth:** <http://localhost:9099>

### Test the API

**Test Token Balance:**

```bash
curl -X GET http://localhost:5001/demo-sentient-archive/us-central1/v1/tokens/balance \
  -H "Authorization: Bearer <your_test_token>"
```

**Test File Extraction:**

```bash
curl -X POST http://localhost:5001/demo-sentient-archive/us-central1/v1/notes/extract \
  -H "Authorization: Bearer <your_test_token>" \
  -F "file=@sample.pdf"
```

## Development

### Available Scripts

```bash
# Development
npm run dev                  # Start functions in watch mode
npm run build                # Compile TypeScript to JavaScript
npm run serve                # Serve built functions locally

# Emulators
npm run emulators:start      # Start Firebase emulators
npm run emulators:stop       # Stop emulators
npm run emulators:logs       # View emulator logs
npm run emulators:reset      # Reset emulators (clear data)
npm run seed                 # Seed test data
npm run seed:fresh           # Reset and seed from scratch

# Testing
npm run test                 # Run tests once
npm run test:unit            # Run unit tests only
npm run test:integration     # Run integration tests only
npm run test:watch           # Watch mode for TDD
npm run test:coverage        # Generate coverage report
npm run test:emulator        # Run tests with emulators

# Code Quality
npm run lint                 # Run ESLint
npm run lint:fix             # Fix linting issues automatically
npm run format               # Format code with Prettier
npm run format:check         # Check if code is formatted
npm run type-check           # TypeScript type checking

# Deployment
npm run deploy:dev           # Deploy to development
npm run deploy:staging       # Deploy to staging
npm run deploy:prod          # Deploy to production
```

### Development Workflow

**1. Create a new feature:**

```bash
# Using GitFlow
git flow feature start file-extraction

# Make changes...
git add .

# Commit with Gitmoji (enforced by Husky)
git commit -m ":sparkles: Add PDF extraction endpoint"

# Run tests
npm run test
npm run lint

# Finish feature
git flow feature finish file-extraction
```

**Gitmoji Commit Examples:**

```bash
:sparkles: Add file extraction endpoint
:bug: Fix token deduction race condition
:memo: Update API documentation
:recycle: Refactor AI service
:white_check_mark: Add file extraction tests
:wrench: Configure Docker compose
:zap: Improve Firestore query performance
:lock: Add file size validation middleware
```

**2. Seed test data:**

The project includes a comprehensive seed script that populates the Firebase emulators
with realistic test data for development and testing.

```bash
# Start emulators (if not already running)
npm run emulators:start

# Wait for emulators to be ready (about 10-15 seconds)
# Then seed test data
npm run seed

# Or use the script directly
./scripts/run-seed.sh
```

**What gets seeded:**

- **2 Admin accounts** with elevated privileges
- **8 Client accounts** with standard user permissions
- **60-100 Notes** distributed across client users with realistic content
- **Transaction history** showing token grants and deductions
- **System configuration** with AI model settings and token costs

**Test Credentials (after seeding):**

```text
Admin Accounts:
  Email:    admin1@sentientarchive.local
  Password: Admin123!

  Email:    admin2@sentientarchive.local
  Password: Admin123!

Client Accounts:
  All client accounts use password: Client123!
  Emails are displayed in the seed output
```

**Seed Script Features:**

- ✅ Waits for emulators to be healthy before seeding
- ✅ Generates realistic data using Faker.js
- ✅ Creates proper Firestore structure with timestamps
- ✅ Sets up token economy with transaction history
- ✅ Displays credentials summary after completion
- ✅ Handles errors gracefully

**Persistent Data:**

When you stop the emulators gracefully, data is automatically exported:

```bash
# Stop emulators (triggers --export-on-exit)
npm run emulators:stop

# Or with Docker Compose
docker compose stop
```

The seeded data is saved to `./firebase/seed-data/` and will be automatically imported
on the next startup, so you don't need to re-seed every time.

**Reset and Re-seed:**

```bash
# Clear all data and seed fresh
npm run seed:fresh

# Or manually:
npm run emulators:reset  # Clears data and restarts
npm run seed             # Seeds fresh data
```

**3. Test with emulators:**

```bash
# Terminal 1: Start emulators
docker compose up

# Terminal 2: Run functions in watch mode
npm run dev

# Terminal 3: Run tests in watch mode
npm run test:watch

# Make changes, tests run automatically
```

**4. Before committing:**

```bash
# Husky pre-commit hook will automatically run:
# - ESLint
# - Prettier check
# - TypeScript type checking

# Husky commit-msg hook will validate Gitmoji format
```

### Environment Variables

First, copy the example environment file to create your own `.env` file:

```bash
cp .env.example .env
```

Then, edit the `.env` file in the root directory as needed:

```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Environment
NODE_ENV=development
FUNCTIONS_EMULATOR=true

# Firebase Project ID (for emulator)
GCP_PROJECT_ID=demo-sentient-archive
```

**Firebase Functions Config (for deployed environments):**

```bash
# Set config for each environment
firebase use dev
firebase functions:config:set gemini.api_key="YOUR_DEV_KEY"

firebase use staging
firebase functions:config:set gemini.api_key="YOUR_STAGING_KEY"

firebase use prod
firebase functions:config:set gemini.api_key="YOUR_PROD_KEY"
```

⚠️ **Security:** Never commit `.env` files or API keys to Git.

### Docker Compose

The `docker-compose.yml` file sets up Firebase emulators with persistent data and hot
reload support.

**Key Features:**

- Firebase Emulator Suite (Auth, Firestore, Functions)
- Persistent data storage
- Hot reload for source code changes
- Health checks
- Isolated network

**Manage emulators:**

```bash
# Start all services
docker compose up -d

# View logs (follow mode)
docker compose logs -f firebase-emulators

# Stop all services
docker compose down

# Restart services
docker compose restart firebase-emulators

# Rebuild container after Dockerfile changes
docker compose up -d --build

# Complete rebuild (no cache)
npm run emulators:rebuild

# Reset data (fresh start)
npm run emulators:reset

# Seed with test data
npm run seed

# Fresh start with seed data
npm run seed:fresh
```

**Seed Data:**

The seed script populates the emulators with realistic test data:

- **10 user accounts** (2 admins, 8 clients)
- **50-100 notes** with varied content
- **200+ transactions** (grants and deductions)
- **System configuration** with default settings

**Login credentials:**

- Admin: `admin@sentient.dev` / `Admin123!`
- User: `user1@sentient.dev` / `User123!`

See [MASTERPLAN.md Section 10.4-10.5](./MASTERPLAN.md#104-docker-compose-configuration)
for complete configuration details.

## Testing

### Test Strategy

We aim for **100% test coverage** on critical business logic:

- File extraction service
- Token service
- AI service
- Middleware (auth, admin, rate limiting)
- Input validation

### Running Tests

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode (recommended during development)
npm run test:watch

# Coverage report (requires 100% for production)
npm run test:coverage

# Run with emulators
npm run test:emulator
```

### Test Structure

```text
tests/
├── unit/
│   ├── services/
│   │   ├── file.service.test.ts     # NEW
│   │   ├── ai.service.test.ts
│   │   ├── token.service.test.ts
│   │   ├── rag.service.test.ts
│   │   └── analytics.service.test.ts
│   │
│   ├── extractors/                   # NEW
│   │   ├── pdf.extractor.test.ts
│   │   ├── txt.extractor.test.ts
│   │   └── md.extractor.test.ts
│   │
│   ├── middleware/
│   │   ├── auth.test.ts
│   │   ├── admin.test.ts
│   │   ├── rateLimit.test.ts
│   │   └── fileUpload.test.ts       # NEW
│   │
│   └── utils/
│       ├── validation.test.ts
│       ├── fileValidation.test.ts   # NEW
│       ├── gemini.test.ts
│       └── retry.test.ts
│
├── integration/
│   ├── notes.test.ts                # NEW - File extraction tests
│   ├── ai.test.ts
│   ├── tokens.test.ts
│   ├── admin.test.ts
│   └── auth.test.ts
│
├── fixtures/                        # NEW
│   ├── sample.pdf
│   ├── sample.txt
│   ├── sample.md
│   └── large-file.pdf               # >10MB for testing
│
└── setup.ts
```

### Example Tests

#### Unit Test: File Service

```typescript
// tests/unit/services/file.service.test.ts
import { describe, test, expect } from "@jest/globals";
import { fileService } from "@/services/file.service";
import * as fs from "fs";
import * as path from "path";

describe("FileService", () => {
  describe("validateFile", () => {
    test("accepts valid PDF file", () => {
      const result = fileService.validateFile(
        "document.pdf",
        "application/pdf",
        5 * 1024 * 1024,
      );

      expect(result.valid).toBe(true);
      expect(result.fileType).toBe("pdf");
    });

    test("rejects file exceeding size limit", () => {
      const result = fileService.validateFile(
        "large.pdf",
        "application/pdf",
        11 * 1024 * 1024,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("10MB");
    });

    test("rejects unsupported file type", () => {
      const result = fileService.validateFile("image.jpg", "image/jpeg", 1024);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported");
    });
  });

  describe("extractContent", () => {
    test("extracts text from PDF", async () => {
      const pdfBuffer = fs.readFileSync(
        path.join(__dirname, "../../fixtures/sample.pdf"),
      );

      const text = await fileService.extractContent(pdfBuffer, "pdf");

      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);
      expect(typeof text).toBe("string");
    });

    test("extracts text from TXT", async () => {
      const txtBuffer = Buffer.from("Hello World\nThis is a test.");

      const text = await fileService.extractContent(txtBuffer, "txt");

      expect(text).toBe("Hello World This is a test.");
    });

    test("extracts text from Markdown", async () => {
      const mdBuffer = Buffer.from("# Title\n\nSome **bold** text.");

      const text = await fileService.extractContent(mdBuffer, "md");

      expect(text).toContain("Title");
      expect(text).toContain("bold");
    });
  });
});
```

#### Integration Test: File Extraction

```typescript
// tests/integration/notes.test.ts
import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import * as path from "path";

describe("POST /v1/notes/extract", () => {
  test("successfully extracts PDF content", async () => {
    const token = "mock-firebase-id-token";
    const pdfPath = path.join(__dirname, "../fixtures/sample.pdf");

    const response = await request("http://localhost:5001")
      .post("/demo-sentient-archive/us-central1/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", pdfPath);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.noteId).toBeDefined();
    expect(response.body.data.content).toBeDefined();
    expect(response.body.data.sourceFile.type).toBe("pdf");
  });

  test("successfully extracts TXT content", async () => {
    const token = "mock-firebase-id-token";
    const txtPath = path.join(__dirname, "../fixtures/sample.txt");

    const response = await request("http://localhost:5001")
      .post("/demo-sentient-archive/us-central1/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", txtPath);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sourceFile.type).toBe("txt");
  });

  test("rejects file exceeding size limit", async () => {
    const token = "mock-firebase-id-token";
    const largePath = path.join(__dirname, "../fixtures/large-file.pdf");

    const response = await request("http://localhost:5001")
      .post("/demo-sentient-archive/us-central1/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", largePath);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  });

  test("rejects unsupported file type", async () => {
    const token = "mock-firebase-id-token";

    const response = await request("http://localhost:5001")
      .post("/demo-sentient-archive/us-central1/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake image"), { filename: "image.jpg" });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  test("returns 401 on missing auth token", async () => {
    const txtPath = path.join(__dirname, "../fixtures/sample.txt");

    const response = await request("http://localhost:5001")
      .post("/demo-sentient-archive/us-central1/v1/notes/extract")
      .attach("file", txtPath);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});
```

#### Unit Test: Token Service

```typescript
// tests/unit/services/token.service.test.ts
import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { tokenService } from "@/services/token.service";

describe("TokenService", () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-test",
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("deducts tokens correctly", async () => {
    await testEnv.firestore().collection("users").doc("user1").set({
      tokenBalance: 10,
      totalTokensSpent: 0,
    });

    const newBalance = await tokenService.deduct("user1", 2, "summarize");

    expect(newBalance).toBe(8);

    const userDoc = await testEnv.firestore().collection("users").doc("user1").get();
    expect(userDoc.data().tokenBalance).toBe(8);
    expect(userDoc.data().totalTokensSpent).toBe(2);
  });

  test("throws error on insufficient tokens", async () => {
    await testEnv.firestore().collection("users").doc("user2").set({
      tokenBalance: 1,
    });

    await expect(tokenService.deduct("user2", 2, "summarize")).rejects.toThrow(
      "INSUFFICIENT_TOKENS",
    );
  });

  test("grants tokens correctly (admin)", async () => {
    await testEnv.firestore().collection("users").doc("user3").set({
      tokenBalance: 10,
      totalTokensGranted: 20,
    });

    const newBalance = await tokenService.grant("user3", 50, "Monthly grant", "admin1");

    expect(newBalance).toBe(60);

    const userDoc = await testEnv.firestore().collection("users").doc("user3").get();
    expect(userDoc.data().tokenBalance).toBe(60);
    expect(userDoc.data().totalTokensGranted).toBe(70);
  });
});
```

## Deployment

### Firebase Cloud Functions

SentientArchive Functions are deployed to Firebase Cloud Functions (Gen 2).

### Deployment Environments

**Important:** Cloud Functions supports **4 environments** (not 5 like the web
repository) due to Firebase project limitations.

| Environment     | Branch Source | GCP Project                    | Deployment Trigger | Notes                       |
| :-------------- | :------------ | :----------------------------- | :----------------- | :-------------------------- |
| **Local**       | `feature/*`   | `demo-sentient-archive`        | Manual (emulator)  | Docker Compose + Emulators  |
| **Development** | `develop`     | `moliveda-gcloudprojects-dev`  | Auto (on push)     | Shared dev environment      |
| **Staging**     | `release/*`   | `moliveda-gcloudprojects-stg`  | Auto (on push)     | Pre-production testing      |
| **Production**  | `main`        | `moliveda-gcloudprojects-prod` | Manual Dispatch    | Live production environment |

**Why No Preview Environment?**

Unlike Cloud Run (used by the web repository), Cloud Functions cannot support ephemeral
preview environments because:

- Each deployment requires a Firebase project
- Firebase projects cannot be created/destroyed automatically
- Cost and quota implications
- Cold start times not ideal for temporary testing

**PR Testing Strategy:**

For pull request testing:

1. Test locally with emulators first (required)
2. Optionally deploy to Development with PR-specific function names (`api-pr-123`)
3. Clean up after PR merge

See [MASTERPLAN.md Section 10.6](./MASTERPLAN.md#106-pull-request-testing-strategy) for
detailed PR testing strategy.

### Manual Deployment

**1. Build the functions:**

```bash
npm run build
```

**2. Deploy to Firebase:**

```bash
# Login to Firebase
firebase login

# Deploy to development
firebase use dev
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Deploy to staging
firebase use staging
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Deploy to production
firebase use prod
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Automated Deployment (GitHub Actions)

Deployments are automated via GitHub Actions:

#### CI Workflow (Preview)

Runs on every pull request to `develop` or `main`:

- Linting
- Type checking
- Building
- Testing with emulators
- 100% coverage verification

#### Deploy Development

Triggers automatically on push to `develop`:

- Runs tests
- Builds functions
- Deploys to development environment

#### Deploy Staging

Triggers automatically on push to `release/*`:

- Runs full test suite
- Builds functions
- Deploys to staging environment

#### Deploy Production

Manual trigger from `main` branch:

- Requires 100% test coverage
- Runs full test suite
- Builds functions
- Deploys to production environment

**Required GitHub Secrets (per environment):**

Authentication uses **Workload Identity Federation** (no service account keys required).

```text
# All environments (development, staging, production)
GCP_PROJECT_ID                    # GCP Project ID
GCP_WORKLOAD_IDENTITY_PROVIDER    # Workload Identity Provider path
GCP_SERVICE_ACCOUNT               # Service account email for CI/CD
GEMINI_API_KEY                    # Gemini API key
```

**Setup Workload Identity Federation:**

1. Create a Workload Identity Pool in Google Cloud Console
2. Add a GitHub provider to the pool
3. Create a Service Account with required roles
4. Grant the Service Account access to the Workload Identity Pool
5. Add the secrets to each GitHub environment

### Environment URLs

- **Development:** `https://us-central1-moliveda-gcloudprojects-dev.cloudfunctions.net`
- **Staging:** `https://us-central1-moliveda-gcloudprojects-stg.cloudfunctions.net`
- **Production:** `https://us-central1-moliveda-gcloudprojects-prod.cloudfunctions.net`

### Firestore Setup

**1. Create Firestore database:**

```bash
# In Firebase Console, create Firestore database in 'nam5' region
```

**2. Deploy security rules:**

```bash
firebase deploy --only firestore:rules
```

**3. Deploy indexes:**

```bash
firebase deploy --only firestore:indexes
```

## Project Structure

```text
sentient-archive_functions/
├── firebase/
│   ├── Dockerfile                    # Firebase emulator container
│   ├── emulator-data/                # Persistent emulator data
│   └── seed-data.json                # Initial test data
│
├── src/
│   ├── index.ts                      # Function exports
│   │
│   ├── middleware/
│   │   ├── auth.ts                   # Authentication middleware
│   │   ├── admin.ts                  # Admin-only middleware
│   │   ├── rateLimit.ts              # Rate limiting
│   │   ├── fileUpload.ts             # File upload middleware (NEW)
│   │   └── errorHandler.ts           # Global error handler
│   │
│   ├── routes/
│   │   ├── notes.routes.ts           # File extraction endpoint (NEW)
│   │   ├── ai.routes.ts              # AI endpoints
│   │   ├── tokens.routes.ts          # Token endpoints
│   │   └── admin.routes.ts           # Admin endpoints
│   │
│   ├── services/
│   │   ├── file.service.ts           # File content extraction (NEW)
│   │   ├── extractors/               # File extractors (NEW)
│   │   │   ├── pdf.extractor.ts      # PDF text extraction
│   │   │   ├── txt.extractor.ts      # Plain text extraction
│   │   │   └── md.extractor.ts       # Markdown extraction
│   │   ├── ai.service.ts             # Gemini AI integration
│   │   ├── token.service.ts          # Token economy logic
│   │   ├── rag.service.ts            # RAG implementation
│   │   ├── analytics.service.ts      # Analytics aggregation
│   │   └── config.service.ts         # Configuration management
│   │
│   ├── utils/
│   │   ├── gemini.ts                 # Gemini API client
│   │   ├── firestore.ts              # Firestore helpers
│   │   ├── validation.ts             # Zod schemas
│   │   ├── fileValidation.ts         # File validation (NEW)
│   │   ├── logger.ts                 # Logging utility
│   │   └── retry.ts                  # Retry logic
│   │
│   └── types/
│       ├── api.ts                    # API type definitions
│       ├── user.ts                   # User types
│       ├── note.ts                   # Note types
│       ├── file.ts                   # File types (NEW)
│       ├── transaction.ts            # Transaction types
│       └── config.ts                 # Config types
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── file.service.test.ts  # (NEW)
│   │   │   ├── ai.service.test.ts
│   │   │   └── token.service.test.ts
│   │   ├── extractors/               # (NEW)
│   │   │   ├── pdf.extractor.test.ts
│   │   │   ├── txt.extractor.test.ts
│   │   │   └── md.extractor.test.ts
│   │   ├── middleware/
│   │   │   └── fileUpload.test.ts    # (NEW)
│   │   └── utils/
│   │       └── fileValidation.test.ts # (NEW)
│   │
│   ├── integration/
│   │   ├── notes.test.ts             # File extraction tests (NEW)
│   │   ├── ai.test.ts
│   │   ├── tokens.test.ts
│   │   └── admin.test.ts
│   │
│   ├── fixtures/                     # (NEW)
│   │   ├── sample.pdf
│   │   ├── sample.txt
│   │   ├── sample.md
│   │   └── large-file.pdf
│   │
│   └── setup.ts
│
├── scripts/
│   ├── seed-emulator.ts              # Seed test data
│   └── migrate-data.ts               # Data migrations
│
├── .husky/                           # (NEW)
│   ├── commit-msg                    # Gitmoji validation
│   └── pre-commit                    # Lint and format check
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI with 100% coverage check
│       ├── deploy-dev.yml            # Auto-deploy to dev
│       ├── deploy-staging.yml        # Auto-deploy to staging
│       └── deploy-prod.yml           # Manual deploy to prod
│
├── .dockerignore
├── .env.example                      # Environment template
├── .env
├── .eslintrc.cjs                     # ESLint configuration
├── .prettierrc.json                  # Prettier configuration
├── .gitignore
├── docker-compose.yml                # Docker setup
├── firebase.json                     # Firebase configuration
├── .firebaserc                       # Firebase project aliases
├── firestore.rules                   # Firestore security rules
├── firestore.indexes.json            # Firestore indexes
├── tsconfig.json                     # TypeScript configuration
├── package.json
├── README.md                         # This file
├── MASTERPLAN.md                     # Detailed architecture guide
└── LICENSE                           # GPL-2.0 license
```

## License

SentientArchive Functions is free software licensed under the **GNU General Public
License v2.0 (GPL-2.0)**.

### What This Means

✅ **You can:**

- Use the software for any purpose
- Study and modify the source code
- Share copies of the software
- Share your modifications

⚠️ **You must:**

- Include the original license and copyright notice
- Disclose your source code when distributing
- License your modifications under GPL-2.0
- Document your changes

❌ **You cannot:**

- Sublicense or relicense the software
- Hold the authors liable for damages

**Full License Text:** [LICENSE](./LICENSE)

### Third-Party Dependencies

This project uses various open-source libraries with compatible licenses:

- **Apache 2.0:** Firebase Admin SDK, Google Generative AI SDK
- **MIT License:** Zod, date-fns, pdf-parse, busboy, various npm packages
- **ISC License:** Various npm packages

All dependencies are compatible with GPL-2.0.

## Additional Resources

- **Detailed Architecture:** [MASTERPLAN.md](./MASTERPLAN.md)
