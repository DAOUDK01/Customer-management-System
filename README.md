# Restaurant Management System

Single-app restaurant management system with separate Admin and Manager dashboards.

## Stack

- React frontend
- Express backend
- MongoDB Atlas database
- JWT authentication
- Render deployment target

## Current Status

- Project scaffolded
- Auth API started
- Role-based frontend routing started

## Run

1. Install dependencies in both workspaces.
2. Set environment variables in `server/.env` and `client/.env`.
3. Run `npm run dev` from the repository root.

## Deploy On Vercel

1. Import this repository into Vercel.
2. Keep project root as repository root.
3. Vercel uses `vercel.json` to:
	- Build frontend from `client`
	- Output static files from `client/dist`
	- Route `/api/*` to the serverless Express handler
	- Route all frontend paths to `index.html` (SPA routing)
4. Add these Vercel Environment Variables:
	- `MONGODB_URI`
	- `JWT_SECRET`
	- `FRONTEND_ORIGIN` (your Vercel app URL)
5. Redeploy after saving env vars.
