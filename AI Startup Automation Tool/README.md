# AI Startup Automation Tool

A simple beginner-friendly full-stack project built with:

- React + Vite + Tailwind CSS
- Node.js + Express

## Features

- Upload CSV leads with `name`, `email`, and `message`
- View uploaded leads in a table
- Classify leads as `HOT`, `MEDIUM`, or `COLD`
- Show quick stats on the dashboard

## Project Structure

- `frontend` - React app
- `backend` - Express API

## How to Run

### 1. Install dependencies

```bash
cd "AI Startup Automation Tool"
npm run install-all
```

### 2. Start backend

```bash
cd "AI Startup Automation Tool\\backend"
npm run dev
```

### 3. Start frontend

```bash
cd "AI Startup Automation Tool\\frontend"
npm run dev
```

## CSV Format

```csv
name,email,message
John Doe,john@example.com,I am interested in your pricing and want a demo.
Jane Smith,jane@example.com,Can you share more details? I am curious.
Mark Lee,mark@example.com,Not ready right now.
```