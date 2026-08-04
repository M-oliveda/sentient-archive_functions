# Users

[← Back to index](./README.md)

## PUT `/v1/users/me`

Update the authenticated user's profile (display name and/or language preference).

### Auth

User

### Token Cost

None

### Request Body

At least one field must be provided.

```json
{
  "displayName": "Jane Doe",
  "language": "en"
}
```

| Field | Type | Required | Constraints |
| :---- | :--- | :------- | :---------- |
| `displayName` | string | No | Trimmed, 1–80 characters |
| `language` | string | No | `"en"`, `"es"`, `"fr"`, or `"pt"` |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
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
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Validation failed or no fields provided |
| `NOT_FOUND` | 404 | User not found |

### Example

```bash
curl -X PUT \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/users/me \
  -H "Authorization: Bearer <firebase_id_token>" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Jane Doe", "language": "es"}'
```
