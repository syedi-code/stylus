# Antisocial Web

Vue 3 + TypeScript + Vite frontend, deployed to Cloudflare Pages.

## Development

```bash
npm run dev -w @antisocial/web
```

## Deployment

```bash
npm run deploy -w @antisocial/web
```

Or from the project root:

```bash
npm run deploy:web
```

## Configuration

Copy `wrangler.example.toml` to `wrangler.toml` and fill in your project name.

Set `VITE_API_URL` in Cloudflare Pages environment variables to point to your
Worker URL.
