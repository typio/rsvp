ALTER TABLE rooms ADD COLUMN participants JSON DEFAULT ('[]');
CREATE INDEX idx_room_uid ON users_of_rooms(room_uid);
TRUNCATE rooms;
TRUNCATE users_of_rooms;
