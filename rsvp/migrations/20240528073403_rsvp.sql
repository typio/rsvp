CREATE TABLE IF NOT EXISTS rooms (
    uid VARCHAR(36) PRIMARY KEY,
    days JSON,
    day_count TINYINT,
    time_min TINYINT,
    time_max TINYINT,
    slot_length TINYINT,
    availabilities JSON
);

CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(36) PRIMARY KEY,
    auth_token VARCHAR(64),
    name VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS users_of_rooms (
    user_uid VARCHAR(36),
    room_uid VARCHAR(36),
    is_admin BOOL
);
