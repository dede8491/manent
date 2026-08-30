# Manent — Image / Vision integration testing rules

Follow these rules when testing the `/api/vision` endpoint:

## Image handling rules
- Always use base64-encoded images. Accept a `data:image/...;base64,...` URL or raw base64.
- Accepted formats: JPEG, PNG, WEBP only. Not SVG, BMP, HEIC, GIF.
- Do NOT upload blank / uniform images — must have real edges, textures, text.
- If the file isn't PNG/JPEG/WEBP, transcode before upload.
- Resize huge images to sensible bounds.

## Vision endpoint
`POST /api/vision`
Body:
```json
{ "image_base64": "<data URL or raw base64>", "mode": "transcribe" }
```
Modes:
- `transcribe` — returns `{ text: string }` (French passage transcription via Claude Sonnet 4.6)
- `page_number` — returns `{ page_number: number, raw: string }`

Requires Bearer token from `/api/auth/login` or `/api/auth/register`.
