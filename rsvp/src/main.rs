extern crate dotenv;

mod utils;
use utils::{generate_auth_token, generate_id};

use async_std::prelude::*;
use async_std::sync::Mutex;
use core::panic;
use dotenv::dotenv;
use serde::Deserialize;
use sqlx::mysql::MySqlConnectOptions;
use sqlx::mysql::MySqlPool;
use sqlx::MySql;
use sqlx::Pool;
use std::collections::HashMap;
use std::env;
use std::str::FromStr;
use std::sync::Arc;
use tide::http::headers::HeaderValue;
use tide::http::Cookie;
use tide::prelude::*;
use tide::security::CorsMiddleware;
use tide::security::Origin;
use tide::Request;
use tide::Response;
use tide::StatusCode;
use tide_websockets::WebSocket;
use tide_websockets::WebSocketConnection;
use time::Duration;
use time::OffsetDateTime;
use time_new::ext::NumericalDuration;
use uuid::Uuid;

type RoomUID = String;
type UserUID = String;

#[derive(Clone)]
struct State {
    db_pool: Pool<MySql>,
    rooms: Arc<Mutex<HashMap<RoomUID, HashMap<UserUID, WebSocketConnection>>>>,
}

impl State {
    fn new(db_pool: Pool<MySql>) -> Self {
        Self {
            db_pool,
            rooms: Default::default(),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WSMessage {
    message_type: String,
    payload: serde_json::Value,
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

    app.at("/api/auth").post(authenticate);
    app.at("/api/rooms").post(create_room);
    app.at("/api/rooms/:room_uid").get(get_room);

    app.at("/api/ws/:room_uid")
        .with(WebSocket::new(
            |req: tide::Request<State>, mut wsc: WebSocketConnection| async move {
                let user_uid = get_user_uid_from_cookie(&req).await;
                let room_uid = req.param("room_uid").unwrap();

                if let Some(user_uid) = &user_uid {
                    let mut rooms = req.state().rooms.lock().await;
                    rooms
                        .entry(room_uid.to_string())
                        .or_insert_with(HashMap::new)
                        .insert(user_uid.clone(), wsc.clone());
                }

                while let Some(Ok(message)) = wsc.next().await {
                    if let tide_websockets::Message::Text(text) = message {
                        let message: WSMessage = serde_json::from_str(&text).unwrap();
                        let _ = handle_websocket_message(
                            req.state().clone(),
                            room_uid.to_string(),
                            user_uid.clone(),
                            message,
                        )
                        .await;
                    }
                }

                Ok(())
            },
        ))
        .get(|_| async move { Ok("this was not a websocket request") });

    app.listen("127.0.0.1:3632").await?;

    Ok(())
}

async fn handle_websocket_message(
    state: State,
    room_uid: String,
    user_uid: Option<String>,
    msg: WSMessage,
) -> Result<(), Box<dyn std::error::Error>> {
    let user_uid = user_uid.unwrap();

    match msg.message_type.as_str() {
        "editSchedule" => {
            let user_schedule: Vec<Vec<bool>> =
                serde_json::from_value(msg.payload["user_schedule"].clone())?;

            let user_name: String = serde_json::from_value(msg.payload["user_name"].clone())?;

            #[derive(Debug, Serialize, Deserialize)]
            struct EditRoomReq {
                user_schedule: Vec<Vec<bool>>,
            }

            #[derive(Debug, Serialize, Deserialize)]
            struct EditRoomRes {
                user_schedule: Vec<Vec<bool>>,
                others_schedule: Vec<Vec<Vec<u32>>>,
                users: Vec<String>,
            }

            // If user isn't in room add them
            let _ = sqlx::query!(
                r#"
                    INSERT IGNORE INTO users_of_rooms (user_uid, room_uid, name, is_owner)
                    VALUES (?, ?, ?, ?);
                    "#,
                user_uid,
                room_uid,
                user_name,
                false
            )
            .execute(&state.db_pool)
            .await;

            // get schedule as in DB
            let room = sqlx::query!(
                r#"
                    SELECT * FROM rooms
                    WHERE uid=?
                    "#,
                room_uid
            )
            .fetch_one(&state.db_pool)
            .await?;

            // update schedule
            let mut schedule: Vec<Vec<Vec<String>>> =
                serde_json::from_str(&room.schedule.unwrap())?;

            let (_, mut others_schedule) = seperate_users_schedule(schedule, user_uid.clone());

            schedule = others_schedule
                .iter_mut()
                .enumerate()
                .map(|(i, row)| {
                    row.iter_mut()
                        .enumerate()
                        .map(|(j, slot)| {
                            if user_schedule[i][j] == true {
                                slot.push(user_uid.clone());
                            }
                            (*slot).clone()
                        })
                        .collect()
                })
                .collect();

            // save new schedule
            let _ = sqlx::query!(
                r#"
                    UPDATE rooms 
                    SET schedule=?
                    WHERE uid=?
                    "#,
                json!(schedule),
                room_uid,
            )
            .execute(&state.db_pool)
            .await;

            // get users
            let users_of_room: Vec<(String,)> = sqlx::query_as(
                r#"
                SELECT user_uid FROM users_of_rooms
                WHERE room_uid=?
                "#,
            )
            .bind(room_uid.clone())
            .fetch_all(&state.db_pool)
            .await?;

            for (this_user_uid, user_wsc) in state.rooms.lock().await.get(&room_uid).unwrap().iter()
            {
                let mut other_users_indices_dict = HashMap::new();
                let mut other_users_index = 0;
                for user in users_of_room.iter() {
                    if user.0 != *this_user_uid {
                        other_users_indices_dict.insert(user.0.clone(), other_users_index);
                        other_users_index += 1;
                    }
                }

                let (_, this_others_schedule) =
                    seperate_users_schedule(schedule.clone(), this_user_uid.to_string());

                let this_others_schedule_indices: Vec<Vec<Vec<usize>>> = this_others_schedule
                    .iter()
                    .map(|day| {
                        (*day)
                            .iter()
                            .map(|slot| {
                                (*slot)
                                    .iter()
                                    .map(|uid| *other_users_indices_dict.get(uid).unwrap())
                                    .collect()
                            })
                            .collect()
                    })
                    .collect();

                let _ = user_wsc
                    .send_json(&WSMessage {
                        message_type: String::from("editSchedule"),
                        payload: this_others_schedule_indices.into(),
                    })
                    .await;
            }
        }
        "editEventName" => {
            #[derive(Serialize, Deserialize)]
            struct EditEventNamePayload {
                name: String,
            }
            let event_name_payload: EditEventNamePayload =
                serde_json::from_value(msg.payload).unwrap();

            let user_of_room: UserOfRoom = sqlx::query_as(
                r#"
                SELECT * FROM users_of_rooms
                WHERE user_uid=? AND room_uid=?
                "#,
            )
            .bind(user_uid.clone())
            .bind(room_uid.clone())
            .fetch_one(&state.db_pool)
            .await?;

            if user_of_room.is_owner {
                sqlx::query(
                    r#"
                    UPDATE rooms
                    SET event_name=?
                    WHERE uid=?;
                    "#,
                )
                .bind(event_name_payload.name.clone())
                .bind(room_uid.clone())
                .execute(&state.db_pool)
                .await?;

                // #[derive(Serialize, Deserialize)]
                // struct EditEventNamePingPayload {
                //     name: String,
                // }

                #[derive(Serialize, Deserialize)]
                struct EditEventNamePing {
                    message_type: String,
                    payload: String,
                }

                for (this_user_uid, user_wsc) in
                    state.rooms.lock().await.get(&room_uid).unwrap().iter()
                {
                    if *this_user_uid != user_uid {
                        let _ = user_wsc
                            .send_json(&EditEventNamePing {
                                message_type: "editEventName".to_string(),
                                payload: event_name_payload.name.to_string(),
                            })
                            .await;
                    }
                }
            }
        }
        "editUserName" => {
            #[derive(Debug, Serialize, Deserialize)]
            struct EditUserNamePayload {
                name: String,
            }
            let user_name_payload: EditUserNamePayload =
                serde_json::from_value(msg.payload).unwrap();

            let res = sqlx::query(
                r#"
                UPDATE users_of_rooms
                SET name=?
                WHERE user_uid=? AND room_uid=? 
                "#,
            )
            .bind(user_name_payload.name)
            .bind(user_uid.clone())
            .bind(room_uid.clone())
            .execute(&state.db_pool)
            .await?;

            let users_of_rooms = sqlx::query_as::<_, UserOfRoom>(
                r#"
                SELECT * FROM users_of_rooms
                WHERE room_uid=?
                "#,
            )
            .bind(room_uid.clone())
            .fetch_all(&state.db_pool)
            .await?;

            #[derive(Serialize, Deserialize)]
            struct EditUserNamePing {
                message_type: String,
                payload: Vec<String>,
            }

            for (this_user_uid, user_wsc) in state.rooms.lock().await.get(&room_uid).unwrap().iter()
            {
                if *this_user_uid != user_uid {
                    let others_names: Vec<String> = users_of_rooms.clone().into_iter().fold(
                        Vec::new(),
                        |mut others_names, user| {
                            if user.user_uid != *this_user_uid {
                                others_names.push(user.name);
                            }
                            others_names
                        },
                    );

                    let _ = user_wsc
                        .send_json(&EditUserNamePing {
                            message_type: "editUserName".to_string(),
                            payload: others_names,
                        })
                        .await;
                }
            }
        }
        _ => return Err("Unknown message_type".into()),
    };

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

async fn authenticate(req: Request<State>) -> tide::Result {
    let mut response = Response::new(StatusCode::Ok);

    let mut user_uid = get_user_uid_from_cookie(&req).await;

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

    Ok(response)
}

#[derive(Debug, Serialize, Deserialize)]
struct GetRoomRes {
    event_name: String,
    dates: Vec<String>,
    slot_length: u8,
    user_schedule: Vec<Vec<bool>>,
    others_schedule: Vec<Vec<Vec<usize>>>,
    user_name: String,
    others_names: Vec<String>,
    time_range: TimeRange,
    is_owner: bool,
}

async fn get_room(req: Request<State>) -> tide::Result {
    let room_uid: String = req.param("room_uid")?.to_string();

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

    let mut user_index_dict = HashMap::new();
    let mut users_fold_index = 0;

    let (is_owner, user_name, others_names): (bool, String, Vec<String>) =
        users_of_rooms.clone().into_iter().fold(
            (false, String::new(), Vec::new()),
            |(mut is_owner, mut user_name, mut others_names), user| {
                if user.user_uid == user_uid {
                    user_name = user.name;
                    is_owner = user.is_owner;
                } else {
                    others_names.push(user.name);
                    user_index_dict.insert(user_name.clone(), users_fold_index);
                }
                users_fold_index += 1;

                (is_owner, user_name, others_names)
            },
        );

    for (user_i, user) in users_of_rooms.iter().enumerate() {
        user_index_dict.insert(user.user_uid.clone(), user_i);
    }

    let others_schedule_indices: Vec<Vec<Vec<usize>>> = others_schedule
        .iter()
        .map(|day| {
            (*day)
                .iter()
                .map(|slot| {
                    (*slot)
                        .iter()
                        .map(|uid| *user_index_dict.get(uid).unwrap())
                        .collect()
                })
                .collect()
        })
        .collect();

    let response_body = GetRoomRes {
        event_name: room.event_name.unwrap(),
        dates: serde_json::from_str(&room.dates.unwrap())?,
        slot_length: room.slot_length.unwrap(),
        user_schedule,
        others_schedule: others_schedule_indices,
        others_names,
        user_name,
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
