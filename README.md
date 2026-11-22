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
├── db/schema.sql      SRS 3.3 기반 DB 스키마
├── docs/              SRS, 구현 계획(FR 매핑 + SRS 해석 메모)
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

- 스키마를 다시 적용하려면 `docker compose down -v` 후 `docker compose up -d`
- 센터/물품 등록 API는 아직 없으므로(아래 표 참고) 지금은 DB에 직접 넣어야 목록 화면에 데이터가 보입니다.

## 구현 현황

| FR | 내용 | 상태 |
|----|------|------|
| FR-01 | 직원 로그인/로그아웃 | 구현됨 |
| FR-02 | 센터 관리 | 조회만 구현, 생성/수정/삭제 TODO |
| FR-03 | 습득물 등록 | TODO |
| FR-04 | 습득물 수정 | TODO |
| FR-05 | 검색/필터 | 키워드·카테고리·날짜·센터·좌표(bbox) API 구현, 화면은 키워드·카테고리만 |
| FR-06 | 습득물 상세 | 구현됨 |
| FR-07 | 지도 탐색 | 기본 구현, 겹치는 마커 처리 TODO |
| FR-08 | 반환 처리 | TODO |
| FR-09 | 삭제/폐기 처리 | TODO |
| FR-10 | 관리자 관리 | TODO |

자세한 매핑과 SRS 해석 메모는 [`docs/implementation-plan.md`](docs/implementation-plan.md)를 참고하세요.
