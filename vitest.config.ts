import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

/**
 * Frontend tests.
 *
 * Kept separate from vite.config.ts on purpose: that config carries the dev
 * proxy and the Tailwind plugin, neither of which a test run should pull in —
 * Tailwind in particular would compile the whole stylesheet for every suite.
 */
export default defineConfig({
	plugins: [vue()],
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		globals: false,
		restoreMocks: true,
	},
});
