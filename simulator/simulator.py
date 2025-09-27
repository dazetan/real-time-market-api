import pandas as pd
import asyncio
import websockets
import json
from datetime import datetime, timedelta

class TradeSimulator:
    def __init__(self, filepath="./AAPL.csv"):
        # Loading the csv file into a dataframe
        self.df = pd.read_csv(filepath)
        # Fixing the millisecond formatting
        self.df['datetime'] = self.df['datetime'].str.replace(r'(?<=\d{2}):(?=\d{3}$)', '.', regex=True)
        # Renaming the datetime column to timestamp 
        self.df.rename(columns={'datetime': 'timestamp'}, inplace=True)
        self.df['timestamp'] = pd.to_datetime(self.df['timestamp'], format="%Y-%m-%d %H:%M:%S.%f", errors='coerce').dt.round('s')
        self.df.dropna(subset=['timestamp'], inplace=True)

        # Setting the start time and end time of simulation
        self.simulation_time = self.df['timestamp'].min()
        self.end_time = self.df['timestamp'].max()

    async def start(self):
        uri = "ws://localhost:8000/simulator-feed"
        print("Connecting to FastAPI server at /simulator-feed...")

        try:
            # Creating a websocket connection to the FastAPI
            async with websockets.connect(uri) as websocket:
                print("Simulator connected. Streaming real-time trades...\n")
                # Going through each second of the simulation 
                while self.simulation_time <= self.end_time:
                    # Obtaining the trades for the current second
                    trades = self.get_trades_for_current_second()

                    if trades:
                        # Current time and trades
                        message = {
                            "time": self.simulation_time.isoformat(),
                            "trades": [self.serialize_trade(trade) for trade in trades]
                        }
                        # Sending the message over the websocket
                        await websocket.send(json.dumps(message))
                        print(f"Sent {len(trades)} trades at {self.simulation_time.time()}")

                    self.simulation_time += timedelta(seconds=1)
                    await asyncio.sleep(0.001)

                print("All trades sent. Closing connection.")
                await asyncio.sleep(1)
                await websocket.close()

        except websockets.ConnectionClosed:
            print("Simulator disconnected: server closed connection.")
        except Exception as e:
            print(f"Error: {e}")

    def get_trades_for_current_second(self):
        # Filtering the trades occuring within the current simulation second
        start = self.simulation_time
        end = start + timedelta(seconds=1)
        mask = (self.df['timestamp'] >= start) & (self.df['timestamp'] < end)
        return self.df.loc[mask].to_dict(orient='records')

    def serialize_trade(self, trade):
        # Converting the timestamp to ISO format
        trade["timestamp"] = pd.to_datetime(trade["timestamp"]).isoformat()
        return trade

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "./AAPL.csv"
    simulator = TradeSimulator(filepath=filepath)
    asyncio.run(simulator.start())
