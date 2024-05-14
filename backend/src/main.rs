use tide::prelude::*;
use tide::Request;

#[derive(Debug, Deserialize)]
struct Animal {
    name: String,
    legs: u16,
}

#[async_std::main]
async fn main() -> tide::Result<()> {
    let mut app = tide::new();
    app.at("/orders/shoes").post(order_shoes);
    app.listen("127.0.0.1:4040").await?;

    Ok(())
}

async fn order_shoes(mut req: Request<()>) -> tide::Result {
    println!("order");
    let Animal { name, legs } = req.body_json().await?;
    let response = format!("Hello, {}! I've put in an order for {} shoes", name, legs);
    println!("{}", &response);
    Ok(response.into())
}
