# Admin

[← Back to index](./README.md)

All endpoints under `/v1/admin/*` require authentication and `role: "admin"`. Middleware is applied to the entire router.

---

## GET `/v1/admin/stats`

Get admin dashboard stats: summary counts, system health, and recent activity.

### Auth

Admin

### Request

No body. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalNotes": 1200,
    "totalTokens": 3500,
    "totalAIOperations": 800,
    "systemHealth": [
      { "service": "Core API", "status": "Operational" },
      { "service": "Firestore", "status": "Operational" },
      { "service": "Auth", "status": "Operational" },
      { "service": "AI (Gemini)", "status": "Operational" }
    ],
    "recentActivity": [
      {
        "id": "tx123",
        "name": "Jane Doe",
        "action": "generated a summary",
        "timeAgo": "2 minutes ago"
      }
    ]
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `systemHealth[].status` | string | `"Operational"`, `"Degraded"`, `"Down"`, or `"In Danger"` |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/stats \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## GET `/v1/admin/analytics`

Get system-wide analytics (users, notes, tokens, AI operations).

### Auth

Admin

### Request

No body. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "active": 120,
      "inactive": 30,
      "admins": 3,
      "clients": 147
    },
    "notes": {
      "total": 1200
    },
    "tokens": {
      "totalGranted": 5000,
      "totalSpent": 1500,
      "netBalance": 3500
    },
    "aiOperations": {
      "total": 800,
      "byType": {
        "summarize": 300,
        "autoTag": 200,
        "flashcards": 150,
        "ragQuery": 150
      }
    }
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/analytics \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## GET `/v1/admin/analytics/trends`

Get system-wide analytics with time-series trends.

### Auth

Admin

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `dateRange` | string | No | `"7d"`, `"30d"`, or `"90d"` | `"30d"` |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "users": { "total": 150, "active": 120, "inactive": 30, "admins": 3, "clients": 147 },
    "notes": { "total": 1200 },
    "tokens": { "totalGranted": 5000, "totalSpent": 1500, "netBalance": 3500 },
    "aiOperations": {
      "total": 800,
      "byType": { "summarize": 300, "autoTag": 200, "flashcards": 150, "ragQuery": 150 }
    },
    "trends": {
      "aiOperationsOverTime": [{ "date": "2026-08-01", "count": 25 }],
      "tokenUsageOverTime": [{ "date": "2026-08-01", "granted": 100, "spent": 50 }],
      "userGrowthOverTime": [{ "date": "2026-08-01", "totalUsers": 150, "newUsers": 5 }]
    },
    "dateRange": "30d"
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Invalid `dateRange` value |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/analytics/trends?dateRange=7d" \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## GET `/v1/admin/users`

List users with filtering, search, and pagination.

### Auth

Admin

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `limit` | number | No | Integer, 1–100 | 20 |
| `offset` | number | No | Integer, ≥ 0 | 0 |
| `role` | string | No | `"client"` or `"admin"` | — |
| `isActive` | boolean | No | `true` or `false` | — |
| `search` | string | No | Max 100 characters (email/displayName) | — |
| `sortBy` | string | No | `"createdAt"`, `"lastLoginAt"`, `"tokenBalance"` | `"createdAt"` |
| `sortOrder` | string | No | `"asc"` or `"desc"` | `"desc"` |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "uid": "user123",
        "email": "jane@example.com",
        "displayName": "Jane Doe",
        "photoURL": null,
        "role": "client",
        "isActive": true,
        "tokenBalance": 20,
        "totalTokensGranted": 25,
        "totalTokensSpent": 5,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "lastLoginAt": "2026-08-04T12:00:00.000Z",
        "updatedAt": "2026-08-04T12:00:00.000Z",
        "preferences": {
          "language": "en",
          "theme": "light",
          "notificationsEnabled": true
        }
      }
    ],
    "total": 150,
    "limit": 20,
    "offset": 0
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Invalid query parameters |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/users?role=client&limit=10" \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## PUT `/v1/admin/users/:id`

Update a user (role, active status, or token balance). Admins cannot modify their own account.

### Auth

Admin

### Path Parameters

| Param | Type | Required | Description |
| :---- | :--- | :------- | :---------- |
| `id` | string | Yes | Target user UID |

### Request Body

At least one field must be provided.

```json
{
  "role": "admin",
  "isActive": true,
  "tokenBalance": 50
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `role` | string | No | `"client"` or `"admin"` |
| `isActive` | boolean | No | — |
| `tokenBalance` | number | No | Integer, ≥ 0 |

### Success Response

**Status:** `200 OK`

Returns the updated user object (same shape as entries in the users list).

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `SELF_MODIFICATION_NOT_ALLOWED` | 403 | Cannot modify own account |
| `INVALID_REQUEST` | 400 | Validation failed or no fields provided |
| `NOT_FOUND` | 404 | User not found |

### Example

```bash
curl -X PUT \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/users/user123 \
  -H "Authorization: Bearer <admin_firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

---

## GET `/v1/admin/config`

Get full system configuration including AI settings, token costs, feature flags, file upload limits, and rate limits.

### Auth

Admin

### Request

No body. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "ai": {
      "model": "gemini-3.5-flash",
      "maxTokensPerRequest": 2048,
      "temperature": 1.0
    },
    "tokens": {
      "initialGrant": {
        "production": 25,
        "development": 50,
        "staging": 50,
        "local": 50
      },
      "costs": {
        "summarize": 2,
        "autoTag": 1,
        "flashcards": 3,
        "ragQuery": 4
      }
    },
    "features": {
      "summarizeEnabled": true,
      "autoTagEnabled": true,
      "flashcardsEnabled": true,
      "ragQueryEnabled": true,
      "fileExtractionEnabled": true
    },
    "fileUpload": {
      "maxSizeBytes": 10485760,
      "allowedTypes": ["application/pdf", "text/plain", "text/markdown"],
      "allowedExtensions": [".pdf", ".txt", ".md"]
    },
    "rateLimits": {
      "aiRequestsPerHour": 60,
      "fileExtractionsPerDay": 20
    },
    "version": 1,
    "lastUpdatedBy": "admin-uid",
    "lastUpdatedAt": "2026-08-04T12:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/config \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## POST `/v1/admin/config`

Update system configuration (partial, deep merge). At least one field must be provided.

### Auth

Admin

### Request Body

Partial configuration object. Supported top-level keys:

| Key | Fields |
| :-- | :----- |
| `ai` | `model`, `maxTokensPerRequest`, `temperature`, `thinkingLevel` (`"minimal"` \| `"low"` \| `"medium"` \| `"high"`), `thinkingBudget` |
| `tokens` | `initialGrant` (per environment), `costs` (per operation) |
| `features` | `summarizeEnabled`, `autoTagEnabled`, `flashcardsEnabled`, `ragQueryEnabled`, `fileExtractionEnabled` |
| `rateLimits` | `aiRequestsPerHour`, `fileExtractionsPerDay` |

```json
{
  "features": {
    "ragQueryEnabled": false
  },
  "tokens": {
    "costs": {
      "summarize": 3
    }
  }
}
```

### Success Response

**Status:** `200 OK`

Returns the full updated configuration (same shape as GET).

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Validation failed or empty body |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/config \
  -H "Authorization: Bearer <admin_firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"features": {"fileExtractionEnabled": false}}'
```

---

## GET `/v1/admin/token-requests`

List token requests for admin review with filtering.

### Auth

Admin

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `limit` | number | No | Integer, 1–100 | 20 |
| `offset` | number | No | Integer, ≥ 0 | 0 |
| `status` | string | No | `"pending"`, `"approved"`, `"rejected"`, `"all"` | `"all"` |
| `userId` | string | No | Filter by user UID | — |
| `startDate` | string | No | `YYYY-MM-DD` | — |
| `endDate` | string | No | `YYYY-MM-DD` | — |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "req123",
        "userId": "user123",
        "amount": 50,
        "status": "pending",
        "createdAt": "2026-08-04T12:00:00.000Z",
        "justification": "Need tokens for research"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Invalid query parameters |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/token-requests?status=pending" \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```

---

## POST `/v1/admin/token-requests/:id/approve`

Approve a token request and grant tokens to the user.

### Auth

Admin

### Path Parameters

| Param | Type | Required | Description |
| :---- | :--- | :------- | :---------- |
| `id` | string | Yes | Token request ID |

### Request Body

```json
{
  "amount": 50,
  "notes": "Approved for research project"
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `amount` | number | No | Integer, positive, max 10,000 (overrides requested amount) |
| `notes` | string | No | Max 500 characters |

### Success Response

**Status:** `200 OK`

Returns the approved token request with `status: "approved"` and `reviewedAt` set.

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Validation failed |
| `NOT_FOUND` | 404 | Request not found |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/token-requests/req123/approve \
  -H "Authorization: Bearer <admin_firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "notes": "Approved for research project"}'
```

---

## POST `/v1/admin/token-requests/:id/reject`

Reject a token request.

### Auth

Admin

### Path Parameters

| Param | Type | Required | Description |
| :---- | :--- | :------- | :---------- |
| `id` | string | Yes | Token request ID |

### Request Body

```json
{
  "reason": "Insufficient justification provided"
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `reason` | string | No | Max 500 characters |

### Success Response

**Status:** `200 OK`

Returns the rejected token request with `status: "rejected"` and `reviewedAt` set.

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Validation failed |
| `NOT_FOUND` | 404 | Request not found |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/token-requests/req123/reject \
  -H "Authorization: Bearer <admin_firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Insufficient justification provided"}'
```

---

## GET `/v1/admin/activity-logs`

Get system-wide activity logs with filtering and search.

### Auth

Admin

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `limit` | number | No | Integer, 1–100 | 50 |
| `offset` | number | No | Integer, ≥ 0 | 0 |
| `category` | string | No | `"all"`, `"ai"`, `"tokens"`, `"notes"`, `"folders"` | `"all"` |
| `userId` | string | No | Filter by user UID | — |
| `q` | string | No | Search query | `""` |
| `startDate` | string | No | ISO date string | — |
| `endDate` | string | No | ISO date string | — |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "act123",
        "category": "ai",
        "title": "Note summarized",
        "description": "Generated a summary",
        "createdAt": "2026-08-04T12:00:00.000Z",
        "iconHint": "bot",
        "userId": "user123",
        "userEmail": "jane@example.com",
        "userName": "Jane Doe"
      }
    ],
    "total": 500,
    "limit": 50,
    "offset": 0
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Invalid category |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/admin/activity-logs?category=ai&limit=20" \
  -H "Authorization: Bearer <admin_firebase_id_token>"
```
