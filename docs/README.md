# SentientArchive API Documentation

Canonical reference for all HTTP endpoints exposed by the `sentientArchiveApi` Cloud Function.

## Base URLs

| Environment | Base URL |
| :---------- | :------- |
| **Local (Emulator)** | `http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi` |
| **Development** | `https://us-central1-moliveda-gcloudprojects-dev.cloudfunctions.net/sentientArchiveApi` |
| **Staging** | `https://us-central1-moliveda-gcloudprojects-stg.cloudfunctions.net/sentientArchiveApi` |
| **Production** | `https://us-central1-moliveda-gcloudprojects-prod.cloudfunctions.net/sentientArchiveApi` |

All endpoint paths below are relative to the base URL (e.g. `GET /health`, `POST /v1/notes/extract`).

## Authentication

All endpoints except [GET /health](./health.md) require a Firebase ID token:

```text
Authorization: Bearer <firebase_id_token>
```

**Admin endpoints** under `/v1/admin/*` additionally require the authenticated user to have `role: "admin"`.

## Response Format

All endpoints return a consistent JSON envelope:

```typescript
// Success
{
  success: true,
  data: { ... },
  timestamp?: string  // ISO 8601
}

// Error
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: object
  },
  timestamp?: string
}
```

Validation failures return `400` with `code: "INVALID_REQUEST"` and `details.errors` listing field-level issues.

## Error Codes

| Code | HTTP Status | Description |
| :--- | :---------- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid Firebase ID token |
| `UNAUTHORIZED` | 403 | Insufficient permissions (non-admin accessing admin route) |
| `INSUFFICIENT_TOKENS` | 402 | Not enough tokens for the operation |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_REQUEST` | 400 | Validation failed or malformed request |
| `INVALID_FILE` | 400 | File validation failed |
| `FILE_TOO_LARGE` | 413 | File exceeds 10MB limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | File type not supported |
| `EXTRACTION_FAILED` | 400 | No text content could be extracted |
| `AI_API_ERROR` | 502 | Gemini API error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `FILE_EXTRACTION_DISABLED` | 503 | File extraction disabled by admin |
| `FEATURE_DISABLED` | 503 | AI feature disabled by admin |
| `NO_CONTEXT` | 400 | No notes found for RAG query context |
| `SELF_MODIFICATION_NOT_ALLOWED` | 403 | Admin cannot modify their own account |

## Endpoint Index

| Method | Path | Auth | Token Cost | Documentation |
| :----- | :--- | :--- | :--------- | :------------ |
| GET | `/health` | None | — | [health.md](./health.md) |
| POST | `/v1/notes/extract` | User | 0 | [notes.md](./notes.md) |
| POST | `/v1/ai/summarize` | User | Configurable | [ai.md](./ai.md) |
| POST | `/v1/ai/autoTag` | User | Configurable | [ai.md](./ai.md) |
| POST | `/v1/ai/flashcards` | User | Configurable | [ai.md](./ai.md) |
| POST | `/v1/ai/ragQuery` | User | Configurable | [ai.md](./ai.md) |
| GET | `/v1/tokens/balance` | User | — | [tokens.md](./tokens.md) |
| GET | `/v1/tokens/history` | User | — | [tokens.md](./tokens.md) |
| GET | `/v1/tokens/requests` | User | — | [tokens.md](./tokens.md) |
| POST | `/v1/tokens/request` | User | — | [tokens.md](./tokens.md) |
| POST | `/v1/tokens/mint` | Admin | — | [tokens.md](./tokens.md) |
| PUT | `/v1/users/me` | User | — | [users.md](./users.md) |
| GET | `/v1/activity/` | User | — | [activity.md](./activity.md) |
| GET | `/v1/activity/stats` | User | — | [activity.md](./activity.md) |
| GET | `/v1/config/` | User | — | [config.md](./config.md) |
| GET | `/v1/admin/stats` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/analytics` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/analytics/trends` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/users` | Admin | — | [admin.md](./admin.md) |
| PUT | `/v1/admin/users/:id` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/config` | Admin | — | [admin.md](./admin.md) |
| POST | `/v1/admin/config` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/token-requests` | Admin | — | [admin.md](./admin.md) |
| POST | `/v1/admin/token-requests/:id/approve` | Admin | — | [admin.md](./admin.md) |
| POST | `/v1/admin/token-requests/:id/reject` | Admin | — | [admin.md](./admin.md) |
| GET | `/v1/admin/activity-logs` | Admin | — | [admin.md](./admin.md) |

Default token costs (configurable via system config):

| Operation | Default Cost |
| :-------- | :----------- |
| File extraction | 0 |
| Auto-tag | 1 |
| Summarize | 2 |
| Flashcards | 3 |
| RAG query | 4 |

Current costs and feature flags are available at [GET /v1/config/](./config.md).

## Non-HTTP Triggers

The following Firebase trigger is not an HTTP endpoint:

- **`createUserProfile`** — `beforeUserCreated` Auth trigger that creates a Firestore user profile on signup.

## Domain Documentation

- [Health](./health.md)
- [Notes](./notes.md)
- [AI](./ai.md)
- [Tokens](./tokens.md)
- [Users](./users.md)
- [Activity](./activity.md)
- [Config](./config.md)
- [Admin](./admin.md)
