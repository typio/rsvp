use std::time::{Duration, Instant};

use crate::models::{Room, State, UserOfRoom, WSMessage};
use crate::room::process_room_data;
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
    let Some(user_uid) = get_user_uid_from_cookie(&req).await else {
        let _ = wsc.send(tide_websockets::Message::Close(None)).await;
        return Ok(());
    };
    let room_uid = req.param("room_uid")?;

    let state = req.state().clone();

    // Add connection
    state
        .rooms
        .lock()
        .await
        .entry(room_uid.to_string())
        .or_default()
        .insert(user_uid.clone(), wsc.clone());

    let mut interval = async_std::stream::interval(std::time::Duration::from_secs(15));

    let mut last_pong = Instant::now();
    let heartbeat_timeout = Duration::from_secs(25);

    loop {
        select! {
            _ = interval.next().fuse() => {
                if last_pong.elapsed() > heartbeat_timeout {
                    println!("Client failed to respond to ping, closing connection.");
                    break;
                }
                // if let Err(_) = wsc.send(tide_websockets::Message::Ping(vec![])).await {
                if let Err(_) = wsc.send(tide_websockets::Message::Text("ping".to_string())).await {
                    break;
                }
            },
            message = wsc.next().fuse() => {
                match message {
                    Some(Ok(tide_websockets::Message::Text(text))) => {
                        if text.len() > 100_000 {
                            break;
                        }
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
                        // println!("WebSocket closed.");
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
    {
        let mut rooms = req.state().rooms.lock().await;
        if let Some(room) = rooms.get_mut(room_uid) {
            room.remove(&user_uid);
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
    user_uid: String,
    msg: WSMessage,
) -> Result<(), Box<dyn std::error::Error>> {

    match msg.message_type.as_str() {
        "editSchedule" => {
            let mut transaction = (&state.db_pool).begin().await?;

            let user_schedule: Vec<Vec<bool>> =
                serde_json::from_value(msg.payload["user_schedule"].clone())?;

            let mut user_name: String = serde_json::from_value(msg.payload["user_name"].clone())?;

            // If user isn't in room add them
            let user_exists: bool = match sqlx::query(
                r#"
                SELECT * FROM users_of_rooms
                WHERE user_uid=? AND room_uid=?
                "#,
            )
            .bind(&user_uid)
            .bind(&room_uid)
            .fetch_one(&state.db_pool)
            .await
            {
                Ok(_) => true,
                Err(sqlx::Error::RowNotFound) => false,
                Err(error) => return Err(format!("Database error: {}", error).into()),
            };

            if !user_exists {
                if user_name.is_empty() {
                    let default_name: String =
                        (sqlx::query_as("SELECT default_name FROM users WHERE uid=?")
                            .bind(user_uid.clone())
                            .fetch_one(&state.db_pool)
                            .await
                            .unwrap_or((String::new(),)))
                        .0;

                    user_name = default_name;
                }

                let _ = sqlx::query!(
                    r#"
                    INSERT INTO users_of_rooms (user_uid, room_uid, name, is_owner, is_absent, absent_reason)
                    VALUES (?, ?, ?, ?, ?, ?);
                    "#,
                    user_uid,
                    room_uid,
                    user_name,
                    false,
                    false,
                    ""
                )
                .execute(&mut *transaction)
                .await?;
            }

            // get room from DB
            let room: Room = sqlx::query_as(
                r#"
                    SELECT uid, event_name, schedule_type,
                           CAST(dates AS CHAR) as dates,
                           CAST(days_of_week AS CHAR) as days_of_week,
                           time_min, time_max, slot_length,
                           CAST(schedule AS CHAR) as schedule,
                           CAST(participants AS CHAR) as participants,
                           expires_at
                    FROM rooms
                    WHERE uid=?
                    FOR UPDATE
                "#,
            )
            .bind(&room_uid)
            .fetch_one(&mut *transaction)
            .await?;

            let mut participants: Vec<String> = serde_json::from_str(&room.participants)?;
            let mut schedule: Vec<Vec<Vec<usize>>> = serde_json::from_str(&room.schedule)?;

            // Find or add user's participant index
            let user_p_index = match participants.iter().position(|p| p == &user_uid) {
                Some(idx) => idx,
                None => {
                    participants.push(user_uid.clone());
                    participants.len() - 1
                }
            };

            // Remove user's index from all cells, re-add where selected
            for (i, row) in schedule.iter_mut().enumerate() {
                for (j, slot) in row.iter_mut().enumerate() {
                    slot.retain(|&idx| idx != user_p_index);
                    if i < user_schedule.len() && j < user_schedule[i].len() && user_schedule[i][j] {
                        slot.push(user_p_index);
                    }
                }
            }

            // save schedule and participants
            let _ = sqlx::query!(
                r#"
                    UPDATE rooms
                    SET schedule=?, participants=?
                    WHERE uid=?
                    "#,
                json!(schedule),
                json!(participants),
                room_uid,
            )
            .execute(&mut *transaction)
            .await;

            transaction.commit().await?;

            if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                for (wsc_user_uid, wsc) in room.iter() {
                    if let Ok(room_data) = process_room_data(&state, &room_uid, &wsc_user_uid).await {
                        let _ = wsc
                            .send_json(&json!({
                            "messageType": "editSchedule",
                            "payload": {
                                "userName": room_data.user_name,
                                "others": room_data.others_names,
                                "othersSchedule": room_data.others_schedule,
                                "absentReasons": room_data.absent_reasons
                            }}))
                            .await;
                    }
                }
            }
        }
        "editEventName" => {
            #[derive(Serialize, Deserialize)]
            struct EditEventNamePayload {
                name: String,
            }
            let event_name_payload: EditEventNamePayload =
                serde_json::from_value(msg.payload)?;

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

                if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                    for (this_user_uid, user_wsc) in room.iter() {
                        if *this_user_uid != user_uid {
                            let _ = user_wsc
                                .send_json(&json!( {
                                    "messageType": "editEventName",
                                    "payload": {"eventName": event_name_payload.name},
                                }))
                                .await;
                        }
                    }
                }
            }
        }
        "editUserName" => {
            #[derive(Deserialize)]
            struct EditUserNamePayload {
                name: String,
            }

            let user_name_payload: EditUserNamePayload =
                serde_json::from_value(msg.payload)?;

            sqlx::query(
                r#"
                UPDATE users_of_rooms
                SET name=?
                WHERE user_uid=? AND room_uid=? 
                "#,
            )
            .bind(&user_name_payload.name)
            .bind(&user_uid)
            .bind(&room_uid)
            .execute(&state.db_pool)
            .await?;

            sqlx::query(
                r#"
                UPDATE users
                SET default_name=?
                WHERE uid=?
                "#,
            )
            .bind(&user_name_payload.name)
            .bind(&user_uid)
            .execute(&state.db_pool)
            .await?;

            let users_of_rooms = sqlx::query_as::<_, UserOfRoom>(
                r#"
                SELECT * FROM users_of_rooms
                WHERE room_uid=?
                "#,
            )
            .bind(&room_uid)
            .fetch_all(&state.db_pool)
            .await?;

            if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                for (this_user_uid, user_wsc) in room.iter() {
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
                            .send_json(&json!({
                                "messageType": "editUserName",
                                "payload": { "others": others_names},
                            }))
                            .await;
                    }
                }
            }
        }
        "editIsAbsent" => {
            let user_of_room: Result<UserOfRoom, sqlx::Error> = sqlx::query_as(
                r#"
                    SELECT * FROM users_of_rooms
                    WHERE user_uid=? AND room_uid=?
                "#,
            )
            .bind(user_uid.clone())
            .bind(room_uid.clone())
            .fetch_one(&state.db_pool)
            .await;

            let user_of_room = match user_of_room {
                Ok(res) => Some(res),
                Err(sqlx::Error::RowNotFound) => None,
                Err(e) => return Err(e.into()),
            };

            if user_of_room.is_some() && user_of_room.unwrap().is_owner {
                return Err("Owner can't be absent.".into());
            }

            // TODO: OR get default name!
            let user_name: String = serde_json::from_value(msg.payload["user_name"].clone())?;
            let absent_reason: Option<String> =
                serde_json::from_value(msg.payload["absent_reason"].clone())?;

            let is_absent = !absent_reason.is_none();

            let absent_reason: String = absent_reason.unwrap_or("".to_string());

            // Set absent, and if user isn't in room add them
            let _ = sqlx::query!(
                r#"
                    INSERT IGNORE INTO users_of_rooms (user_uid, room_uid, name, is_owner, is_absent, absent_reason)
                    VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_absent=?, absent_reason=?;
                "#,
                user_uid,
                room_uid,
                user_name,
                false,
                is_absent,
                absent_reason,

                is_absent,
                absent_reason
            )
            .execute(&state.db_pool)
            .await;

            if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                for (this_user_uid, user_wsc) in room.iter() {
                    if let Ok(room_data) = process_room_data(&state, &room_uid, &this_user_uid).await {
                        let msg_type = if *this_user_uid == user_uid {
                            "userSetAbsentReason"
                        } else {
                            "otherSetAbsentReason"
                        };

                        let _ = user_wsc
                            .send_json(&json!({
                                "messageType": msg_type,
                                "payload": {
                                    "othersSchedule": room_data.others_schedule,
                                    "others": room_data.others_names,
                                    "absentReasons": room_data.absent_reasons
                                }
                            }))
                            .await;
                    }
                }
            }
        }
        "removeParticipant" => {
            // Two modes: owner removes another (others_index), or non-owner removes self (leave: true)
            #[derive(Deserialize)]
            struct RemovePayload {
                others_index: Option<usize>,
                leave: Option<bool>,
            }
            let payload: RemovePayload = serde_json::from_value(msg.payload)?;

            let user_of_room: UserOfRoom = sqlx::query_as(
                "SELECT * FROM users_of_rooms WHERE user_uid=? AND room_uid=?",
            )
            .bind(&user_uid)
            .bind(&room_uid)
            .fetch_one(&state.db_pool)
            .await?;

            let is_self_leave = payload.leave.unwrap_or(false);

            if !is_self_leave && !user_of_room.is_owner {
                return Err("Only the owner can remove other participants".into());
            }
            if is_self_leave && user_of_room.is_owner {
                return Err("Owner cannot leave their own room".into());
            }

            let mut transaction = (&state.db_pool).begin().await?;

            let room: Room = sqlx::query_as(
                r#"
                    SELECT uid, event_name, schedule_type,
                           CAST(dates AS CHAR) as dates,
                           CAST(days_of_week AS CHAR) as days_of_week,
                           time_min, time_max, slot_length,
                           CAST(schedule AS CHAR) as schedule,
                           CAST(participants AS CHAR) as participants,
                           expires_at
                    FROM rooms
                    WHERE uid=?
                    FOR UPDATE
                "#,
            )
            .bind(&room_uid)
            .fetch_one(&mut *transaction)
            .await?;

            let mut participants: Vec<String> = serde_json::from_str(&room.participants)?;
            let mut schedule: Vec<Vec<Vec<usize>>> = serde_json::from_str(&room.schedule)?;

            // Determine target participant index
            let target_p_index = if is_self_leave {
                participants.iter().position(|p| p == &user_uid)
                    .ok_or("User not found in participants")?
            } else {
                let sender_p_index = participants.iter().position(|p| p == &user_uid)
                    .ok_or("Owner not found in participants")?;
                let others_index = payload.others_index
                    .ok_or("others_index required for owner removal")?;
                let mut others_idx = 0;
                let mut found: Option<usize> = None;
                for (p_idx, _) in participants.iter().enumerate() {
                    if p_idx != sender_p_index {
                        if others_idx == others_index {
                            found = Some(p_idx);
                            break;
                        }
                        others_idx += 1;
                    }
                }
                found.ok_or("Invalid participant index")?
            };

            let target_uid = participants.get(target_p_index)
                .ok_or("Participant index out of bounds")?.clone();

            // Remove target's index from all schedule cells and reindex
            for row in schedule.iter_mut() {
                for slot in row.iter_mut() {
                    slot.retain(|&idx| idx != target_p_index);
                    for idx in slot.iter_mut() {
                        if *idx > target_p_index {
                            *idx -= 1;
                        }
                    }
                }
            }

            participants.remove(target_p_index);

            sqlx::query!(
                "UPDATE rooms SET schedule=?, participants=? WHERE uid=?",
                json!(schedule),
                json!(participants),
                room_uid,
            )
            .execute(&mut *transaction)
            .await?;

            sqlx::query("DELETE FROM users_of_rooms WHERE user_uid=? AND room_uid=?")
                .bind(&target_uid)
                .bind(&room_uid)
                .execute(&mut *transaction)
                .await?;

            transaction.commit().await?;

            // Notify the removed user (if removed by owner)
            if !is_self_leave {
                if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                    if let Some(target_wsc) = room.get(&target_uid) {
                        let _ = target_wsc
                            .send_json(&json!({ "messageType": "removedFromRoom" }))
                            .await;
                    }
                }
            }

            // Broadcast updated state to remaining users
            if let Some(room) = state.rooms.lock().await.get(&room_uid) {
                for (wsc_user_uid, wsc) in room.iter() {
                    if *wsc_user_uid != target_uid {
                        if let Ok(room_data) = process_room_data(&state, &room_uid, wsc_user_uid).await {
                            let _ = wsc
                                .send_json(&json!({
                                    "messageType": "editSchedule",
                                    "payload": {
                                        "userName": room_data.user_name,
                                        "others": room_data.others_names,
                                        "othersSchedule": room_data.others_schedule,
                                        "absentReasons": room_data.absent_reasons
                                    }
                                }))
                                .await;
                        }
                    }
                }
            }
        }
        _ => return Err("Unknown message type".into()),
    };

    Ok(())
}
