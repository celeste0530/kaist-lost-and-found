# Implementation Plan

SRS v1.1 요구사항을 API / 화면 / 코드 위치에 매핑한 표와, 스켈레톤을 만들며 해석한 SRS 모호점 메모입니다.

## FR 매핑

|FR|API|화면|코드|API 상태|화면 상태|
|-|-|-|-|-|-|
|FR-01 로그인|`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`|StaffLogin|`server/src/routes/auth.ts`|구현|구현|
|FR-02 센터 관리|`GET/POST/PUT/DELETE /api/centers`|CenterList, CenterDetails, AdminPage|`server/src/routes/centers.ts`|구현|구현 (AdminPage)|
|FR-03 등록|`POST /api/items`|ItemForm|`server/src/routes/items.ts`, `middleware/upload.ts`|구현 (상태 이력 기록)|구현 (ItemForm)|
|FR-04 수정|`PUT /api/items/:id`|ItemForm|`server/src/routes/items.ts`|구현|구현 (ItemForm 수정 모드)|
|FR-05 검색/필터|`GET /api/items`|LostItemList|`server/src/routes/items.ts`|구현|구현 (키워드·카테고리·날짜·센터·지도 영역)|
|FR-06 상세|`GET /api/items/:id`|ItemDetails|`server/src/routes/items.ts`|구현|구현|
|FR-07 지도|`GET /api/items`, `GET /api/centers`|LostItemMap|`client/src/pages/LostItemMap.tsx`|구현|구현 (같은 위치 물품은 번호 마커로 묶음)|
|FR-08 반환|`POST /api/items/:id/return`|CenterInventory|`server/src/routes/items.ts`|구현 (상태 이력 기록)|구현 (CenterInventory)|
|FR-09 삭제/폐기|`POST /api/items/:id/remove`, `/dispose`|CenterInventory|`server/src/routes/items.ts`|구현 (상태 이력 기록)|구현 (CenterInventory)|
|FR-10 관리자|`/api/staff`, `/api/centers`|AdminPage|`server/src/routes/staff.ts`|구현 (직원 비활성화 포함)|구현 (AdminPage)|

## 

