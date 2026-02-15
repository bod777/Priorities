# Railway Deployment Guide

A step-by-step guide for deploying a Node.js web app (with WebSocket support) on Railway, written for someone who has never used the platform before.

---

## What is Railway?

Railway is a cloud hosting platform that lets you deploy web apps directly from a GitHub repo. You push code, Railway builds and runs it. No server management, no Docker knowledge needed, no manual TLS certificate setup. It handles all of that for you.

---

## Step 1: Create an Account

1. Go to [railway.app](https://railway.app).
2. Click **"Sign Up"** or **"Login"**.
3. Sign up with your **GitHub account** (recommended). This also lets Railway access your repos for deployment later.
   - Alternative: sign up with email (you'll receive a verification code).
4. New accounts get a **free Trial** with a one-time $5 credit that expires in 30 days. This is enough to test your app.

### Upgrading to the Hobby Plan

The Trial has limitations (1 GB RAM, 30-day expiry). To keep your app running long-term:

1. Go to **Account Settings** (click your avatar, top-right).
2. Under **Billing**, select the **Hobby Plan** ($5/month).
3. Add a payment method (credit card).
4. The $5/month fee includes $5 of usage credits. For a small multiplayer game with friends, you'll likely stay well within this.

---

## Step 2: Prepare Your Code

Before deploying, your project needs two things:

### A. A `start` script in `package.json`

Railway looks for a `start` script to know how to run your app.

```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server",
    "start": "node server/dist/index.js"
  }
}
```

### B. Use the `PORT` environment variable

Railway assigns a port dynamically. Your server **must** read it from the environment, not hardcode it.

```typescript
// In your server entry file (e.g., server/src/index.ts)
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

Important: bind to `0.0.0.0`, not `localhost`. Railway requires this to route traffic to your app.

### C. Push your code to GitHub

Railway deploys from a GitHub repo. Make sure your code is pushed:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

---

## Step 3: Create a Project on Railway

1. Log into [railway.app](https://railway.app). You'll land on the **Dashboard**.
2. Click **"New Project"**.
3. Select **"Deploy from GitHub Repo"**.
4. If this is your first time, Railway will ask you to authorize access to your GitHub repos. Grant it.
5. Search for and select your repository.
6. Railway gives you two options:
   - **"Deploy Now"** — starts building immediately.
   - **"Add Variables"** — lets you configure environment variables first (choose this if your app needs any).
7. Click **"Deploy Now"** to kick off your first deployment.

You'll land on the **Project Canvas** — a visual dashboard showing your service(s).

---

## Step 4: Configure Build & Start Commands (If Needed)

Railway auto-detects Node.js projects and will run `npm install` then `npm start` by default. If your project needs custom commands:

1. Click on your **service** on the Project Canvas.
2. Go to the **"Settings"** tab.
3. Scroll to **"Build & Deploy"**.
4. Set:
   - **Build Command**: e.g., `npm run build` (compiles TypeScript, bundles the React frontend, etc.)
   - **Start Command**: e.g., `node server/dist/index.js`

### Alternative: Config as Code

Instead of using the dashboard, you can add a `railway.json` file to your repo root:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node server/dist/index.js"
  }
}
```

This file takes priority over dashboard settings, and it travels with your code.

---

## Step 5: Generate a Public URL

By default, your deployed app is **not publicly accessible**. You need to generate a domain:

1. Click on your service on the Project Canvas.
2. Go to the **"Settings"** tab.
3. Scroll to **"Public Networking"**.
4. Click **"Generate Domain"**.
5. Railway assigns a URL like `your-app-name.up.railway.app`.
6. Your app is now live at that URL with HTTPS enabled automatically.

### Custom Domain (Optional)

If you own a domain (e.g., `mygame.com`):

1. In the same **Public Networking** section, click **"Add Custom Domain"**.
2. Enter your domain (e.g., `play.mygame.com`).
3. Railway gives you a **CNAME record** value.
4. Go to your DNS provider (e.g., Cloudflare, Namecheap) and add a CNAME record pointing your domain to Railway's value.
5. Wait for DNS propagation (minutes to hours).
6. Railway auto-provisions an SSL certificate via Let's Encrypt.

---

## Step 6: Set Environment Variables

If your app needs environment variables (API keys, config values, etc.):

1. Click on your service on the Project Canvas.
2. Go to the **"Variables"** tab.
3. Click **"New Variable"**.
4. Enter the key and value (e.g., `NODE_ENV` = `production`).
5. The service automatically redeploys with the new variables.

Tip: click **"RAW Editor"** to paste multiple variables at once in `.env` format:

```
NODE_ENV=production
SOME_API_KEY=abc123
```

---

## Step 7: Automatic Deploys

Once your repo is connected, Railway **auto-deploys every time you push to the connected branch** (usually `main`).

```bash
# Make a change, commit, push — Railway deploys automatically
git add .
git commit -m "Update game logic"
git push
```

You can watch the deployment progress in the Railway dashboard:
1. Click on your service.
2. Click on the latest **deployment** entry.
3. View **Build Logs** (the build process) and **Deploy Logs** (runtime output / console.log).

---

## Step 8: View Logs & Monitor

### Logs
- Click on a deployment to see its **runtime logs** (your `console.log` output).
- Switch to the **"Build Logs"** tab to see the build process output.
- Use the **"Observability"** button in the top nav for logs across all services.

### Metrics
- CPU, memory, disk, and network usage are available per service.
- Up to 30 days of historical data.

### Rollbacks
- If a deployment breaks something, click on a previous deployment and hit **"Rollback"** to instantly revert.

---

## Step 9: WebSocket-Specific Setup

For this game (or any app using Socket.IO / WebSockets):

### Your server must serve HTTP and WebSocket on the same port

Railway routes all traffic through one port. Your Express + Socket.IO server should look like:

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0');
```

### Clients connect over WSS (secure WebSocket)

Once deployed, your frontend connects like:

```typescript
import { io } from 'socket.io-client';

const socket = io('https://your-app.up.railway.app');
// Socket.IO handles the wss:// upgrade automatically
```

No port number needed — Railway routes HTTPS (443) to your app's internal port.

### Keep-Alive: Prevent Idle Disconnects

Railway's proxy may close idle WebSocket connections after ~30 seconds of no activity. Socket.IO handles this with its built-in ping/pong mechanism, but make sure it's configured:

```typescript
const io = new Server(httpServer, {
  pingInterval: 25000,  // send ping every 25 seconds
  pingTimeout: 20000,   // wait 20 seconds for pong before disconnecting
});
```

This keeps connections alive during quiet moments in the game (e.g., when someone is thinking about their ranking).

---

## Railway CLI (Optional)

You can manage Railway from your terminal instead of the web dashboard.

### Install

```bash
# npm (any OS)
npm i -g @railway/cli

# macOS / Linux
brew install railway

# Windows (Scoop)
scoop install railway
```

### Common Commands

| Command | What It Does |
|---------|-------------|
| `railway login` | Log in to your Railway account (opens browser) |
| `railway init` | Create a new project from the terminal |
| `railway link` | Link your local directory to an existing Railway project |
| `railway up` | Deploy the current directory to Railway (without going through GitHub) |
| `railway run npm start` | Run your app locally with Railway's environment variables injected |
| `railway logs` | View your latest deployment logs |
| `railway domain` | Manage domains for a service |

The CLI is convenient for quick checks (`railway logs`) and for running your app locally with production env vars (`railway run`).

---

## Quick Reference: Full Deployment Checklist

```
[ ] Code pushed to GitHub
[ ] package.json has "start" script
[ ] Server reads PORT from process.env.PORT
[ ] Server binds to 0.0.0.0
[ ] HTTP and WebSocket share the same port
[ ] Railway account created (GitHub sign-up)
[ ] New Project created from GitHub repo
[ ] Build command set (if not using default npm start)
[ ] Public domain generated (Settings > Public Networking)
[ ] Environment variables set (if any)
[ ] Test the live URL in a browser
[ ] Ping/pong keep-alive configured for WebSocket
```
