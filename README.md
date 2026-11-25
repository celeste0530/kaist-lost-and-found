# KAIST Lost and Found System

KAIST 캠퍼스 내 여러 분실물 보관소(Lost-and-Found Center)에 흩어져 있는 습득물 정보를 한곳에서 검색할 수 있는 웹사이트입니다.

- Team: TEAM 9
- SRS Version: 1.1 (2026-10-06) → [`docs/Team9_SRS.pdf`](docs/Team9_SRS.pdf)

## 개요

- 습득자는 사이트를 쓰지 않고 가까운 보관소에 물건을 전달합니다.
- 보관소 직원(Center Staff)이 물건 정보를 시스템에 등록합니다.
- 누구나 로그인 없이 습득물을 검색/조회할 수 있고, 습득 위치와 보관 센터를 확인할 수 있습니다.
- 소유자 확인과 실제 반환은 오프라인에서 센터 직원이 처리하고, 이후 시스템에서 상태를 갱신합니다.

| 역할 | 권한 |
|------|------|
| Public User | 로그인 없이 습득물/센터 검색 및 조회 |
| Center Staff | 자기 센터 소속 습득물 등록/수정/상태 변경 |
| Administrator | 센터, 직원 계정, 전체 습득물 기록 관리 |

습득물 상태: `Available` → `Returned` / `Removed` / `Disposed`. 기본 공개 검색에는 `Available`만 표시됩니다.

## 기술 스택

SRS에는 스택이 정해져 있지 않아(2.1.4) 아래 기본값으로 시작했습니다. 팀 합의 후 바꿔도 됩니다.

| 영역 | 선택 |
|------|------|
| Server | Node.js + Express 5 + TypeScript |
| Client | React 18 + Vite + TypeScript, React Router |
| DB | MySQL 8 (SRS의 ENUM / POINT 타입과 맞춤) |
| Map | Leaflet + OpenStreetMap (API 키 불필요) |
| Auth | 이메일/비밀번호(bcrypt), JWT를 httpOnly 쿠키로 사용 |

## 폴더 구조

```
.
├── client/            React 프런트엔드 (화면: SRS 2.1.2)
│   └── src/pages/     LostItemList, LostItemMap, ItemDetails, CenterList, CenterDetails,
│                      StaffLogin, ItemForm, CenterInventory, AdminPage
├── server/            Express API
│   └── src/
│       ├── routes/    auth, items, centers, staff
│       ├── middleware/ auth(인증/권한), upload(JPG/PNG 10MB)
│       └── scripts/   createAdmin (최초 관리자 생성)
├── db/schema.sql      SRS 3.3 기반 DB 스키마 (+ 상태 이력 테이블)
├── db/seed.sql        개발용 샘플 데이터
├── docs/              SRS, 구현 계획(FR 매핑 + SRS 해석 메모), API 명세(api.en.md 기준, api.md 번역)
└── docker-compose.yml 개발용 MySQL
```

## 실행 방법

필요한 것: Node.js 20+, Docker (MySQL용)

```bash
# 1) DB 실행 (최초 1회 db/schema.sql 자동 적용)
docker compose up -d

# 2) 서버
cd server
cp .env.example .env
npm install
npm run create-admin -- admin@example.com 'your-password'   # 최초 관리자 계정
npm run dev                                                 # http://localhost:4000

# 3) 클라이언트 (다른 터미널)
cd client
npm install
npm run dev                                                 # http://localhost:5173
```

- 스키마를 다시 적용하려면 `docker compose down -v` 후 `docker compose up -d` (로컬 DB 데이터가 모두 지워짐)
- DB의 날짜·시간은 모두 한국 시간(KST, `+09:00`) 기준입니다.
- DB를 처음 만들 때 [`db/seed.sql`](db/seed.sql)의 샘플 데이터가 함께 들어갑니다: 센터 5개(1개는 삭제됨), 물품 28개(Available 17 / Returned 5 / Removed 2 / Disposed 4).
- 샘플 계정 (**로컬 개발 전용**, 비밀번호는 모두 `password1234`). 시드를 쓰면 `create-admin`은 건너뛰어도 됩니다.

  | 이메일 | 역할 | 센터 |
  |--------|------|------|
  | `admin@lostfound.test` | Administrator | - |
  | `staff1@lostfound.test` ~ `staff4@lostfound.test` | Staff | 1 ~ 4 |
- 시드 없이 직접 데이터를 넣으려면: 관리자 계정으로 센터(`POST /api/centers`)와 직원 계정(`POST /api/staff`)을 만든 뒤, 직원 계정으로 로그인해 물품(`POST /api/items`)을 등록합니다. 요청 형식은 [API 명세](docs/api.en.md)를 참고하세요.
- 업로드된 이미지는 `server/uploads/`에 저장됩니다(git에는 올라가지 않음).

### 테스트

서버 API를 실제 HTTP 요청으로 확인하는 자동 테스트입니다(SRS 3.7.2 테스트 케이스 10개 포함). MySQL 8 서버가 실행 중이어야 합니다. 기본값은 이 저장소의 Docker MySQL에 맞춰져 있어서, Docker를 쓰면 설정 없이 바로 실행됩니다.

```bash
cd server
npm test
```

- 테스트는 같은 MySQL 안의 **별도 DB `lostfound_test`**를 매번 `db/schema.sql` + `db/seed.sql`로 새로 만들어 사용합니다. 개발용 DB(`lostfound`)와 `server/uploads/`는 건드리지 않습니다(업로드는 임시 폴더 사용).
- 테스트 DB를 만들고 지우기 위해 MySQL 관리자 계정을 씁니다. Docker가 아닌 MySQL(직접 설치, CI 등)에서는 아래 환경 변수로 맞춰 주세요.

  | 환경 변수 | 기본값 | 의미 |
  |-----------|--------|------|
  | `DB_HOST`, `DB_PORT` | `localhost`, `3306` | MySQL 서버 주소 |
  | `TEST_DB_ADMIN_USER` | `root` | DB를 만들고 권한을 줄 수 있는 계정 |
  | `TEST_DB_ADMIN_PASSWORD` | `rootpassword` (`docker-compose.yml`) | 그 계정의 비밀번호 |
  | `DB_USER`, `DB_PASSWORD` | `lostfound`, `lostfound` (`.env`) | 서버가 접속하는 계정 (미리 만들어져 있어야 함) |
  | `TEST_DB_GRANT_HOST` | `%` | 서버 계정의 호스트 부분. 계정이 `'lostfound'@'localhost'`로 만들어졌다면 `localhost` |
  | `TEST_DB_NAME` | `lostfound_test` | 테스트용 DB 이름 (매번 지우고 새로 만듦) |

  예 (PowerShell): `$env:TEST_DB_ADMIN_PASSWORD = "내 root 비밀번호"; $env:TEST_DB_GRANT_HOST = "localhost"; npm test`
- MySQL 8이 필요합니다(`utf8mb4_0900_ai_ci` 정렬 규칙과 공간 함수 사용). MariaDB나 MySQL 5.7은 지원하지 않습니다.
- 테스트는 시드 데이터(계정, 물품 번호와 상태)를 전제로 합니다. `db/seed.sql`을 바꾸면 `server/test/`의 테스트도 함께 확인해 주세요.
- 테스트 코드의 타입 검사: `npm run typecheck:test`

### 성능 측정 (SRS 3.2)

```bash
cd server
npm run perf
```

- 테스트 DB를 시드로 다시 만든 뒤 물품을 **1,000건**까지 채우고, **동시 사용자 5명**이 검색 요청 500개(19가지 검색 조건)를 보내 **2초 이내 비율**을 잽니다. 상태 변경(반환)이 바로 다음 검색에 반영되는지도 확인합니다.
- 측정용 서버와 가상 사용자가 같은 프로세스에서 돌기 때문에 결과는 보수적인(느리게 나오는) 값입니다. 네트워크 지연이 없는 로컬 측정이므로, 배포 후에는 실제 환경에서 다시 확인하는 것이 좋습니다.

## 구현 현황

| FR | 내용 | API | 화면 |
|----|------|-----|------|
| FR-01 | 직원 로그인/로그아웃 | 구현됨 |
| FR-02 | 센터 관리 | 구현됨 (생성/수정/삭제, 삭제는 소프트 삭제 + Available 물품 있으면 거절) | 조회만 (AdminPage TODO) |
| FR-03 | 습득물 등록 | 구현됨 (센터에 배정된 직원만, 이미지 JPG/PNG 10MB 선택, 보관 센터는 직원의 배정 센터로 자동 지정) | TODO (ItemForm) |
| FR-04 | 습득물 수정 | 구현됨 (Available 물품만, 직원은 자기 센터 물품, 관리자는 모든 센터 물품. 이미지 교체/유지/삭제) | TODO (ItemForm) |
| FR-05 | 검색/필터 | 구현됨 (키워드·카테고리·날짜·센터·좌표(bbox)) | 키워드·카테고리만 |
| FR-06 | 습득물 상세 | 구현됨 | 구현됨 |
| FR-07 | 지도 탐색 | 구현됨 | 기본 구현, 겹치는 마커 처리 TODO |
| FR-08 | 반환 처리 | 구현됨 (Available 물품만, 반환일·처리자 기록, 직원은 자기 센터 물품, 관리자는 모든 센터 물품) | TODO (CenterInventory) |
| FR-09 | 삭제/폐기 처리 | 구현됨 (Available 물품만 Removed/Disposed로, 기록은 보존. 처리자·처리 시각은 상태 이력 테이블에 기록) | TODO (CenterInventory) |
| FR-10 | 관리자 관리 | 구현됨 (센터 관리(FR-02), 직원 계정 목록/생성/수정/비활성화, 관리자의 물품 수정(FR-04)·상태 변경(FR-08/09)) | TODO (AdminPage) |

자세한 매핑과 SRS 해석 메모는 [`docs/implementation-plan.md`](docs/implementation-plan.md)를, API 요청/응답 형식은 [`docs/api.en.md`](docs/api.en.md)(한국어 번역: [`docs/api.md`](docs/api.md))를 참고하세요.

## 논의 필요 사항

개발하면서 나온, 팀 결정이 필요한 주제입니다. 결정되면 결과를 적고 관련 문서(스키마, API 명세)를 함께 고친 뒤 이 표에서 정리해 주세요. SRS 해석에 관한 기존 메모는 [`docs/implementation-plan.md`](docs/implementation-plan.md#srs-해석-메모-팀-확인-필요)에 있습니다.

| # | 주제 | 현재 상태 / 문제 |
|---|------|------------------|
| 1 | **수정 API 방식 (PUT vs PATCH)** | `PUT /api/centers/:id`는 전체 교체라서 빠뜨린 선택 필드(`phone` 등)가 `null`로 지워집니다. 부분 수정(PATCH)으로 바꾸거나, PUT에서 모든 필드를 필수로 받는 방법이 있습니다. |
