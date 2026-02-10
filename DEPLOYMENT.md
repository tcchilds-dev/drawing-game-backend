# Deploy Backend on Render and Frontend on Cloudflare Pages

This setup uses:

1. `drawing-game-backend` on Render (free web service)
2. `drawing-game-frontend` on Cloudflare Pages (free static hosting)

## 1. Deploy Backend (`drawing-game-backend`) to Render

1. Push `drawing-game-backend` to GitHub.
2. In Render, create a new Blueprint and connect that repo.
3. Render will use `render.yaml` in this repo:
   - Build command: `pnpm install --frozen-lockfile && pnpm run build`
   - Start command: `pnpm start`
   - Health check path: `/health`
4. In Render service environment variables, set:
   - `CORS_ORIGIN=https://<your-cloudflare-pages-domain>`
5. Deploy and copy the backend URL (example: `https://drawing-game-backend.onrender.com`).

Notes:

1. `CORS_ORIGIN` supports comma-separated values, so you can allow multiple origins.
2. Example: `https://my-game.pages.dev,https://play.mydomain.com`
3. Render free instances sleep when idle, so the first reconnect may take longer.

## 2. Deploy Frontend (`drawing-game-frontend`) to Cloudflare Pages

1. Push `drawing-game-frontend` to GitHub.
2. In Cloudflare Pages, create a new project from that repo.
3. Use these build settings:
   - Build command: `pnpm run build`
   - Build output directory: `dist`
   - Root directory: `/` (or set to `drawing-game-frontend` only if deploying from a monorepo)
4. Add environment variable:
   - `VITE_SOCKET_URL=https://<your-render-service>.onrender.com`
5. Deploy the site.

## 3. Final Connection Check

1. Open the frontend URL and verify the game connects.
2. If socket connection fails due to CORS, confirm backend `CORS_ORIGIN` exactly matches your frontend URL.
3. If you add a custom frontend domain later, add it to `CORS_ORIGIN` and redeploy backend.
