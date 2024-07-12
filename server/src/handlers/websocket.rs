use std::time::{Duration, Instant};

use crate::models::{Room, State, UserOfRoom, WSMessage};
use crate::room::{process_room_data, seperate_users_schedule};
use crate::utils::get_user_uid_from_cookie;

use async_std::prelude::*;
use futures::select;
use futures::FutureExt;
use serde::Deserialize;
use tide::prelude::*;
use tide_websockets::WebSocketConnection;

pub async fn connect_websocket(
    req: tide::Request<State>,
    mut wsc: WebSocketConnection,
) -> tide::Result<()> {
    let user_uid = get_user_uid_from_cookie(&req).await;
    let room_uid = req.param("room_uid").unwrap();
    let state = req.state().clone();

    // Add connection
    if let Some(user_uid) = &user_uid {
        state
            .rooms
            .lock()
            .await
            .entry(room_uid.to_string())
            .or_default()
            .insert(user_uid.clone(), wsc.clone());
    }

    let mut interval = async_std::stream::interval(std::time::Duration::from_secs(15));

    let mut last_pong = Instant::now();
    let heartbeat_timeout = Duration::from_secs(30);

    loop {
        select! {
            _ = interval.next().fuse() => {
                if last_pong.elapsed() > heartbeat_timeout {
                    println!("Client failed to respond to ping, closing connection.");
                    break;
                }
                if let Err(_) = wsc.send(tide_websockets::Message::Ping(vec![])).await {
                    break;
                }
            },
            message = wsc.next().fuse() => {
                match message {
                    Some(Ok(tide_websockets::Message::Text(text))) => {
                        if text.trim() == "ping" {
                            // Handle text-based ping
                            if let Err(_) = wsc.send(tide_websockets::Message::Text("pong".to_string())).await {
                                break;
                            }
                            last_pong = Instant::now();
                        } else if text.trim() == "pong" {
                            // Handle text-based pong
                            last_pong = Instant::now();
                        } else {
                            // Handle regular text messages
                            let message: WSMessage = match serde_json::from_str(&text) {
                                Ok(msg) => msg,
                                Err(e) => {
                                    println!("Error parsing message: {:?}", e);
                                    continue;
                                }
                            };
                            if let Err(e) = handle_websocket_message(
                                req.state().clone(),
                                room_uid.to_string(),
                                user_uid.clone(),
                                message,
                            )
                            .await
                            {
                                println!("Error handling message: {:?}", e);
                            }
                        }
                    },
                    Some(Ok(tide_websockets::Message::Pong(_))) => {
                        last_pong = Instant::now();
                    },
                    Some(Ok(tide_websockets::Message::Ping(payload))) => {
                        if wsc.send(tide_websockets::Message::Pong(payload)).await.is_err() {
                            break;
                        }
                        last_pong = Instant::now();
                    },
                    Some(Ok(tide_websockets::Message::Close(_))) => {
                        println!("WebSocket closed.");
                        break;
                    },
                    Some(Err(e)) => {
                        println!("WebSocket error: {:?}", e);
                        break;
                    },
                    None => {
                        println!("WebSocket stream ended.");
                        break;
                    },
                    _ => {}
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
}

pub async fn handle_websocket_message(
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
