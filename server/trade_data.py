import pandas as pd
from datetime import datetime

# Global list to store all trade records
trades = []

# Add a new trade to the global trades list with timestamp validation.
def add_trade(trade):
    trade["timestamp"] = pd.to_datetime(trade["timestamp"], errors="coerce")
    if pd.isna(trade["timestamp"]):
        return
    trades.append(trade)

# Generate summary statistics for the most recent minute of trades
def get_minute_summary():
    if not trades:
        return {}

    df = pd.DataFrame(trades)
    df["minute"] = df["timestamp"].dt.floor("min")

    now_minute = df["minute"].max()
    recent = df[df["minute"] == now_minute]

    if recent.empty:
        return {}

    avg_price = recent["price"].mean()
    min_price = recent["price"].min()
    max_price = recent["price"].max()

    return {
        "timestamp": now_minute.isoformat(),
        "avg_price": round(avg_price, 2),
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2)
    }

# Generate OHLC (Open-High-Low-Close) data for all minutes with trades.
def get_all_minute_data():
    if not trades:
        return []

    df = pd.DataFrame(trades)
    df["minute"] = df["timestamp"].dt.floor("min")
    result = []
    grouped = df.groupby("minute")

    for minute, group in grouped:
        result.append({
            "timestamp": minute.isoformat(),
            "open": group.iloc[0]["price"],
            "close": group.iloc[-1]["price"],
            "high": group["price"].max(),
            "low": group["price"].min(),
            "volume": int(group["quantity"].sum()),
            "avg_price": round(group["price"].mean(), 2)
        })
    return result

# Calculate MACD (Moving Average Convergence Divergence) indicators
def get_moving_averages(short_window=12, long_window=26):
    if not trades:
        return {"macd_data": []}

    df = pd.DataFrame(trades)
    df = df.sort_values("timestamp")
    df["minute"] = df["timestamp"].dt.floor("min")
    minute_avg = df.groupby("minute")["price"].mean().reset_index()

    if len(minute_avg) < long_window:
        return {"macd_data": []}

    minute_avg["ema_short"] = minute_avg["price"].ewm(span=short_window, adjust=False).mean()
    minute_avg["ema_long"] = minute_avg["price"].ewm(span=long_window, adjust=False).mean()

    # MACD is difference between short and long EMAs
    minute_avg["macd"] = minute_avg["ema_short"] - minute_avg["ema_long"]

    # Signal line is EMA of MACD
    minute_avg["signal"] = minute_avg["macd"].ewm(span=9, adjust=False).mean()

    # Histogram shows distance between MACD and signal
    minute_avg["histogram"] = minute_avg["macd"] - minute_avg["signal"]

    macd_data = []
    for _, row in minute_avg.iterrows():
        macd_data.append({
            "timestamp": row["minute"].isoformat(),
            "ema_short": round(row["ema_short"], 2),
            "ema_long": round(row["ema_long"], 2),
            "macd": round(row["macd"], 2),
            "signal": round(row["signal"], 2),
            "histogram": round(row["histogram"], 2)
        })

    return macd_data

# Get OHLC prices for the most recent minute
def get_open_close_high_low():
    df = pd.DataFrame(trades)
    if df.empty:
        return {"open": None, "close": None, "high": None, "low": None}

    df["minute"] = df["timestamp"].dt.floor("min")
    now_minute = df["minute"].max()
    recent = df[df["minute"] == now_minute]

    if recent.empty:
        return {"open": None, "close": None, "high": None, "low": None}

    recent = recent.sort_values("timestamp")
    return {
        "open": round(recent.iloc[0]["price"], 2),
        "close": round(recent.iloc[-1]["price"], 2),
        "high": round(recent["price"].max(), 2),
        "low": round(recent["price"].min(), 2)
    }

# Generate candlestick data for the most recent minute
def get_candlestick():
    df = pd.DataFrame(trades)
    if df.empty:
        return {}

    df["minute"] = df["timestamp"].dt.floor("min")
    now_minute = df["minute"].max()
    recent = df[df["minute"] == now_minute]

    if recent.empty:
        return {}

    recent = recent.sort_values("timestamp")
    open_price = recent.iloc[0]["price"]
    close_price = recent.iloc[-1]["price"]
    high_price = recent["price"].max()
    low_price = recent["price"].min()

    color = "blue" if close_price > open_price else "red"
    return {
        "open": round(open_price, 2),
        "close": round(close_price, 2),
        "high": round(high_price, 2),
        "low": round(low_price, 2),
        "color": color
    }

# Calculate trading volume aggregated by minute
def get_volume_per_minute():
    if not trades:
        return {}

    df = pd.DataFrame(trades)
    df['minute'] = df['timestamp'].dt.floor('min')
    volume_by_minute = df.groupby('minute')['quantity'].sum()

    return {minute.strftime("%Y-%m-%d %H:%M"): int(volume) for minute, volume in volume_by_minute.items()}

# Generate daily trading statistics (open, high, low, volume)
def get_daily_stats():
    if not trades:
        return {"day_open": None, "day_high": None, "day_low": None, "day_volume": None}

    df = pd.DataFrame(trades)
    df = df.sort_values("timestamp")

    day_open = df.iloc[0]["price"]
    day_high = df["price"].max()
    day_low = df["price"].min()
    day_volume = df["quantity"].sum()

    return {
        "day_open": round(day_open, 2),
        "day_high": round(day_high, 2),
        "day_low": round(day_low, 2),
        "day_volume": int(day_volume),
        "last_price": round(df.iloc[-1]["price"], 2)
    }
