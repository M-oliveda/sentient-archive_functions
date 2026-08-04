# Notes

[← Back to index](./README.md)

## POST `/v1/notes/extract`

Extract text content from an uploaded file (PDF, TXT, or MD) and create a new note in Firestore.

### Auth

User (Firebase ID token required)

### Token Cost

0 tokens (free)

### Request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
| :---- | :--- | :------- | :---------- |
| `file` | binary | Yes | File to extract (single file per request) |

**Constraints:**

- **Max file size:** 10MB
- **Allowed types:** PDF, TXT, MD
- **Allowed MIME types:** `application/pdf`, `text/plain`, `text/markdown`, `text/x-markdown`
- **Allowed extensions:** `.pdf`, `.txt`, `.md`, `.markdown`

Files are processed in memory and never stored permanently. Only extracted text and metadata are saved.

### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "noteId": "abc123",
    "title": "Document Title",
    "content": "Extracted text content from the file...",
    "excerpt": "Extracted text content from the file...",
    "sourceFile": {
      "name": "document.pdf",
      "type": "pdf",
      "size": 1048576,
      "extractedAt": "2026-08-04T12:00:00.000Z"
    },
    "createdAt": "2026-08-04T12:00:00.000Z"
  },
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

| Field | Type | Description |
| :---- | :--- | :---------- |
| `noteId` | string | Firestore note document ID |
| `title` | string | Generated from filename |
| `content` | string | Full extracted text |
| `excerpt` | string | First 200 characters of content |
| `sourceFile.type` | `"pdf"` \| `"txt"` \| `"md"` | Detected file type |
| `sourceFile.size` | number | File size in bytes |

### Errors

| Code | HTTP | Description |
| :--- | :--- | :---------- |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_REQUEST` | 400 | Content-Type is not `multipart/form-data` |
| `INVALID_FILE` | 400 | File validation failed |
| `FILE_TOO_LARGE` | 413 | File exceeds 10MB |
| `UNSUPPORTED_FILE_TYPE` | 415 | File type not supported |
| `EXTRACTION_FAILED` | 400 | No text content could be extracted |
| `FILE_EXTRACTION_DISABLED` | 503 | Feature disabled by admin |

### Example

```bash
curl -X POST \
  http://localhost:5001/demo-sentient-archive/us-central1/sentientArchiveApi/v1/notes/extract \
  -H "Authorization: Bearer <firebase_id_token>" \
  -F "file=@document.pdf"
```
