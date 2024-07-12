use crate::auth::signup;
use crate::models::{CreateRoomReq, GetRoomRes, Room, ScheduleDates, State, TimeRange};
use crate::utils::{generate_id, get_user_uid_from_cookie};

use sqlx::MySql;
use sqlx::Transaction;
use std::collections::HashMap;
use std::str::FromStr;
use tide::prelude::*;
use tide::Request;
use tide::Response;
use tide::StatusCode;
use time_new::ext::NumericalDuration;

pub fn get_sanitized_others(
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

pub fn seperate_users_schedule<'a>(
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

pub async fn process_room_data(
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

pub async fn create_room(mut req: Request<State>) -> tide::Result {
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

pub async fn get_room(req: Request<State>) -> tide::Result {
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

pub async fn delete_room(req: Request<State>) -> tide::Result {
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
