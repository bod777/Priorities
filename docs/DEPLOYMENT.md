# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account
- Railway account (https://railway.app)

## Local Testing

### 1. Development Mode

```bash
# Install dependencies
npm install

# Run both client and server in development
npm run dev
```

The client will run on http://localhost:5173 and the server on http://localhost:3000.

### 2. Production Mode (Local)

```bash
# Build all packages
npm run build

# Start production server
NODE_ENV=production npm start
```

Visit http://localhost:3000 to test the production build locally.

## Deploy to Railway

### Step 1: Push to GitHub

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Priorities game"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/priorities.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub
5. Select your `priorities` repository

### Step 3: Configure Environment

1. In Railway project settings, go to "Variables"
2. Add environment variable:
   - Key: `NODE_ENV`
   - Value: `production`

### Step 4: Generate Public Domain

1. Go to "Settings" tab
2. Scroll to "Public Networking"
3. Click "Generate Domain"
4. Railway will provide a URL like: `priorities-production-xxxx.up.railway.app`

### Step 5: Deploy

Railway will automatically:
1. Detect the `railway.json` configuration
2. Run `npm install && npm run build`
3. Start the server with `npm start`
4. Make the app available at the generated URL

### Step 6: Verify Deployment

1. Visit your Railway URL
2. Create a lobby
3. Open the same URL on another device/browser
4. Join the lobby using the code
5. Play a full game to verify everything works

## Environment Variables

The app requires only one environment variable:

- `NODE_ENV=production` - Enables production mode (disables CORS, serves static files)

## Monitoring

### Railway Dashboard

View logs and metrics in the Railway dashboard:
- Real-time logs: "Deployments" → Click on latest deployment → "Logs"
- Metrics: CPU, Memory, Network usage
- Restart: If needed, redeploy from GitHub

### Health Check

The server exposes a health check endpoint:
- GET `/api/health` → Returns `{ status: "ok" }`

## Troubleshooting

### Build Fails

Check the Railway build logs for errors:
```
npm run build
```

Common issues:
- TypeScript errors: Run `npm run typecheck` locally
- Missing dependencies: Ensure `package.json` is committed

### Server Won't Start

Check start command:
```
npm start
```

Ensure `server/dist/index.js` exists after build.

### Socket.IO Connection Issues

- Verify `NODE_ENV=production` is set
- Check CORS configuration in `server/src/index.ts`
- Ensure WebSocket support is enabled (Railway enables by default)

### Players Can't Join

- Check server logs for errors
- Verify lobby code is correct (4 characters, case-insensitive)
- Ensure both players are using the same Railway URL

## Scaling

Railway automatically handles:
- SSL/HTTPS certificates
- Load balancing
- Auto-restart on crashes
- Metrics and monitoring

For higher traffic:
1. Upgrade Railway plan
2. Consider Redis for session storage (currently in-memory)
3. Add database for persistent game history

## Updates

To deploy updates:

```bash
# Make changes locally
git add .
git commit -m "Description of changes"
git push

# Railway auto-deploys on push to main
```

## Custom Domain (Optional)

1. In Railway project settings, go to "Public Networking"
2. Click "Custom Domain"
3. Add your domain
4. Update DNS records as instructed
5. Railway handles SSL automatically

## Cost

Railway pricing:
- Hobby Plan: $5/month (includes $5 usage credit)
- Usage-based pricing after credit exhausted
- This app uses minimal resources (typically < $1/month in usage)

## Support

For issues:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Create an issue in your repository

---

**The app is now fully deployed and ready to play!** 🎉
