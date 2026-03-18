import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Local dev proxies to the local wrangler dev server, which connects
// to staging D1 via `wrangler dev --env staging --remote`.
// No CF Access token needed — wrangler handles auth to Cloudflare directly.
const LOCAL_WORKER_URL = 'http://127.0.0.1:8787';

// https://vite.dev/config/
export default defineConfig({
	envDir: '../../',
	plugins: [vue(), tailwindcss()],
	server: {
		proxy: {
			'/api': {
				target: process.env.VITE_PROXY_TARGET || LOCAL_WORKER_URL,
				changeOrigin: true,
				configure: (proxy, options) => {
					console.log(`[vite-proxy] API → ${options.target}`);
					proxy.on('error', (err, _req, res) => {
						console.error(`[vite-proxy] Proxy error: ${err.message}`);
						console.error('[vite-proxy] Is wrangler dev running? Start it with: npm run dev');
						if ('writeHead' in res) {
							res.writeHead(502, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({
								error: 'Proxy error — backend unreachable',
								code: 'PROXY_ERROR',
								details: err.message,
								hint: 'Start the local Worker with: npm run dev',
							}));
						}
					});
				},
			},
		},
	},
});
