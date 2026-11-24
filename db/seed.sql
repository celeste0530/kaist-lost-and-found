-- KAIST Lost and Found System - development seed data. LOCAL DEVELOPMENT ONLY.
-- Loaded after schema.sql when the DB volume is first created (reload: docker compose down -v && docker compose up -d).
--
-- * Centers are fictional, placed on the KAIST Daejeon campus. POINT is (longitude latitude).
-- * All accounts use the password: password1234
--     admin@lostfound.test   Administrator (no center)
--     staff1@lostfound.test  Staff, center 1      staff2@lostfound.test  Staff, center 2
--     staff3@lostfound.test  Staff, center 3      staff4@lostfound.test  Staff, center 4
-- * Item status mix: Available 17 / Returned 5 / Removed 2 / Disposed 4.
--   Items 3+4 and 8+9 share a found location (map marker overlap test, FR-07).
--   Center 5 is soft-deleted and only holds Disposed items (must not appear in Center List).

SET NAMES utf8mb4;

INSERT INTO center (center_id, name, location, phone, email, operating_hours, closure_information, deleted_at) VALUES
  (1, '학생회관(N12) 분실물센터',   ST_GeomFromText('POINT(127.3608 36.3738)'), '042-350-0001', 'n12-lost@lostfound.test',
      '평일 09:00-18:00', '주말 및 공휴일 휴무', NULL),
  (2, '학술문화관(E9) 안내데스크',  ST_GeomFromText('POINT(127.3627 36.3697)'), '042-350-0002', 'library-lost@lostfound.test',
      '평일 09:00-22:00, 토요일 10:00-17:00', '일요일 및 공휴일 휴무, 시험 기간 연장 운영', NULL),
  (3, '기숙사 통합행정실(W)',       ST_GeomFromText('POINT(127.3561 36.3687)'), '042-350-0003', NULL,
      '매일 08:00-20:00', '설날·추석 연휴 휴무', NULL),
  (4, '본관(E14) 종합안내실',       ST_GeomFromText('POINT(127.3634 36.3683)'), '042-350-0004', 'e14-info@lostfound.test',
      '평일 09:00-17:30', NULL, NULL),
  (5, '구 창의학습관 임시 보관소',  ST_GeomFromText('POINT(127.3644 36.3707)'), NULL, NULL,
      '운영 종료', '2026-10-01 폐쇄', '2026-10-01 09:00:00');

-- bcrypt (cost 12) hash of 'password1234'
SET @pw = '$2a$12$6E8NOeoR5s4cR8y059TbT.RTsePp4y1wqsDHLxhFTP0QgsXuMWNKG';

INSERT INTO staff_user (user_id, email, password_hash, display_name, role, center_id) VALUES
  (1, 'admin@lostfound.test',  @pw, '시스템 관리자',   'Administrator', NULL),
  (2, 'staff1@lostfound.test', @pw, '학생회관 직원',   'Staff', 1),
  (3, 'staff2@lostfound.test', @pw, '학술문화관 직원', 'Staff', 2),
  (4, 'staff3@lostfound.test', @pw, '기숙사 직원',     'Staff', 3),
  (5, 'staff4@lostfound.test', @pw, '본관 직원',       'Staff', 4);

INSERT INTO item (item_id, center_id, registered_by, returned_by, name, category, found_date, found_location,
                  description, image, status, registration_date, return_date) VALUES
  -- Center 1: 학생회관 (staff 2)
  (1,  1, 2, NULL, '갤럭시 S25 (검정 케이스)', 'Electronics', '2026-11-18', ST_GeomFromText('POINT(127.3610 36.3740)'),
       '학생회관 1층 식당 테이블 위에서 발견. 잠금화면에 고양이 사진.', NULL, 'Available', '2026-11-18 13:20:00', NULL),
  (2,  1, 2, NULL, '학생증 (전산학부)', 'Wallet/Card', '2026-11-17', ST_GeomFromText('POINT(127.3606 36.3736)'),
       '학생회관 앞 벤치 아래에서 발견.', NULL, 'Available', '2026-11-17 10:05:00', NULL),
  (3,  1, 2, NULL, '검정 장우산', 'Umbrella', '2026-11-12', ST_GeomFromText('POINT(127.3608 36.3738)'),
       '학생회관 출입구 우산꽂이에 일주일 넘게 남아 있던 우산.', NULL, 'Available', '2026-11-12 18:00:00', NULL),
  (4,  1, 2, NULL, '회색 후드티', 'Clothing', '2026-11-10', ST_GeomFromText('POINT(127.3608 36.3738)'),
       '학생회관 출입구 옆 의자에 걸려 있었음. M 사이즈.', NULL, 'Available', '2026-11-10 16:45:00', NULL),
  (5,  1, 2, 2,    '에어팟 프로 케이스', 'Electronics', '2026-11-05', ST_GeomFromText('POINT(127.3611 36.3737)'),
       '학생회관 2층 동아리방 앞 복도.', NULL, 'Returned', '2026-11-05 12:10:00', '2026-11-07 15:30:00'),
  (6,  1, 2, 2,    '갈색 가죽 카드지갑', 'Wallet/Card', '2026-10-28', ST_GeomFromText('POINT(127.3605 36.3741)'),
       '학생회관 매점 계산대 앞.', NULL, 'Returned', '2026-10-28 09:30:00', '2026-10-30 11:00:00'),
  (7,  1, 2, NULL, '노란 우산', 'Umbrella', '2026-10-15', ST_GeomFromText('POINT(127.3609 36.3739)'),
       '학생회관 출입구. 보관 기간 경과.', NULL, 'Disposed', '2026-10-15 17:00:00', NULL),

  -- Center 2: 학술문화관 (staff 3)
  (8,  2, 3, NULL, '맥북 충전기 (USB-C 70W)', 'Electronics', '2026-11-19', ST_GeomFromText('POINT(127.3627 36.3697)'),
       '학술문화관 3층 열람실 콘센트에 꽂혀 있었음.', NULL, 'Available', '2026-11-19 21:40:00', NULL),
  (9,  2, 3, NULL, '파란 필통', 'Stationery', '2026-11-16', ST_GeomFromText('POINT(127.3627 36.3697)'),
       '학술문화관 3층 열람실. 샤프, 지우개, 형광펜 포함.', NULL, 'Available', '2026-11-16 20:15:00', NULL),
  (10, 2, 3, NULL, '공학수학 교재', 'Other', '2026-11-14', ST_GeomFromText('POINT(127.3625 36.3699)'),
       '2층 그룹스터디룸. 첫 장에 이니셜 J.K. 메모.', NULL, 'Available', '2026-11-14 19:00:00', NULL),
  (11, 2, 3, NULL, '흰색 텀블러', 'Other', '2026-11-13', ST_GeomFromText('POINT(127.3629 36.3696)'),
       '1층 카페 앞 테이블.', NULL, 'Available', '2026-11-13 14:30:00', NULL),
  (12, 2, 3, NULL, 'KAIST 로고 에코백', 'Bag', '2026-11-09', ST_GeomFromText('POINT(127.3626 36.3695)'),
       '학술문화관 사물함 옆. 안에 노트 2권.', NULL, 'Available', '2026-11-09 11:20:00', NULL),
  (13, 2, 3, 3,    '로지텍 무선 마우스', 'Electronics', '2026-11-02', ST_GeomFromText('POINT(127.3628 36.3698)'),
       '4층 PC석.', NULL, 'Returned', '2026-11-02 18:00:00', '2026-11-04 14:10:00'),
  (14, 2, 3, NULL, '공학용 계산기', 'Stationery', '2026-10-30', ST_GeomFromText('POINT(127.3628 36.3698)'),
       '중복 등록된 기록.', NULL, 'Removed', '2026-10-30 15:00:00', NULL),

  -- Center 3: 기숙사 (staff 4)
  (15, 3, 4, NULL, '검정 백팩 (노트북 칸 있음)', 'Bag', '2026-11-20', ST_GeomFromText('POINT(127.3560 36.3688)'),
       '기숙사 세탁실 앞.', NULL, 'Available', '2026-11-20 22:10:00', NULL),
  (16, 3, 4, NULL, '남색 패딩 점퍼', 'Clothing', '2026-11-15', ST_GeomFromText('POINT(127.3557 36.3691)'),
       '기숙사 휴게실 소파.', NULL, 'Available', '2026-11-15 09:00:00', NULL),
  (17, 3, 4, NULL, '체크카드', 'Wallet/Card', '2026-11-11', ST_GeomFromText('POINT(127.3563 36.3684)'),
       '기숙사 편의점 앞.', NULL, 'Available', '2026-11-11 23:30:00', NULL),
  (18, 3, 4, NULL, '체크무늬 접이식 우산', 'Umbrella', '2026-11-08', ST_GeomFromText('POINT(127.3559 36.3686)'),
       '기숙사 출입구 우산꽂이.', NULL, 'Available', '2026-11-08 08:20:00', NULL),
  (19, 3, 4, 4,    '검정 뿔테 안경', 'Other', '2026-11-03', ST_GeomFromText('POINT(127.3562 36.3689)'),
       '기숙사 헬스장 탈의실.', NULL, 'Returned', '2026-11-03 21:00:00', '2026-11-05 19:20:00'),
  (20, 3, 4, NULL, '베이지 목도리', 'Clothing', '2026-10-20', ST_GeomFromText('POINT(127.3558 36.3690)'),
       '보관 기간 경과.', NULL, 'Disposed', '2026-10-20 10:00:00', NULL),

  -- Center 4: 본관 (staff 5)
  (21, 4, 5, NULL, '아이패드 (스페이스 그레이)', 'Electronics', '2026-11-19', ST_GeomFromText('POINT(127.3634 36.3683)'),
       '본관 1층 로비 소파.', NULL, 'Available', '2026-11-19 10:30:00', NULL),
  (22, 4, 5, NULL, '자동차 키', 'Other', '2026-11-15', ST_GeomFromText('POINT(127.3637 36.3680)'),
       '본관 앞 주차장 입구.', NULL, 'Available', '2026-11-15 08:50:00', NULL),
  (23, 4, 5, NULL, '빨간 여권 지갑', 'Wallet/Card', '2026-11-06', ST_GeomFromText('POINT(127.3632 36.3685)'),
       '본관 2층 국제협력처 앞.', NULL, 'Available', '2026-11-06 13:15:00', NULL),
  (24, 4, 5, NULL, '스프링 실험 노트', 'Stationery', '2026-11-04', ST_GeomFromText('POINT(127.3635 36.3682)'),
       '본관 3층 세미나실.', NULL, 'Available', '2026-11-04 17:40:00', NULL),
  (25, 4, 5, 5,    '베이지 캔버스 토트백', 'Bag', '2026-10-31', ST_GeomFromText('POINT(127.3633 36.3684)'),
       '본관 1층 엘리베이터 앞.', NULL, 'Returned', '2026-10-31 16:00:00', '2026-11-02 09:40:00'),
  (26, 4, 5, NULL, '보조배터리', 'Electronics', '2026-10-25', ST_GeomFromText('POINT(127.3636 36.3681)'),
       '잘못 등록된 기록.', NULL, 'Removed', '2026-10-25 11:00:00', NULL),

  -- Center 5: deleted center (registered by the administrator)
  (27, 5, 1, NULL, '투명 비닐우산', 'Umbrella', '2026-09-20', ST_GeomFromText('POINT(127.3644 36.3707)'),
       '센터 폐쇄 전 보관 물품.', NULL, 'Disposed', '2026-09-20 12:00:00', NULL),
  (28, 5, 1, NULL, '체육복 상의', 'Clothing', '2026-09-15', ST_GeomFromText('POINT(127.3644 36.3707)'),
       '센터 폐쇄 전 보관 물품.', NULL, 'Disposed', '2026-09-15 15:30:00', NULL);

-- Status history: initial registration of every item, then each later change.
INSERT INTO item_status_history (item_id, from_status, to_status, changed_by, changed_at)
  SELECT item_id, NULL, 'Available', registered_by, registration_date FROM item ORDER BY item_id;

INSERT INTO item_status_history (item_id, from_status, to_status, changed_by, changed_at) VALUES
  (5,  'Available', 'Returned', 2, '2026-11-07 15:30:00'),
  (6,  'Available', 'Returned', 2, '2026-10-30 11:00:00'),
  (7,  'Available', 'Disposed', 2, '2026-11-15 17:00:00'),
  (13, 'Available', 'Returned', 3, '2026-11-04 14:10:00'),
  (14, 'Available', 'Removed',  3, '2026-10-30 16:00:00'),
  (19, 'Available', 'Returned', 4, '2026-11-05 19:20:00'),
  (20, 'Available', 'Disposed', 4, '2026-11-20 10:00:00'),
  (25, 'Available', 'Returned', 5, '2026-11-02 09:40:00'),
  (26, 'Available', 'Removed',  5, '2026-10-26 12:00:00'),
  (27, 'Available', 'Disposed', 1, '2026-09-30 18:00:00'),
  (28, 'Available', 'Disposed', 1, '2026-09-30 18:00:00');
