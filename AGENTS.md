# Backend Developer Coding Style and Best Practices

## JavaScript Best Practices

### JavaScript Best Practices: Syntax & Language Features

- Use `const` for values that never change and `let` for those that do; avoid using
  `var`
- Prefer **arrow functions** for callbacks and short functions, but use named functions
  when they improve readability or debugging
- Use **template literals** for string construction instead of concatenation
- Destructure objects and arrays for clarity and immutability
- Use **spread/rest operators** instead of `Object.assign()` or manual copying
- Favor **optional chaining (`?.`)** and **nullish coalescing (`??`)** for safe access
  and defaults
- Prefer **shorthand properties** and methods in object literals
- Always return early in functions to reduce nesting and improve readability

### JavaScript Best Practices: Code Style & Formatting

- Follow consistent indentation (4 spaces, project-dependent — use **Prettier** tool
  configuration)
- Use `camelCase` for variables, functions, and object properties
- End statements with semicolons
- Prefer **double quotes** for strings (enforce via **Prettier tool**)
- Avoid inline comments in complex logic; use block comments above logic blocks
- Use **ESLint** and **Prettier** with CI integration to enforce style consistently

### JavaScript Best Practices: Structure & Organization

- Group related constants, types, and utility functions into modules
- Keep functions pure and focused on a single responsibility (_SRP_)
- Organize files by feature or domain instead of file type in large applications
- Use named exports consistently to avoid ambiguity in import names
- Split large files into smaller modules when they exceed **~500 lines of code**
- Prefer colocating files (`index.js`, `styles.js`, `types.js`) in a folder per
  component or feature

### JavaScript Best Practices: Error Handling

- Always handle rejections in `async/await` and `Promise` chains
- Avoid empty `catch` blocks; log or throw a meaningful error
- Use `try/catch` where failure is expected, not as control flow
- Create custom error types for domain-specific cases

### JavaScript Best Practices: Naming Conventions

- Use meaningful, descriptive names for variables and functions
- Avoid abbreviations unless they're widely understood (`id`, `URL`, `API`)
- Use verbs for functions (`fetchData`, `calculateTotal`)
- Name booleans with prefixes like `is`, `has`, or `can` (e.g., `isActive`,
  `hasPermission`)
- Use plural names for arrays and collections (`users`, `items`)
- Constants should be in `UPPER_SNAKE_CASE` when they are exported or shared

### JavaScript Best Practices: Performance & Optimization

- Avoid unnecessary loops and recalculations; memoize expensive operations
- Use debounce/throttle on high-frequency DOM events (e.g., scroll, input)
- Minimize DOM manipulations and reflows
- Use `requestIdleCallback`, `requestAnimationFrame` for UI performance tuning

### JavaScript Best Practices: Maintainability

- Avoid magic numbers and hardcoded strings — use constants or enums
- Write reusable, **pure functions** and isolate side effects
- Favor declarative code over imperative code when possible
- Document complex logic using **JSDoc**
- Avoid mutable shared state — use factory functions or closures to encapsulate

### JavaScript Best Practices: Testing & Debugging

- Use a robust testing framework (e.g., **Jest**, **Vitest**, or **Mocha**) for unit and
  integration tests
- Write tests for edge cases and error paths, not just the _happy path_
- Use mocks and spies carefully — overuse can reduce test clarity
- Avoid `console.log()` in production; use structured logging and levels
- Validate function arguments and return values in tests

### JavaScript Best Practices: Tooling & Ecosystem

- Use **npm** as a default package manager.
- Keep dependencies up-to-date using tools like `npm audit`.
- Use **Vite** with production optimization enabled
- Add `build`, `lint`, `test`, and `format` scripts to `package.json`

### JavaScript Best Practices: Modern Features (ES6+)

- Use ES Modules (`import/export`) instead of `require`
- Prefer `Array.prototype.map`, `filter`, `reduce` for data transformation
- Use `Map`/`Set` over objects for collections with dynamic keys or guaranteed
  uniqueness
- Leverage `async/await` for clearer async flow
- Use `Promise.all` or `Promise.allSettled` for parallelism when tasks are independent
- Avoid deeply nested `.then()` chains — use `await` or flatten logic

### JavaScript Best Practices:: Anti-Patterns to Avoid

- Avoid deeply nested callbacks or Promises — use functions or early returns
- Don't mutate function parameters; always treat them as immutable
- Avoid using `this` in non-class functions
- Never extend native prototypes like `Array.prototype` or `Object.prototype`
- Don't rely on side effects to control function output
- Avoid global state

### JavaScript Best Practices: Security

- Sanitize and validate **all user inputs** before processing or storing
- Never use `eval()`, `Function()`, or dynamic `import()` with user input
- Avoid exposing sensitive keys or secrets in client-side code
- Configure **Content Security Policy (CSP)** headers to prevent XSS attacks
- Use HTTPS and modern authentication libraries
- Verify third-party dependencies and audit licenses

## TypeScript Best Practices

### TypeScript Best Practices: Type System

- Prefer interfaces over types for object definitions
- Use `type` for unions, intersections, and mapped types
- Avoid using `any`, prefer `unknown` for unknown types
- Use strict TypeScript configuration (`strict: true` in tsconfig.json)
- Leverage TypeScript's built-in utility types (`Partial`, `Pick`, `Omit`, `Record`,
  etc.)
- Use generics for reusable type patterns
- Use `readonly` for immutable properties
- Use discriminated unions for better type safety
- Use type guards and `in` checks for runtime type checking
- Prefer literal types and enums for limited sets of values

### TypeScript Best Practices: Naming Conventions

- Use PascalCase for type names and for interfaces place the `I` before the name
  (`IPersonInterface`)
- Use `camelCase` for variables, functions, and parameters
- Use `UPPER_CASE` for constants and enum members
- Use descriptive names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Prefix types for React props with 'Props' (e.g., `ButtonProps`)
- Name custom error types with the `Error` suffix (e.g., `NotFoundError`)

### TypeScript Best Practices: Code Organization

- Keep type definitions close to where they're used
- Export shared types and interfaces from dedicated type files
- Use barrel exports (`index.ts`) to simplify import paths
- Group related types in a `types/` directory
- Co-locate component props/types with the components
- Avoid circular imports by structuring modules clearly

### TypeScript Best Practices: Functions

- Use explicit return types for all public functions and methods
- Prefer arrow functions for callbacks and inline handlers
- Use function overloads to handle multiple type scenarios
- Prefer `async/await` over raw Promises for readability
- Implement custom error types and return them instead of strings
- Avoid deeply nested functions; extract logic to named helpers

### TypeScript Best Practices: Imports & Dependencies

- Use absolute imports for shared modules and aliases (`@/components`, `@/utils`, etc.)
- Group imports: external → internal → relative
- Avoid default exports in shared codebases, prefer named exports
- Prefer tree-shakable libraries and modern ESM-compatible packages
- Keep import statements ordered and clean

### TypeScript Best Practices: Linting & Formatting

- Use ESLint with `@typescript-eslint` plugin
- Enforce `no-explicit-any`, `no-non-null-assertion`, and `no-unused-vars`
- Use Prettier for automatic code formatting
- Add **Husky** and **lint-staged** to run linters/formatters before commits
- Format and lint code automatically in CI

### TypeScript Best Practices: Error Handling

- Create custom error types for domain-specific errors
- Use `Result` or `Either` types for recoverable errors
- Implement proper error boundaries in React
- Use typed `try/catch` with `instanceof` checks
- Handle Promise rejections using `.catch` or `try/catch`

### TypeScript Best Practices: Testing

- Use `ts-jest`, `vitest`, or `jest` with proper TS support
- Avoid using `any` in test files; type mock data and props
- Prefer integration tests that simulate real usage
- Use libraries like `tsd` or `typescript-eslint` rules to check type usage
- Keep type safety when mocking with tools like `jest.Mocked<T>`

### TypeScript Best Practices: Documentation & Comments

- Use TSDoc to document public APIs and complex types
- Add comments to explain complex type transformations
- Avoid unnecessary inline comments for obvious types
- Keep documentation in sync with type updates

### TypeScript Best Practices: Tooling & Automation

- Use `tsc --noEmit` in CI to ensure type safety
- Automate linting and formatting with Git hooks and CI checks
- Use `ts-prune` or `typescript-unused-exports` to remove unused types

### TypeScript Best Practices: Patterns

- Use the Builder pattern for complex object construction
- Use the Factory pattern for controlled object creation
- Use the Repository pattern for abstracting data access
- Use the Module pattern for encapsulated logic
- Leverage dependency injection in services or utilities
- Prefer composition over inheritance in business logic and components

### TypeScript Best Practices: Performance Considerations

- Avoid deeply nested types or overly complex generics
- Simplify unions when possible
- Use indexed access types cautiously
- Avoid unnecessary runtime type checking for fully trusted inputs

## Firebase Cloud Functions Best Practices

### Firebase Cloud Functions Best Practices: Project Structure

- Use `src/` as the root directory for all source code
- Organize by feature/domain, not by file type:
  - `src/middleware/` - Authentication, authorization, rate limiting, file upload
  - `src/routes/` - HTTP route handlers grouped by domain (notes, ai, tokens, admin)
  - `src/services/` - Business logic layer (file, ai, token, rag, analytics)
  - `src/utils/` - Shared utilities (gemini, firestore, validation, logger)
  - `src/types/` - TypeScript type definitions
- Keep `src/index.ts` as the entry point that exports all Cloud Functions
- Use `tests/` parallel to `src/` for unit and integration tests
- Use `scripts/` for utility scripts (seed data, migrations)
- Store Firebase configuration in `firebase.json` and `firestore.rules`

### Firebase Cloud Functions Best Practices: Function Types & Exports

- Use **Gen 2 Cloud Functions** for better performance and features
- Export HTTP functions using named exports from `src/index.ts`
- Use `onRequest` for HTTP endpoints that need full request/response control
- Use `onCall` for callable functions when you need automatic authentication
- Group related endpoints under a single function using Express Router
- Example structure:

  ```typescript
  // src/index.ts
  import { onRequest } from "firebase-functions/v2/https";
  import { notesRouter } from "./routes/notes.routes";
  import { aiRouter } from "./routes/ai.routes";

  export const api = onRequest({ cors: true, region: "us-central1" }, app);
  ```

### Firebase Cloud Functions Best Practices: Middleware Patterns

- Implement middleware in the correct order:
  1. CORS and security headers
  2. Body parsing (JSON, multipart)
  3. Authentication verification
  4. Authorization/role checking
  5. Rate limiting
  6. Request validation
  7. Route handlers
  8. Error handling (last)
- Use async middleware and propagate errors with `next(error)`
- Create reusable middleware for common patterns:
  - `authMiddleware` - Verify Firebase ID tokens
  - `adminMiddleware` - Check admin role
  - `rateLimitMiddleware` - Enforce rate limits
  - `fileUploadMiddleware` - Handle multipart file uploads
  - `errorHandler` - Centralized error handling
- Always validate Firebase ID tokens using `admin.auth().verifyIdToken()`
- Attach authenticated user to `req.user` for downstream handlers

### Firebase Cloud Functions Best Practices: Firestore Operations

- Use Firebase Admin SDK for all Firestore operations
- Initialize Admin SDK once at module level, not per request
- Use transactions for operations that modify multiple documents
- Use batch writes for multiple independent writes (up to 500 operations)
- Implement proper error handling for Firestore operations
- Use subcollections for hierarchical data (e.g., `users/{uid}/notes`)
- Query efficiently:
  - Use `where()` clauses to filter data
  - Use `limit()` to prevent large result sets
  - Create composite indexes for complex queries
  - Use `orderBy()` with `startAfter()` for pagination
- Handle Firestore timestamps correctly:

  ```typescript
  import { FieldValue, Timestamp } from "firebase-admin/firestore";

  createdAt: FieldValue.serverTimestamp(),
  updatedAt: Timestamp.now()
  ```

### Firebase Cloud Functions Best Practices: File Processing

- **Never store files permanently** - process in memory and discard
- Use `busboy` for parsing multipart/form-data
- Validate files before processing:
  - Check MIME type and file extension
  - Enforce size limits (e.g., 10MB max)
  - Validate against allowed file types
- Process files in streaming mode when possible to reduce memory usage
- Clean up file buffers immediately after processing
- Handle extraction errors gracefully with meaningful error messages
- For PDF extraction, use `pdf-parse` library
- For text files (TXT/MD), use `Buffer.toString('utf-8')`
- Store only extracted text content and metadata, never the original file

### Firebase Cloud Functions Best Practices: AI Integration (Gemini)

- Initialize Gemini client once at module level
- Use environment variables for API keys (never hardcode)
- Implement retry logic with exponential backoff for API failures
- Set appropriate timeouts for AI operations
- Use streaming responses for long-running operations when possible
- Validate AI responses before returning to client
- Log AI requests for debugging and cost tracking
- Use JSON mode when expecting structured output:

  ```typescript
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });
  ```

- Handle rate limits and quota errors from Gemini API
- Cache AI responses when appropriate to reduce costs

### Firebase Cloud Functions Best Practices: Token Economy System

- Use Firestore transactions for all token operations to ensure atomicity
- Never allow negative token balances
- Create immutable transaction records for audit trail
- Implement token deduction before performing AI operations
- Rollback tokens if AI operation fails
- Store transaction metadata (operation type, timestamp, user)
- Example transaction pattern:

  ```typescript
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await transaction.get(userRef);
    const balance = userDoc.data().tokenBalance;

    if (balance < cost) {
      throw new Error("Insufficient tokens");
    }

    transaction.update(userRef, {
      tokenBalance: balance - cost,
      totalTokensSpent: FieldValue.increment(cost),
    });
  });
  ```

### Firebase Cloud Functions Best Practices: Security

- Verify Firebase ID tokens on every authenticated request
- Implement role-based access control (RBAC) using custom claims or Firestore
- Validate all input using Zod schemas
- Sanitize file uploads (MIME type, size, extension)
- Use CORS configuration to restrict origins
- Never expose internal error details to clients
- Rate limit expensive operations (AI requests, file uploads)
- Use environment-specific configuration (dev/staging/prod)
- Implement request size limits to prevent DoS attacks
- Log security events (failed auth, unauthorized access)

### Firebase Cloud Functions Best Practices: Error Handling

- Create custom error classes for different error types:

  ```typescript
  class AppError extends Error {
    constructor(
      public code: string,
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  }
  ```

- Use centralized error handling middleware
- Return consistent error response format:

  ```typescript
  {
    success: false,
    error: {
      code: "ERROR_CODE",
      message: "User-friendly message",
      details?: object
    }
  }
  ```

- Map Firebase errors to appropriate HTTP status codes
- Log errors with context (user ID, request ID, timestamp)
- Never expose stack traces or sensitive data in production
- Handle async errors in middleware with try/catch

### Firebase Cloud Functions Best Practices: Validation

- Use Zod for all request/response validation
- Define schemas in `src/utils/validation.ts`
- Validate early in the request lifecycle
- Return detailed validation errors to clients
- Example validation pattern:

  ```typescript
  import { z } from "zod";

  const SummarizeRequestSchema = z.object({
    noteId: z.string().min(1),
    maxLength: z.number().int().min(50).max(500).optional(),
  });

  // In route handler
  const data = SummarizeRequestSchema.parse(req.body);
  ```

- Validate file uploads separately from JSON payloads
- Use custom Zod refinements for business logic validation

### Firebase Cloud Functions Best Practices: Logging

- Use structured logging with consistent format
- Include request ID in all logs for tracing
- Log at appropriate levels (debug, info, warn, error)
- Log important business events (token deductions, file extractions)
- Use Firebase Functions logger:

  ```typescript
  import { logger } from "firebase-functions/v2";

  logger.info("Processing file extraction", {
    userId,
    fileName,
    fileSize,
  });
  ```

- Never log sensitive data (tokens, passwords, API keys)
- Use log correlation IDs for distributed tracing

### Firebase Cloud Functions Best Practices: Testing

- Write unit tests for services, utilities, and middleware
- Write integration tests for HTTP endpoints
- Use Firebase Emulator Suite for local testing
- Mock external services (Gemini API) in tests
- Test with realistic data using seed scripts
- Test error scenarios and edge cases
- Use `@firebase/rules-unit-testing` for Firestore rules testing
- Use `supertest` for HTTP endpoint testing
- Aim for high test coverage on critical business logic
- Example test structure:

  ```typescript
  describe("Token Service", () => {
    it("should deduct tokens atomically", async () => {
      // Test implementation
    });

    it("should throw error on insufficient balance", async () => {
      // Test implementation
    });
  });
  ```

### Firebase Cloud Functions Best Practices: Environment Configuration

- Use `.env` file for local development
- Use Firebase Functions config for deployed environments:

  ```bash
  firebase functions:config:set gemini.api_key="YOUR_KEY"
  ```

- Access config in code:

  ```typescript
  import { defineString } from "firebase-functions/params";

  const geminiApiKey = defineString("GEMINI_API_KEY");
  ```

- Never commit `.env` files or secrets to version control
- Use different configurations per environment (dev/staging/prod)
- Validate required environment variables on startup

### Firebase Cloud Functions Best Practices: Performance

- Use connection pooling for Firestore (Admin SDK handles this)
- Minimize cold start times:
  - Keep dependencies minimal
  - Use lazy loading for heavy modules
  - Initialize services at module level
- Use async/await for all I/O operations
- Implement caching for frequently accessed data
- Use Firestore batch operations instead of individual writes
- Set appropriate function timeouts and memory limits
- Monitor function execution time and optimize slow operations
- Use Cloud Functions Gen 2 for better performance

### Firebase Cloud Functions Best Practices: Deployment

- Use separate Firebase projects for dev/staging/prod
- Deploy using Firebase CLI with project aliases:

  ```bash
  firebase use dev
  firebase deploy --only functions
  ```

- Use CI/CD for automated deployments
- Run tests before deploying
- Use environment-specific configuration
- Monitor deployed functions using Firebase Console
- Set up alerts for errors and performance issues
- Use gradual rollouts for critical changes
- Keep deployment history and rollback capability

### Firebase Cloud Functions Best Practices: Cost Optimization

- Set appropriate memory allocation (don't over-provision)
- Set minimum instances to 0 for low-traffic functions
- Use appropriate timeout values
- Cache expensive operations
- Optimize Firestore queries to reduce reads
- Monitor and optimize AI API usage
- Use Cloud Functions Gen 2 for better pricing
- Implement rate limiting to prevent abuse
- Monitor costs using Firebase Console and set budget alerts

## Zod Validation Best Practices

### Zod Validation Best Practices: Schema Organization

- Define all validation schemas in `src/utils/validation.ts`
- Group schemas by domain (notes, ai, tokens, admin)
- Export schemas with descriptive names (e.g., `SummarizeRequestSchema`)
- Use TypeScript type inference from Zod schemas:

  ```typescript
  import { z } from "zod";

  export const SummarizeRequestSchema = z.object({
    noteId: z.string().min(1),
    maxLength: z.number().int().min(50).max(500).optional(),
  });

  export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;
  ```

### Zod Validation Best Practices: Request Validation

- Validate all request bodies, query parameters, and path parameters
- Use `.parse()` for synchronous validation (throws on error)
- Use `.safeParse()` when you need to handle errors manually
- Return detailed validation errors to clients:

  ```typescript
  try {
    const data = SummarizeRequestSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Validation failed",
          details: error.errors,
        },
      });
    }
  }
  ```

### Zod Validation Best Practices: File Upload Validation

- Create separate schemas for file metadata validation
- Validate file properties (name, size, type) before processing
- Example file validation schema:

  ```typescript
  export const FileMetadataSchema = z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.enum(["application/pdf", "text/plain", "text/markdown"]),
    size: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024), // 10MB
  });
  ```

### Zod Validation Best Practices: Response Validation

- Validate API responses in development to catch bugs early
- Use Zod schemas to ensure type safety for responses
- Example response schema:

  ```typescript
  export const ApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.any().optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
  });
  ```

### Zod Validation Best Practices: Custom Refinements

- Use `.refine()` for custom validation logic
- Use `.transform()` to modify validated data
- Example custom validation:

  ```typescript
  const TokenMintSchema = z
    .object({
      userId: z.string().min(1),
      amount: z.number().int().positive(),
      reason: z.string().min(1),
    })
    .refine((data) => data.amount <= 1000, {
      message: "Cannot mint more than 1000 tokens at once",
    });
  ```

### Zod Validation Best Practices: Reusable Schemas

- Create base schemas for common patterns
- Extend base schemas for specific use cases
- Example:

  ```typescript
  const BaseNoteSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
  });

  const CreateNoteSchema = BaseNoteSchema.extend({
    folderId: z.string().optional(),
  });

  const UpdateNoteSchema = BaseNoteSchema.partial();
  ```

### Zod Validation Best Practices: Error Messages

- Provide clear, user-friendly error messages
- Use custom error messages for important validations:

  ```typescript
  const EmailSchema = z
    .string()
    .email({ message: "Please provide a valid email address" })
    .min(1, { message: "Email is required" });
  ```

### Zod Validation Best Practices: Environment Variables

- Validate environment variables on startup
- Use Zod to ensure required config is present:

  ```typescript
  const EnvSchema = z.object({
    GEMINI_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "staging", "production"]),
    FIREBASE_PROJECT_ID: z.string().min(1),
  });

  export const env = EnvSchema.parse(process.env);
  ```

## Python Best Practices

### Python Best Practices: Project Structure

- Use src-layout with `src/your_package_name/`
- Place tests in `tests/` directory parallel to `src/`
- Keep configuration in `config/` or as environment variables
- Store requirements in `requirements.txt`
- Use `data/` for external datasets
- Use `scripts/` for utility scripts

### Python Best Practices: Code Style

- Follow Black code formatting
- Use isort for import sorting
- Follow PEP 8 naming conventions:
  - `snake_case` for functions and variables
  - `PascalCase` for classes
  - `UPPER_CASE` for constants
- Maximum line length of 88 characters (Black default)
- Use absolute imports over relative imports
- Avoid wildcard imports
- Avoid deeply nested code blocks
- Prefer f-strings over `%` formatting or `.format()`

### Python Best Practices: Type Hints

- Use type hints for all function parameters and returns
- Import types from `typing` module
- Use `Optional[Type]` instead of `Type | None`
- Use `TypeVar` for generic types
- Define custom types in `types.py`
- Use `Protocol` for duck typing
- Validate types at runtime when needed using `pydantic`

### Python Best Practices: Testing

- Use **pytest** for testing
- Write tests for all functions and modules
- Use **pytest-cov** for coverage
- Implement proper fixtures
- Use mocking with **pytest-mock**
- Test error scenarios and edge cases
- Keep tests isolated and deterministic

### Python Best Practices: Security

- Use HTTPS when handling network requests
- Sanitize all inputs if processing user data
- Avoid `eval`, `exec`, and dynamic code execution
- Use `secrets` module instead of `random` for sensitive data
- Follow OWASP guidelines for secure coding
- Avoid hardcoding credentials or secrets
- Use `.env` files and load securely
- Regularly scan code with tools like **Bandit**

### Python Best Practices: Performance

- Profile code using `cProfile` or `line_profiler`
- Use generators for large datasets
- Avoid unnecessary object creation
- Use `functools.lru_cache` for memoization where appropriate
- Optimize algorithms and data structures
- Avoid using global variables
- Use **multiprocessing** or **asyncio** for parallelism

### Python Best Practices: Error Handling

- Create custom exception classes when needed
- Use try-except blocks
- Log exceptions using the `logging` module
- Avoid catching broad exceptions like `except Exception`
- Raise meaningful errors with descriptive messages

### Python Best Practices: Documentation

- Use Google-style docstrings
- Document all public APIs and functions
- Keep `README.md` updated with usage and setup instructions
- Use inline comments to explain complex logic
- Generate documentation using tools like `Sphinx`

### Python Best Practices: Development Workflow

- Always create a virtual environment using `python -m venv .venv` at the beginning of a
  project. Activate it and install all dependencies with the `pip` tool to ensure
  isolated and reproducible environments.
- Use virtual environments (venv or virtualenv)
- Use pre-commit hooks for formatting and linting
- Follow semantic versioning
- Use Makefile or `tox` for common tasks
- Run linters (e.g., flake8, pylint) in CI/CD
- Automate tests and coverage reporting

### Python Best Practices: Dependencies

- Pin dependency versions in `requirements.txt`
- Separate dev dependencies (e.g., `requirements-dev.txt`)
- Prefer stable and maintained libraries
- Regularly audit and update dependencies
- Avoid unnecessary dependencies
- Use dependency managers like `pip-tools` or `poetry`

## Database Best Practices

### Database Best Practices: General Practices

- Separate database logic from business logic (Repository/DAO pattern)
- Use environment-based configuration (e.g., `DATABASE_URL`)
- Manage schema using migrations (Alembic, Prisma CLI, etc.)
- Use consistent naming conventions (e.g., `snake_case`)
- Avoid direct DB access from frontend logic
- Sanitize and validate all input
- Avoid `SELECT *`, query only required fields
- Use indexes for frequent filters/joins
- Normalize data unless denormalization is needed for performance
- Enable query logging in development

### Database Best Practices: Relational Databases (PostgreSQL & SQLite)

- Use proper schema versioning tools (Alembic or Prisma Migrate)
- Use proper foreign keys and constraints
- Index frequently queried fields
- Use transactions for multi-step changes
- Keep migrations under version control
- Use appropriate default values and nullability

### Database Best Practices: SQLAlchemy (Python)

- Use declarative models and `Base = declarative_base()`
- Define `__tablename__` and use consistent field naming
- Use `nullable`, `unique`, `index`, and `default` explicitly
- Use `sessionmaker` and context managers for session handling
- Use **Alembic** for migrations
- Model relationships with `relationship()` and `ForeignKey`
- Combine with Pydantic for schema validation

### Prisma (Node.js/TypeScript)

- Use `prisma migrate` for schema changes
- Define relations with `@relation`
- Add `@unique`, `@@index`, and `@default` where needed
- Validate data using `zod` with Prisma
- Use service layer to isolate database logic
- Use `prisma.$transaction` for multi-query consistency
- Prefer `select` over `include` for precise field access

### Database Best Practices: Nonrelational Databases (e.g., MongoDB)

#### Nonrelational Databases: General Practices

- Define document schemas clearly
- Avoid deeply nested structures
- Validate input with Pydantic (Python) or Zod (TS)
- Use `ObjectId` or UUIDs appropriately
- Index fields used in queries
- Use transactions when modifying related documents

#### Nonrelational Databases: Mongoose (Node.js)

- Use strict schema definitions
- Avoid `lean()` unless performance-critical
- Use middleware hooks (`pre`, `post`) for side effects only
- Use services to encapsulate DB logic

#### Nonrelational Databases: Motor / MongoEngine (Python)

- Use async Motor with FastAPI for I/O performance
- Use Pydantic for validation
- Define indexes at model level
- Isolate data logic in repository layer

### Database Best Practices: Security

- Parameterize all queries to avoid SQL injection
- Use connection pooling
- Limit large result sets using `LIMIT` and pagination
- Regularly audit for slow queries
- Test and validate backup/recovery procedures

### Database Best Practices: Conventions

- Tables/Collections: `snake_case`, plural (e.g., `users`, `blog_posts`)
- Fields: `snake_case`, descriptive (e.g., `created_at`)
- Models: PascalCase (e.g., `User`, `BlogPost`)
- Enums: `UPPERCASE` strings

### Database Best Practices:: Testing

- Use in-memory SQLite for relational DB testing
- Seed tests with fixtures/factories
- Mock DB connections in unit tests
- Use containers for integration testing
- Add type-checking and linting to CI

## Express.js Best Practices

### Express.js Best Practices: Project Structure

- Keep routes organized by domain

### Express.js Best Practices: Express Setup

- Use `express.Router()` to modularize route definitions
- Load middleware in the correct order (e.g., body parsers before routes)
- Avoid mounting application-level middleware in route files
- Use `next()` properly to propagate errors
- Avoid logic inside route definitions — delegate to controllers/services
- Separate app initialization and server start logic
- Use centralized error-handling middleware with correct signature
  `(err, req, res, next)`

### Express.js Best Practices: API Design

- Use REST principles
- Implement API versioning
- Use request validation
- Handle errors
- Implement proper HTTP response formats
- Document APIs

### Express.js Best Practices: Database Integration

- Use **Prisma** as ORM
- Implement migrations
- Use connection pooling
- Implement transactions
- Use query optimization
- Handle database errors properly

### Express.js Best Practices: Authentication

- Implement correct JWT handling
- Use password hashing
- Implement session management
- Use OAuth integration
- Implement role-based access
- Handle auth errors
- Secure cookies with `httpOnly`, `secure`, `sameSite` flags
- Avoid storing sensitive data in session or request object

### Express.js Best Practices: Security

- Use CORS setup
- Implement rate limiting
- Use security headers
- Implement input validation
- Use encryption
- Handle security vulnerabilities
- Avoid using `eval`, `Function`, or dynamic `require()`
- Use `helmet` middleware to set HTTP headers securely

### Express.js Best Practices: Performance

- Use caching
- Implement async operations
- Implement logging using `Winston`
- Use a monitoring tool
- Handle high traffic properly

### Express.js Best Practices: Testing

- Write unit and integration tests
- Implement proper mocking
- Test error scenarios
- Use proper test coverage
- Test middleware behavior in isolation
- Mock Express `req`, `res`, and `next` for controller testing

### Express.js Best Practices: Deployment

- Use a Process Manager like PM2 to keep your application running continuously,
  automatically restart it on crashes, and manage multiple processes (clustering) to
  utilize all CPU cores.
- Run behind a Reverse Proxy such as Nginx or Apache. The proxy handles SSL/TLS
  termination, static file serving, compression, and load balancing, freeing Express to
  focus on application logic.
- Implement Clustering using Node's built-in cluster module or a tool like PM2 to spawn
  multiple worker processes. This maximizes throughput by distributing the load across
  all available CPU cores.
- Serve Static Assets via the Reverse Proxy (Nginx/CDN) instead of using
  express.static(). This offloads work from the Node.js event loop, improving
  performance.
- Store Secrets in environment variables (e.g., using a .env file locally, but
  configuring them on the production server/container). Never hardcode sensitive
  information.
- Use Docker for containerization. This ensures consistency between development and
  production environments and simplifies deployment to cloud platforms (AWS ECS,
  Kubernetes, etc.).
- Monitor application health, request throughput, and latency using tools like
  Prometheus, Grafana, or specialized services like Datadog or New Relic.

## FastAPI Best Practices

### FastAPI Best Practices: Project Structure

- Use a modular directory structure
- Organize routes by domain or feature
- Use a services layer for business logic
- Separate models into `schemas` (**Pydantic**) and `models` (**SQLAlchemy**)
- Keep dependencies in a `dependencies/` module
- Create a centralized `config.py` for settings
- Use `main.py` only to mount routers and start the app
- Example folder structure:

```text
app/
├── api/                # APIRouter modules by domain
│   ├── v1/
│   │   ├── users.py
│   │   └── items.py
├── core/               # App setup and configurations
│   ├── config.py
│   └── security.py
├── models/             # SQLAlchemy models
├── schemas/            # Pydantic models
├── services/           # Business logic
├── dependencies/       # Reusable dependencies
├── db/                 # DB session and init logic
│   └── session.py
├── main.py             # Application entrypoint
└── tests/              # Test modules
```

### FastAPI Best Practices: API Design

- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Return meaningful status codes
- Use **Pydantic models** for request and response bodies
- Validate data with Pydantic and FastAPI features
- Handle errors with `HTTPException` and custom exception handlers
- Leverage FastAPI's OpenAPI integration for automatic docs

### FastAPI Best Practices: Models

- Use Pydantic for data validation and serialization
- Use SQLAlchemy for database models
- Keep Pydantic models separate
- Use type hints and field validators
- Organize models logically in separate modules
- Use BaseModel inheritance to reduce redundancy

### FastAPI Best Practices: Database

- Use SQLAlchemy with `async_session` for async support
- Use Alembic for database migrations
- Pool connections with SQLAlchemy’s engine
- Wrap DB operations in transactions where needed
- Optimize queries using indexes and `selectinload`, `joinedload`
- Handle `IntegrityError` and other DB exceptions cleanly

### FastAPI Best Practices: Authentication

- Use OAuth2 with JWT tokens for authentication
- Store passwords hashed with `bcrypt`
- Protect routes using FastAPI dependencies (`Depends`)
- Implement RBAC (role-based access control)
- Use OAuth2 scopes for granular permissions
- Return appropriate status codes for auth failures

### FastAPI Best Practices: Security

- Enable and configure CORS properly
- Implement rate limiting via middleware or reverse proxy
- Validate all input via Pydantic models
- Set secure HTTP headers using middleware
- Sanitize input where necessary
- Avoid leaking sensitive info in error responses
- Enable HTTPS in production

### FastAPI Best Practices: Performance

- Use async def endpoints and async DB access
- Run background tasks using FastAPI's `BackgroundTasks`
- Cache expensive operations with Redis or similar tools
- Use database indexes and query optimization
- Avoid blocking calls in the main event loop
- Profile and monitor latency and throughput

### FastAPI Best Practices: Testing

- Use `pytest` as the test runner
- Create reusable test fixtures
- Test both positive and negative cases
- Mock external services and DB calls
- Use FastAPI's `TestClient` for integration tests
- Measure and maintain test coverage

### FastAPI Best Practices: Deployment

- Use `uvicorn` with `--workers` for production
- Run behind a reverse proxy like Nginx
- Use Docker for containerized deployments
- Store secrets in environment variables or secret managers
- Automate CI/CD with GitHub Actions, GitLab CI, or similar
- Monitor uptime, logs, and exceptions in production

### FastAPI Best Practices: Documentation

- Add descriptive docstrings to routes and functions
- Leverage FastAPI's automatic OpenAPI generation
- Add summaries and descriptions to endpoints
- Use tags and versioning in route definitions
- Keep the documentation up to date with code changes
- Document expected errors and edge cases

## Git Workflow & Commit Conventions

### Git Workflow & Commit Conventions: Gitmoji Commit Format

- Use **Gitmoji** for all commit messages (enforced by Husky)
- Format: `:<emoji_code>: <commit message>`
- Keep commit messages clear, concise, and descriptive
- Use imperative mood ("Add feature" not "Added feature")
- Common Gitmoji patterns for this project:
  - `:sparkles:` - Add new features (e.g., new endpoints, services)
  - `:bug:` - Fix bugs
  - `:fire:` - Remove code or files
  - `:memo:` - Add or update documentation
  - `:recycle:` - Refactor code
  - `:zap:` - Improve performance
  - `:lock:` - Fix security issues
  - `:white_check_mark:` - Add or update tests
  - `:construction:` - Work in progress
  - `:wrench:` - Add or update configuration files
  - `:package:` - Add or update dependencies
  - `:rocket:` - Deploy stuff
  - `:art:` - Improve structure/format of code
  - `:lipstick:` - Update UI and style files (if applicable)

### Git Workflow & Commit Conventions: Commit Message Examples

```bash
# Good examples
:sparkles: Add file extraction endpoint for PDF/TXT/MD
:bug: Fix token deduction race condition in transactions
:memo: Update API documentation with file upload examples
:recycle: Refactor AI service to use dependency injection
:white_check_mark: Add integration tests for file extraction
:wrench: Configure Docker Compose for Firebase emulators
:zap: Improve Firestore query performance with indexes
:lock: Add file size validation middleware

# Bad examples (avoid these)
:sparkles: updates
:bug: fix
:memo: changes to docs
```

### Git Workflow & Commit Conventions: GitFlow Branching Strategy

- Use **GitFlow** for branch management
- Main branches:
  - `main` - Production-ready code
  - `develop` - Integration branch for features
- Supporting branches:
  - `feature/*` - New features
  - `bugfix/*` - Bug fixes
  - `hotfix/*` - Urgent production fixes
  - `release/*` - Release preparation
- Branch naming conventions:
  - `feature/file-extraction` - Feature branches
  - `bugfix/token-validation` - Bug fix branches
  - `hotfix/security-patch` - Hotfix branches
  - `release/v1.0.0` - Release branches

### Git Workflow & Commit Conventions: Feature Development Workflow

```bash
# Start a new feature
git flow feature start file-extraction

# Make changes and commit with Gitmoji
git add .
git commit -m ":sparkles: Add PDF extraction service"

# Continue development
git commit -m ":white_check_mark: Add tests for PDF extractor"
git commit -m ":memo: Document file extraction API"

# Finish feature (merges to develop)
git flow feature finish file-extraction
```

### Git Workflow & Commit Conventions: Husky Pre-commit Hooks

- Husky runs automatically before commits
- Pre-commit hook runs:
  - ESLint for code quality
  - Prettier for code formatting
  - TypeScript type checking
- Commit-msg hook validates Gitmoji format
- If hooks fail, fix issues before committing
- Never bypass hooks with `--no-verify` unless absolutely necessary

### Git Workflow & Commit Conventions: Pull Request Guidelines

- Create PRs from feature branches to `develop`
- Use descriptive PR titles with Gitmoji
- Include detailed description of changes
- Reference related issues (e.g., "Closes #123")
- Ensure all tests pass before requesting review
- Address review comments promptly
- Squash commits if needed for clean history

### Git Workflow & Commit Conventions: Release Process

```bash
# Start a release
git flow release start v1.0.0

# Make release preparations (version bumps, changelog)
git commit -m ":bookmark: Bump version to 1.0.0"
git commit -m ":memo: Update CHANGELOG for v1.0.0"

# Finish release (merges to main and develop, creates tag)
git flow release finish v1.0.0
```

### Git Workflow & Commit Conventions: Hotfix Process

```bash
# Start a hotfix from main
git flow hotfix start security-patch

# Fix the issue
git commit -m ":lock: Fix file upload security vulnerability"

# Finish hotfix (merges to main and develop, creates tag)
git flow hotfix finish security-patch
```

### Git Workflow & Commit Conventions: Best Practices

- Commit frequently with small, focused changes
- Write meaningful commit messages
- Never commit sensitive data (API keys, secrets)
- Keep commits atomic (one logical change per commit)
- Test locally before committing
- Pull latest changes before starting new work
- Resolve merge conflicts carefully
- Use `.gitignore` to exclude build artifacts and dependencies

## Docker Best Practices

### Docker Best Practices: Dockerfile

- **Use a single, multi-stage `Dockerfile`** for all environments (dev/prod). This
  prevents duplication and ensures the dev build dependencies don't bloat the final
  production image.
- **Generate two specialized files** for specific needs:
  - **`Dockerfile.dev`**: Includes development-only tools (like watchers, debuggers, or
    excessive test dependencies) and is optimized for quick rebuilds. It should expose
    the source code via **volumes** to enable live reloading.
  - **`Dockerfile.prod`** (renamed from `Dockerfile`): A **minimal, multi-stage build**
    designed for final deployment. It strips out all development dependencies, optimizes
    the runtime image, and is the source for your final deployment image.

### Docker Best Practices: Docker

- **Use `docker-compose.yml`** as the **base configuration** shared by all environments
  (networks, shared volumes, common service names).
- **Use `docker-compose.override.yml`** for **local development**. This file is
  automatically loaded and includes things like:
  - **Bind mounts** for hot-reloading.
  - **Environment variables** for local settings.
  - **Exposed ports** for easy access.
- **Use `docker-compose.staging.yml`** for the **staging/testing environment**. This
  file:
  - Overrides the `build` context to use `Dockerfile.prod`.
  - Specifies production-like **environment variables** (database URLs, external service
    keys).
  - Exposes only necessary ports and doesn't include bind mounts.
- **Use `docker-compose.prod.yml`** for the **production/live environment**. This file:
  - Overrides the `build` context to use `Dockerfile.prod`.
  - Specifies **live production environment variables** (production database URLs, final
    external service keys).
  - Exposes only essential ports for the running application and **must not** include
    bind mounts or development tooling

### Docker Best Practices: README.md File

Add a section like this to your project's `README.md` file:

````md
## Docker Operations 🐳

### 1. Local Development (Hot Reloading)

This configuration uses `docker-compose.yml` and automatically loads
`docker-compose.override.yml` for local settings.

#### **Commands**

- **Run (Foreground):** `docker compose up --build`
  - _Builds the image (if necessary) and starts all services in the foreground._
- **Run (Detached):** `docker compose up -d`
  - _Starts services in the background._
- **Restart a Service:** `docker compose restart [service_name]`
  - _Restarts a specific service (e.g., `web`)._
- **Stop All:** `docker compose down`
  - _Stops and removes containers, networks, and volumes._

### 2. Executing Commands Inside a Container

To run one-off commands (like migrations, tests, or shell access) inside your running
development container:

#### **Suggestions**

- **Run a specific command (e.g., database migrations):**
  ```bash
  docker compose exec web npm run migrate
  ```
- **Open a shell (Bash/Sh) inside the main service container:**
  ```bash
  docker compose exec web bash
  ```
  _(Use `sh` instead of `bash` if your image is Alpine-based.)_

### 3. Staging/Production Deployment

Use the dedicated staging configuration for a production-like test run.

#### **Command**

- **Build and Run Production Image:**
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d
  ```
  _This command explicitly uses the base config and the staging override to build and
  run the optimized production image._
````
