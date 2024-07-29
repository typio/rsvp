use crate::models::State;
use crate::utils::{generate_auth_token, get_user_uid_from_cookie};

use sqlx::MySql;
use sqlx::Transaction;
use tide::http::Cookie;
use tide::Request;
use tide::Response;
use tide::StatusCode;
use time::Duration;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn authenticate(req: Request<State>) -> tide::Result {
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

pub async fn signup(
    transaction: &mut Transaction<'_, MySql>,
) -> Result<(String, Cookie<'static>), sqlx::Error> {
    let user_uid = Uuid::new_v4().to_string();
    let auth_token = generate_auth_token();

    match sqlx::query!(
        r#"
        INSERT INTO users (uid, auth_token, default_name)
        VALUES (?, ?, '')
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
