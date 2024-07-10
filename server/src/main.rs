extern crate dotenv;

mod utils;
use utils::{generate_auth_token, generate_id};

use async_std::prelude::*;
use async_std::sync::Mutex;
use dotenv::dotenv;
use futures::select;
use futures::FutureExt;
use serde::Deserialize;
use sqlx::mysql::MySqlConnectOptions;
use sqlx::mysql::MySqlPool;
use sqlx::MySql;
use sqlx::Pool;
use sqlx::Transaction;
use std::collections::HashMap;
use std::env;
use std::str::FromStr;
use std::sync::Arc;
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

#[derive(Debug, Clone, sqlx::FromRow)]
struct Room {
    uid: String,
    schedule_type: u8,
    event_name: String,
    dates: String,
    days_of_week: String,
    time_min: u8,
    time_max: u8,
    slot_length: u8,
    schedule: String, // TODO: Change from full user_uids to indexes into users_of_room maybe?
    expires_at: time_new::OffsetDateTime,
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
        .allow_origin(Origin::from("http://localhost:5173"))
        .allow_credentials(true);

    app.with(cors);

    app.at("/api/auth").post(authenticate);
    app.at("/api/rooms").post(create_room);
    app.at("/api/rooms/:room_uid").get(get_room);
    app.at("/api/delete/:room_uid").post(delete_room);

    app.at("/api/ws/:room_uid")
        .with(WebSocket::new(
            |req: tide::Request<State>, mut wsc: WebSocketConnection| async move {
                let user_uid = get_user_uid_from_cookie(&req).await;
                let room_uid = req.param("room_uid").unwrap();

                // Add connection
                if let Some(user_uid) = &user_uid {
                    let mut rooms = req.state().rooms.lock().await;
                    rooms
                        .entry(room_uid.to_string())
                        .or_insert_with(HashMap::new)
                        .insert(user_uid.clone(), wsc.clone());
                }

                let ping_interval = std::time::Duration::from_secs(100);
                let mut interval = async_std::stream::interval(ping_interval);

                loop {
                    select! {
                        _ = interval.next().fuse() => {
                            if let Err(_) = wsc.send(tide_websockets::Message::Ping(vec![])).await {
                                break;
                            }
                        },
                        message = wsc.next().fuse() => {
                            if let Some(Ok(message)) = message {
                                match message {
                                    tide_websockets::Message::Text(text) => {
                                        let message: WSMessage = serde_json::from_str(&text).unwrap();
                                        let _ = handle_websocket_message(
                                            req.state().clone(),
                                            room_uid.to_string(),
                                            user_uid.clone(),
                                            message,
                                        )
                                        .await;
                                    },
                                    tide_websockets::Message::Pong(_) => {
                                        if let Some(user_uid) = &user_uid {
                                            // println!("Pong from {}", user_uid);
                                        }
                                    },
                                    tide_websockets::Message::Ping(payload) => {
                                        if let Some(user_uid) = &user_uid {
                                            // println!("Ping from {}", user_uid);
                                        if let Err(_) = wsc.send(tide_websockets::Message::Pong(payload)).await {
                                            break;
                                        }
                                        }
                                    },
                                    _ => {} // Handle other message types if needed
                                }
                            }
                            else {
                                break; // Connection closed
                            }
                        }
                    }
                }

                // Remove connection
                if let Some(user_uid) = &user_uid {
                    let mut rooms = req.state().rooms.lock().await;
                    if let Some(room) = rooms.get_mut(room_uid) {
                        room.remove(user_uid);
                        if room.is_empty() {
                            rooms.remove(room_uid);
                        }
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
            let mut transaction = (&state.db_pool).begin().await?;

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

            // TODO: only allow current limit of 6 users per room (including owner)
            // send an error message back that creates a toast

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
            .execute(&mut *transaction)
            .await;

            // get schedule as in DB
            let room: Room = sqlx::query_as(
                r#"
                    SELECT * FROM rooms
                    WHERE uid=?
                    "#,
            )
            .bind(&room_uid)
            .fetch_one(&mut *transaction)
            .await?;

            // update schedule
            let mut schedule: Vec<Vec<Vec<&str>>> = serde_json::from_str(&room.schedule)?;

            let (_, mut others_schedule) = seperate_users_schedule(schedule, &user_uid);

            schedule = others_schedule
                .iter_mut()
                .enumerate()
                .map(|(i, row)| {
                    row.iter_mut()
                        .enumerate()
                        .map(|(j, slot)| {
                            if user_schedule[i][j] == true {
                                slot.push(&user_uid);
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
            .execute(&mut *transaction)
            .await;

            transaction.commit().await?;

            for (wsc_user_uid, wsc) in state.rooms.lock().await.get(&room_uid).unwrap().iter() {
                let room_data = process_room_data(&state, &room_uid, &wsc_user_uid)
                    .await
                    .unwrap();

                let _ = wsc
                    .send_json(&WSMessage {
                        message_type: String::from("editSchedule"),
                        // TODO: Change this to a bool array for more efficient rendering on the
                        // client
                        payload: room_data.others_schedule.into(),
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

            sqlx::query(
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

fn get_sanitized_others(
    others_schedule: Vec<Vec<Vec<&str>>>,
    users_of_room: Vec<(&str, &str)>,
    user_uid: &str,
) -> (Vec<String>, Vec<Vec<Vec<usize>>>) {
    let mut other_names = Vec::with_capacity(users_of_room.len() - 1);
    let mut other_users_indices_dict = HashMap::new();
    let mut other_users_index = 0;
    for (some_uid, some_name) in users_of_room.iter() {
        if *some_uid != user_uid {
            other_users_indices_dict.insert(some_uid, other_users_index);
            other_users_index += 1;

            other_names.push(some_name.to_string());
        }
    }

    (
        other_names,
        others_schedule
            .iter()
            .map(|day| {
                (*day)
                    .iter()
                    .map(|slot| {
                        (*slot)
                            .iter()
                            .map(|uid| {
                                let idx = other_users_indices_dict.get(uid);
                                let idx = idx.unwrap();
                                *idx
                            })
                            .collect()
                    })
                    .collect()
            })
            .collect(),
    )
}

async fn process_room_data(
    state: &State,
    room_uid: &str,
    user_uid: &str,
) -> Result<GetRoomRes, Box<dyn std::error::Error>> {
    let room: Room = sqlx::query_as(
        r#"
        SELECT * FROM rooms
        WHERE uid=?
        "#,
    )
    .bind(room_uid)
    .fetch_one(&state.db_pool)
    .await
    .unwrap();

    // Process schedule
    let schedule: Vec<Vec<Vec<&str>>> = serde_json::from_str(&room.schedule)?;
    let (user_schedule, others_schedule) = seperate_users_schedule(schedule, user_uid);

    // get users
    let users_of_room: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT user_uid, name FROM users_of_rooms
        WHERE room_uid=?
        "#,
    )
    .bind(room_uid)
    .fetch_all(&state.db_pool)
    .await
    .unwrap();

    // User might not be in room yet (as in GET request), that's ok
    let (user_name, is_owner): (String, bool) = sqlx::query_as(
        r#"
        SELECT name, is_owner FROM users_of_rooms
        WHERE room_uid=? AND user_uid=?
        "#,
    )
    .bind(room_uid)
    .bind(user_uid)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or((String::new(), false));

    let user_uids_and_names_of_room: Vec<(&str, &str)> = users_of_room
        .iter()
        .map(|(uid, name)| (uid.as_ref(), name.as_ref()))
        .collect();

    let (others_names, others_schedule_indices) =
        get_sanitized_others(others_schedule, user_uids_and_names_of_room, user_uid);

    Ok(GetRoomRes {
        event_name: room.event_name,
        schedule_type: room.schedule_type,
        dates: serde_json::from_str(&room.dates)?,
        days_of_week: serde_json::from_str(&room.days_of_week)?,
        slot_length: room.slot_length,
        user_schedule,
        others_schedule: others_schedule_indices,
        others_names,
        user_name,
        time_range: TimeRange {
            from_hour: room.time_min,
            to_hour: room.time_max,
        },
        is_owner,
    })
}

fn seperate_users_schedule<'a>(
    schedule: Vec<Vec<Vec<&'a str>>>,
    user_uid: &str,
) -> (Vec<Vec<bool>>, Vec<Vec<Vec<&'a str>>>) {
    let (user_schedule, others_schedule): (Vec<Vec<bool>>, Vec<Vec<Vec<&str>>>) = schedule
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

    if get_user_uid_from_cookie(&req).await == None {
        let mut transaction: Transaction<'_, MySql> = req.state().db_pool.begin().await?;

        match signup(&mut transaction).await {
            Ok((_signup_result, cookie)) => {
                response.insert_cookie(cookie);
            }
            Err(err) => {
                println!("{}", err);
                return Ok(Response::new(StatusCode::InternalServerError));
            }
        }

        transaction.commit().await?;
    }

    Ok(response)
}

#[derive(Debug, Serialize, Deserialize)]
struct GetRoomRes {
    event_name: String,
    schedule_type: u8,
    dates: Vec<String>,
    days_of_week: Vec<u8>,
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

    let user_uid = get_user_uid_from_cookie(&req)
        .await
        .unwrap_or(String::from_str("none")?);

    let room_data = process_room_data(&req.state(), &room_uid, &user_uid)
        .await
        .unwrap();

    let response_body_string = serde_json::to_string(&room_data)?;
    response.set_body(response_body_string);

    Ok(response)
}

async fn delete_room(req: Request<State>) -> tide::Result {
    let room_uid = req.param("room_uid")?;

    let response = Response::new(StatusCode::Ok);
    let user_uid: Option<String> = get_user_uid_from_cookie(&req).await;

    if user_uid == None {
        return Ok(Response::new(StatusCode::NetworkAuthenticationRequired));
    }

    let mut transaction: Transaction<'_, MySql> = req.state().db_pool.begin().await?;

    let (is_owner,): (bool,) =
        sqlx::query_as("SELECT is_owner FROM users_of_rooms WHERE user_uid=? AND room_uid=?")
            .bind(user_uid)
            .bind(room_uid)
            .fetch_one(&mut *transaction)
            .await?;

    if !is_owner {
        return Ok(Response::new(StatusCode::NetworkAuthenticationRequired));
    }

    match sqlx::query(
        r#"
        DELETE FROM rooms
        WHERE uid=?
        "#,
    )
    .bind(room_uid)
    .execute(&mut *transaction)
    .await
    {
        Ok(_) => {}
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    match sqlx::query("DELETE FROM users_of_rooms WHERE room_uid=?")
        .bind(room_uid)
        .execute(&mut *transaction)
        .await
    {
        Ok(_) => {}
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    transaction.commit().await?;
    Ok(response)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum ScheduleDates {
    Dates(Vec<String>),
    DaysOfWeek(Vec<u8>),
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateRoomReq {
    event_name: String,
    schedule_type: u8, // NOTE: I want to use an enum but sqlx nor TS+serde work well
    dates: ScheduleDates,
    slot_length: u8,
    schedule: Vec<Vec<bool>>,
    time_range: TimeRange,
}

async fn create_room(mut req: Request<State>) -> tide::Result {
    let req_body = match req.body_json::<CreateRoomReq>().await {
        Ok(res) => res,
        Err(e) => {
            println!("err: {}", { e });
            return Ok(Response::new(StatusCode::BadRequest));
        }
    };

    let mut transaction: Transaction<'_, MySql> = req.state().db_pool.begin().await?;

    let mut response = Response::new(StatusCode::Ok);
    let mut user_uid: Option<String> = get_user_uid_from_cookie(&req).await;

    if user_uid == None {
        match signup(&mut transaction).await {
            Ok((new_user_uid, cookie)) => {
                user_uid = Some(new_user_uid);
                response.insert_cookie(cookie);
            }
            Err(err) => {
                println!("Error: {}", err);
                return Ok(Response::new(StatusCode::InternalServerError));
            }
        }
    }

    // TODO: create a process that deletes expired rooms

    let room_uid: String;

    loop {
        let temp_uid = generate_id(req.peer_addr().unwrap_or(""), 4);
        match sqlx::query("SELECT * FROM rooms WHERE uid=?")
            .bind(temp_uid.clone())
            .fetch_one(&mut *transaction)
            .await
        {
            Ok(_) => false,
            Err(sqlx::Error::RowNotFound) => {
                room_uid = temp_uid;
                break;
            }
            Err(e) => panic!("{}", e),
        };
    }

    let (schedule_type, dates, days_of_week) = match req_body.dates {
        ScheduleDates::Dates(d) => (0u8, json!(d), serde_json::json!([])),
        ScheduleDates::DaysOfWeek(d) => (1u8, serde_json::json!([]), json!(d)),
    };

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
        INSERT INTO rooms (uid, event_name, schedule_type, dates, days_of_week, time_min, time_max, slot_length, schedule, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
        room_uid,
        req_body.event_name,
        schedule_type,
        dates,
        days_of_week,
        req_body.time_range.from_hour,
        req_body.time_range.to_hour,
        req_body.slot_length,
        schedule,
        expiry
    )
    .execute(&mut *transaction)
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
    .execute(&mut *transaction)
    .await
    {
        Ok(_) => response.set_body(json!({
            "room_uid": room_uid
        })),
        Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
    };

    transaction.commit().await?;

    Ok(response)
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

async fn signup(
    transaction: &mut Transaction<'_, MySql>,
) -> Result<(String, Cookie<'static>), sqlx::Error> {
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
    .execute(&mut **transaction)
    .await
    {
        Ok(_) => {
            return Ok((
                user_uid,
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
