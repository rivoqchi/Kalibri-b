# Kalibri Texnika — Backend API

NestJS + MongoDB storefront API optimized for SEO, caching, Cloudflare images, and realtime updates.

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | NestJS 12 (ESM) | Modular, typed, production-ready |
| DB | MongoDB + Mongoose | Flexible catalog + text search indexes |
| Cache | Redis (ioredis) with memory fallback | Hot product/SEO responses |
| Realtime | Socket.IO + Redis adapter | Multi-instance cart/stock/price events |
| Images | Cloudflare R2 (S3 API) | Fast CDN delivery |
| SEO | Template engine + JSON-LD payloads | Intent queries (`Macbook M4 yangisi`, `eng arzon noutbuk`) |
| Safety | Helmet, compression, throttling, validation | Baseline hardening for traffic spikes |

## Quick start

```bash
# Option A: in-memory Mongo (no Docker) — default in .env.example
cd Backend
cp .env.example .env   # MONGODB_URI=memory
npm install
npm run start:dev

# Option B: real Mongo + Redis
docker compose up -d
# then set MONGODB_URI=mongodb://127.0.0.1:27017/kalibri_texnika
```

API: `http://localhost:8000`  
Realtime: `ws://localhost:8000/realtime`  
Health: `GET /api/health`

## Main endpoints

- `GET /api/products?q=&sort=price_asc|newest|bestseller|relevance`
- `GET /api/products/:slug`
- `GET /api/categories`
- `GET /api/categories/:slug`
- `GET /api/cart` + header `x-session-id`
- `POST /api/cart/items` + header `x-session-id`
- `POST /api/checkout` + header `x-session-id`
- `GET /api/seo/templates`
- `GET /api/seo/search?q=Macbook%20M4%20yangisi`
- `GET /api/seo/product/:slug`
- `GET /api/seo/sitemap`
- `POST /api/media/upload-url?contentType=image/webp`

## SEO intent templates

Seeded templates cover:

- **newest** — `Macbook M4 yangisi`
- **cheapest** — `eng arzon noutbuk`
- **bestseller** — `eng koʻp sotilgan ...`
- **brand_model** — `MacBook M4 narxi`
- **comparison** — `Air vs Pro`
- **generic_search** — fallback

`GET /api/seo/search?q=...` returns title, description, h1, keywords, suggested sort, and JSON-LD for Next.js metadata.

## Scale notes (1M users)

1. Put API behind a load balancer (multiple Nest instances).
2. Set `REDIS_URL` so cache + Socket.IO adapter are shared.
3. Keep MongoDB indexes (text + price + brand/model) — already defined in schemas.
4. Serve images only via Cloudflare R2 public URL / CDN.
5. Frontend should use ISR/`revalidate` for product pages and Socket.IO for live stock/cart.

## Cloudflare R2

Fill in `.env`:

```env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=kalibri-media
CLOUDFLARE_R2_PUBLIC_URL=https://your-cdn-domain
```

Then call `POST /api/media/upload-url`, PUT the file to `uploadUrl`, store returned `publicUrl` on the product.
