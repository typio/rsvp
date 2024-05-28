extern crate dotenv;

use dotenv::dotenv;
use num_bigint::BigUint;
use sha2::{Digest, Sha256};
use sqlx::mysql::MySqlConnectOptions;
use sqlx::MySql;
use sqlx::Pool;
use std::env;
use std::ops::Div;
use std::ops::Rem;
use std::time::{SystemTime, UNIX_EPOCH};
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

#[derive(Clone)]
struct State {
    db_pool: Pool<MySql>,
}

impl State {
    fn new(db_pool: Pool<MySql>) -> Self {
        Self { db_pool }
    }
}

#[derive(Debug, Deserialize)]
struct Time {
    hour: usize,
    is_am: bool,
}

#[derive(Debug, Deserialize)]
struct TimeRange {
    from: Time,
    to: Time,
}

#[derive(Debug, Deserialize)]
struct CreateRoomReq {
    dates: Vec<String>,
    slot_length: usize,
    schedule: Vec<Vec<bool>>,
    time_range: TimeRange,
}

/*
* TABLE rooms
* UID: VARCHAR(10)
* DAYS: JSON (Array(JS Date timestamps))
* DAY_COUNT: TINYINT
* TIME_MIN: TINYINT
* TIME_MAX: TINYINT
* SLOT_LENGTH: TINYINT
* AVAILABILITIES: JSON (Array of Days (Array of Times (Array of Users)))
*
* TABLE users
* UID: VARCHAR(16)
* NAME: VARCHAR(64)
* AUTH_TOKEN: VARCHAR(16)
*
* TABLE users_of_rooms
* USER_UID: VARCHAR
* ROOM_UID: VARCHAR
* IS_ADMIN: BOOL
*/

#[async_std::main]
async fn main() -> tide::Result<()> {
    dotenv().ok();

    let options: MySqlConnectOptions = (&env::var("DATABASE_URL")?).parse()?;
    let pool = MySqlPool::connect_with(options).await?;

    let mut app = tide::with_state(State::new(pool));

    let cors = CorsMiddleware::new()
        .allow_methods("GET, POST, OPTIONS".parse::<HeaderValue>().unwrap())
        .allow_origin(Origin::from("*"))
        .allow_credentials(false);

    app.with(cors);

    app.at("/api/share-room").post(create_room);
    app.listen("127.0.0.1:3632").await?;

    Ok(())
}

async fn create_room(mut req: Request<State>) -> tide::Result {
    println!("Create Room\n{:?}", req.peer_addr());

    // let room_uid = format!("{}", generate_id(req.peer_addr().unwrap_or("1"), 4));
    // let user_auth_token = format!("{}", generate_auth_token());

    let mut response: tide::Response;

    match signup(&req.state().db_pool).await {
        Ok(res) => {
            response = Response::new(200);
            let body = json!({
                "uid": res.uid,
                "auth_token":res.auth_token
            });
            response.set_body(body);
        }
        Err(err) => {
            println!("{}", err);
            response = Response::new(500);
        }
    }

    Ok(response)
}

struct SignupResult {
    uid: String,
    auth_token: String,
}

async fn signup(pool: &Pool<MySql>) -> Result<SignupResult, sqlx::Error> {
    let uid = Uuid::new_v4().to_string();
    let auth_token = format!("{}", generate_auth_token());

    match sqlx::query!(
        r#"
        INSERT INTO users (uid, auth_token)
        VALUES (?, ?)
        "#,
        uid,
        auth_token
    )
    .execute(pool)
    .await
    {
        Ok(_) => return Ok(SignupResult { uid, auth_token }),
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
