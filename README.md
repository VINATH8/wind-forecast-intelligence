# Spark — Wind Forecast Intelligence

A data-driven dashboard for evaluating Great Britain’s wind generation forecasts.

**Live Demo:** https://wind-forecast-intelligence-one.vercel.app/  
**Backend API:** https://spark-wind-api.onrender.com

## Overview

Spark brings wind generation actuals, forecast data, and evaluation metrics into a single analytics dashboard. It helps users explore forecast performance and understand the differences between predicted and observed generation.

The project evaluates historical data for January 2026 using Elexon's Balancing Mechanism Reporting Service (BMRS).

## Features

- **Overview:** Key performance indicators and forecast summaries.
- **Forecasts:** Visual comparison of actual and forecast generation.
- **Accuracy:** Historical forecast evaluation metrics.
- **Interactive analytics:** Charts, metrics, and data tables.
- **API integration:** FastAPI backend connected to a React frontend.

## Tech Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI, Uvicorn |
| Data retrieval | HTTPX |
| Data source | Elexon BMRS |
| Testing | Pytest |
| Containerization | Docker |
| Deployment | Vercel, Render |

## Data & Evaluation

Spark uses two Elexon BMRS datasets:

- **FUELHH:** Half-hourly actual generation, filtered for wind.
- **WINDFOR:** Wind generation forecasts.

Evaluation period: **January 1–31, 2026**

| Metric | Result |
|---|---:|
| Actual records retrieved | 1,488 |
| Forecast records retrieved | 18,688 |
| Matched hourly intervals | 744 / 744 |
| Interval coverage | 100% |
| MAE | 2,122.81 MW |
| RMSE | 2,616.69 MW |
| Mean bias | +1,840.30 MW |

*The 100% coverage represents matched hourly intervals, not forecast accuracy. Positive mean bias indicates overforecasting under the current sign convention. Forecast selection uses a prior-day 10:00 UTC cutoff assumption that requires validation for operational use.*

Data source: [Elexon](https://www.elexon.co.uk/)

## Architecture

```text
Elexon BMRS
    ↓
Python / FastAPI
    ↓
Analysis and evaluation API
    ↓
React / Vite
    ↓
Spark Dashboard
```

The frontend communicates with the backend through `/api` routes. In production, Vercel rewrites these requests to the Render-hosted API.

## Project Structure

```text
spark/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── elexon.py
│   │   ├── routes.py
│   │   └── analysis.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── render.yaml
└── README.md
```

## Run Locally

**Prerequisites:** Python, Node.js, npm, and Git.

Clone the repository:

```bash
git clone https://github.com/VINATH8/wind-forecast-intelligence.git
cd wind-forecast-intelligence
```

**1. Start the backend** (Windows PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Start the frontend** in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `/api/health` | Backend health check |
| `/api/analysis/january-2026` | January 2026 evaluation |
| `/api/data/inspect` | Data inspection |

## Tests & Docker

Run backend tests from the `backend` directory:

```bash
python -m pytest tests -q
```

**13 backend tests passed** during development. The frontend production build also completed successfully.

Build and run the backend container locally if Docker is installed:

```bash
docker build -t spark-wind-api ./backend
docker run --rm -p 8000:8000 spark-wind-api
```

The Docker image was built and deployed through Render. Local Docker execution was not verified.

## Deployment

- **Frontend:** [Vercel](https://wind-forecast-intelligence-one.vercel.app/)
- **Backend:** [Render](https://spark-wind-api.onrender.com/)
- **Health check:** [API status](https://spark-wind-api.onrender.com/api/health)
- **Evaluation data:** [January 2026 analysis](https://spark-wind-api.onrender.com/api/analysis/january-2026)

Free hosting may introduce cold starts after inactivity.

## Design References

The visual direction was informed by:

- [Linear](https://linear.app/) — clean interface, typography, and structured layouts.
- [Kombai](https://kombai.com/) — frontend design and implementation reference.

These served as design references; Spark's dashboard was developed for this project's specific requirements.

## AI Tools Disclosure

GPT and Arshna.ai were used minimally for ideation and debugging assistance, primarily to explore ideas and resolve specific issues with AI serving only as a limited supporting tool.

## Limitations

- Evaluation currently covers January 2026 only.
- Forecast alignment and the forecast cutoff assumption affect the reported metrics.
- Historical performance does not guarantee future accuracy.

---

**Spark — Wind Forecast Intelligence**
