extern crate dotenv;

use core::panic;
use dotenv::dotenv;
use num_bigint::BigUint;
use sha2::{Digest, Sha256};
use sqlx::mysql::MySqlConnectOptions;
use sqlx::MySql;
use sqlx::Pool;
use std::env;
use std::ops::Div;
use std::ops::Rem;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use tide::http::Cookie;
use tide::StatusCode;
use time::Duration;
use time::OffsetDateTime;
use uuid::Uuid;
// use std::sync::atomic::AtomicU32;
// use std::sync::Arc;
//
// use bincode::{config, Decode, Encode};
use serde::Deserialize;
use sqlx::mysql::MySqlPool;
use tide::http::headers::HeaderValue;
use tide::prelude::*;
use tide::security::CorsMiddleware;
use tide::security::Origin;
use tide::Request;
use tide::Response;
use time_new::ext::NumericalDuration;

#[derive(Clone)]
struct State {
    db_pool: Pool<MySql>,
}

impl State {
    fn new(db_pool: Pool<MySql>) -> Self {
        Self { db_pool }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct TimeRange {
    from_hour: u8,
    to_hour: u8,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateRoomReq {
    dates: Vec<String>,
    slot_length: u8,
    schedule: Vec<Vec<bool>>,
    time_range: TimeRange,
}

#[derive(Debug, Serialize, Deserialize)]
struct GetRoomRes {
    dates: Vec<String>,
    slot_length: u8,
    schedule: Vec<Vec<Vec<String>>>,
    time_range: TimeRange,
    users: Vec<String>,
}

#[async_std::main]
async fn main() -> tide::Result<()> {
    dotenv().ok();

    let options: MySqlConnectOptions = (&env::var("DATABASE_URL")?).parse()?;
    let pool = MySqlPool::connect_with(options).await?;

    let mut app = tide::with_state(State::new(pool));

    let cors = CorsMiddleware::new()
        .allow_methods("GET, POST, OPTIONS".parse::<HeaderValue>().unwrap())
        .allow_origin(Origin::from("http://localhost:5173"))
        .allow_credentials(true);

    app.with(cors);

    app.at("/api/rooms").post(create_room);
    app.at("/api/rooms/:slug").get(get_room);
    app.listen("127.0.0.1:3632").await?;

    Ok(())
}

async fn get_room(req: Request<State>) -> tide::Result {
    let room_uid: String = req.param("slug")?.to_string();
    let mut response = Response::new(StatusCode::Ok);

    let room = sqlx::query!(
        r#"
        SELECT * FROM rooms
        WHERE uid=?
        "#,
        room_uid
    )
    .fetch_one(&req.state().db_pool)
    .await?;

    let users_of_room_records = sqlx::query!(
        r#"
        SELECT * FROM users_of_rooms
        WHERE room_uid=?
        "#,
        room_uid
    )
    .fetch_all(&req.state().db_pool)
    .await?;

    let users_of_room = users_of_room_records
        .iter()
        .filter_map(|record| record.user_uid.as_ref())
        .map(|user_uid| format!("\"{}\"", user_uid))
        .collect::<Vec<_>>();

    let json_string: String = format!(
        r#"{{
                "dates": {},
                "slot_length": {},
                "schedule": {},
                "time_range": {{
                    "from_hour": {},
                    "to_hour": {}
                }},
                "users": [{}]
            }}"#,
        room.dates.unwrap(),
        room.slot_length.unwrap(),
        room.schedule.unwrap(),
        room.time_min.unwrap(),
        room.time_max.unwrap(),
        users_of_room.join(", ")
    );

    let response_body: GetRoomRes = serde_json::from_str(json_string.as_str())?;

    response.set_body(json!(response_body));

    Ok(response)
}

async fn create_room(mut req: Request<State>) -> tide::Result {
    println!("Create Room");

    let req_body: CreateRoomReq = req.body_json().await.unwrap_or_else(|e| {
        println!("{}", e);
        panic!();
    });

    let mut response = Response::new(StatusCode::Ok);
    let mut user_uid: Option<String> = None;

    let auth_cookie = req.cookie("auth_token");

    if let Some(auth_cookie) = auth_cookie {
        let client_auth_token = auth_cookie.value().to_string();

        user_uid = match sqlx::query!(
            r#"
                SELECT * FROM users
                WHERE auth_token=?
                "#,
            client_auth_token
        )
        .fetch_one(&req.state().db_pool)
        .await
        {
            Ok(res) => Some(res.uid),
            Err(_) => None,
        }
    }

    if user_uid == None {
        match signup(&req.state().db_pool).await {
            Ok(res) => {
                user_uid = Some(res.user_uid);
                response.insert_cookie(
                    Cookie::build("auth_token", res.auth_token)
                        .http_only(true)
                        .path("/")
                        .expires(OffsetDateTime::now_utc() + Duration::days(400))
                        .same_site(tide::http::cookies::SameSite::Strict)
                        .finish(),
                );
            }
            Err(err) => {
                println!("{}", err);
                return Ok(Response::new(StatusCode::InternalServerError));
            }
        }
    }

    let room_uid = generate_id(req.peer_addr().unwrap_or(""), 4);

    let dates = json!(req_body.dates);
    let day_count = req_body.dates.len() as u8;
    let schedule = json!(req_body
        .schedule
        .iter()
        .map(|row| {
            row.iter()
                .map(|&avail| {
                    if avail {
                        vec![user_uid.clone().unwrap()]
                    } else {
                        vec![]
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>());

    // TODO: Make this the last day of days plus an offset
    let expiry: sqlx::types::time::OffsetDateTime =
        sqlx::types::time::OffsetDateTime::now_utc() + 31.days();

    let _ = match sqlx::query!(
        r#"
        INSERT INTO rooms 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        room_uid,
        dates,
        day_count,
        req_body.time_range.from_hour,
        req_body.time_range.to_hour,
        req_body.slot_length,
        schedule,
        expiry
    )
    .execute(&req.state().db_pool)
    .await
    {
        Ok(_) => response.set_body(json!({
            "room_uid": room_uid
        })),
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    let _ = match sqlx::query!(
        r#"
        INSERT INTO users_of_rooms 
        VALUES (?, ?, ?)
        "#,
        user_uid,
        room_uid,
        true
    )
    .execute(&req.state().db_pool)
    .await
    {
        Ok(_) => response.set_body(json!({
            "room_uid": room_uid
        })),
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    Ok(response)
}

struct SignupResult {
    auth_token: String,
    user_uid: String,
}

async fn signup(pool: &Pool<MySql>) -> Result<SignupResult, sqlx::Error> {
    let user_uid = Uuid::new_v4().to_string();
    let auth_token = format!("{}", generate_auth_token());

    match sqlx::query!(
        r#"
        INSERT INTO users (uid, auth_token)
        VALUES (?, ?)
        "#,
        user_uid,
        auth_token
    )
    .execute(pool)
    .await
    {
        Ok(_) => {
            return Ok(SignupResult {
                auth_token,
                user_uid,
            })
        }
        Err(err) => return Err(err),
    }
}

fn generate_auth_token() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", timestamp, Uuid::new_v4()));
    let hash = hasher.finalize();
    format!("{:x}", hash)
}

fn generate_id(ip: &str, len: usize) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", timestamp, ip));
    let hash = hasher.finalize();

    const BASE36_CHARS: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    let mut id = String::new();
    let mut num = BigUint::from_bytes_be(&hash);

    while num > BigUint::ZERO {
        let (new_num, remainder) = (
            num.clone().div(&BigUint::from(36u32)),
            num.clone().rem(&BigUint::from(36u32)),
        );
        let rem_u32 = BigUint::to_u32_digits(&remainder);
        if !rem_u32.is_empty() {
            let digit = BASE36_CHARS[rem_u32[0] as usize];
            id.insert(0, digit as char);
        }

        num = new_num;
    }

    id[..len].to_string()
}
