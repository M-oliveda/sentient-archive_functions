# AI

[← Back to index](./README.md)

All AI endpoints require authentication, sufficient token balance, and the corresponding feature to be enabled. Token costs are configurable via [GET /v1/config/](./config.md).

Default costs: summarize **2**, autoTag **1**, flashcards **3**, ragQuery **4**.

Tokens are deducted before the AI operation runs. The user's preferred language (`en`, `es`, `fr`, or `pt`) from their profile is used for AI output.

---

## POST `/v1/ai/summarize`

Summarize note content using Gemini AI. Updates the note's `summary` field.

### Auth

User

### Token Cost

Configurable (default: 2)

### Request Body

```json
{
  "noteId": "note123",
  "maxLength": 200
}
```

| Field | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `noteId` | string | Yes | Min 1 character | — |
| `maxLength` | number | No | Integer, 50–500 | 200 |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "noteId": "note123",
    "summary": "This note discusses quantum computing fundamentals...",
    "tokensUsed": 2,
    "tokenCost": 2,
    "balanceAfter": 18
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed |
| `FEATURE_DISABLED` | 503 | Summarization disabled |
| `INSUFFICIENT_TOKENS` | 402 | Not enough tokens |
| `NOT_FOUND` | 404 | Note not found |
| `AI_API_ERROR` | 502 | Gemini API error |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/ai/summarize \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "note123", "maxLength": 150}'
```

---

## POST `/v1/ai/autoTag`

Generate semantic tags for a note. Updates the note's `aiTags` field.

### Auth

User

### Token Cost

Configurable (default: 1)

### Request Body

```json
{
  "noteId": "note123",
  "maxTags": 5
}
```

| Field | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `noteId` | string | Yes | Min 1 character | — |
| `maxTags` | number | No | Integer, 1–10 | 5 |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "noteId": "note123",
    "tags": ["quantum", "computing", "physics"],
    "tokensUsed": 1,
    "tokenCost": 1,
    "balanceAfter": 17
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed |
| `FEATURE_DISABLED` | 503 | Auto-tagging disabled |
| `INSUFFICIENT_TOKENS` | 402 | Not enough tokens |
| `NOT_FOUND` | 404 | Note not found |
| `AI_API_ERROR` | 502 | Gemini API error |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/ai/autoTag \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "note123", "maxTags": 5}'
```

---

## POST `/v1/ai/flashcards`

Generate study flashcards from a note. Updates the note's `flashcards` field.

### Auth

User

### Token Cost

Configurable (default: 3)

### Request Body

```json
{
  "noteId": "note123",
  "count": 5
}
```

| Field | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `noteId` | string | Yes | Min 1 character | — |
| `count` | number | No | Integer, 2–20 | 5 |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "noteId": "note123",
    "flashcards": [
      { "front": "What is superposition?", "back": "A quantum state..." },
      { "front": "Define entanglement", "back": "A phenomenon where..." }
    ],
    "tokensUsed": 3,
    "tokenCost": 3,
    "balanceAfter": 14
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed |
| `FEATURE_DISABLED` | 503 | Flashcard generation disabled |
| `INSUFFICIENT_TOKENS` | 402 | Not enough tokens |
| `NOT_FOUND` | 404 | Note not found |
| `AI_API_ERROR` | 502 | Gemini API error |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/ai/flashcards \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "note123", "count": 5}'
```

---

## POST `/v1/ai/ragQuery`

Answer a question using Retrieval-Augmented Generation (RAG) over the user's notes.

### Auth

User

### Token Cost

Configurable (default: 4)

### Request Body

```json
{
  "query": "What did I learn about quantum computing?",
  "maxResults": 5
}
```

| Field | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `query` | string | Yes | 3–500 characters | — |
| `maxResults` | number | No | Integer, 1–10 | 5 |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "query": "What did I learn about quantum computing?",
    "answer": "Based on your notes, you learned that...",
    "sourceNoteIds": ["note123", "note456"],
    "tokensUsed": 4,
    "tokenCost": 4,
    "balanceAfter": 10
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed |
| `FEATURE_DISABLED` | 503 | Knowledge Q&A disabled |
| `INSUFFICIENT_TOKENS` | 402 | Not enough tokens |
| `NO_CONTEXT` | 400 | No notes found for context |
| `AI_API_ERROR` | 502 | Gemini API error |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/ai/ragQuery \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "What did I learn about quantum computing?", "maxResults": 5}'
```
