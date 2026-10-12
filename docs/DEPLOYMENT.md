# Deploying the frontend (VPS + PM2 + Caddy)

- Site: https://contrastco.tech → Caddy → `127.0.0.1:3000` (this app, PM2 process `contrast-frontend`)
- API: https://api.contrastco.tech → Caddy → `127.0.0.1:3010` (backend, PM2)
- Node.js ≥ 20.9 (developed on 24). No Docker.

## Environment

`NEXT_PUBLIC_*` values are compiled into the build. Set them **before**
`npm run build`; changing one means rebuilding.

On the VPS, create `.env.production` from `.env.production.example`:

| Variable | Production value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.contrastco.tech/api/v1` | Includes `/api/v1`. Alternatively set `NEXT_PUBLIC_API_URL=https://api.contrastco.tech`; `/api/v1` is appended. |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | **Required.** It defaults to `true`, which shows sample products. |
| `NEXT_PUBLIC_SITE_URL` | `https://contrastco.tech` | sitemap.xml, robots.txt, Open Graph |
| `NEXT_PUBLIC_CUSTOM_CASE_PRODUCT_SLUG` | `custom-case` | Optional (this is the default) |

Next.js loads `.env.local` **over** `.env.production`. Don't keep a
`.env.local` on the server.

## First deploy

```bash
git clone https://github.com/Ahmedkhalaf2-1/phone-cases-frontend.git
cd phone-cases-frontend
cp .env.production.example .env.production   # check the values
./deploy-frontend.sh
pm2 startup        # once per server, follow the printed command
```

Caddy:

```
contrastco.tech, www.contrastco.tech {
	reverse_proxy 127.0.0.1:3000
}
```

## Every deploy after that

```bash
cd phone-cases-frontend && ./deploy-frontend.sh
```

The script stops at the first failure. It checks the env file, pulls
(fast-forward only), runs `npm ci` and `npm run build`, then reloads PM2
and health-checks `127.0.0.1:3000`. If the build fails, PM2 isn't touched.

## Backend requirements

- CORS must allow `https://contrastco.tech` (and `https://www.contrastco.tech` if served).
- `PUBLIC_BASE_URL=https://api.contrastco.tech` so media URLs are
  `https://api.contrastco.tech/uploads/...`. Otherwise they are
  `http://localhost:3010/...`, which customers can't load.
- `/collections` and `sitemap.xml` are prerendered at build time from the
  API, so the API must be up while building.
