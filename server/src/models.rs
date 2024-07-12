use async_std::sync::Mutex;
use serde::Deserialize;
use sqlx::MySql;
use sqlx::Pool;
use std::collections::HashMap;
use std::sync::Arc;
use tide::prelude::*;
use tide_websockets::WebSocketConnection;

type RoomUID = String;
type UserUID = String;

#[derive(Clone)]
pub struct State {
    pub db_pool: Pool<MySql>,
    pub rooms: Arc<Mutex<HashMap<RoomUID, HashMap<UserUID, WebSocketConnection>>>>,
}

impl State {
    pub fn new(db_pool: Pool<MySql>) -> Self {
        Self {
            db_pool,
            rooms: Default::default(),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserOfRoom {
    pub room_uid: String,
    pub user_uid: String,
    pub name: String,
    pub is_owner: bool,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Room {
    pub uid: String,
    pub schedule_type: u8,
    pub event_name: String,
    pub dates: String,
    pub days_of_week: String,
    pub time_min: u8,
    pub time_max: u8,
    pub slot_length: u8,
    pub schedule: String, // TODO: Change from full user_uids to indexes into users_of_room maybe?
    pub expires_at: time_new::OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeRange {
    pub from_hour: u8,
    pub to_hour: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WSMessage {
    pub message_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetRoomRes {
    pub event_name: String,
    pub schedule_type: u8,
    pub dates: Vec<String>,
    pub days_of_week: Vec<u8>,
    pub slot_length: u8,
    pub user_schedule: Vec<Vec<bool>>,
    pub others_schedule: Vec<Vec<Vec<usize>>>,
    pub user_name: String,
    pub others_names: Vec<String>,
    pub time_range: TimeRange,
    pub is_owner: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ScheduleDates {
    Dates(Vec<String>),
    DaysOfWeek(Vec<u8>),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoomReq {
    pub event_name: String,
    pub schedule_type: u8, // NOTE: I want to use an enum but sqlx nor TS+serde work well
    pub dates: ScheduleDates,
    pub slot_length: u8,
    pub schedule: Vec<Vec<bool>>,
    pub time_range: TimeRange,
}
