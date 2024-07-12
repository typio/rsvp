extern crate dotenv;

mod utils;

mod handlers;
use handlers::{auth, room, websocket};

mod models;
use models::State;

use dotenv::dotenv;
use sqlx::mysql::MySqlPool;
use std::env;
use tide::security::CorsMiddleware;
use tide::security::Origin;
use tide_websockets::WebSocket;

#[async_std::main]
async fn main() -> tide::Result<()> {
    dotenv().ok();

    let pool = MySqlPool::connect(&env::var("DATABASE_URL")?).await?;
    let mut app = tide::with_state(State::new(pool));

    let cors = CorsMiddleware::new()
        .allow_origin(Origin::from("http://localhost:5173"))
        .allow_credentials(true);

    app.with(cors);

    app.at("/api/auth").post(auth::authenticate);
    app.at("/api/rooms").post(room::create_room);
    app.at("/api/rooms/:room_uid").get(room::get_room);
    app.at("/api/delete/:room_uid").post(room::delete_room);

    app.at("/api/ws/:room_uid")
        .with(WebSocket::new(websocket::connect_websocket))
        .get(|_| async move { Ok("this was not a websocket request") });

    app.listen("127.0.0.1:3632").await?;

    Ok(())
}
