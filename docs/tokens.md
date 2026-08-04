# Tokens

[← Back to index](./README.md)

Token economy endpoints for balance queries, transaction history, user token requests, and admin token minting.

---

## GET `/v1/tokens/balance`

Get the authenticated user's current token balance.

### Auth

User

### Token Cost

None

### Request

No body. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "balance": 20,
    "totalGranted": 25,
    "totalSpent": 5
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/tokens/balance \
  -H "Authorization: Bearer <firebase_id_token>"
```

---

## GET `/v1/tokens/history`

Get transaction history for the authenticated user.

### Auth

User

### Token Cost

None

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `limit` | number | No | Integer, 1–100 | 20 |
| `offset` | number | No | Integer, ≥ 0 | 0 |
| `type` | string | No | `"grant"` or `"deduction"` | — |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "tx123",
      "userId": "user123",
      "type": "deduction",
      "amount": 2,
      "operation": "summarize",
      "balanceBefore": 20,
      "balanceAfter": 18,
      "createdAt": "2026-08-04T12:00:00.000Z",
      "description": "Summarize note"
    }
  ],
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `type` | `"grant"` \| `"deduction"` | Transaction direction |
| `operation` | string | `"summarize"`, `"autoTag"`, `"flashcards"`, `"ragQuery"`, or `"admin_grant"` |
| `grantedBy` | string | Admin UID (grants only) |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Invalid query parameters |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/tokens/history?limit=10&type=deduction" \
  -H "Authorization: Bearer <firebase_id_token>"
```

---

## GET `/v1/tokens/requests`

Get all token requests submitted by the authenticated user (newest first).

### Auth

User

### Token Cost

None

### Request

No body. No query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "req123",
      "userId": "user123",
      "amount": 50,
      "status": "pending",
      "createdAt": "2026-08-04T12:00:00.000Z",
      "justification": "Need tokens for research project"
    }
  ],
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `status` | `"pending"` \| `"approved"` \| `"rejected"` | Request status |
| `reviewedAt` | string | ISO 8601 (when reviewed) |
| `reviewedBy` | string | Admin UID (when reviewed) |
| `reason` | string | Admin rejection reason |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/tokens/requests \
  -H "Authorization: Bearer <firebase_id_token>"
```

---

## POST `/v1/tokens/request`

Submit a token request for admin review.

### Auth

User

### Token Cost

None

### Request Body

```json
{
  "amount": 50,
  "justification": "Need tokens for research project"
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `amount` | number | Yes | Integer, positive, max 10,000 |
| `justification` | string | No | 3–500 characters (trimmed) |

### Success Response

**Status:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "req123",
    "userId": "user123",
    "amount": 50,
    "status": "pending",
    "createdAt": "2026-08-04T12:00:00.000Z",
    "justification": "Need tokens for research project"
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/tokens/request \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "justification": "Need tokens for research project"}'
```

---

## POST `/v1/tokens/mint`

Grant tokens to a user. Admin only.

### Auth

Admin

### Token Cost

None

### Request Body

```json
{
  "userId": "target-user-uid",
  "amount": 100,
  "reason": "Initial grant for beta tester"
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `userId` | string | Yes | Min 1 character |
| `amount` | number | Yes | Integer, positive, max 10,000 |
| `reason` | string | Yes | 3–200 characters |

Self-minting (granting tokens to yourself) is not allowed.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "tx456",
    "userId": "target-user-uid",
    "type": "grant",
    "amount": 100,
    "operation": "admin_grant",
    "balanceBefore": 20,
    "balanceAfter": 120,
    "createdAt": "2026-08-04T12:00:00.000Z",
    "description": "Initial grant for beta tester",
    "grantedBy": "admin-uid"
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `UNAUTHORIZED` | 403 | Not an admin |
| `INVALID_REQUEST` | 400 | Validation failed or self-mint attempt |
| `NOT_FOUND` | 404 | Target user not found |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/tokens/mint \
  -H "Authorization: Bearer <admin_firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "target-user-uid", "amount": 100, "reason": "Initial grant for beta tester"}'
```
