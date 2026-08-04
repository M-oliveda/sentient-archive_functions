# Config

[← Back to index](./README.md)

## GET `/v1/config/`

Return feature flags and token costs for the authenticated client. Does not expose AI model settings, prompts, or rate limits (those are admin-only via [GET /v1/admin/config](./admin.md)).

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
    "features": {
      "summarizeEnabled": true,
      "autoTagEnabled": true,
      "flashcardsEnabled": true,
      "ragQueryEnabled": true,
      "fileExtractionEnabled": true
    },
    "tokens": {
      "costs": {
        "summarize": 2,
        "autoTag": 1,
        "flashcards": 3,
        "ragQuery": 4
      }
    }
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

Use this endpoint to determine whether a feature is enabled and how many tokens an operation costs before calling [AI endpoints](./ai.md).

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/config/ \
  -H "Authorization: Bearer <firebase_id_token>"
```
