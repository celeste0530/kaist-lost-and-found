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

- Request bodies and responses are JSON (`Content-Type: application/json`). The exceptions are item registration and editing (`POST /api/items`, `PUT /api/items/:id`), which take `multipart/form-data` so that an image can be attached.
- JSON keys are camelCase (`operatingHours`, `foundDate`).
- Coordinates are exchanged as two numbers: `lat` (latitude, -90 to 90) and `lng` (longitude, -180 to 180).
- Dates: `DATE` values are `"YYYY-MM-DD"` strings, `DATETIME` values are `"YYYY-MM-DD HH:MM:SS"` strings.
  - All `DATETIME` values (registration date, return date, …) are Korea Standard Time (KST, `+09:00`): the MySQL server runs with `--default-time-zone=+09:00` (see `docker-compose.yml`). A deployed database must use the same setting.

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
| 400 | Invalid input | `name: String must contain at least 1 character(s)`, `Request body is not valid JSON.` |
| 401 | Login required | `Login required.` |
| 403 | Not allowed | `Administrator access required.`, `You can only edit items stored at your center.` |
| 404 | Not found | `Center not found.`, `Item not found.` |
| 409 | Conflicts with the current state | `This center still has Available items and cannot be deleted.`, `Only Available items can be edited.` |
| 413 | JSON body larger than 100 KB | `request entity too large` |
| 500 | Internal server error | `Internal server error.` |

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
| 403 | `This account has been deactivated.` Only returned when the password is correct, so the account state is not revealed to someone who does not know it |

### `POST /api/auth/logout` — Public

Clears the cookie. **204** (no body)

### `GET /api/auth/me` — Staff

The currently logged-in user, in the same format as the login response. **401** when not logged in, or when the account has been deactivated since logging in.

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

**400** `Invalid search parameters.` when a parameter has the wrong format, including impossible dates such as `2026-02-30`.

### `GET /api/items/:id` — Public (FR-06)

**200** + `Item`. Public users can only see `Available` items; any other status returns **404** `Item not found.` (Staff can see every status.)

### `POST /api/items` — Staff (FR-03)

Registers a found item at the logged-in staff member's center.

- Only staff accounts assigned to a center can register items. Administrators have no assigned center and get **403**.
- The storage center is always the staff member's assigned center; a `centerId` in the request is ignored (FR-03: not editable by staff). New items always start as `Available`.
- Send `multipart/form-data` (`FormData`) to attach an image. All form fields arrive as strings; the server converts the coordinates to numbers. Without an image, a JSON body also works.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | ✅ | 1–255 characters after trimming |
| `category` | string | ✅ | One of the categories listed under the Item object |
| `foundDate` | string | ✅ | `YYYY-MM-DD`, a real calendar date, not later than today in Korea time (Asia/Seoul) |
| `foundLat` | number | ✅ | -90 to 90 (in a form, a numeric string such as `"36.3686"`; an empty value is rejected, not read as 0) |
| `foundLng` | number | ✅ | -180 to 180 (same as `foundLat`) |
| `description` | string | ✅ | At least 1 character after trimming, no length limit |
| `image` | file | | One JPG or PNG file, up to 10 MB, in the form field `image` |

- Rules that the SRS does not state, decided during development: impossible dates such as `2026-02-30` are rejected; "today" for the future-date check is the Korean date, whatever the server's or database's time zone; only staff (not administrators) can register.
- The file type is checked with the MIME type the browser sends (`image/jpeg`, `image/png`); the file content itself is not inspected.
- If the request fails for any reason, the uploaded image is not kept.

```js
const form = new FormData();
form.append("name", "Black umbrella");
form.append("category", "Umbrella");
form.append("foundDate", "2026-11-22");
form.append("foundLat", String(lat));
form.append("foundLng", String(lng));
form.append("description", "Long black umbrella found near E3");
if (file) form.append("image", file);
const item = await api("/items", { method: "POST", body: form }); // api() leaves Content-Type to the browser for FormData
```

**201** + the created `Item` (`imageUrl` is the stored file name, or `null` without an image)

| Failure | When |
|---------|------|
| 400 | Invalid input, e.g. `name: String must contain at least 1 character(s)`, `foundDate: Found date cannot be in the future`, `foundDate: Invalid date`; or a rejected image: `image: Only JPG or PNG images are allowed.`, `image: Image must be 10 MB or smaller.` |
| 401 | Not logged in |
| 403 | Logged in as an administrator (no assigned center): `Only staff assigned to a center can register items.` |
| 409 | The staff member's assigned center has been deleted: `Your assigned center has been deleted. Ask an administrator to reassign you.` |

### `PUT /api/items/:id` — Staff (FR-04, FR-10)

Edits an `Available` item.

- Staff can edit items stored at their own center. Administrators can edit items at any center (FR-10).
- Only `Available` items can be edited, by staff and administrators alike. `Returned`, `Removed` and `Disposed` items return **409**.
- The storage center and the status are never changed by this API.
- Request format is the same as `POST /api/items` (`multipart/form-data`, or JSON without an image), with the same field rules. All text fields are required, so a missing field is a 400 error and nothing is cleared by omission.
- Image handling:

| Request | Result |
|---------|--------|
| A new file in `image` | The image is replaced and the old file is deleted |
| `removeImage=true` (no file) | The image is removed (`imageUrl` becomes `null`) and the old file is deleted |
| Neither | The current image is kept |

  If both a file and `removeImage=true` are sent, the new file wins.
- Whether an administrator may edit non-`Available` items was not clear from the SRS (FR-04 vs FR-10); the team chose to allow only `Available` items for everyone.
- If the request fails for any reason, a newly uploaded image is not kept and the current image is unchanged.

```js
const form = new FormData();
form.append("name", "Black umbrella");
form.append("category", "Umbrella");
form.append("foundDate", "2026-11-22");
form.append("foundLat", String(lat));
form.append("foundLng", String(lng));
form.append("description", "Long black umbrella found near E3");
if (newFile) form.append("image", newFile);
else if (removeCurrentImage) form.append("removeImage", "true");
const item = await api(`/items/${id}`, { method: "PUT", body: form });
```

**200** + the updated `Item`

| Failure | When |
|---------|------|
| 400 | Invalid input or rejected image (same messages as `POST /api/items`) |
| 401 | Not logged in |
| 403 | A staff member tries to edit an item stored at another center: `You can only edit items stored at your center.` |
| 404 | No item with this id, or `:id` is not a positive integer: `Item not found.` |
| 409 | The item is not `Available`: `Only Available items can be edited.` |

### `POST /api/items/:id/return` — Staff (FR-08, FR-10)

Marks an `Available` item as `Returned`, after the center has verified the owner offline. No request body.

- Staff can mark items stored at their own center. Administrators can mark items at any center (FR-10).
- Only `Available` items can be marked (3.5.3: Available → Returned). Any other status returns **409**.
- The return date (`return_date`) and the staff user who did it (`returned_by`) are recorded (FR-08). They are not included in the `Item` response.
- The record is kept. A `Returned` item disappears from public search and the map and returns 404 on public details, but staff can still find it with `GET /api/items?status=Returned` and open its details.
- The status change runs in a transaction with a row lock, so when two requests mark the same item at the same time, one succeeds and the other gets 409 (3.4.1).

```js
const item = await api(`/items/${id}/return`, { method: "POST" });
```

**200** + the updated `Item` (`status: "Returned"`)

| Failure | When |
|---------|------|
| 401 | Not logged in |
| 403 | A staff member tries to mark an item stored at another center: `You can only change items stored at your center.` |
| 404 | No item with this id, or `:id` is not a positive integer: `Item not found.` |
| 409 | The item is not `Available` (e.g. already returned): `Only Available items can be marked Returned.` |

### `POST /api/items/:id/remove`, `POST /api/items/:id/dispose` — Staff (FR-09, FR-10)

Marks an `Available` item as `Removed` or `Disposed`. No request body.

| API | New status | When to use (FR-09) |
|-----|------------|---------------------|
| `POST /api/items/:id/remove` | `Removed` | The record was created incorrectly, is a duplicate, or should no longer remain as a valid active record |
| `POST /api/items/:id/dispose` | `Disposed` | The item was validly registered but is no longer stored by the center under its retention or disposal policy |

- Same rules as `POST /api/items/:id/return`: staff can change items stored at their own center, administrators at any center (FR-10); only `Available` items can be changed (3.5.3), otherwise **409**; the change runs in a transaction with a row lock.
- The record is kept. The item disappears from public search, the map and public details, but staff can still find it with `GET /api/items?status=Removed` or `?status=Disposed`.
- `return_date` / `returned_by` stay `null`. Who made the change and when is recorded in the `item_status_history` table instead (SRS 2.1.4), like every status change including registration and returns. The history is not exposed through the API yet.

```js
const item = await api(`/items/${id}/dispose`, { method: "POST" }); // or `/items/${id}/remove`
```

**200** + the updated `Item` (`status: "Removed"` or `"Disposed"`)

| Failure | When |
|---------|------|
| 401 | Not logged in |
| 403 | A staff member tries to change an item stored at another center: `You can only change items stored at your center.` |
| 404 | No item with this id, or `:id` is not a positive integer: `Item not found.` |
| 409 | The item is not `Available`: `Only Available items can be marked Removed.` / `Only Available items can be marked Disposed.` |

---

## Staff accounts (FR-10)

All staff APIs are **Admin** only, so staff members cannot change their own assigned center (FR-10).

### Staff object

The login response fields plus `deactivatedAt`. The password hash is never included (SRS 3.1).

```json
{ "id": 2, "email": "kim@example.com", "displayName": "Kim Minsu", "role": "Staff", "centerId": 3, "deactivatedAt": null }
```

| Field | Type | Rules |
|-------|------|-------|
| `id` | number | Assigned by the server |
| `email` | string | Login ID. Valid email, up to 255 characters, unique (case-insensitive). Cannot be changed after creation |
| `password` | string | **Request only.** 8–72 characters. Stored as a bcrypt hash |
| `displayName` | string | 1–100 characters after trimming |
| `role` | `"Staff"` \| `"Administrator"` | **Response only.** Accounts created through this API are always `Staff` |
| `centerId` | number \| null | Assigned center. Required for `Staff` and must be an active (not deleted) center. `null` for administrators |
| `deactivatedAt` | string \| null | **Response only.** `null` for an active account; otherwise when it was deactivated (`"YYYY-MM-DD HH:MM:SS"`, KST) |

- The password length rule (8–72) is not defined by the SRS: the minimum matches the `create-admin` script, and 72 is bcrypt's input limit.
- Administrator accounts are created with `npm run create-admin` (see README), not through this API.
- Staff accounts are never deleted, only deactivated (see below): items and status history keep referring to the account.

### `GET /api/staff` — Admin

All accounts, administrators included, sorted by role (`Staff` first) and then by display name. **200** + `Staff[]`

| Failure | When |
|---------|------|
| 401 / 403 | Not logged in / not an administrator |

### `POST /api/staff` — Admin

Creates a `Staff` account assigned to one active center.

```json
{ "email": "kim@example.com", "password": "********", "displayName": "Kim", "centerId": 2 }
```

**201** + the created `Staff`. A `role` field in the request is ignored.

| Failure | When |
|---------|------|
| 400 | Invalid input, or `centerId` is not an active center (`centerId: Center not found or deleted.`) |
| 401 / 403 | Not logged in / not an administrator |
| 409 | The email is already used by another account (`email: This email is already in use.`) |

### `PUT /api/staff/:id` — Admin

Renames a staff member, moves them to another active center, and optionally resets their password. Only `Staff` accounts can be edited; administrator accounts return 404.

```json
{ "displayName": "Kim Minsu", "centerId": 3, "password": "********" }
```

- `displayName` and `centerId` are required.
- `password` is optional: **leave it out to keep the current password.** (Unlike `PUT /api/centers/:id`, a missing field here does not clear anything.)
- Moving a staff member to another center does **not** change the storage center of items they registered (FR-10).
- The change applies from the staff member's next request; they do not need to log in again.

**200** + the updated `Staff`

| Failure | When |
|---------|------|
| 400 | Invalid input, or `centerId` is not an active center |
| 401 / 403 | Not logged in / not an administrator |
| 404 | No `Staff` account with this id (including administrator accounts), or `:id` is not a positive integer |

### `POST /api/staff/:id/deactivate`, `POST /api/staff/:id/activate` — Admin

Deactivates or reactivates a `Staff` account. No request body. Administrator accounts cannot be changed (404).

- A deactivated account cannot log in (`POST /api/auth/login` returns 403), and an existing login stops working on its next request (it is treated as not logged in, 401).
- The account row is kept, so the items it registered and the status history it wrote stay intact. A deactivated account can still be edited with `PUT /api/staff/:id`, and its email cannot be reused for a new account.
- `activate` reverses a deactivation; the account can log in again with its current password.
- Deactivating is a soft delete, like deleting a center (`deactivated_at` in `staff_user`). This column is not in the SRS 3.3 table: staff rows cannot be deleted because other tables refer to them.

```js
const staff = await api(`/staff/${id}/deactivate`, { method: "POST" }); // or `/staff/${id}/activate`
```

**200** + the updated `Staff` (`deactivatedAt` set, or back to `null`)

| Failure | When |
|---------|------|
| 401 / 403 | Not logged in / not an administrator |
| 404 | No `Staff` account with this id (including administrator accounts), or `:id` is not a positive integer: `Staff account not found.` |
| 409 | Already in that state: `This staff account is already deactivated.` / `This staff account is already active.` |
