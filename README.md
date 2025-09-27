# Real-Time Market Data Web App

Full-stack trading data platform built with **FastAPI**, **WebSockets**, **Pandas**, and **Chart.js**.  
Simulates and streams market trades in real time with floating bars, candlestick charts, and interactive dashboards.

---

## Features
- **Real-time market feed** – Simulator replays historical trades every second.  
- **FastAPI server** – Aggregates trades, calculates min/max prices and volumes, and broadcasts via WebSockets.  
- **Interactive client** – Browser app with floating bars, candlestick charts, and live updates of key metrics (last price, volume, highs/lows).  
- **Modular design** – Separate simulator, server, and client components for easy maintenance.

---

## Installation & Running

### Prerequisites
- Python 3.10+
- Uvicorn

### 1. Start the server
```bash
cd OOP_project_4
python -m uvicorn server.main:app --reload --port 8000
