# Implementation Plan

SRS v1.1 요구사항을 API / 화면 / 코드 위치에 매핑한 표와, 스켈레톤을 만들며 해석한 SRS 모호점 메모입니다.

## FR 매핑

| FR | API | 화면 | 코드 | 상태 |
|----|-----|------|------|------|
| FR-01 로그인 | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | StaffLogin | `server/src/routes/auth.ts` | 구현 |
| FR-02 센터 관리 | `GET/POST/PUT/DELETE /api/centers` | CenterList, CenterDetails, AdminPage | `server/src/routes/centers.ts` | 조회만 |
| FR-03 등록 | `POST /api/items` | ItemForm | `server/src/routes/items.ts`, `middleware/upload.ts` | TODO |
| FR-04 수정 | `PUT /api/items/:id` | ItemForm | `server/src/routes/items.ts` | TODO |
| FR-05 검색/필터 | `GET /api/items` | LostItemList | `server/src/routes/items.ts` | 구현(UI 일부) |
| FR-06 상세 | `GET /api/items/:id` | ItemDetails | `server/src/routes/items.ts` | 구현 |
| FR-07 지도 | `GET /api/items`, `GET /api/centers` | LostItemMap | `client/src/pages/LostItemMap.tsx` | 기본 구현 |
| FR-08 반환 | `POST /api/items/:id/return` | CenterInventory | `server/src/routes/items.ts` | TODO |
| FR-09 삭제/폐기 | `POST /api/items/:id/remove`, `/dispose` | CenterInventory | `server/src/routes/items.ts` | TODO |
| FR-10 관리자 | `/api/staff`, `/api/centers` | AdminPage | `server/src/routes/staff.ts` | TODO |

## 권장 구현 순서

1. FR-02 센터 CRUD + FR-10 직원 계정 (데이터를 넣을 수 있어야 나머지를 확인 가능)
2. FR-03 등록 + FR-04 수정 (이미지 업로드, 지도에서 위치 선택)
3. FR-08 / FR-09 상태 변경 (원자적 업데이트, 3.4.1)
4. FR-05 화면 필터 보완, FR-07 마커 겹침 처리
5. 테스트 케이스(SRS 3.7.2) 자동화, 성능 확인(3.2: 1,000건 / 동시 5명 / 95%가 2초 이내)

## SRS 해석 메모 (팀 확인 필요)

1. **Item 테이블의 `Center ID`가 PK로 표기됨** — FK의 오타로 보고 `item.center_id`를 FK로 만들었습니다.
2. **센터 삭제** — FR-02(삭제 후 신규 등록 불가)와 FR-10(센터가 삭제돼도 물품 기록 보존)을 함께 만족하도록 `center.deleted_at` 소프트 삭제로 설계했습니다. SRS 3.3 표에는 없는 컬럼입니다.
3. **관리자의 센터 배정** — FR-10은 "직원 계정에 센터 배정 필수"라고만 하고 관리자는 언급이 없어, `staff_user.center_id`를 NULL 허용으로 두었습니다. Staff는 필수이며 서버 로직에서 검증해야 합니다 (DB CHECK 제약은 넣지 않음).
4. **상태 이력 테이블** — 2.1.4는 "status history"를 저장한다고 하지만 3.3에는 해당 테이블이 없습니다. 현재는 `item.return_date` / `returned_by`만 사용합니다. 이력이 필요하면 테이블을 추가하세요.
5. **습득 위치 필터 (FR-05)** — 방식이 정해져 있지 않아 `bbox=minLng,minLat,maxLng,maxLat` 파라미터로 임시 구현했습니다. UI는 지도 영역 선택 / 반경 검색 등으로 정해야 합니다.
6. **비로그인 상세 조회 범위 (FR-06)** — Returned/Removed/Disposed 물품의 상세 페이지를 공개할지 정해져 있지 않아, 현재는 비로그인 사용자에게 `Available`만 보여 줍니다(나머지는 404).
7. **좌표 저장 규칙** — `POINT`의 X = 경도, Y = 위도 (SRID 0). MySQL의 SRID 4326은 위도/경도 축 순서가 달라 혼동되기 쉬워 사용하지 않았습니다.
8. **이미지 저장** — 서버의 `UPLOAD_DIR`(기본 `server/uploads`)에 파일로 저장하고 DB에는 파일명만 저장합니다. 배포 환경에서 디스크가 휘발성이면 별도 저장소가 필요합니다.
9. **센터 정보의 `closure_information`** — FR-02는 "운영 정보 필수"라고 하여 `operating_hours`는 NOT NULL, 휴무 정보는 NULL 허용으로 했습니다.
