CREATE TABLE rooms (
    uid VARCHAR(36) PRIMARY KEY,
    event_name VARCHAR(64),
    schedule_type TINYINT UNSIGNED, -- enum Dates=0, DaysOfWeek=1
    dates JSON,
    days_of_week JSON,
    time_min TINYINT UNSIGNED,
    time_max TINYINT UNSIGNED,
    slot_length TINYINT UNSIGNED,
    schedule JSON,
    expires_at TIMESTAMP
);

CREATE TABLE users (
    uid VARCHAR(36) PRIMARY KEY,
    auth_token VARCHAR(64),
    default_name VARCHAR(64)
);

CREATE TABLE users_of_rooms (
    user_uid VARCHAR(36),
    room_uid VARCHAR(36),
    name VARCHAR(64),
    is_owner BOOL,
    is_absent BOOL,
    absent_reason VARCHAR(1000),
    UNIQUE KEY unique_user (user_uid, room_uid)
);
