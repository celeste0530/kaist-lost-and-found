# Implementation Plan

SRS v1.1 요구사항을 API / 화면 / 코드 위치에 매핑한 표와, 스켈레톤을 만들며 해석한 SRS 모호점 메모입니다.

## FR 매핑

| FR | API | 화면 | 코드 | API 상태 | 화면 상태 |
|----|-----|------|------|----------|-----------|
| FR-01 로그인 | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | StaffLogin | `server/src/routes/auth.ts` | 구현 | 구현 |
| FR-02 센터 관리 | `GET/POST/PUT/DELETE /api/centers` | CenterList, CenterDetails, AdminPage | `server/src/routes/centers.ts` | 구현 | 조회만 (AdminPage TODO) |
| FR-03 등록 | `POST /api/items` | ItemForm | `server/src/routes/items.ts`, `middleware/upload.ts` | 구현 (상태 이력 기록) | 구현 |
| FR-04 수정 | `PUT /api/items/:id` | ItemForm | `server/src/routes/items.ts` | 구현 | 구현 |
| FR-05 검색/필터 | `GET /api/items` | LostItemList | `server/src/routes/items.ts` | 구현 | 키워드·카테고리만 (날짜·위치·센터 TODO) |
| FR-06 상세 | `GET /api/items/:id` | ItemDetails | `server/src/routes/items.ts` | 구현 | 구현 |
| FR-07 지도 | `GET /api/items`, `GET /api/centers` | LostItemMap | `client/src/pages/LostItemMap.tsx` | 구현 | 기본 구현 (마커 겹침 TODO) |
| FR-08 반환 | `POST /api/items/:id/return` | CenterInventory | `server/src/routes/items.ts` | 구현 (상태 이력 기록) | TODO |
| FR-09 삭제/폐기 | `POST /api/items/:id/remove`, `/dispose` | CenterInventory | `server/src/routes/items.ts` | 구현 (상태 이력 기록) | TODO |
| FR-10 관리자 | `/api/staff`, `/api/centers` | AdminPage | `server/src/routes/staff.ts` | 구현 (직원 비활성화 포함) | TODO |

## 권장 구현 순서

서버 API(FR-01 ~ FR-10)는 구현되어 있습니다. 남은 작업은 주로 화면입니다.

1. ItemForm: FR-03 등록 + FR-04 수정 (이미지 업로드, 지도에서 위치 선택)
2. CenterInventory: 자기 센터 물품 목록 + FR-08 반환 / FR-09 삭제·폐기
3. AdminPage: FR-02 센터 CRUD + FR-10 직원 계정 관리
4. FR-05 화면 필터 보완, FR-07 마커 겹침 처리
5. 테스트 케이스(SRS 3.7.2) 자동화, 성능 확인(3.2: 1,000건 / 동시 5명 / 95%가 2초 이내)

## SRS 해석 메모 (팀 확인 필요)

1. **Item 테이블의 `Center ID`가 PK로 표기됨** — FK의 오타로 보고 `item.center_id`를 FK로 만들었습니다.
2. **센터 삭제** — FR-02(삭제 후 신규 등록 불가)와 FR-10(센터가 삭제돼도 물품 기록 보존)을 함께 만족하도록 `center.deleted_at` 소프트 삭제로 설계했습니다. SRS 3.3 표에는 없는 컬럼입니다.
3. **관리자의 센터 배정** — FR-10은 "직원 계정에 센터 배정 필수"라고만 하고 관리자는 언급이 없어, `staff_user.center_id`를 NULL 허용으로 두었습니다. Staff는 필수이며 서버 로직에서 검증해야 합니다 (DB CHECK 제약은 넣지 않음). 다만 SRS 3.3 표는 다른 NULL 허용 컬럼과 달리 `Center ID`에 NULLABLE 표기가 없어, 모든 계정에 센터가 필요하다는 뜻인지 의뢰 팀 확인이 필요합니다.
4. **상태 이력 테이블** — 2.1.4는 "status history"를 저장한다고 하지만 3.3에는 해당 테이블이 없습니다. `item.return_date` / `returned_by`만으로는 Removed/Disposed를 누가 언제 처리했는지 남지 않아(FR-09 "관리 이력 보존") `item_status_history` 테이블을 추가했습니다. 등록(FR-03)과 상태 변경(FR-08/09) 시 item UPDATE와 이력 INSERT를 한 트랜잭션으로 처리해야 합니다(사용 예는 `db/schema.sql` 주석).
5. **습득 위치 필터 (FR-05)** — 방식이 정해져 있지 않아 `bbox=minLng,minLat,maxLng,maxLat` 파라미터로 임시 구현했습니다. UI는 지도 영역 선택 / 반경 검색 등으로 정해야 합니다.
6. **비로그인 상세 조회 범위 (FR-06)** — Returned/Removed/Disposed 물품의 상세 페이지를 공개할지 정해져 있지 않아, 현재는 비로그인 사용자에게 `Available`만 보여 줍니다(나머지는 404).
7. **좌표 저장 규칙** — `POINT`의 X = 경도, Y = 위도 (SRID 0). MySQL의 SRID 4326은 위도/경도 축 순서가 달라 혼동되기 쉬워 사용하지 않았습니다.
8. **이미지 저장** — 서버의 `UPLOAD_DIR`(기본 `server/uploads`)에 파일로 저장하고 DB에는 파일명만 저장합니다. 배포 환경에서 디스크가 휘발성이면 별도 저장소가 필요합니다.
9. **센터 정보의 `closure_information`** — FR-02는 "운영 정보 필수"라고 하여 `operating_hours`는 NOT NULL, 휴무 정보는 NULL 허용으로 했습니다.
10. **관리자의 물품 등록 (FR-03)** — **관리자는 물품을 등록할 수 없습니다** (403). FR-03은 등록 주체를 "Authorized center staff"로, 보관 센터를 "직원의 배정 센터로 자동 지정, 수정 불가"로 정하고 있습니다. 반환·삭제·폐기(FR-08/09)는 "staff or an administrator"라고 관리자를 명시하지만 FR-03에는 그런 표현이 없고, FR-10의 관리자 권한 목록에도 등록은 없습니다. 보안 요구사항에도 "Only authorized center staff can register or update items"라고 되어 있습니다.
11. **직원 계정 비활성화 (FR-10)** — 물품(`registered_by`, `returned_by`)과 상태 이력(`changed_by`)이 직원 행을 참조하므로 직원 계정은 삭제하지 않고, 센터와 같은 방식의 소프트 삭제로 `staff_user.deactivated_at`을 추가했습니다(NULL = 활성). SRS 3.3 표에는 없는 컬럼입니다. 비활성 계정은 로그인할 수 없고, 이미 로그인한 세션도 다음 요청부터 막힙니다.
