# API Reference

REST API served by the Express server (`server/`). Request/response formats and error codes are documented here so the frontend can be built from this file alone.

- **This English file is the source of truth.** [`api.md`](api.md) is a Korean translation; if the two differ, this file wins.
- Change this file first, then update the Korean translation in the same commit.
- Implementation status is tracked in the FR mapping table in [`implementation-plan.md`](implementation-plan.md).
- When you add an API or change its behaviour, update this document in the same commit.

## Common rules

### Paths

- Every API path starts with `/api`.
- During development the client (Vite, `localhost:5173`) proxies `/api` and `/uploads` to the server (`localhost:4000`), so frontend code uses relative paths such as `fetch("/api/...")`.

### Request / response format

- Request bodies and responses are JSON (`Content-Type: application/json`). Only APIs with image upload use `multipart/form-data` (FR-03/04, not implemented yet).
- JSON keys are camelCase (`operatingHours`, `foundDate`).
- Coordinates are exchanged as two numbers: `lat` (latitude, -90 to 90) and `lng` (longitude, -180 to 180).
- Dates: `DATE` values are `"YYYY-MM-DD"` strings, `DATETIME` values are `"YYYY-MM-DD HH:MM:SS"` strings.
  - ⚠️ The development MySQL container currently runs in UTC, so `DATETIME` values (registration date, return date, …) are 9 hours behind Korean time. How to handle this is still to be decided by the team.

### Authentication

- Staff and administrators log in with `POST /api/auth/login` and receive a `token` cookie (httpOnly, 8 hours). The browser sends it automatically afterwards.
- `fetch` calls from the frontend need `credentials: "include"` (already handled by the `api()` helper in `client/src/api.ts`).
- Public users can call the read-only APIs without logging in.

| Label | Meaning |
|-------|---------|
| Public | No login required |
| Staff | Logged-in staff member or administrator |
| Admin | Administrators only |

### Error responses

Every failure uses the format below. The frontend can show the `error` string to the user as is.

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning | Example message |
|--------|---------|-----------------|
| 400 | Invalid input | `name: String must contain at least 1 character(s)` |
| 401 | Login required | `Login required.` |
| 403 | Not allowed | `Administrator access required.` |
| 404 | Not found | `Center not found.` |
| 409 | Conflicts with the current state | `This center still has Available items and cannot be deleted.` |
| 500 | Internal server error | `Internal server error.` |
| 501 | API not implemented yet | `Not implemented yet (FR-03).` |

Input validation errors (400) report **only the first problem**, formatted as `"<field>: <reason>"`, even when there are several.

---

## Health check

### `GET /api/health` — Public

Checks that the server is running.

```json
{ "ok": true }
```

---

## Authentication (FR-01)

### `POST /api/auth/login` — Public

```json
{ "email": "admin@example.com", "password": "********" }
```

**200** — the logged-in user (the password hash is never included) + sets the `token` cookie

```json
{ "id": 1, "email": "admin@example.com", "displayName": "Administrator", "role": "Administrator", "centerId": null }
```

| Failure | Message |
|---------|---------|
| 400 | `Enter a valid email address and password.` |
| 401 | `Incorrect email or password.` (same message for an unknown email and a wrong password) |

### `POST /api/auth/logout` — Public

Clears the cookie. **204** (no body)

### `GET /api/auth/me` — Staff

The currently logged-in user, in the same format as the login response. **401** when not logged in.

- `role`: `"Staff"` or `"Administrator"`
- `centerId`: the staff member's assigned center. May be `null` for administrators.

---

## Centers (FR-02, FR-10)

### Center object

```json
{
  "id": 1,
  "name": "Main Library Info Desk",
  "lat": 36.3695,
  "lng": 127.362,
  "phone": null,
  "email": "library@example.com",
  "operatingHours": "Weekdays 09:00-17:00",
  "closureInformation": "Closed on weekends"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | number | (response only) | Assigned by the server. Ignored if sent in a request |
| `name` | string | ✅ | 1–255 characters after trimming |
| `lat` | number | ✅ | -90 to 90 |
| `lng` | number | ✅ | -180 to 180 |
| `operatingHours` | string | ✅ | 1–255 characters after trimming (free text) |
| `phone` | string \| null | | Up to 255 characters (format not checked) |
| `email` | string \| null | | Valid email, up to 255 characters |
| `closureInformation` | string \| null | | No length limit |

- To leave an optional field empty, **send `null` or omit the field.** An empty string `""` is currently not converted: `email: ""` fails validation (400) and `phone: ""` is stored as an empty string.
- Deleted centers are hidden from every center API (list, details and edit all treat them as 404).

### `GET /api/centers` — Public

Centers that are not deleted, sorted by name. **200** + `Center[]`

### `GET /api/centers/:id` — Public

**200** + `Center`. **404** `Center not found.` if the center does not exist or was deleted.

### `POST /api/centers` — Admin

Creates a center. The request body is the Center object without `id`.

```json
{ "name": "Main Library", "lat": 36.3695, "lng": 127.362, "operatingHours": "Weekdays 09:00-18:00", "phone": "042-350-0000" }
```

**201** + the created `Center`

| Failure | When |
|---------|------|
| 400 | Invalid input |
| 401 / 403 | Not logged in / not an administrator |

### `PUT /api/centers/:id` — Admin

**Replaces** the center's information as a whole. The request body is the same as for POST.

- ⚠️ **Optional fields that are left out (`phone`, `email`, `closureInformation`) are cleared to `null`.** In the edit screen, load the existing center, edit it, and send the whole object back.
- Whether to switch to partial updates (PATCH) is still under discussion.

**200** + the updated `Center`

| Failure | When |
|---------|------|
| 400 | Invalid input |
| 401 / 403 | Not logged in / not an administrator |
| 404 | Center does not exist or was already deleted, or `:id` is not a positive integer |

### `DELETE /api/centers/:id` — Admin

Deletes a center. This is a **soft delete**: the database row and the center's item records are kept, and the center is only hidden from the center APIs (FR-10: item records are preserved even when a center is deleted).

**204** (no body)

| Failure | When |
|---------|------|
| 401 / 403 | Not logged in / not an administrator |
| 404 | Center does not exist or was already deleted |
| 409 | The center still has items with status `Available` (FR-02) |

---

## Items (FR-03 – FR-09)

### Item object

```json
{
  "id": 1,
  "name": "Black umbrella",
  "category": "Umbrella",
  "foundDate": "2026-11-20",
  "foundLat": 36.3725,
  "foundLng": 127.361,
  "description": "Long black umbrella",
  "imageUrl": null,
  "status": "Available",
  "registrationDate": "2026-11-22 14:00:00",
  "centerId": 1,
  "centerName": "Main Library Info Desk"
}
```

- `category`: `Electronics`, `Wallet/Card`, `Clothing`, `Bag`, `Stationery`, `Umbrella`, `Other`
- `status`: `Available`, `Returned`, `Removed`, `Disposed`
- `imageUrl`: uploaded file name. The image is served at `/uploads/<imageUrl>`. `null` when there is no image

### `GET /api/items` — Public (FR-05, FR-07)

Search, filter and list items. The map screen uses the same API. Sorted by registration date, newest first; no pagination. **200** + `Item[]` (`[]` when nothing matches)

| Query parameter | Description |
|-----------------|-------------|
| `q` | Keyword contained in the name or description (max 100 characters) |
| `category` | One category |
| `foundDateFrom`, `foundDateTo` | Found date range (`YYYY-MM-DD`, inclusive) |
| `centerId` | Storage center |
| `bbox` | Found location range `minLng,minLat,maxLng,maxLat` (temporary approach) |
| `status` | **Staff only.** Public users always get `Available` items only |

Example: `/api/items?q=wallet&category=Wallet/Card&centerId=1`

**400** `Invalid search parameters.` when a parameter has the wrong format.

### `GET /api/items/:id` — Public (FR-06)

**200** + `Item`. Public users can only see `Available` items; any other status returns **404** `Item not found.` (Staff can see every status.)

### Not implemented yet

The APIs below exist only as placeholders and currently return **501**. Their formats will be added here as they are implemented.

| API | Access | FR |
|-----|--------|----|
| `POST /api/items` | Staff | FR-03 Register an item |
| `PUT /api/items/:id` | Staff | FR-04 Edit an item |
| `POST /api/items/:id/return` | Staff | FR-08 Mark as Returned |
| `POST /api/items/:id/remove` | Staff | FR-09 Mark as Removed |
| `POST /api/items/:id/dispose` | Staff | FR-09 Mark as Disposed |

---

## Staff accounts (FR-10)

The APIs below exist only as placeholders and currently return **501**.

| API | Access | Description |
|-----|--------|-------------|
| `GET /api/staff` | Admin | List staff accounts |
| `POST /api/staff` | Admin | Create a staff account and assign a center |
| `PUT /api/staff/:id` | Admin | Change staff details / assigned center |
