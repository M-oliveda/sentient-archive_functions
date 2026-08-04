# Health

[← Back to index](./README.md)

## GET `/health`

Health check endpoint. No authentication required.

### Auth

None

### Token Cost

None

### Request

No body or query parameters.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "SentientArchive API is healthy",
  "version": "1.0.0",
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

### Errors

This endpoint does not return application error codes under normal operation.

### Example

```bash
curl http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/health
```
