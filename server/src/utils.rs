use crate::models::{Bucket, State};

use num_bigint::BigUint;
use sha2::{Digest, Sha256};
use std::ops::Div;
use std::ops::Rem;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tide::Request;
use uuid::Uuid;

pub fn client_ip(req: &Request<State>) -> String {
    let header = |name: &str| {
        req.header(name)
            .and_then(|h| h.get(0))
            .map(|v| v.as_str().split(',').next().unwrap_or("").trim().to_string())
            .filter(|s| !s.is_empty())
    };
    header("cf-connecting-ip")
        .or_else(|| header("x-forwarded-for"))
        .unwrap_or_else(|| {
            // strip the port: it differs per connection
            req.peer_addr()
                .and_then(|p| p.parse::<std::net::SocketAddr>().ok())
                .map(|a| a.ip().to_string())
                .unwrap_or_else(|| "?".to_string())
        })
}

// token bucket per ip: `burst` at once, then one per `refill_secs`
pub async fn allow(req: &Request<State>, scope: &str, burst: f64, refill_secs: f64) -> bool {
    if std::env::var("RSVP_NO_RATE_LIMIT").is_ok() {
        return true;
    }
    let key = format!("{}:{}", scope, client_ip(req));
    let mut map = req.state().limiter.lock().await;
    let now = Instant::now();
    if map.len() > 5_000 {
        map.retain(|_, b| now.duration_since(b.last).as_secs() < 3600);
    }
    let b = map.entry(key).or_insert(Bucket { tokens: burst, last: now });
    b.tokens = (b.tokens + now.duration_since(b.last).as_secs_f64() / refill_secs).min(burst);
    b.last = now;
    if b.tokens >= 1.0 {
        b.tokens -= 1.0;
        true
    } else {
        false
    }
}

pub fn generate_auth_token() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", timestamp, Uuid::new_v4()));
    let hash = hasher.finalize();
    format!("{:x}", hash)
}

pub fn generate_id(ip: &str, len: usize) -> String {
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

    id[..id.len().min(len)].to_string()
}

pub async fn get_user_uid_from_cookie(req: &Request<State>) -> Option<String> {
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
