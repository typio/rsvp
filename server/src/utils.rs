use num_bigint::BigUint;
use sha2::{Digest, Sha256};
use std::ops::Div;
use std::ops::Rem;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

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

    id[..len].to_string()
}


