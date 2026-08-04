# Activity

[← Back to index](./README.md)

Client-facing activity feed and summary statistics for the authenticated user.

---

## GET `/v1/activity/`

Get a paginated activity feed for the authenticated user.

### Auth

User

### Token Cost

None

### Query Parameters

| Param | Type | Required | Constraints | Default |
| :---- | :--- | :------- | :---------- | :------ |
| `category` | string | No | `"all"`, `"ai"`, `"tokens"`, `"notes"`, `"folders"` | `"all"` |
| `q` | string | No | Max 200 characters (search) | `""` |
| `limit` | number | No | Integer, 1–100 | 50 |
| `offset` | number | No | Integer, ≥ 0 | 0 |

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "act123",
      "category": "ai",
      "title": "Note summarized",
      "description": "Generated a summary for \"Quantum Computing Basics\"",
      "createdAt": "2026-08-04T12:00:00.000Z",
      "iconHint": "bot"
    }
  ],
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `category` | `"ai"` \| `"tokens"` \| `"notes"` \| `"folders"` | Activity category |
| `iconHint` | `"bot"` \| `"coins"` \| `"file-text"` \| `"folder"` \| `"pencil"` | UI icon hint |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Invalid query parameters |

### Example

```bash
curl "http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/activity/?category=ai&limit=20" \
  -H "Authorization: Bearer <firebase_id_token>"
```

---

## GET `/v1/activity/stats`

Get activity summary statistics for the authenticated user.

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
    "actionsToday": 5,
    "actionsTodayDeltaPct": 25,
    "aiOpsThisWeek": 12,
    "aiOpsThisWeekDeltaPct": -10,
    "totalActions": 150
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `actionsToday` | number | Actions performed today |
| `actionsTodayDeltaPct` | number | Percent change vs yesterday |
| `aiOpsThisWeek` | number | AI operations this week |
| `aiOpsThisWeekDeltaPct` | number | Percent change vs prior week |
| `totalActions` | number | All-time action count |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/activity/stats \
  -H "Authorization: Bearer <firebase_id_token>"
```
