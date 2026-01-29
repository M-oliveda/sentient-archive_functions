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
│   ├── config/
│   │   └── prompts.toml              # AI system prompts (TOML format)
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
│   │   ├── toml.ts                   # TOML configuration loader
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

| Category            | Technology            | Version | Purpose                          |
| :------------------ | :-------------------- | :------ | :------------------------------- |
| **Validation**      | Zod                   | 3.x     | Request/response validation      |
| **AI SDK**          | @google/generative-ai | Latest  | Gemini API client                |
| **Firebase Admin**  | firebase-admin        | Latest  | Server-side Firebase SDK         |
| **File Processing** | pdf-parse             | Latest  | PDF text extraction              |
| **File Processing** | busboy                | Latest  | Multipart form parsing           |
| **Configuration**   | smol-toml             | Latest  | TOML parser (~10% token savings) |
| **Date Utils**      | date-fns              | 4.x     | Date manipulation                |
| **HTTP Framework**  | express               | 4.x     | HTTP routing (optional)          |

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

The project includes a comprehensive seed script that creates realistic test data for
local development. The seed script automatically waits for emulators to be ready before
populating data.

```bash
# Wait for emulators to be ready (about 10 seconds)
npm run seed

# Or use the script directly
./scripts/run-seed.sh
```

**Seed Script Data Generation:**

The seed script (`scripts/seed-emulator.ts`) creates:

| Resource                  | Quantity | Description                                      |
| :------------------------ | :------- | :----------------------------------------------- |
| **Admin Users**           | 2        | Full administrative privileges                   |
| **Client Users**          | 8        | Standard user accounts                           |
| **Notes per User**        | 8-12     | Realistic notes with varied content types        |
| **Total Notes**           | 60-100   | Meeting notes, recipes, journals, learning notes |
| **Transactions per User** | 3-10     | Token grants and AI operation deductions         |
| **System Config**         | 1 record | AI model settings, costs, and feature flags      |

**Test Credentials Generated:**

```text
🔐 Admin Accounts:
  admin1@sentientarchive.local / Admin123!
  admin2@sentientarchive.local / Admin123!

👤 Client Accounts:
  All use password: Client123!
  Emails are randomly generated (e.g., firstname.lastname@example.com)
  Full list displayed in seed output
```

**Seed Script Architecture:**

```typescript
// scripts/seed-emulator.ts
async function main() {
  await seedUsers(); // Create auth users and Firestore profiles
  await seedNotes(); // Generate realistic note content
  await seedTransactions(); // Create token transaction history
  await seedSystemConfig(); // Set up system configuration
  printSummary(); // Display credentials and stats
}
```

**Note Content Templates:**

The seed script uses 6 different note templates with realistic content:

1. **Meeting Notes** - Agendas, attendees, action items
2. **Book Summaries** - Titles, authors, key takeaways, quotes
3. **Project Plans** - Objectives, timelines, milestones, risks
4. **Learning Notes** - Concepts, examples, code snippets
5. **Daily Journals** - Goals, accomplishments, gratitude
6. **Recipes** - Ingredients, instructions, cooking times

Each note includes:

- Realistic title and content (generated with Faker.js)
- Relevant tags (manual + AI-generated)
- Random flashcards (70% of notes)
- Random summaries (50% of notes)
- Proper timestamps and metadata

**Token Economy Setup:**

Each user starts with:

- **Initial Grant:** 1000 tokens (configurable)
- **Transaction History:** 3-10 random operations
- **Operation Types:** summarize, autoTag, flashcards, ragQuery
- **Proper Balance Tracking:** Accurate balanceBefore/balanceAfter

**Seed Script Features:**

```bash
# Features of scripts/run-seed.sh:
✅ Checks if emulators are running
✅ Waits for all emulators to be healthy
✅ Uses tsx for fast TypeScript execution
✅ Validates emulator connections (UI, Firestore, Auth)
✅ Displays detailed progress and summary
✅ Shows all generated credentials
✅ Handles errors gracefully
```

**Environment Configuration:**

The seed script automatically detects and uses emulator ports:

```typescript
// Automatically configured
FIRESTORE_EMULATOR_HOST = "localhost:8081";
FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
GCLOUD_PROJECT = "demo-sentient-archive";
```

**Persistent Data with Import/Export:**

Data is automatically preserved between restarts:

```bash
# First run: Seed creates initial data
npm run seed

# Stop emulators (triggers --export-on-exit)
docker compose stop
# → Data saved to ./firebase/seed-data/

# Next startup: Data auto-imported
docker compose up
# → Logs show: "✓ emulators: Importing data from ./seed-data"
```

**Seed Management Commands:**

```bash
# Seed with existing data intact
npm run seed

# Clear all data and seed from scratch
npm run seed:fresh

# Reset emulators only (clears data)
npm run emulators:reset

# Export current data manually
npm run emulators:export
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
name: sentient-archive-functions_local

services:
  firebase-emulators:
    build:
      context: ./firebase
      dockerfile: Dockerfile
    container_name: firebase-emulators
    ports:
      - "4000:4000" # Emulator UI
      - "4500:4500" # Emulator UI WebSocket
      - "5001:5001" # Functions Emulator
      - "8081:8081" # Firestore Emulator
      - "9099:9099" # Auth Emulator
      - "9150:9150" # Firestore WebSocket
      - "9199:9199" # Storage Emulator
      - "9299:9299" # Firealerts/EventArc Emulator
    volumes:
      # Mount Firebase configuration files
      - ./firebase.json:/app/firebase.json:ro
      - ./.firebaserc:/app/.firebaserc:ro
      - ./firestore.rules:/app/firestore.rules:ro
      - ./firestore.indexes.json:/app/firestore.indexes.json:ro
      - ./storage.rules:/app/storage.rules:ro

      # Mount source code for hot reload (functions)
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
      - ./package-lock.json:/app/package-lock.json:ro
      - ./tsconfig.json:/app/tsconfig.json:ro
      - ./tsconfig.build.json:/app/tsconfig.build.json:ro

      # Persistent emulator data (import/export)
      - ./firebase/seed-data:/app/seed-data:rw

      # Node modules volume for performance
      - firebase_node_modules:/app/node_modules
    environment:
      - FIREBASE_PROJECT_ID=demo-sentient-archive
      - FUNCTIONS_EMULATOR=true
      - FIRESTORE_EMULATOR_HOST=0.0.0.0:8081
      - FIREBASE_AUTH_EMULATOR_HOST=0.0.0.0:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=0.0.0.0:9199
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - NODE_ENV=development
    networks:
      - sentient-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    # Install dependencies on container start
    entrypoint: /bin/bash
    command:
      - -c
      - |
        # Only install if node_modules is empty
        if [ ! -d "node_modules/firebase-tools" ]; then
          echo "Installing dependencies..."
          npm ci --prefer-offline --no-audit
        fi

        echo "Building TypeScript..."
        npm run build

        echo "Starting Firebase Emulators..."
        # If seed-data folder is empty, Firebase will just warn and start clean.
        # Once you shut down, it will populate this folder for the next run.
        firebase emulators:start --import=./seed-data --export-on-exit --project demo-sentient-archive

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

# Install Java (required for Firestore emulator) and required tools
RUN apk add --no-cache openjdk21-jre curl bash

# Install Firebase CLI globally (pinned version for stability)
RUN npm install -g firebase-tools@latest

# Set working directory
WORKDIR /app

# Expose emulator ports
EXPOSE 4000 5001 8080 9099 9199

# Create directory for emulator data (will be overridden by volume mount)
RUN mkdir -p seed-data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000 || exit 1

# Default command (overridden by docker-compose)
CMD ["firebase", "emulators:start", "--import=./seed-data", "--export-on-exit", "--project", "demo-sentient-archive"]
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

The seed data script (`scripts/seed-emulator.ts`) populates the Firebase Emulator with
realistic test data to simulate a production-like environment. The seed script uses
**tsx** for fast TypeScript execution and **Faker.js** for generating realistic data.

#### Quick Start

```bash
# Start emulators
npm run emulators:start

# Wait 10-15 seconds, then seed
npm run seed

# Or use wrapper script that checks emulator health
./scripts/run-seed.sh
```

#### What Gets Seeded

**1. User Accounts (10 users):**

- **2 Admin users:**
  - `admin1@sentientarchive.local` / `Admin123!`
  - `admin2@sentientarchive.local` / `Admin123!`
  - Initial token balance: 10,000 tokens
  - Custom claims: `{ role: "admin" }`

- **8 Client users:**
  - Randomly generated names (e.g., `alexandrea.predovic@example.com`)
  - Password: `Client123!` (for all)
  - Initial token balance: 1,000 tokens
  - Custom claims: `{ role: "client" }`
  - Realistic profiles with avatars, preferences, timestamps

**2. Notes (60-100 notes total):**

Distributed across client users (8-12 notes per user) with 6 content templates:

| Template       | Description                                      | Tags                       |
| :------------- | :----------------------------------------------- | :------------------------- |
| Meeting Notes  | Agendas, attendees, action items, next steps     | meeting, notes, work       |
| Book Summaries | Title, author, key takeaways, quotes, rating     | book, summary, reading     |
| Project Plans  | Objectives, timeline, milestones, risks, metrics | project, planning, work    |
| Learning Notes | Concepts, examples, code snippets, questions     | learning, education, notes |
| Daily Journals | Goals, accomplishments, gratitude, reflections   | journal, daily, personal   |
| Recipes        | Ingredients, instructions, tips, variations      | recipe, cooking, food      |

**Note Features:**

- Realistic titles and markdown content (generated with Faker.js)
- Manual tags (from templates) + AI tags (random selection)
- 50% have AI-generated summaries
- 30% have flashcards (2-5 cards per note)
- Proper Firestore structure with timestamps
- Random pinned/archived status
- Created over past year (realistic distribution)

**3. Transaction History (3-10 per user):**

Each user has transaction history showing:

- **Initial Grant:** 1,000 tokens (welcome bonus)
- **Token Deductions:** For AI operations (summarize, autoTag, flashcards, ragQuery)
- **Refill Grants:** When balance goes negative (100-500 tokens)
- **Proper Accounting:** `balanceBefore` and `balanceAfter` tracked
- **Metadata:** Operation type, timestamp, description, granter (for grants)

Token costs used in seed:

```typescript
const TOKEN_COSTS = {
  summarize: 10, // 10 tokens per summary
  autoTag: 5, // 5 tokens per auto-tag
  flashcards: 15, // 15 tokens per flashcard set
  ragQuery: 20, // 20 tokens per RAG query
};
```

**4. System Configuration:**

Single system config document (`config/system`) with:

```typescript
{
  ai: {
    model: "gemini-1.5-flash",
    maxTokensPerRequest: 2048,
    temperature: 0.7,
    systemPrompts: { /* ... */ }
  },
  tokens: {
    initialGrant: {
      production: 500,
      development: 1000,
      staging: 1000,
      local: 1000
    },
    costs: {
      summarize: 10,
      autoTag: 5,
      flashcards: 15,
      ragQuery: 20
    },
    maxPerOperation: 100
  },
  features: {
    summarizeEnabled: true,
    autoTagEnabled: true,
    flashcardsEnabled: true,
    ragQueryEnabled: true,
    fileExtractionEnabled: true
  },
  fileUpload: {
    maxSizeBytes: 10485760,  // 10MB
    allowedTypes: ["application/pdf", "text/plain", "text/markdown"],
    allowedExtensions: [".pdf", ".txt", ".md"]
  },
  rateLimits: {
    aiRequestsPerHour: 60,
    fileExtractionsPerDay: 20
  }
}
```

#### Seed Script Architecture

```typescript
// scripts/seed-emulator.ts
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { faker } from "@faker-js/faker";

// Emulator configuration
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

const app = initializeApp({ projectId: "demo-sentient-archive" });
const auth = getAuth(app);
const db = getFirestore(app);

// Main execution flow
async function main() {
  console.log("🚀 Starting Firebase Emulator Seed...");

  await seedUsers(); // Create 10 users (2 admin + 8 client)
  await seedNotes(); // Generate 60-100 realistic notes
  await seedTransactions(); // Create token transaction history
  await seedSystemConfig(); // Set up system configuration

  printSummary(); // Display credentials and statistics
}

void main();
```

**Helper Functions:**

```typescript
// Generate realistic note content from templates
function generateNoteContent(template: NoteTemplate): {
  title: string;
  content: string;
  tags: string[];
} {
  // Replaces placeholders with Faker data
  // Returns fully populated note content
}

// Random integer helper
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

#### Seed Script Wrapper (scripts/run-seed.sh)

The bash wrapper script ensures emulators are healthy before seeding:

```bash
#!/usr/bin/env bash
# scripts/run-seed.sh

# 1. Check if Emulator UI is accessible
check_emulator() {
  curl -s -o /dev/null -w "%{http_code}" "$EMULATOR_UI_URL"
}

# 2. Wait for all emulators to be ready
wait_for_emulators() {
  # Checks: Emulator UI (4000), Firestore (8081), Auth (9099)
  # Max wait: 60 seconds with 2-second polling
}

# 3. Set environment and run seed script
export FIRESTORE_EMULATOR_HOST="localhost:8081"
export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"

npx tsx scripts/seed-emulator.ts
```

#### Seed Output Example

```text
==========================================
  Firebase Emulator Seed Script
==========================================

[INFO] Checking if emulators are running...
[INFO] Waiting for Firebase Emulators to be ready...
[INFO] All emulators are ready!

🚀 Starting Firebase Emulator Seed...
   Firestore: localhost:8081
   Auth: localhost:9099

📝 Creating users...
  ✓ Created admin: admin1@sentientarchive.local
  ✓ Created admin: admin2@sentientarchive.local
  ✓ Created client: alexandrea.predovic@example.com
  ✓ Created client: clifford.turcotte@example.com
  [... 6 more clients ...]

📚 Creating notes...
  ✓ Created 9 notes for alexandrea.predovic@example.com
  ✓ Created 9 notes for clifford.turcotte@example.com
  [... more notes ...]
  Total notes created: 66

💰 Creating transactions...
  ✓ Created 10 transactions for alexandrea.predovic@example.com
  [... more transactions ...]

⚙️ Creating system configuration...
  ✓ Created system configuration

============================================================
🎉 SEED COMPLETE!
============================================================

📋 TEST CREDENTIALS:
🔐 ADMIN ACCOUNTS:
  Email:    admin1@sentientarchive.local
  Password: Admin123!
  UID:      uY0Sp5G4aOT2cokrtcHoDxX29y98

👤 CLIENT ACCOUNTS:
  Alexandrea Predovic
    Email:    alexandrea.predovic@example.com
    Password: Client123!
  [... more clients ...]

📊 SUMMARY:
  Total Users:  10
  - Admins:     2
  - Clients:    8

🌐 EMULATOR URLS:
  Emulator UI:  http://localhost:4000
  Auth:         http://localhost:9099
  Firestore:    http://localhost:8081
  Functions:    http://localhost:5001
  Storage:      http://localhost:9199
============================================================
```

#### Persistent Data Management

**Automatic Export/Import:**

The Docker Compose setup uses `--import` and `--export-on-exit` flags to preserve data:

```bash
# First run: Seed creates data
npm run seed

# Stop emulators (exports data)
docker compose stop
# → Data saved to ./firebase/seed-data/

# Restart (imports data)
docker compose up
# → Logs show: "✓ emulators: Importing data from ./seed-data"
```

**Data Location:**

```text
firebase/seed-data/
├── auth_export/
│   └── accounts.json           # User accounts and custom claims
├── firestore_export/
│   └── all_namespaces/
│       └── all_kinds/
│           └── all_namespaces_all_kinds.export_metadata
└── firebase-export-metadata.json
```

**Seed Management Commands:**

```bash
# Seed with existing data intact
npm run seed

# Clear all data and re-seed from scratch
npm run seed:fresh

# Clear data but keep container running
npm run emulators:reset

# Export current emulator state manually
npm run emulators:export

# View emulator logs
npm run emulators:logs
```

#### Testing with Seeded Data

**1. Get a Test User Token:**

```bash
# Use Firebase Auth Emulator REST API
curl -X POST "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin1@sentientarchive.local",
    "password": "Admin123!",
    "returnSecureToken": true
  }'

# Response includes idToken
```

**2. Test API Endpoints:**

```bash
# Set token variable
export TOKEN="<idToken_from_above>"

# Check token balance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/demo-sentient-archive/us-central1/api/v1/tokens/balance

# Get user's notes
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/demo-sentient-archive/us-central1/api/v1/notes

# Test AI summarization (deducts tokens)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "<note_id>", "maxLength": 100}' \
  http://localhost:5001/demo-sentient-archive/us-central1/api/v1/ai/summarize
```

**3. View Data in Emulator UI:**

```bash
# Open Emulator UI
open http://localhost:4000

# Navigate to:
# - Authentication: View all seeded users
# - Firestore: Browse collections (users, notes, transactions, config)
# - Functions: View deployed functions and logs
```

#### Seed Script Dependencies

```json
{
  "dependencies": {
    "firebase-admin": "^13.0.2"
  },
  "devDependencies": {
    "@faker-js/faker": "^9.3.0",
    "tsx": "^4.21.0"
  }
}
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

- [x] Create Docker Compose for Firebase Emulators
- [x] Configure emulators (Auth, Firestore, Functions, Storage)
- [x] Create seed data script with realistic test data
- [x] Test local development workflow
- [x] Configure proper emulator hosts (0.0.0.0) for container access
- [x] Add storage emulator configuration
- [x] Create comprehensive seed script with 10 users, 50-100 notes, transactions
- [x] Add seed helper script with emulator health checks

### Phase 3: Core Middleware & Auth (Week 2)

- [x] Implement authMiddleware
- [x] Implement adminMiddleware
- [x] Implement rateLimitMiddleware
- [x] Implement fileUploadMiddleware
- [x] Create validation schemas (Zod)
- [x] Write unit tests for all middleware and utilities

### Phase 4: File Extraction System (Week 3)

- [x] Implement FileService
- [x] Create PDF extractor
- [x] Create TXT extractor
- [x] Create MD extractor
- [x] Implement POST /v1/notes/extract
- [x] Test file extraction

### Phase 5: Token Economy System (Week 4)

- [x] Implement TokenService
- [x] Create token deduction logic
- [x] Create token grant logic (admin)
- [x] Implement token endpoints
- [x] Test token operations

### Phase 6: AI Service & Gemini Integration (Week 5)

- [x] Set up Gemini client
- [x] Implement AIService methods
- [x] Implement error handling & retry logic
- [x] Test AI service methods

### Phase 7: AI Endpoints (Week 6)

- [x] Install smol-toml for TOML configuration support (~10% token savings vs JSON)
- [x] Create TOML configuration file for AI system prompts (`src/config/prompts.toml`)
- [x] Create TOML loader utility (`src/utils/toml.ts`)
- [x] Migrate AI service to use TOML-based prompts
- [x] Test TOML configuration loading (100% coverage)
- [x] Implement AI endpoints
- [x] Add AI request logging
- [x] Test AI endpoints

### Phase 8: RAG Implementation (Week 7)

- [x] Implement RAGService
- [x] Implement note retrieval logic
- [x] Implement POST /v1/ai/ragQuery
- [x] Test RAG functionality

### Phase 9: Admin Endpoints (Week 8)

- [x] Implement admin endpoints
- [x] Test admin endpoints

### Phase 10: Testing & QA (Week 9)

- [x] Write unit tests (100% coverage)
- [x] Write integration tests
- [x] Test with Firebase Emulator Suite
- [x] Fix all bugs
- [x] Create `ci.yml` GitHub Action Pipeline

### Phase 10: Development Environment and GitHub Configuration (Week 10)

- [x] Generate GitHub environments (development, staging, production)
- [x] Add GitHub secrets
- [x] SetUp development environment pipeline

### Phase 11: Documentation & Deployment (Week 11)

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
