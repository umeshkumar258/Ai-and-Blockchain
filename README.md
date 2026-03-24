# AI Startup Automation Tool

A full-stack lead management demo that combines AI-style lead qualification, email follow-up, and blockchain activity logging in one workflow.

## Overview

This project lets a user upload lead data from a CSV file, classify each lead as `HOT`, `MEDIUM`, or `COLD`, generate a suggested response, send an email reply, and log activity to the blockchain layer.

## Features

- CSV upload for lead intake
- Automated lead classification based on message intent
- Suggested reply generation for each lead
- Email sending through Gmail credentials
- Blockchain logging with Shardeum RPC
- Dashboard summary cards and lead distribution chart
- In-memory blockchain activity log viewer

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Chart.js, Papa Parse
- Backend: Node.js, Express, Nodemailer, Ethers.js
- Blockchain: Shardeum RPC integration

## Repository Structure

```text
.
|-- backend/          Express API and blockchain/email logic
|-- frontend/         React dashboard UI
|-- sample-leads.csv  Example upload file
|-- package.json      Workspace helper scripts
`-- README.md         Project documentation
```

## Getting Started

### 1. Install dependencies

```bash
npm run install-all
```

### 2. Configure backend environment

Create a `.env` file inside `backend/` using `backend/.env.example` as a reference.

Required variables:

```env
GMAIL_USER=yourgmail@gmail.com
GMAIL_PASS=your-gmail-app-password
SHARDEUM_PRIVATE_KEY=
PORT=5000
```

Notes:

- Use a Gmail App Password instead of your normal Gmail password.
- If `SHARDEUM_PRIVATE_KEY` is not provided, blockchain logging runs in simulated mode.

### 3. Start the backend

```bash
npm run dev:backend
```

### 4. Start the frontend

```bash
npm run dev:frontend
```

Frontend default URL: `http://localhost:5173`  
Backend default URL: `http://localhost:5000`

## Available Scripts

```bash
npm run install-all
npm run dev:backend
npm run dev:frontend
```

## Sample CSV Format

```csv
name,email,message
John Doe,john@example.com,I am interested in your pricing and want a demo.
Jane Smith,jane@example.com,Can you share more details? I am curious.
Mark Lee,mark@example.com,Not ready right now.
```

You can use the included `sample-leads.csv` file to test the flow quickly.

## API Endpoints

- `GET /` - Backend status check
- `GET /health` - Health endpoint with timestamp
- `GET /get-logs` - Fetch blockchain log entries
- `POST /analyze` - Analyze and classify a lead
- `POST /send-email` - Send the suggested email reply
- `POST /log-to-blockchain` - Record lead activity on-chain or in simulated mode

## Developer Notes

- The backend stores blockchain logs in memory, so logs reset when the server restarts.
- The frontend is currently configured to call `http://localhost:5000`.
- This repository is organized for quick local setup and demo-friendly presentation on GitHub.
