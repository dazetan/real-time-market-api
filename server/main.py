from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import websockets
import uvicorn

# Importing the functions for trade data analysis
from server.trade_data import (
    add_trade,
    get_moving_averages,
    get_open_close_high_low,
    get_candlestick,
    get_volume_per_minute,
    get_minute_summary,
    get_all_minute_data,
    get_daily_stats
)

app = FastAPI()
connected_clients = set()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serving the static files for the frontend
app.mount("/client", StaticFiles(directory="client"), name="client")

@app.get("/")
async def root():
    return {"message": "Server running"}

@app.get("/data")
async def get_data():
    return {
        "minute_data": get_all_minute_data(),
        "macd_data": get_moving_averages(),
        "daily_stats": get_daily_stats(),
        "volume_data": get_volume_per_minute()
    }

# Websocket endpoint for simulator to push in the trading data
@app.websocket("/simulator-feed")
async def simulator_feed(websocket: WebSocket):
    await websocket.accept()
    print("Simulator connected.")

    try:
        while True:
            # Receiving the trade data from simulator
            data = await websocket.receive_text()
            message = json.loads(data)
            trades = message.get("trades", [])

            for trade in trades:
                add_trade(trade)

            update = {
                "minute_data": get_all_minute_data(),
                "macd_data": get_moving_averages(),
                "daily_stats": get_daily_stats(),
                "volume_data": get_volume_per_minute()
            }
            for client in connected_clients:
                await client.send_json(update)

    except Exception as e:
        print(f"Simulator disconnected: {e}")

# Websocket endpoint for browser clients
@app.websocket("/ws")
async def browser_ws(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print("Browser connected.")

    try:
        initial_data = {
            "minute_data": get_all_minute_data(),
            "macd_data": get_moving_averages(),
            "daily_stats": get_daily_stats(),
            "volume_data": get_volume_per_minute()
        }
        await websocket.send_json(initial_data)

        while True:
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Browser disconnected: {e}")
    finally:
        connected_clients.remove(websocket)

# Starting the FastAPI server using uvicorn
if __name__ == "__main__":
    uvicorn.run("server.main:app", host="0.0.0.0", port=8000, reload=True)

