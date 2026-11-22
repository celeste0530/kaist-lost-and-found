-- KAIST Lost and Found System - database schema (MySQL 8)
-- Based on SRS v1.1, section 3.3 "Logical Database Requirement".
--
-- Conventions
--   * POINT columns store X = longitude, Y = latitude (SRID 0, plain WGS84 degrees).
--     Insert with:  ST_GeomFromText('POINT(127.3604 36.3721)')   -- 'POINT(lng lat)'
--     Read with:    ST_X(col) AS lng, ST_Y(col) AS lat
--   * See docs/implementation-plan.md for where this schema deviates from / interprets the SRS.

CREATE TABLE center (
  center_id           INT          NOT NULL AUTO_INCREMENT,
  name                VARCHAR(255) NOT NULL,
  location            POINT        NOT NULL,
  phone               VARCHAR(255) NULL,       -- SRS field "Number"
  email               VARCHAR(255) NULL,
  operating_hours     VARCHAR(255) NOT NULL,
  closure_information TEXT         NULL,       -- weekends / public holidays / regular closures
  -- FR-02 / FR-10: a deleted center must stay referenced by its items, so deletion is a soft delete.
  deleted_at          DATETIME     NULL,
  PRIMARY KEY (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE staff_user (
  user_id       INT          NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  role          ENUM('Staff', 'Administrator') NOT NULL,
  -- Required for role 'Staff' (FR-10), NULL allowed for 'Administrator'.
  -- This rule is enforced in the application (server), not with a CHECK constraint.
  center_id     INT          NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_staff_user_email (email),
  CONSTRAINT fk_staff_user_center FOREIGN KEY (center_id) REFERENCES center (center_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE item (
  item_id           INT          NOT NULL AUTO_INCREMENT,
  center_id         INT          NOT NULL,   -- storage center (FK). Never changes when staff are reassigned (FR-10).
  registered_by     INT          NOT NULL,
  returned_by       INT          NULL,
  name              VARCHAR(255) NOT NULL,
  category          ENUM('Electronics', 'Wallet/Card', 'Clothing', 'Bag', 'Stationery', 'Umbrella', 'Other') NOT NULL,
  found_date        DATE         NOT NULL,
  found_location    POINT        NOT NULL,
  description       TEXT         NOT NULL,
  image             VARCHAR(255) NULL,       -- uploaded file name (or URL)
  status            ENUM('Available', 'Returned', 'Removed', 'Disposed') NOT NULL DEFAULT 'Available',
  registration_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  return_date       DATETIME     NULL,
  PRIMARY KEY (item_id),
  KEY idx_item_status_registered (status, registration_date),
  KEY idx_item_center (center_id),
  KEY idx_item_category (category),
  CONSTRAINT fk_item_center        FOREIGN KEY (center_id)     REFERENCES center (center_id),
  CONSTRAINT fk_item_registered_by FOREIGN KEY (registered_by) REFERENCES staff_user (user_id),
  CONSTRAINT fk_item_returned_by   FOREIGN KEY (returned_by)   REFERENCES staff_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
