# API 명세

Express 서버(`server/`)가 제공하는 REST API 목록입니다. 프런트엔드는 이 문서만 보고 화면을 붙일 수 있도록, 요청/응답 형식과 오류 코드를 함께 적습니다.

- **기준 문서는 영어판 [`api.en.md`](api.en.md)입니다.** 이 파일은 한국어 번역본이며, 두 문서의 내용이 다르면 영어판이 우선입니다.
- API 문서를 고칠 때는 영어판을 먼저 고치고, 같은 커밋에서 이 번역본도 맞춰 주세요.
- 구현 상태는 [`implementation-plan.md`](implementation-plan.md)의 FR 매핑 표와 같이 관리합니다.
- API를 추가하거나 동작을 바꾸면 이 문서도 같은 커밋에서 고쳐 주세요.

## 공통 규칙

### 주소

- 모든 API는 `/api`로 시작합니다.
- 개발 중에는 클라이언트(Vite, `localhost:5173`)가 `/api`, `/uploads` 요청을 서버(`localhost:4000`)로 프록시합니다. 그래서 프런트 코드에서는 `fetch("/api/...")`처럼 상대 경로를 씁니다.

### 요청 / 응답 형식

- 요청 본문과 응답은 JSON입니다 (`Content-Type: application/json`). 이미지 업로드가 있는 API만 `multipart/form-data`를 씁니다 (FR-03/04, 아직 미구현).
- JSON 키는 camelCase입니다 (`operatingHours`, `foundDate`).
- 좌표는 숫자 두 개 `lat`(위도, -90~90), `lng`(경도, -180~180)로 주고받습니다.
- 날짜: `DATE`는 `"YYYY-MM-DD"`, `DATETIME`은 `"YYYY-MM-DD HH:MM:SS"` 문자열입니다.
  - ⚠️ 현재 개발용 MySQL 컨테이너의 시간대가 UTC라서, `DATETIME` 값(등록일, 반환일 등)은 한국 시각보다 9시간 이릅니다. 처리 방식은 팀에서 결정 예정입니다.

### 인증

- 직원/관리자는 `POST /api/auth/login`으로 로그인하면 `token` 쿠키(httpOnly, 8시간)를 받습니다. 이후 요청에 쿠키가 자동으로 실립니다.
- 프런트에서 `fetch`를 쓸 때는 `credentials: "include"`가 필요합니다 (`client/src/api.ts`의 `api()` 헬퍼가 이미 처리함).
- 일반 사용자(Public)는 로그인 없이 조회 API를 쓸 수 있습니다.

| 표기 | 의미 |
|------|------|
| Public | 로그인 없이 호출 가능 |
| Staff | 로그인한 직원 또는 관리자 |
| Admin | 관리자만 |

### 오류 응답

실패하면 항상 다음 형식으로 응답합니다. 프런트는 `error` 문자열을 그대로 화면에 보여 주면 됩니다.

```json
{ "error": "사람이 읽을 수 있는 오류 메시지" }
```

| 상태 코드 | 의미 | 예시 메시지 |
|-----------|------|-------------|
| 400 | 입력값 오류 | `name: String must contain at least 1 character(s)` |
| 401 | 로그인 필요 | `Login required.` |
| 403 | 권한 없음 | `Administrator access required.` |
| 404 | 대상 없음 | `Center not found.` |
| 409 | 현재 상태와 충돌 | `This center still has Available items and cannot be deleted.`, `email: This email is already in use.` |
| 500 | 서버 내부 오류 | `Internal server error.` |
| 501 | 아직 구현되지 않은 API | `Not implemented yet (FR-03).` |

입력값 검사(400)는 문제가 여러 개여도 **첫 번째 문제 하나**만 `"<필드>: <이유>"` 형식으로 알려 줍니다.

---

## 상태 확인

### `GET /api/health` — Public

서버가 살아 있는지 확인합니다.

```json
{ "ok": true }
```

---

## 인증 (FR-01)

### `POST /api/auth/login` — Public

```json
{ "email": "admin@example.com", "password": "********" }
```

**200** — 로그인한 사용자 정보 (비밀번호 해시는 절대 포함되지 않음) + `token` 쿠키 설정

```json
{ "id": 1, "email": "admin@example.com", "displayName": "Administrator", "role": "Administrator", "centerId": null }
```

| 실패 | 메시지 |
|------|--------|
| 400 | `Enter a valid email address and password.` |
| 401 | `Incorrect email or password.` (이메일이 없을 때와 비밀번호가 틀릴 때 같은 메시지) |

### `POST /api/auth/logout` — Public

쿠키를 지웁니다. **204** (본문 없음)

### `GET /api/auth/me` — Staff

현재 로그인한 사용자 정보. 응답 형식은 로그인과 같습니다. 로그인하지 않았으면 **401**.

- `role`: `"Staff"` 또는 `"Administrator"`
- `centerId`: 직원의 배정 센터. 관리자는 `null`일 수 있습니다.

---

## 센터 (FR-02, FR-10)

### Center 객체

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

| 필드 | 타입 | 필수 | 규칙 |
|------|------|------|------|
| `id` | number | (응답 전용) | 서버가 부여. 요청에 넣어도 무시됨 |
| `name` | string | ✅ | 앞뒤 공백 제거 후 1~255자 |
| `lat` | number | ✅ | -90 ~ 90 |
| `lng` | number | ✅ | -180 ~ 180 |
| `operatingHours` | string | ✅ | 앞뒤 공백 제거 후 1~255자 (자유 형식) |
| `phone` | string \| null | | 최대 255자 (형식 검사 없음) |
| `email` | string \| null | | 이메일 형식, 최대 255자 |
| `closureInformation` | string \| null | | 길이 제한 없음 |

- 선택 필드를 비우려면 **`null`을 보내거나 필드를 빼 주세요.** 빈 문자열 `""`은 현재 그대로 처리되어, `email: ""`은 형식 오류(400)가 되고 `phone: ""`은 빈 문자열로 저장됩니다.
- 삭제된 센터는 어떤 센터 API에서도 보이지 않습니다 (목록, 상세, 수정 모두 404 취급).

### `GET /api/centers` — Public

삭제되지 않은 센터 목록. 이름순 정렬. **200** + `Center[]`

### `GET /api/centers/:id` — Public

**200** + `Center`. 없거나 삭제된 센터면 **404** `Center not found.`

### `POST /api/centers` — Admin

센터를 새로 만듭니다. 요청 본문은 Center 객체에서 `id`를 뺀 것입니다.

```json
{ "name": "Main Library", "lat": 36.3695, "lng": 127.362, "operatingHours": "Weekdays 09:00-18:00", "phone": "042-350-0000" }
```

**201** + 생성된 `Center`

| 실패 | 경우 |
|------|------|
| 400 | 입력값 오류 |
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |

### `PUT /api/centers/:id` — Admin

센터 정보를 **통째로 교체**합니다. 요청 본문은 POST와 같습니다.

- ⚠️ **빠뜨린 선택 필드(`phone`, `email`, `closureInformation`)는 `null`로 지워집니다.** 수정 화면에서는 기존 센터 정보를 불러와 고친 뒤 전체를 다시 보내 주세요.
- 부분 수정(PATCH) 방식으로 바꿀지는 아직 논의 중입니다.

**200** + 수정된 `Center`

| 실패 | 경우 |
|------|------|
| 400 | 입력값 오류 |
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |
| 404 | 없거나 이미 삭제된 센터, 또는 `:id`가 양의 정수가 아님 |

### `DELETE /api/centers/:id` — Admin

센터를 삭제합니다. **소프트 삭제**라서 DB 행과 그 센터의 물품 기록은 남고, 이후 센터 API에서만 보이지 않게 됩니다 (FR-10: 센터가 삭제돼도 물품 기록 보존).

**204** (본문 없음)

| 실패 | 경우 |
|------|------|
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |
| 404 | 없거나 이미 삭제된 센터 |
| 409 | 상태가 `Available`인 물품이 남아 있음 (FR-02) |

---

## 물품 (FR-03 ~ FR-09)

### Item 객체

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
- `imageUrl`: 업로드된 파일 이름. 이미지 주소는 `/uploads/<imageUrl>`. 이미지가 없으면 `null`

### `GET /api/items` — Public (FR-05, FR-07)

검색/필터/목록. 지도 화면도 같은 API를 씁니다. 등록일 최신순 정렬, 페이지 나눔 없음. **200** + `Item[]` (결과가 없으면 `[]`)

| 쿼리 파라미터 | 설명 |
|---------------|------|
| `q` | 이름 또는 설명에 포함된 키워드 (최대 100자) |
| `category` | 카테고리 하나 |
| `foundDateFrom`, `foundDateTo` | 습득 날짜 범위 (`YYYY-MM-DD`, 양 끝 포함) |
| `centerId` | 보관 센터 |
| `bbox` | 습득 위치 범위 `minLng,minLat,maxLng,maxLat` (임시 방식) |
| `status` | **Staff만** 적용. 일반 사용자는 항상 `Available`만 받음 |

예: `/api/items?q=wallet&category=Wallet/Card&centerId=1`

파라미터 형식이 틀리면 **400** `Invalid search parameters.`

### `GET /api/items/:id` — Public (FR-06)

**200** + `Item`. 일반 사용자에게는 `Available`인 물품만 보이고, 그 외 상태는 **404** `Item not found.` (Staff는 모든 상태 조회 가능)

### 미구현 API

아래 API는 자리만 있고 현재 **501**을 응답합니다. 구현하면서 이 문서에 형식을 채워 넣습니다.

| API | 권한 | FR |
|-----|------|----|
| `POST /api/items` | Staff | FR-03 물품 등록 |
| `PUT /api/items/:id` | Staff | FR-04 물품 수정 |
| `POST /api/items/:id/return` | Staff | FR-08 반환 처리 |
| `POST /api/items/:id/remove` | Staff | FR-09 Removed 처리 |
| `POST /api/items/:id/dispose` | Staff | FR-09 Disposed 처리 |

---

## 직원 계정 (FR-10)

직원 API는 모두 **Admin** 전용입니다. 그래서 직원은 자기 배정 센터를 바꿀 수 없습니다 (FR-10).

### Staff 객체

로그인 응답과 같은 모양입니다. 비밀번호 해시는 절대 포함되지 않습니다 (SRS 3.1).

```json
{ "id": 2, "email": "kim@example.com", "displayName": "Kim Minsu", "role": "Staff", "centerId": 3 }
```

| 필드 | 타입 | 규칙 |
|------|------|------|
| `id` | number | 서버가 부여 |
| `email` | string | 로그인 ID. 이메일 형식, 최대 255자, 중복 불가(대소문자 구분 없음). 생성 후 변경 불가 |
| `password` | string | **요청 전용.** 8~72자. bcrypt 해시로 저장 |
| `displayName` | string | 앞뒤 공백 제거 후 1~100자 |
| `role` | `"Staff"` \| `"Administrator"` | **응답 전용.** 이 API로 만든 계정은 항상 `Staff` |
| `centerId` | number \| null | 배정 센터. `Staff`는 필수이며 삭제되지 않은 센터여야 함. 관리자는 `null` |

- 비밀번호 길이 규칙(8~72자)은 SRS에 정의되어 있지 않습니다. 최소값은 `create-admin` 스크립트와 맞췄고, 72는 bcrypt의 입력 한계입니다.
- 관리자 계정은 이 API가 아니라 `npm run create-admin`으로 만듭니다 (README 참고).
- 직원 계정 비활성화·삭제는 아직 구현되지 않았습니다.

### `GET /api/staff` — Admin

관리자를 포함한 모든 계정. 역할(`Staff` 먼저) → 표시 이름 순으로 정렬. **200** + `Staff[]`

| 실패 | 경우 |
|------|------|
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |

### `POST /api/staff` — Admin

살아 있는 센터 하나에 배정된 `Staff` 계정을 만듭니다.

```json
{ "email": "kim@example.com", "password": "********", "displayName": "Kim", "centerId": 2 }
```

**201** + 생성된 `Staff`. 요청에 `role`을 넣어도 무시됩니다.

| 실패 | 경우 |
|------|------|
| 400 | 입력값 오류, 또는 `centerId`가 살아 있는 센터가 아님 (`centerId: Center not found or deleted.`) |
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |
| 409 | 이미 다른 계정이 쓰는 이메일 (`email: This email is already in use.`) |

### `PUT /api/staff/:id` — Admin

직원의 이름을 바꾸거나, 다른 살아 있는 센터로 옮기거나, 비밀번호를 재설정합니다(선택). `Staff` 계정만 수정할 수 있고, 관리자 계정은 404입니다.

```json
{ "displayName": "Kim Minsu", "centerId": 3, "password": "********" }
```

- `displayName`, `centerId`는 필수입니다.
- `password`는 선택입니다. **빼고 보내면 기존 비밀번호가 유지됩니다.** (`PUT /api/centers/:id`와 달리, 여기서는 빠진 필드가 지워지지 않습니다.)
- 직원을 다른 센터로 옮겨도 그 직원이 등록한 물품의 보관 센터는 **바뀌지 않습니다** (FR-10).
- 변경 사항은 직원의 다음 요청부터 바로 적용되며, 다시 로그인할 필요가 없습니다.

**200** + 수정된 `Staff`

| 실패 | 경우 |
|------|------|
| 400 | 입력값 오류, 또는 `centerId`가 살아 있는 센터가 아님 |
| 401 / 403 | 로그인 안 함 / 관리자가 아님 |
| 404 | 해당 id의 `Staff` 계정이 없음 (관리자 계정 포함), 또는 `:id`가 양의 정수가 아님 |
