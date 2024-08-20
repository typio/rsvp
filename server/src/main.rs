extern crate dotenv;

mod utils;

mod handlers;
use handlers::{auth, room, websocket};

mod models;
use models::State;

use dotenv::dotenv;
use sqlx::mysql::MySqlPool;
use std::env;
use tide::http::headers::HeaderValue;
use tide::security::CorsMiddleware;
use tide::security::Origin;
use tide_websockets::WebSocket;

#[async_std::main]
async fn main() -> tide::Result<()> {
    dotenv().ok();

    let pool = MySqlPool::connect(&env::var("DATABASE_URL")?).await?;
    let mut app = tide::with_state(State::new(pool));

    let cors = CorsMiddleware::new()
        .allow_methods("GET, POST, DELETE".parse::<HeaderValue>().unwrap())
        .allow_origin(Origin::from(env::var("FRONTEND_URL")?))
        .allow_credentials(true);

    app.with(cors);

    app.at("/").get(|_| async { Ok("Hello, world!") });
    app.at("/api/auth").post(auth::authenticate);
    app.at("/api/rooms").post(room::create_room);
    app.at("/api/rooms/:room_uid").get(room::get_room);
    app.at("/api/rooms/:room_uid").delete(room::delete_room);

    app.at("/api/ws/:room_uid")
        .with(WebSocket::new(websocket::connect_websocket))
        .get(|_| async move { Ok("this was not a websocket request") });

    app.listen(&env::var("BACKEND_URL")?).await?;

    Ok(())
}
