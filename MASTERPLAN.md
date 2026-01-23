# 🧠 SentientArchive

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [Security Model](#7-security-model)
8. [Token Economy System](#8-token-economy-system)
9. [AI Integration Strategy](#9-ai-integration-strategy)
10. [Development Environment](#10-development-environment)
11. [Testing Strategy](#11-testing-strategy)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Development Phases](#13-development-phases)

## 1. Executive Summary

**SentientArchive Functions** is the backend API for the Personal Knowledge Base (PKB)
system, built with Firebase Cloud Functions, TypeScript, and Google Gemini AI
integration.

### Key Features

- **Serverless Architecture:** Firebase Cloud Functions (Gen 2)
- **AI-Powered APIs:** Gemini Flash integration
- **Token Economy:** Resource-constrained quota system
- **Role-Based Access:** Admin and Client permissions
- **File Content Extraction:** PDF/TXT/MD text extraction for note creation
- **Production-Ready:** Complete error handling and logging

### Repository Information

```text
m-oliveda/sentient-archive_functions
├── Firebase Cloud Functions Gen 2
├── Node.js 24 + TypeScript
├── Gemini AI Integration
├── File Processing (PDF/TXT/MD)
└── Firestore as Database
```

### Business Value

- **For Users:** Fast, reliable AI-powered features with seamless file content
  extraction
- **For Admins:** Complete control over resources and costs
- **For Portfolio:** Demonstrates backend expertise and cloud architecture

## 2. Project Overview

### 2.1 Vision

Create a robust, scalable, and secure serverless backend that provides AI-powered
knowledge management features while maintaining cost control through a token economy
system. Enable seamless file content extraction to transform documents into searchable
notes.

### 2.2 Core Responsibilities

1. **Authentication & Authorization**
   - Verify Firebase ID tokens
   - Enforce role-based access control (RBAC)
   - Manage user sessions

2. **File Content Extraction**
   - Extract text from PDF files
   - Process TXT and MD files
   - Create notes from extracted content
   - Validate file types and sizes

3. **AI Operations**
   - Summarization
   - Auto-tagging
   - Flashcard generation
   - Knowledge Q&A (RAG)

4. **Token Management**
   - Deduct tokens for AI operations
   - Track transaction history
   - Admin token minting

5. **Admin Operations**
   - User management
   - Analytics aggregation
   - System configuration

6. **Data Management**
   - Firestore operations
   - Data validation
   - Audit logging

### 2.3 API Endpoints Overview

```text
/v1/notes/
└── POST /extract          - Extract content from file (PDF/TXT/MD)

/v1/ai/
├── POST /summarize        - Summarize note content (2 tokens)
├── POST /autoTag          - Generate tags (1 token)
├── POST /flashcards       - Create flashcards (3 tokens)
└── POST /ragQuery         - Answer questions (4 tokens)

/v1/tokens/
├── GET  /balance          - Get token balance
├── GET  /history          - Transaction history
└── POST /mint             - Admin: Grant tokens

/v1/admin/
├── GET  /analytics        - System analytics
├── GET  /users            - List users
├── PUT  /users/:id        - Update user
└── GET/POST /config       - System configuration
```

### 2.4 Non-Goals (Out of Scope)

- ❌ WebSocket or real-time streaming
- ❌ Long-term file storage (files processed then discarded)
- ❌ Email notifications
- ❌ Third-party API integrations (except Gemini)
- ❌ GraphQL API
- ❌ Background jobs or cron tasks (use Cloud Scheduler if needed)

## 3. Architecture

### 3.1 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND CLIENT                          │
│               (See web repository MASTERPLAN)               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS + Firebase ID Token
                            │ + File Upload (multipart/form-data)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          FIREBASE CLOUD FUNCTIONS (Gen 2)                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  HTTP Functions (Node.js 24 + TypeScript)            │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  Middleware Layer                               │ │ │
│  │  │  - authMiddleware: Verify token & load user    │ │ │
│  │  │  - adminMiddleware: Check admin role           │ │ │
│  │  │  - rateLimitMiddleware: Enforce rate limits    │ │ │
│  │  │  - fileUploadMiddleware: Handle multipart      │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  Route Handlers                                 │ │ │
│  │  │  - Notes Routes (/v1/notes/*)                  │ │ │
│  │  │  - AI Routes (/v1/ai/*)                        │ │ │
│  │  │  - Token Routes (/v1/tokens/*)                 │ │ │
│  │  │  - Admin Routes (/v1/admin/*)                  │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  Service Layer                                  │ │ │
│  │  │  - fileService: File content extraction        │ │ │
│  │  │  - aiService: Gemini API integration           │ │ │
│  │  │  - tokenService: Token economy logic           │ │ │
│  │  │  - ragService: Retrieval-augmented generation  │ │ │
│  │  │  - analyticsService: Aggregation logic         │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ Admin SDK
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   FIREBASE SERVICES                         │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │AUTHENTICATION │  │  FIRESTORE   │  │ TEMP STORAGE    │ │
│  │- Token Verify │  │  - NoSQL DB  │  │  - File Buffer  │ │
│  │- User Lookup  │  │  - Real-time │  │  - Immediate    │ │
│  │               │  │               │  │    Deletion     │ │
│  └───────────────┘  └──────────────┘  └─────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  GOOGLE GEMINI API                          │
│          Model: gemini-1.5-flash-latest                     │
│          - Text Generation                                  │
│          - JSON Mode                                        │
│          - Streaming (optional)                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 File Content Extraction Flow

```text
1. Client Upload
   └─▶ Multipart form-data with file
       └─▶ File types: PDF, TXT, MD
           └─▶ Max size: 10MB

2. Cloud Function Entry
   └─▶ authMiddleware validates token
       └─▶ fileUploadMiddleware parses multipart
           └─▶ Validate file type & size
               └─▶ Buffer file in memory

3. File Processing
   └─▶ Detect file type (MIME + extension)
       └─▶ Route to appropriate extractor:
           ├─▶ PDF: pdf-parse library
           ├─▶ TXT: Buffer.toString('utf-8')
           └─▶ MD: Buffer.toString('utf-8')
       └─▶ Extract raw text content
           └─▶ Clean & sanitize text

4. Note Creation
   └─▶ Generate title from filename
       └─▶ Create excerpt (first 200 chars)
           └─▶ Store in Firestore (users/{uid}/notes)
               └─▶ Delete file buffer immediately
                   └─▶ Return note data to client

5. Response
   └─▶ Return created note with:
       ├─▶ noteId
       ├─▶ title (from filename)
       ├─▶ content (extracted text)
       └─▶ metadata (file info, timestamps)

IMPORTANT: Files are NEVER stored permanently.
They exist only in memory during extraction, then discarded.
```

### 3.3 Folder Structure

```text
sentient-archive_functions/
├── firebase/
│   ├── Dockerfile                    # Firebase emulator container
│   └── emulator-data/                # Persistent emulator data
│
├── src/
│   ├── index.ts                      # Entry point & function exports
│   │
│   ├── middleware/
│   │   ├── auth.ts                   # Auth middleware
│   │   ├── admin.ts                  # Admin middleware
│   │   ├── rateLimit.ts              # Rate limiting
│   │   ├── fileUpload.ts             # Multipart file upload handler
│   │   └── errorHandler.ts           # Global error handler
│   │
│   ├── routes/
│   │   ├── notes.routes.ts           # File extraction endpoint
│   │   ├── ai.routes.ts              # AI endpoints
│   │   ├── tokens.routes.ts          # Token endpoints
│   │   └── admin.routes.ts           # Admin endpoints
│   │
│   ├── services/
│   │   ├── file.service.ts           # File content extraction
│   │   ├── extractors/
│   │   │   ├── pdf.extractor.ts      # PDF text extraction
│   │   │   ├── txt.extractor.ts      # Plain text extraction
│   │   │   └── md.extractor.ts       # Markdown extraction
│   │   ├── ai.service.ts             # Gemini integration
│   │   ├── token.service.ts          # Token economy
│   │   ├── rag.service.ts            # RAG logic
│   │   ├── analytics.service.ts      # Analytics
│   │   └── config.service.ts         # Configuration
│   │
│   ├── utils/
│   │   ├── gemini.ts                 # Gemini client
│   │   ├── firestore.ts              # Firestore helpers
│   │   ├── validation.ts             # Zod schemas
│   │   ├── logger.ts                 # Logging utility
│   │   └── fileValidation.ts         # File type/size validation
│   │
│   └── types/
│       ├── api.ts                    # API types
│       ├── user.ts                   # User types
│       ├── note.ts                   # Note types
│       ├── file.ts                   # File types
│       ├── transaction.ts            # Transaction types
│       └── config.ts                 # Config types
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── file.service.test.ts
│   │   │   ├── ai.service.test.ts
│   │   │   └── token.service.test.ts
│   │   ├── extractors/
│   │   │   ├── pdf.extractor.test.ts
│   │   │   ├── txt.extractor.test.ts
│   │   │   └── md.extractor.test.ts
│   │   └── utils/
│   │       ├── validation.test.ts
│   │       └── fileValidation.test.ts
│   │
│   ├── integration/
│   │   ├── notes.test.ts             # File extraction tests
│   │   ├── ai.test.ts
│   │   ├── tokens.test.ts
│   │   └── admin.test.ts
│   │
│   ├── fixtures/
│   │   ├── sample.pdf                # Test files
│   │   ├── sample.txt
│   │   └── sample.md
│   │
│   └── setup.ts
│
├── scripts/
│   ├── seed-emulator.ts              # Seed test data
│   └── migrate-data.ts               # Data migrations
│
├── .husky/
│   ├── commit-msg                    # Gitmoji validation
│   └── pre-commit                    # Lint and format check
│
├── .dockerignore
├── .env.example
├── .env
├── .eslintrc.cjs
├── .prettierrc.json
├── docker-compose.yml
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── tsconfig.json
├── package.json
├── README.md
├── LICENSE
├── MASTERPLAN.md
└── AGENTS.md
```

## 4. Technology Stack

### 4.1 Core Technologies

| Category     | Technology               | Version | Purpose            |
| :----------- | :----------------------- | :------ | :----------------- |
| **Runtime**  | Node.js                  | 24 LTS  | JavaScript runtime |
| **Language** | TypeScript               | 5.7.x   | Type safety        |
| **Platform** | Firebase Cloud Functions | Gen 2   | Serverless compute |
| **Database** | Cloud Firestore          | Latest  | NoSQL database     |

### 4.2 Backend Libraries

| Category            | Technology            | Version | Purpose                     |
| :------------------ | :-------------------- | :------ | :-------------------------- |
| **Validation**      | Zod                   | 3.x     | Request/response validation |
| **AI SDK**          | @google/generative-ai | Latest  | Gemini API client           |
| **Firebase Admin**  | firebase-admin        | Latest  | Server-side Firebase SDK    |
| **File Processing** | pdf-parse             | Latest  | PDF text extraction         |
| **File Processing** | busboy                | Latest  | Multipart form parsing      |
| **Date Utils**      | date-fns              | 4.x     | Date manipulation           |
| **HTTP Framework**  | express               | 4.x     | HTTP routing (optional)     |

### 4.3 Development Tools

| Category       | Technology                   | Version | Purpose            |
| :------------- | :--------------------------- | :------ | :----------------- |
| **Testing**    | Jest                         | 29.x    | Unit testing       |
| **Testing**    | @firebase/rules-unit-testing | Latest  | Firestore testing  |
| **Testing**    | Supertest                    | Latest  | HTTP testing       |
| **Linting**    | ESLint                       | 9.x     | Code quality       |
| **Formatting** | Prettier                     | 3.x     | Code formatting    |
| **Container**  | Docker                       | 27.x    | Firebase emulators |

## 5. Database Schema

### 5.1 Firestore Collections Overview

```text
sentient-archive-{env}/
│
├── users/                    # User accounts and profiles
│   └── {userId}/
│       ├── notes/            # Subcollection: User's notes
│       └── folders/          # Subcollection: Folder structure
│
├── transactions/             # Token transaction ledger
│   └── {transactionId}/
│
├── ai_requests/              # AI operation audit logs
│   └── {requestId}/
│
├── system_config/            # Global configuration
│   └── settings              # Single document
│
└── analytics/                # Pre-aggregated analytics
    ├── daily/
    └── monthly/
```

### 5.2 Collection: `users`

**Document ID:** Firebase Auth UID

```typescript
interface User {
  // Identity
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;

  // Role & Access
  role: "client" | "admin";
  isActive: boolean;

  // Token Economy
  tokenBalance: number;
  totalTokensGranted: number;
  totalTokensSpent: number;

  // Metadata
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  updatedAt: Timestamp;

  // Preferences
  preferences: {
    language: "en" | "es";
    theme: "light" | "dark";
    notificationsEnabled: boolean;
  };
}
```

### 5.3 Subcollection: `users/{userId}/notes`

```typescript
interface Note {
  id: string;
  userId: string;

  // Content
  title: string;
  content: string; // Markdown - can be from manual entry or file extraction
  excerpt: string; // First 200 chars

  // Organization
  folderId: string | null;
  tags: string[];
  aiTags: string[];

  // AI-Generated
  summary: string | null;
  flashcards: Flashcard[] | null;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  viewedAt: Timestamp;
  isPinned: boolean;
  isArchived: boolean;

  // File Source (if created from file extraction)
  sourceFile: {
    name: string;
    type: "pdf" | "txt" | "md";
    size: number; // in bytes
    extractedAt: Timestamp;
  } | null;
}

interface Flashcard {
  front: string;
  back: string;
}
```

**Note:** The `sourceFile` field indicates the note was created via file content
extraction. The original file is NOT stored - only metadata about it is retained for
user reference.

### 5.4 Collection: `system_config`

**Document ID:** `settings`

```typescript
interface SystemConfig {
  ai: {
    model: string;
    maxTokensPerRequest: number;
    temperature: number;
    systemPrompts: {
      summarize: string;
      autoTag: string;
      flashcards: string;
      ragQuery: string;
    };
  };
  tokens: {
    initialGrant: {
      production: number;
      development: number;
      staging: number;
      local: number;
    };
    costs: {
      summarize: number;
      autoTag: number;
      flashcards: number;
      ragQuery: number;
    };
    maxPerOperation: number;
  };
  features: {
    summarizeEnabled: boolean;
    autoTagEnabled: boolean;
    flashcardsEnabled: boolean;
    ragQueryEnabled: boolean;
    fileExtractionEnabled: boolean;
  };
  fileUpload: {
    maxSizeBytes: number; // 10MB = 10 * 1024 * 1024
    allowedTypes: string[]; // ['application/pdf', 'text/plain', 'text/markdown']
    allowedExtensions: string[]; // ['.pdf', '.txt', '.md']
  };
  rateLimits: {
    aiRequestsPerHour: number;
    fileExtractionsPerDay: number;
  };
  lastUpdatedBy: string;
  lastUpdatedAt: Timestamp;
  version: number;
}
```

## 6. API Specification

### 6.1 Base URLs

- **Local:** `http://localhost:5001/demo-sentient-archive/us-central1`
- **Development:** `https://us-central1-sentient-archive-dev.cloudfunctions.net`
- **Staging:** `https://us-central1-sentient-archive-staging.cloudfunctions.net`
- **Production:** `https://us-central1-sentient-archive-prod.cloudfunctions.net`

### 6.2 File Extraction Endpoint

#### POST `/v1/notes/extract`

**Token Cost:** 0 tokens (file extraction is free)

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

```typescript
{
  success: true,
  data: {
    noteId: string;
    title: string;              // Generated from filename
    content: string;            // Extracted text
    excerpt: string;            // First 200 chars
    sourceFile: {
      name: string;
      type: 'pdf' | 'txt' | 'md';
      size: number;
      extractedAt: string;      // ISO 8601
    };
    createdAt: string;
  }
}
```

### 6.3 Error Codes

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

## 7. Security Model

### 7.1 File Upload Security

```typescript
// src/middleware/fileUpload.ts
import Busboy from "busboy";

export function fileUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check content type
  const contentType = req.headers["content-type"];
  if (!contentType?.includes("multipart/form-data")) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Content-Type must be multipart/form-data",
      },
    });
  }

  // Limit file size at middleware level
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1, // Only one file per request
    },
  });

  let fileTooLarge = false;

  busboy.on("filesLimit", () => {
    fileTooLarge = true;
  });

  busboy.on("file", (fieldname, file, info) => {
    file.on("limit", () => {
      fileTooLarge = true;
      file.resume(); // Drain file stream
    });
  });

  busboy.on("finish", () => {
    if (fileTooLarge) {
      return res.status(413).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "File size exceeds 10MB limit",
        },
      });
    }
    next();
  });

  req.pipe(busboy);
}
```

### 7.2 File Validation

```typescript
// src/utils/fileValidation.ts
export interface FileValidationResult {
  valid: boolean;
  fileType?: "pdf" | "txt" | "md";
  error?: string;
}

export function validateFile(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): FileValidationResult {
  // Check file size
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (sizeBytes > MAX_SIZE) {
    return {
      valid: false,
      error: "File size exceeds 10MB limit",
    };
  }

  // Extract file extension
  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();

  // Validate by MIME type and extension
  const allowedTypes = {
    pdf: {
      mimes: ["application/pdf"],
      extensions: [".pdf"],
    },
    txt: {
      mimes: ["text/plain"],
      extensions: [".txt"],
    },
    md: {
      mimes: ["text/markdown", "text/x-markdown"],
      extensions: [".md", ".markdown"],
    },
  };

  for (const [type, config] of Object.entries(allowedTypes)) {
    if (config.mimes.includes(mimeType) || config.extensions.includes(extension)) {
      return {
        valid: true,
        fileType: type as "pdf" | "txt" | "md",
      };
    }
  }

  return {
    valid: false,
    error: "Unsupported file type. Only PDF, TXT, and MD files are allowed.",
  };
}
```

## 8. Token Economy System

### 8.1 Token Costs

| Feature         | Cost     | Rationale                      |
| :-------------- | :------- | :----------------------------- |
| File Extraction | 0 tokens | Free feature                   |
| Auto-Tagging    | 1 token  | Lightweight analysis           |
| Summarization   | 2 tokens | Medium generation              |
| Flashcards      | 3 tokens | Multiple Q&A pairs             |
| Knowledge Q&A   | 4 tokens | Context retrieval + generation |

### 8.2 Initial Grants

- **Production:** 20 tokens
- **Staging:** 50 tokens
- **Development:** 100 tokens
- **Local:** 1000 tokens

## 9. AI Integration Strategy

### 9.1 File Content Extraction Service

```typescript
// src/services/file.service.ts
import pdfParse from "pdf-parse";
import { validateFile } from "@/utils/fileValidation";

export class FileService {
  /**
   * Validate file before processing
   */
  validateFile(filename: string, mimeType: string, sizeBytes: number) {
    return validateFile(filename, mimeType, sizeBytes);
  }

  /**
   * Extract content from file buffer
   */
  async extractContent(
    buffer: Buffer,
    fileType: "pdf" | "txt" | "md",
  ): Promise<string> {
    switch (fileType) {
      case "pdf":
        return await this.extractPDF(buffer);
      case "txt":
        return this.extractTXT(buffer);
      case "md":
        return this.extractMD(buffer);
      default:
        throw new Error("Unsupported file type");
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return this.cleanText(data.text);
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from TXT
   */
  private extractTXT(buffer: Buffer): string {
    return this.cleanText(buffer.toString("utf-8"));
  }

  /**
   * Extract text from Markdown
   */
  private extractMD(buffer: Buffer): string {
    return this.cleanText(buffer.toString("utf-8"));
  }

  /**
   * Clean and sanitize extracted text
   */
  private cleanText(text: string): string {
    return (
      text
        // Remove excessive whitespace
        .replace(/\s+/g, " ")
        // Remove null bytes
        .replace(/\0/g, "")
        // Trim
        .trim()
    );
  }
}

export const fileService = new FileService();
```

## 10. Development Environment

### 10.1 Prerequisites

- Node.js 24 (LTS)
- npm 10.x
- Docker Desktop 27.x
- Docker Compose 2.x
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (`gcloud` CLI)
- Git

### 10.2 Husky Configuration (Git Hooks)

#### Installation

```bash
npm install --save-dev husky
npx husky init
```

#### Commit Message Hook (.husky/commit-msg)

```bash
#!/usr/bin/env sh

# Validate commit message format (Gitmoji)
commit_msg=$(cat "$1")
first_line=$(echo "$commit_msg" | head -n 1)

if ! echo "$first_line" | grep -qE '^:[a-z][a-z0-9_]*: '; then
  echo "❌ Error: Commit message must start with a gitmoji shortcode"
  echo ""
  echo "Format: :<shortcode>: <Message>"
  echo "Example: :sparkles: Add file extraction endpoint"
  exit 1
fi

message=$(echo "$first_line" | sed -E 's/^:[a-z][a-z0-9_]*: //')

if ! echo "$message" | grep -qE '^[A-Z]'; then
  echo "❌ Error: First letter after shortcode must be capitalized"
  exit 1
fi

if echo "$message" | grep -qE '\.$'; then
  echo "❌ Error: Commit message should not end with a period"
  exit 1
fi

echo "✅ Commit message format is valid"
```

### 10.3 Local Setup

**1. Clone repository:**

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
# Edit .env with your configuration
```

**4. Start Firebase Emulators with Docker Compose:**

```bash
# Start all services (emulators + functions)
docker compose up -d

# View logs
docker compose logs -f

# Access Emulator UI
open http://localhost:4000
```

**5. Seed test data:**

```bash
# Wait for emulators to be ready (about 10 seconds)
npm run seed

# Or use the script directly
./scripts/run-seed.sh
```

**6. Test the API:**

```bash
# Health check
curl http://localhost:5001/demo-sentient-archive/us-central1/api/health

# Get token balance (requires auth token from seeded user)
curl -H "Authorization: Bearer <token>" \
  http://localhost:5001/demo-sentient-archive/us-central1/api/v1/tokens/balance
```

**Access Points:**

- **Functions API:** `http://localhost:5001/demo-sentient-archive/us-central1/api`
- **Emulator UI:** `http://localhost:4000`
- **Firestore Emulator:** `localhost:8080`
- **Auth Emulator:** `localhost:9099`

### 10.4 Docker Compose Configuration

#### docker-compose.yml

```yaml
# docker-compose.yml
services:
  firebase-emulator:
    build:
      context: ./firebase
      dockerfile: Dockerfile
    container_name: sentient-archive-emulators
    ports:
      - "4000:4000" # Emulator UI
      - "5001:5001" # Functions Emulator
      - "8080:8080" # Firestore Emulator
      - "9099:9099" # Auth Emulator
      - "9199:9199" # Storage Emulator (future use)
    volumes:
      # Mount Firebase configuration
      - ./firebase.json:/app/firebase.json:ro
      - ./.firebaserc:/app/.firebaserc:ro
      - ./firestore.rules:/app/firestore.rules:ro
      - ./firestore.indexes.json:/app/firestore.indexes.json:ro

      # Mount source code for hot reload
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro

      # Persistent emulator data
      - ./firebase/emulator-data:/app/.firebase:rw

      # Node modules cache
      - firebase_node_modules:/app/node_modules
    environment:
      - FIREBASE_PROJECT_ID=demo-sentient-archive
      - FUNCTIONS_EMULATOR=true
      - FIRESTORE_EMULATOR_HOST=localhost:8080
      - FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_ENV=development
    networks:
      - sentient-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

volumes:
  firebase_node_modules:
    driver: local

networks:
  sentient-network:
    driver: bridge
```

#### firebase/Dockerfile

```dockerfile
# firebase/Dockerfile
FROM node:24-alpine

# Install Java (required for Firestore emulator)
RUN apk add --no-cache openjdk11-jre curl bash

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Set working directory
WORKDIR /app

# Copy package files
COPY ../package*.json ./

# Install dependencies
RUN npm ci

# Expose emulator ports
EXPOSE 4000 5001 8080 9099 9199

# Create directory for emulator data
RUN mkdir -p .firebase

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000 || exit 1

# Start Firebase emulators
CMD ["firebase", "emulators:start", "--import=./.firebase", "--export-on-exit"]
```

#### .dockerignore

```text
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
dist
build
coverage
*.log
.DS_Store
.vscode
.idea
tests
.github
README.md
MASTERPLAN.md
AGENTS.md
TODO.md
```

### 10.5 Seed Data for Local Testing

The seed data script populates the Firebase Emulator with realistic test data to
simulate a production-like environment.

#### What Gets Seeded

**1. User Accounts (10 users):**

- **2 Admin users:**
  - `admin@sentient.dev` (password: `Admin123!`)
  - `superadmin@sentient.dev` (password: `Super123!`)
  - High token balances (500-1000 tokens)

- **8 Client users:**
  - `user1@sentient.dev` through `user8@sentient.dev`
  - Password: `User123!` (for all)
  - Varied token balances (0-100 tokens)
  - Different registration dates (last 6 months)

**2. Notes (50-100 notes total):**

- **Manual notes:** Created by users directly
- **File-extracted notes:** Simulating PDF/TXT/MD extraction
- **Varied content:**
  - Short notes (100-300 words)
  - Medium notes (300-800 words)
  - Long notes (800-2000 words)
- **Folder organization:** 3-5 folders per user
- **Tags:** Mix of manual and AI-generated tags
- **AI content:** Some notes have summaries and flashcards

**3. Transaction History (200+ transactions):**

- **Token grants:** Admin granting tokens to users
- **Token deductions:** AI operations (summarize, autoTag, flashcards, ragQuery)
- **Realistic timestamps:** Spread over last 3 months
- **Varied amounts:** Following token cost structure

**4. AI Request Logs (150+ requests):**

- **Operation types:** All four AI operations
- **Success and failure cases:** ~90% success rate
- **Performance metrics:** Realistic execution times
- **Token consumption:** Matching transaction history

**5. System Configuration:**

- Default AI settings (Gemini Flash model)
- Token costs (as per MASTERPLAN)
- Feature flags (all enabled)
- File upload limits (10MB)
- Rate limits

#### scripts/seed-emulator.ts

```typescript
// scripts/seed-emulator.ts
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { faker } from "@faker-js/faker";

// Initialize Firebase Admin SDK for emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "demo-sentient-archive" });
const auth = getAuth(app);
const db = getFirestore(app);

// Seed configuration
const SEED_CONFIG = {
  adminUsers: 2,
  clientUsers: 8,
  notesPerUser: { min: 5, max: 12 },
  transactionsPerUser: { min: 10, max: 30 },
  aiRequestsPerUser: { min: 8, max: 20 },
};

// Token costs (matching MASTERPLAN)
const TOKEN_COSTS = {
  summarize: 2,
  autoTag: 1,
  flashcards: 3,
  ragQuery: 4,
};

async function seedUsers() {
  console.log("🌱 Seeding users...");

  const users = [];

  // Create admin users
  for (let i = 1; i <= SEED_CONFIG.adminUsers; i++) {
    const email = i === 1 ? "admin@sentient.dev" : "superadmin@sentient.dev";
    const password = i === 1 ? "Admin123!" : "Super123!";

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `Admin User ${i}`,
      emailVerified: true,
    });

    const userData = {
      uid: userRecord.uid,
      email,
      displayName: `Admin User ${i}`,
      photoURL: faker.image.avatar(),
      role: "admin",
      isActive: true,
      tokenBalance: faker.number.int({ min: 500, max: 1000 }),
      totalTokensGranted: faker.number.int({ min: 1000, max: 2000 }),
      totalTokensSpent: faker.number.int({ min: 100, max: 500 }),
      createdAt: Timestamp.fromDate(faker.date.past({ years: 1 })),
      lastLoginAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      preferences: {
        language: "en",
        theme: "dark",
        notificationsEnabled: true,
      },
    };

    await db.collection("users").doc(userRecord.uid).set(userData);
    users.push({ ...userData, password });
    console.log(`  ✅ Created admin: ${email}`);
  }

  // Create client users
  for (let i = 1; i <= SEED_CONFIG.clientUsers; i++) {
    const email = `user${i}@sentient.dev`;
    const password = "User123!";

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: faker.person.fullName(),
      emailVerified: true,
    });

    const userData = {
      uid: userRecord.uid,
      email,
      displayName: faker.person.fullName(),
      photoURL: faker.image.avatar(),
      role: "client",
      isActive: i !== 8, // Last user is inactive
      tokenBalance: faker.number.int({ min: 0, max: 100 }),
      totalTokensGranted: faker.number.int({ min: 50, max: 200 }),
      totalTokensSpent: faker.number.int({ min: 10, max: 150 }),
      createdAt: Timestamp.fromDate(faker.date.past({ years: 0.5 })),
      lastLoginAt: Timestamp.fromDate(faker.date.recent({ days: 7 })),
      updatedAt: Timestamp.now(),
      preferences: {
        language: faker.helpers.arrayElement(["en", "es"]),
        theme: faker.helpers.arrayElement(["light", "dark"]),
        notificationsEnabled: faker.datatype.boolean(),
      },
    };

    await db.collection("users").doc(userRecord.uid).set(userData);
    users.push({ ...userData, password });
    console.log(`  ✅ Created client: ${email}`);
  }

  return users;
}

async function seedNotes(users: any[]) {
  console.log("📝 Seeding notes...");

  const clientUsers = users.filter((u) => u.role === "client");

  for (const user of clientUsers) {
    const noteCount = faker.number.int(SEED_CONFIG.notesPerUser);

    for (let i = 0; i < noteCount; i++) {
      const isFileExtracted = faker.datatype.boolean();
      const hasAIContent = faker.datatype.boolean({ probability: 0.6 });

      const noteData = {
        id: faker.string.uuid(),
        userId: user.uid,
        title: faker.lorem.sentence({ min: 3, max: 8 }),
        content: faker.lorem.paragraphs({ min: 2, max: 10 }),
        excerpt: faker.lorem.sentence({ min: 10, max: 20 }),
        folderId: faker.helpers.arrayElement([
          null,
          `folder-${faker.number.int({ min: 1, max: 5 })}`,
        ]),
        tags: faker.helpers.arrayElements(
          ["research", "personal", "work", "study", "ideas"],
          { min: 0, max: 3 },
        ),
        aiTags: hasAIContent
          ? faker.helpers.arrayElements(["ai-generated", "summary", "important"], {
              min: 0,
              max: 2,
            })
          : [],
        summary: hasAIContent ? faker.lorem.paragraph() : null,
        flashcards: hasAIContent
          ? [
              { front: faker.lorem.sentence(), back: faker.lorem.sentence() },
              { front: faker.lorem.sentence(), back: faker.lorem.sentence() },
            ]
          : null,
        createdAt: Timestamp.fromDate(faker.date.past({ years: 0.3 })),
        updatedAt: Timestamp.fromDate(faker.date.recent({ days: 30 })),
        viewedAt: Timestamp.fromDate(faker.date.recent({ days: 7 })),
        isPinned: faker.datatype.boolean({ probability: 0.1 }),
        isArchived: faker.datatype.boolean({ probability: 0.05 }),
        sourceFile: isFileExtracted
          ? {
              name: faker.system.fileName(),
              type: faker.helpers.arrayElement(["pdf", "txt", "md"]),
              size: faker.number.int({ min: 1024, max: 1024 * 1024 * 5 }),
              extractedAt: Timestamp.fromDate(faker.date.past({ years: 0.3 })),
            }
          : null,
      };

      await db
        .collection("users")
        .doc(user.uid)
        .collection("notes")
        .doc(noteData.id)
        .set(noteData);
    }

    console.log(`  ✅ Created ${noteCount} notes for ${user.email}`);
  }
}

async function seedTransactions(users: any[]) {
  console.log("💰 Seeding transactions...");

  for (const user of users) {
    const txCount = faker.number.int(SEED_CONFIG.transactionsPerUser);

    for (let i = 0; i < txCount; i++) {
      const isGrant = faker.datatype.boolean({ probability: 0.3 });
      const operation = isGrant
        ? "grant"
        : faker.helpers.arrayElement([
            "summarize",
            "autoTag",
            "flashcards",
            "ragQuery",
          ]);

      const txData = {
        id: faker.string.uuid(),
        userId: user.uid,
        type: isGrant ? "grant" : "deduction",
        operation,
        amount: isGrant
          ? faker.number.int({ min: 10, max: 100 })
          : TOKEN_COSTS[operation as keyof typeof TOKEN_COSTS],
        balanceBefore: faker.number.int({ min: 0, max: 200 }),
        balanceAfter: 0, // Will be calculated
        metadata: isGrant
          ? {
              grantedBy: users.find((u) => u.role === "admin")?.uid,
              reason: "Monthly grant",
            }
          : {
              noteId: faker.string.uuid(),
              aiModel: "gemini-1.5-flash",
            },
        createdAt: Timestamp.fromDate(faker.date.past({ years: 0.25 })),
      };

      txData.balanceAfter = isGrant
        ? txData.balanceBefore + txData.amount
        : txData.balanceBefore - txData.amount;

      await db.collection("transactions").doc(txData.id).set(txData);
    }

    console.log(`  ✅ Created ${txCount} transactions for ${user.email}`);
  }
}

async function seedSystemConfig() {
  console.log("⚙️  Seeding system configuration...");

  const config = {
    ai: {
      model: "gemini-1.5-flash-latest",
      maxTokensPerRequest: 8192,
      temperature: 0.7,
      systemPrompts: {
        summarize: "You are a helpful assistant that creates concise summaries.",
        autoTag: "You are a helpful assistant that generates relevant tags.",
        flashcards: "You are a helpful assistant that creates educational flashcards.",
        ragQuery:
          "You are a helpful assistant that answers questions based on provided context.",
      },
    },
    tokens: {
      initialGrant: {
        production: 20,
        development: 100,
        staging: 50,
        local: 1000,
      },
      costs: TOKEN_COSTS,
      maxPerOperation: 10,
    },
    features: {
      summarizeEnabled: true,
      autoTagEnabled: true,
      flashcardsEnabled: true,
      ragQueryEnabled: true,
      fileExtractionEnabled: true,
    },
    fileUpload: {
      maxSizeBytes: 10 * 1024 * 1024,
      allowedTypes: ["application/pdf", "text/plain", "text/markdown"],
      allowedExtensions: [".pdf", ".txt", ".md"],
    },
    rateLimits: {
      aiRequestsPerHour: 100,
      fileExtractionsPerDay: 50,
    },
    lastUpdatedBy: "system",
    lastUpdatedAt: Timestamp.now(),
    version: 1,
  };

  await db.collection("system_config").doc("settings").set(config);
  console.log("  ✅ System configuration created");
}

async function main() {
  console.log("🚀 Starting seed process...\n");

  try {
    const users = await seedUsers();
    await seedNotes(users);
    await seedTransactions(users);
    await seedSystemConfig();

    console.log("\n✨ Seed completed successfully!\n");
    console.log("📊 Summary:");
    console.log(
      `  - Users: ${users.length} (${SEED_CONFIG.adminUsers} admins, ${SEED_CONFIG.clientUsers} clients)`,
    );
    console.log(`  - Notes: ~${users.length * 8} notes`);
    console.log(`  - Transactions: ~${users.length * 20} transactions`);
    console.log(`  - System config: ✅`);
    console.log("\n🔐 Login credentials:");
    console.log("  Admin: admin@sentient.dev / Admin123!");
    console.log("  User: user1@sentient.dev / User123!");
    console.log("\n🌐 Access Emulator UI: http://localhost:4000\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
```

#### scripts/run-seed.sh

```bash
#!/bin/bash

# scripts/run-seed.sh
set -e

echo "🔍 Checking if Firebase emulators are running..."

# Check if emulator UI is accessible
if ! curl -s http://localhost:4000 > /dev/null; then
  echo "❌ Firebase emulators are not running!"
  echo "   Please start them with: docker compose up -d"
  exit 1
fi

echo "✅ Emulators are running"
echo ""

# Wait a bit for emulators to be fully ready
echo "⏳ Waiting for emulators to be ready..."
sleep 5

# Run seed script
echo "🌱 Running seed script..."
npx ts-node scripts/seed-emulator.ts

echo ""
echo "✨ Done!"
```

#### package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "seed": "ts-node scripts/seed-emulator.ts",
    "seed:fresh": "docker compose down -v && docker compose up -d && sleep 10 && npm run seed",
    "emulators:start": "docker compose up -d",
    "emulators:stop": "docker compose down",
    "emulators:logs": "docker compose logs -f",
    "emulators:reset": "docker compose down -v && docker compose up -d"
  }
}
```

#### Usage

```bash
# Start fresh with seeded data
npm run seed:fresh

# Seed existing emulators
npm run seed

# Reset emulators (clears all data)
npm run emulators:reset

# View emulator logs
npm run emulators:logs
```

### 10.6 Pull Request Testing Strategy

Since Cloud Functions cannot support ephemeral preview environments like the web
repository (Cloud Run), we use an alternative approach for testing Pull Requests:

#### Why No Preview Environments?

**Cloud Functions Limitations:**

1. **Firebase Project Requirement:** Each deployment requires a Firebase project
2. **No Ephemeral Projects:** Cannot create/destroy Firebase projects automatically
3. **Cost Implications:** Each project has billing and quota implications
4. **Cold Start Times:** Not ideal for temporary testing
5. **No Built-in Auth:** Unlike Cloud Run, no HTTP Basic Auth support

#### Alternative: Development Environment Testing

**Approach:**

1. **Local Testing First (Required):**

   ```bash
   # Test PR changes locally with emulators
   git checkout pr-branch
   docker compose up -d
   npm run seed
   npm run test
   ```

2. **Optional Dev Deployment for Integration Testing:**

   ```bash
   # Deploy PR-specific function to dev environment
   firebase use sentient-archive-dev
   firebase deploy --only functions:api-pr-123

   # Test the PR function
   curl https://us-central1-sentient-archive-dev.cloudfunctions.net/api-pr-123/v1/health
   ```

3. **Cleanup After Merge:**

   ```bash
   # Delete PR-specific function
   firebase functions:delete api-pr-123 --force
   ```

**Best Practices:**

- ✅ Always test locally with emulators first
- ✅ Use comprehensive unit and integration tests
- ✅ Only deploy to dev for complex integration scenarios
- ✅ Clean up PR functions immediately after merge
- ✅ Document any dev deployments in PR comments
- ❌ Don't deploy every PR to dev (use sparingly)
- ❌ Don't leave orphaned functions in dev environment

## 11. Testing Strategy

### 11.1 Test Coverage Requirements

**Minimum 100% coverage** for critical business logic:

- File extraction service
- Token service
- AI service
- Middleware (auth, admin, rate limiting)
- Input validation

### 11.2 Example Tests

#### Integration Test: File Extraction Endpoint

```typescript
// tests/integration/notes.test.ts
import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "@/index";
import * as path from "path";

describe("POST /v1/notes/extract", () => {
  test("successfully extracts PDF content", async () => {
    const token = "mock-firebase-id-token";
    const pdfPath = path.join(__dirname, "../fixtures/sample.pdf");

    const response = await request(app)
      .post("/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", pdfPath);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.noteId).toBeDefined();
    expect(response.body.data.content).toBeDefined();
    expect(response.body.data.sourceFile.type).toBe("pdf");
  });

  test("rejects file exceeding size limit", async () => {
    const token = "mock-firebase-id-token";
    const largePath = path.join(__dirname, "../fixtures/large-file.pdf");

    const response = await request(app)
      .post("/v1/notes/extract")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", largePath);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  });
});
```

## 12. CI/CD Pipeline

### 12.1 GitHub Actions Workflows

```text
.github/workflows/
├── ci.yml                    # Run on all PRs
├── deploy-dev.yml            # Auto-deploy on develop
├── deploy-staging.yml        # Auto-deploy on release/*
└── deploy-prod.yml           # Manual deploy on main
```

**Note:** Unlike the web repository, there are no preview environment workflows due to
Firebase project limitations. See Section 10.6 for PR testing strategy.

### 12.2 CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format Check
        run: npm run format:check

      - name: Type Check
        run: npm run type-check

      - name: Build
        run: npm run build

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Check coverage is 100%
        run: |
          if npx --yes nyc@latest report --reporter=text-summary | grep -q '100%'; then
            echo "✅ 100% coverage achieved!"
          else
            echo "::error::Test coverage must be 100%."
            exit 1
          fi
```

### 12.3 Deploy Production Workflow

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Production

on:
  workflow_dispatch:
    branches: [main]

env:
  FIREBASE_PROJECT: sentient-archive-prod

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment:
      name: production
      url: https://us-central1-sentient-archive-prod.cloudfunctions.net

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: |
          docker compose up -d
          sleep 10
          npm run test:coverage
          docker compose down

      - name: Check 100% coverage
        run: |
          if npx --yes nyc@latest report --reporter=text-summary | grep -q '100%'; then
            echo "✅ 100% coverage achieved!"
          else
            echo "::error::Production requires 100% test coverage."
            exit 1
          fi

      - name: Build
        run: npm run build

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY_PROD }}

      - name: Deploy to Firebase Functions
        run: |
          firebase use ${{ env.FIREBASE_PROJECT }}
          firebase deploy --only functions --force
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY_PROD }}
```

### 12.4 Environments & Secrets Strategy

**Important:** Unlike the web repository (Cloud Run) which supports 5 environments
including ephemeral PR previews, Cloud Functions supports **4 environments** due to
Firebase project limitations.

| Environment     | Branch Source | Firebase Project           | Deployment Trigger | Notes                       |
| :-------------- | :------------ | :------------------------- | :----------------- | :-------------------------- |
| **Local**       | `feature/*`   | `demo-sentient-archive`    | Manual (emulator)  | Docker Compose + Emulators  |
| **Development** | `develop`     | `sentient-archive-dev`     | Auto (on push)     | Shared dev environment      |
| **Staging**     | `release/*`   | `sentient-archive-staging` | Auto (on push)     | Pre-production testing      |
| **Production**  | `main`        | `sentient-archive-prod`    | Manual Dispatch    | Live production environment |

#### Why No Preview Environment?

**Cloud Functions vs Cloud Run:**

The web repository uses Cloud Run, which supports:

- ✅ Ephemeral container deployments
- ✅ HTTP Basic Auth for protection
- ✅ Easy creation/deletion of services
- ✅ Cost-effective for temporary environments

Cloud Functions has limitations:

- ❌ Requires a Firebase project per deployment
- ❌ Cannot create/destroy Firebase projects automatically
- ❌ Each project has billing and quota implications
- ❌ Cold start times not ideal for temporary testing
- ❌ No built-in HTTP Basic Auth

**Alternative Approach:**

For PR testing, use the **Development environment** with function naming conventions:

- Deploy PR-specific functions: `api-pr-123`
- Test integration scenarios that can't be tested locally
- Clean up immediately after PR merge

See Section 10.6 for detailed PR testing strategy.

**Required GitHub Secrets (per Environment):**

**Development:**

- `GCP_SA_KEY_DEV`: Service Account JSON key
- `GEMINI_API_KEY_DEV`: Gemini API key

**Staging:**

- `GCP_SA_KEY_STAGING`: Service Account JSON key
- `GEMINI_API_KEY_STAGING`: Gemini API key

**Production:**

- `GCP_SA_KEY_PROD`: Service Account JSON key
- `GEMINI_API_KEY_PROD`: Gemini API key

## 13. Development Phases

### Phase 1: Project Initialization (Week 1)

- [x] Create GitHub repository
- [x] Set up GitFlow branching
- [x] Initialize Cloud Functions with TypeScript
- [x] Set up ESLint + Prettier
- [x] Configure Husky (pre-commit + commit-msg)
- [x] Create initial folder structure
- [x] SetUp `.gitignore` file

### Phase 2: Local Development Environment (Week 1)

- [ ] Create Docker Compose for Firebase Emulators
- [ ] Configure emulators (Auth, Firestore, Functions)
- [ ] Create seed data script
- [ ] Test local development workflow

### Phase 3: Core Middleware & Auth (Week 2)

- [ ] Implement authMiddleware
- [ ] Implement adminMiddleware
- [ ] Implement rateLimitMiddleware
- [ ] Implement fileUploadMiddleware
- [ ] Create validation schemas (Zod)

### Phase 4: File Extraction System (Week 3)

- [ ] Implement FileService
- [ ] Create PDF extractor
- [ ] Create TXT extractor
- [ ] Create MD extractor
- [ ] Implement POST /v1/notes/extract
- [ ] Test file extraction

### Phase 5: Token Economy System (Week 4)

- [ ] Implement TokenService
- [ ] Create token deduction logic
- [ ] Create token grant logic (admin)
- [ ] Implement token endpoints
- [ ] Test token operations

### Phase 6: AI Service & Gemini Integration (Week 5)

- [ ] Set up Gemini client
- [ ] Implement AIService methods
- [ ] Implement error handling & retry logic
- [ ] Test AI service methods

### Phase 7: AI Endpoints (Week 6)

- [ ] Implement AI endpoints
- [ ] Add AI request logging
- [ ] Test AI endpoints

### Phase 8: RAG Implementation (Week 7)

- [ ] Implement RAGService
- [ ] Implement note retrieval logic
- [ ] Implement POST /v1/ai/ragQuery
- [ ] Test RAG functionality

### Phase 9: Admin Endpoints (Week 8)

- [ ] Implement admin endpoints
- [ ] Test admin endpoints

### Phase 10: Testing & QA (Week 9)

- [ ] Write unit tests (100% coverage)
- [ ] Write integration tests
- [ ] Test with Firebase Emulator Suite
- [ ] Fix all bugs

### Phase 11: Documentation & Deployment (Week 10)

- [ ] Complete README.md
- [ ] Document API endpoints
- [ ] Deploy to development
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor production

## Appendix A: Environment Variables

### `.env.example`

```bash
# Gemini API Key
GEMINI_API_KEY=your-gemini-api-key

# Environment
NODE_ENV=development
FUNCTIONS_EMULATOR=true

# Firebase Project ID
FIREBASE_PROJECT_ID=demo-sentient-archive
```

## Appendix B: Useful Commands

```bash
# Firebase
firebase login
firebase projects:list
firebase use dev
firebase deploy --only functions
firebase emulators:start

# Development
npm run dev                   # Watch mode
npm run build                 # Build TypeScript
npm run serve                 # Serve functions

# Testing
npm run test                  # Run tests
npm run test:coverage         # Coverage report
npm run lint                  # Lint code

# Docker
docker compose up -d          # Start emulators
docker compose down           # Stop emulators
docker compose logs -f        # View logs

# Git
git flow init
git flow feature start file-extraction
git flow feature finish file-extraction
```

## END OF BACKEND MASTERPLAN

_This document serves as the single source of truth for the SentientArchive backend
functions. All implementation decisions should reference and follow this plan._
