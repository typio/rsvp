use crate::auth::signup;
use crate::models::{
    CreateRoomReq, GetRoomRes, Room, RoomDeletedPing, ScheduleDates, State, TimeRange,
};
use crate::utils::{generate_id, get_user_uid_from_cookie};

use sqlx::MySql;
use sqlx::Transaction;
use std::collections::HashMap;
use tide::prelude::*;
use tide::Request;
use tide::Response;
use tide::StatusCode;
use time_new::ext::NumericalDuration;

pub fn seperate_users_schedule(
    schedule: Vec<Vec<Vec<usize>>>,
    user_index: Option<usize>,
) -> (Vec<Vec<bool>>, Vec<Vec<Vec<usize>>>) {
    schedule
        .into_iter()
        .map(|row| {
            row.into_iter()
                .map(|cell| {
                    let mut is_user_in_cell = false;
                    let mut others_in_cell = Vec::with_capacity(cell.len());
                    for idx in cell {
                        if Some(idx) == user_index {
                            is_user_in_cell = true;
                        } else {
                            others_in_cell.push(idx);
                        }
                    }
                    (is_user_in_cell, others_in_cell)
                })
                .unzip()
        })
        .unzip()
}

pub fn remap_others_schedule(
    others_schedule: &Vec<Vec<Vec<usize>>>,
    participant_to_others: &HashMap<usize, usize>,
) -> Vec<Vec<Vec<usize>>> {
    others_schedule
        .iter()
        .map(|day| {
            day.iter()
                .map(|slot| {
                    slot.iter()
                        .filter_map(|p_idx| participant_to_others.get(p_idx).copied())
                        .collect()
                })
                .collect()
        })
        .collect()
}

pub async fn process_room_data(
    state: &State,
    room_uid: &str,
    user_uid: &str,
) -> Result<GetRoomRes, tide::Error> {
    let room: Room = sqlx::query_as(
        r#"
        SELECT uid, event_name, schedule_type,
               CAST(dates AS CHAR) as dates,
               CAST(days_of_week AS CHAR) as days_of_week,
               time_min, time_max, slot_length,
               CAST(schedule AS CHAR) as schedule,
               CAST(participants AS CHAR) as participants,
               timezone,
               expires_at
        FROM rooms
        WHERE uid=?
        "#,
    )
    .bind(room_uid)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => tide::Error::from_str(StatusCode::NotFound, "Room not found"),
        other => {
            println!("SQLx error: {:?}", other);
            tide::Error::from_str(StatusCode::InternalServerError, "Database error")
        }
    })?;

    let participants: Vec<String> = serde_json::from_str(&room.participants)?;
    let schedule: Vec<Vec<Vec<usize>>> = serde_json::from_str(&room.schedule)?;
    let user_index = participants.iter().position(|p| p == user_uid);

    let (user_schedule, others_schedule) = seperate_users_schedule(schedule, user_index);

    // Get all users in the room
    let users_of_room: Vec<(String, String, bool, String)> = sqlx::query_as(
        r#"
        SELECT user_uid, name, is_absent, absent_reason FROM users_of_rooms
        WHERE room_uid=?
        "#,
    )
    .bind(room_uid)
    .fetch_all(&state.db_pool)
    .await?;

    // Build a lookup from uid → (name, is_owner, is_absent, absent_reason)
    let user_info: HashMap<&str, (&str, bool, &str)> = users_of_room
        .iter()
        .map(|(uid, name, is_absent, reason)| (uid.as_str(), (name.as_str(), *is_absent, reason.as_str())))
        .collect();

    // Current user info
    let (user_name, is_owner, is_absent, absent_reason): (String, bool, bool, String) =
        sqlx::query_as(
            r#"
            SELECT name, is_owner, is_absent, absent_reason FROM users_of_rooms
            WHERE room_uid=? AND user_uid=?
            "#,
        )
        .bind(room_uid)
        .bind(user_uid)
        .fetch_one(&state.db_pool)
        .await
        .unwrap_or((String::new(), false, false, String::new()));

    // Build others list: participants (excluding current user) in order,
    // then any absent-only users not in participants
    let mut others_names = Vec::new();
    let mut absent_reasons = Vec::new();
    let mut participant_to_others: HashMap<usize, usize> = HashMap::new();

    absent_reasons.push(if is_absent { Some(absent_reason) } else { None });

    for (p_idx, p_uid) in participants.iter().enumerate() {
        if Some(p_idx) != user_index {
            participant_to_others.insert(p_idx, others_names.len());
            let (name, p_absent, reason) = user_info.get(p_uid.as_str()).copied().unwrap_or(("", false, ""));
            others_names.push(name.to_string());
            absent_reasons.push(if p_absent { Some(reason.to_string()) } else { None });
        }
    }

    // Append absent-only users not in participants
    for (uid, name, u_absent, reason) in &users_of_room {
        if uid != user_uid && !participants.contains(uid) {
            others_names.push(name.clone());
            absent_reasons.push(if *u_absent { Some(reason.clone()) } else { None });
        }
    }

    let others_schedule_remapped = remap_others_schedule(&others_schedule, &participant_to_others);

    Ok(GetRoomRes {
        event_name: room.event_name,
        schedule_type: room.schedule_type,
        dates: serde_json::from_str(&room.dates)?,
        days_of_week: serde_json::from_str(&room.days_of_week)?,
        slot_length: room.slot_length,
        user_schedule,
        others_schedule: others_schedule_remapped,
        others_names,
        user_name,
        time_range: TimeRange {
            from_hour: room.time_min,
            to_hour: room.time_max,
        },
        is_owner,
        absent_reasons,
        timezone: room.timezone,
    })
}

pub async fn create_room(mut req: Request<State>) -> tide::Result {
    let req_body = match req.body_json::<CreateRoomReq>().await {
        Ok(res) => res,
        Err(e) => {
            println!("err: {}", { e });
            return Ok(Response::new(StatusCode::BadRequest));
        }
    };

    if req_body.event_name.len() > 64
        || req_body.time_range.from_hour >= 24
        || req_body.time_range.to_hour > 24
        || req_body.slot_length == 0
        || req_body.schedule.is_empty()
    {
        return Ok(Response::new(StatusCode::BadRequest));
    }

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
            Err(_) => return Ok(Response::new(StatusCode::InternalServerError)),
        };
    }

    let (schedule_type, dates, days_of_week) = match req_body.dates {
        ScheduleDates::Dates(d) => (0u8, json!(d), serde_json::json!([])),
        ScheduleDates::DaysOfWeek(d) => (1u8, serde_json::json!([]), json!(d)),
    };

    let participants = json!([user_uid.clone().unwrap()]);

    let schedule = json!(req_body
        .schedule
        .iter()
        .map(|row| {
            row.iter()
                .map(|&avail| {
                    if avail {
                        vec![0u32]
                    } else {
                        vec![] as Vec<u32>
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
        INSERT INTO rooms (uid, event_name, schedule_type, dates, days_of_week, time_min, time_max, slot_length, schedule, participants, timezone, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        participants,
        req_body.timezone,
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

    // Check if user exists to get default name
    let default_name: String = (sqlx::query_as("SELECT default_name FROM users WHERE uid=?")
        .bind(user_uid.clone())
        .fetch_one(&req.state().db_pool)
        .await
        .unwrap_or((String::new(),)))
    .0;

    let _ = match sqlx::query!(
        r#"
        INSERT INTO users_of_rooms (user_uid, room_uid, name, is_owner, is_absent, absent_reason)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
        user_uid,
        room_uid,
        default_name,
        true,
        false,
        ""
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

pub async fn get_room(req: Request<State>) -> tide::Result {
    let room_uid = req.param("room_uid")?.to_uppercase();
    let room_uid = room_uid.as_str();

    let mut response = Response::new(StatusCode::Ok);

    let user_uid = get_user_uid_from_cookie(&req)
        .await
        .unwrap_or_else(|| String::from("none"));

    let room_data = match process_room_data(&req.state(), room_uid, &user_uid).await {
        Ok(res) => res,
        Err(_) => return Ok(Response::new(StatusCode::NotFound)),
    };

    let response_body_string = serde_json::to_string(&room_data)?;
    response.set_body(response_body_string);

    Ok(response)
}

pub async fn delete_room(req: Request<State>) -> tide::Result {
    let response = Response::new(StatusCode::Ok);

    let room_uid: &str = req.param("room_uid")?;

    let user_uid: String = get_user_uid_from_cookie(&req).await.unwrap_or_default();

    if user_uid.is_empty() {
        return Ok(Response::new(StatusCode::Unauthorized));
    }

    let user_uid: &str = user_uid.as_ref();

    let mut transaction: Transaction<'_, MySql> = req.state().db_pool.begin().await?;

    let (is_owner,): (bool,) =
        sqlx::query_as("SELECT is_owner FROM users_of_rooms WHERE user_uid=? AND room_uid=?")
            .bind(user_uid)
            .bind(room_uid)
            .fetch_one(&mut *transaction)
            .await?;

    if !is_owner {
        return Ok(Response::new(StatusCode::Forbidden));
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

    if let Some(room) = req.state().rooms.lock().await.get(room_uid) {
        for (this_user_uid, user_wsc) in room.iter() {
            if *this_user_uid != user_uid {
                let _ = user_wsc
                    .send_json(&RoomDeletedPing {
                        message_type: "roomDeleted".to_string(),
                    })
                    .await;
            }
        }
    }

    Ok(response)
}

pub async fn og_page(req: Request<State>) -> tide::Result {
    let room_uid = req.param("room_uid")?.to_uppercase();
    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://cmon.rsvp".to_string());

    let room_info: Option<(String,)> = sqlx::query_as(
        "SELECT event_name FROM rooms WHERE uid=?"
    )
    .bind(&room_uid)
    .fetch_optional(&req.state().db_pool)
    .await?;

    let participant_count: Option<(i64,)> = sqlx::query_as(
        "SELECT COUNT(*) FROM users_of_rooms WHERE room_uid=?"
    )
    .bind(&room_uid)
    .fetch_optional(&req.state().db_pool)
    .await?;

    let (title, description) = match room_info {
        Some((event_name,)) => {
            let count = participant_count.map(|(c,)| c).unwrap_or(0);
            let desc = if count > 0 {
                format!("{} {} responded. Add your availability.", count, if count == 1 { "person has" } else { "people have" })
            } else {
                "Be the first to add your availability.".to_string()
            };
            (format!("Join '{}' on cmon.rsvp", event_name), desc)
        }
        None => (
            "cmon.rsvp".to_string(),
            "This room may have expired or been deleted.".to_string(),
        ),
    };

    let html = format!(
        r##"<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{title}</title>
<meta name="description" content="{description}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{frontend_url}/og-image.png" />
<meta property="og:url" content="{frontend_url}/{room_uid}" />
<meta property="og:site_name" content="cmon.rsvp" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{description}" />
<meta name="twitter:image" content="{frontend_url}/og-image.png" />
<meta name="theme-color" content="#0a1929" />
<meta http-equiv="refresh" content="0;url={frontend_url}/{room_uid}" />
</head>
<body></body>
</html>"##
    );

    let mut response = Response::new(StatusCode::Ok);
    response.set_content_type("text/html");
    response.set_body(html);
    Ok(response)
}
