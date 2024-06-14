extern crate dotenv;

use core::panic;
use dotenv::dotenv;
use num_bigint::BigUint;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::mysql::MySqlConnectOptions;
use sqlx::mysql::MySqlPool;
use sqlx::MySql;
use sqlx::Pool;
use std::env;
use std::ops::Div;
use std::ops::Rem;
use std::str::FromStr;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use tide::http::headers::HeaderValue;
use tide::http::Cookie;
use tide::prelude::*;
use tide::security::CorsMiddleware;
use tide::security::Origin;
use tide::Request;
use tide::Response;
use tide::StatusCode;
use time::Duration;
use time::OffsetDateTime;
use time_new::ext::NumericalDuration;
use uuid::Uuid;

#[derive(Clone)]
struct State {
    db_pool: Pool<MySql>,
}

impl State {
    fn new(db_pool: Pool<MySql>) -> Self {
        Self { db_pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct UserOfRoom {
    room_uid: String,
    user_uid: String,
    name: String,
    is_owner: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct TimeRange {
    from_hour: u8,
    to_hour: u8,
}

#[async_std::main]
async fn main() -> tide::Result<()> {
    dotenv().ok();

    let options: MySqlConnectOptions = (&env::var("DATABASE_URL")?).parse()?;
    let pool = MySqlPool::connect_with(options).await?;

    let mut app = tide::with_state(State::new(pool));

    let cors = CorsMiddleware::new()
        .allow_methods("GET, POST, PATCH".parse::<HeaderValue>().unwrap())
        .allow_origin(Origin::from("http://localhost:5173"))
        .allow_credentials(true);

    app.with(cors);

    app.at("/api/rooms").post(create_room);
    app.at("/api/rooms/:slug").get(get_room);
    app.at("/api/rooms/:slug").patch(edit_room);
    app.at("/api/rooms/:slug/eventNameChange")
        .patch(edit_room_event_name);
    app.at("/api/rooms/:slug/userNameChange")
        .patch(edit_room_user_name);
    app.listen("127.0.0.1:3632").await?;

    Ok(())
}

fn seperate_users_schedule(
    schedule: Vec<Vec<Vec<String>>>,
    user_uid: String,
) -> (Vec<Vec<bool>>, Vec<Vec<Vec<String>>>) {
    let (user_schedule, others_schedule): (Vec<Vec<bool>>, Vec<Vec<Vec<String>>>) = schedule
        .into_iter()
        .map(|row| {
            row.into_iter()
                .map(|cell| {
                    let mut is_user_in_cell = false;
                    let mut others_in_cell = Vec::with_capacity(cell.len());

                    for uid in cell {
                        if uid == user_uid {
                            is_user_in_cell = true;
                        } else {
                            others_in_cell.push(uid);
                        }
                    }

                    (is_user_in_cell, others_in_cell)
                })
                .unzip()
        })
        .unzip();

    (user_schedule, others_schedule)
}

async fn edit_room_event_name(mut req: Request<State>) -> tide::Result {
    let mut user_uid: Option<String> = get_user_uid_from_cookie(&req).await;

    Ok(Response::new(StatusCode::Ok))
}

async fn edit_room_user_name(mut req: Request<State>) -> tide::Result {
    Ok(Response::new(StatusCode::Ok))
}

#[derive(Debug, Serialize, Deserialize)]
struct EditRoomReq {
    user_schedule: Vec<Vec<bool>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EditRoomRes {
    user_schedule: Vec<Vec<bool>>,
    others_schedule: Vec<Vec<Vec<String>>>,
    users: Vec<String>,
}

async fn edit_room(mut req: Request<State>) -> tide::Result {
    let room_uid: String = req.param("slug")?.to_string();
    let mut response = Response::new(StatusCode::Ok);

    let req_body: EditRoomReq = req.body_json().await.unwrap_or_else(|_e| {
        panic!();
    });

    // get current user
    let mut user_uid: Option<String> = get_user_uid_from_cookie(&req).await;

    if user_uid == None {
        match signup(req.state().db_pool.clone()).await {
            Ok((signup_result, cookie)) => {
                user_uid = Some(signup_result.user_uid);
                response.insert_cookie(cookie);
            }
            Err(err) => {
                println!("{}", err);
                return Ok(Response::new(StatusCode::InternalServerError));
            }
        }
    }

    let user_uid: String = user_uid.unwrap();

    // get schedule as in DB
    let room = sqlx::query!(
        r#"
        SELECT * FROM rooms
        WHERE uid=?
        "#,
        room_uid
    )
    .fetch_one(&req.state().db_pool)
    .await?;

    // update schedule
    let mut schedule: Vec<Vec<Vec<String>>> = serde_json::from_str(&room.schedule.unwrap())?;

    let (_, mut others_schedule) = seperate_users_schedule(schedule, user_uid.clone());

    schedule = others_schedule
        .iter_mut()
        .enumerate()
        .map(|(i, row)| {
            row.iter_mut()
                .enumerate()
                .map(|(j, slot)| {
                    if req_body.user_schedule[i][j] {
                        slot.push(user_uid.clone());
                    }
                    (*slot).clone()
                })
                .collect()
        })
        .collect();

    // let others_schedule_json = json!(others_schedule);

    // save new schedule

    let _ = match sqlx::query!(
        r#"
        UPDATE rooms 
        SET schedule=?
        WHERE uid=?
        "#,
        json!(schedule),
        room_uid,
    )
    .execute(&req.state().db_pool)
    .await
    {
        Ok(_) => response.set_body(json!({
            "room_uid": room_uid
        })),
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    // If user isn't in room add them
    let _ = sqlx::query!(
        r#"
            INSERT IGNORE INTO users_of_rooms (user_uid, room_uid, name, is_owner)
            VALUES (?, ?, ?, ?);
        "#,
        user_uid,
        room_uid,
        "Jeff",
        false
    )
    .execute(&req.state().db_pool)
    .await;

    // return
    let response_body = EditRoomRes {
        user_schedule: req_body.user_schedule,
        others_schedule,
        users: Vec::new(),
    };

    let response_body_string = serde_json::to_string(&response_body)?;
    response.set_body(response_body_string);

    Ok(response)
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

    let user_uid = get_user_uid_from_cookie(&req)
        .await
        .unwrap_or(String::from_str("none")?);

    let schedule: Vec<Vec<Vec<String>>> = serde_json::from_str(&room.schedule.unwrap())?;
    let (user_schedule, others_schedule) = seperate_users_schedule(schedule, user_uid.clone());

    let users_of_rooms = sqlx::query_as::<_, UserOfRoom>(
        r#"
        SELECT * FROM users_of_rooms
        WHERE room_uid=?
        "#,
    )
    .bind(room_uid)
    .fetch_all(&req.state().db_pool)
    .await?;

    let (is_owner, others_names): (bool, Vec<String>) = users_of_rooms.into_iter().fold(
        (false, Vec::new()),
        |(mut is_owner, mut others_names), user| {
            if user.user_uid == user_uid {
                is_owner = user.is_owner;
            } else {
                others_names.push(user.name);
            }
            (is_owner, others_names)
        },
    );

    let response_body = GetRoomRes {
        event_name: room.event_name.unwrap(),
        dates: serde_json::from_str(&room.dates.unwrap())?,
        slot_length: room.slot_length.unwrap(),
        user_schedule,
        others_schedule,
        others_names,
        time_range: TimeRange {
            from_hour: room.time_min.unwrap(),
            to_hour: room.time_max.unwrap(),
        },
        is_owner, // can also be false if requester is not in users_of_rooms
    };

    let response_body_string = serde_json::to_string(&response_body)?;
    response.set_body(response_body_string);

    Ok(response)
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateRoomReq {
    event_name: String,
    dates: Vec<String>,
    slot_length: u8,
    schedule: Vec<Vec<bool>>,
    time_range: TimeRange,
}

#[derive(Debug, Serialize, Deserialize)]
struct GetRoomRes {
    event_name: String,
    dates: Vec<String>,
    slot_length: u8,
    user_schedule: Vec<Vec<bool>>,
    others_schedule: Vec<Vec<Vec<String>>>,
    others_names: Vec<String>,
    time_range: TimeRange,
    is_owner: bool,
}

async fn create_room(mut req: Request<State>) -> tide::Result {
    println!("Create Room");

    let req_body: CreateRoomReq = req.body_json().await.unwrap_or_else(|_e| {
        panic!();
    });

    let mut response = Response::new(StatusCode::Ok);
    let mut user_uid: Option<String> = get_user_uid_from_cookie(&req).await;

    if user_uid == None {
        match signup(req.state().db_pool.clone()).await {
            Ok((signup_result, cookie)) => {
                user_uid = Some(signup_result.user_uid);
                response.insert_cookie(cookie);
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
        INSERT INTO rooms (uid, event_name, dates, day_count, time_min, time_max, slot_length, schedule, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        room_uid,
        req_body.event_name,
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
        INSERT INTO users_of_rooms (user_uid, room_uid, name, is_owner)
        VALUES (?, ?, ?, ?)
        "#,
        user_uid,
        room_uid,
        "Jeff",
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

async fn get_user_uid_from_cookie(req: &Request<State>) -> Option<String> {
    let mut user_uid = None;
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

    user_uid
}

async fn signup(pool: Pool<MySql>) -> Result<(SignupResult, Cookie<'static>), sqlx::Error> {
    let user_uid = Uuid::new_v4().to_string();
    let auth_token = generate_auth_token();

    match sqlx::query!(
        r#"
        INSERT INTO users (uid, auth_token, default_name)
        VALUES (?, ?, 'Jeff')
        "#,
        user_uid,
        auth_token
    )
    .execute(&pool)
    .await
    {
        Ok(_) => {
            return Ok((
                SignupResult {
                    auth_token: auth_token.clone(),
                    user_uid,
                },
                Cookie::build("auth_token", auth_token)
                    .http_only(true)
                    .path("/")
                    .expires(OffsetDateTime::now_utc() + Duration::days(400))
                    .same_site(tide::http::cookies::SameSite::Strict)
                    .finish(),
            ))
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
