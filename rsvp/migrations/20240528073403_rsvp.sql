CREATE TABLE IF NOT EXISTS rooms (
    uid VARCHAR(36) PRIMARY KEY,
    dates JSON,
    day_count TINYINT UNSIGNED,
    time_min TINYINT UNSIGNED,
    time_max TINYINT UNSIGNED,
    slot_length TINYINT UNSIGNED,
    schedule JSON,
    expires_at TIMESTAMP
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
