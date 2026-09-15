import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/.wrangler/**',
			'coverage/**',
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	eslintConfigPrettier,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					vars: 'all',
					varsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		// The stock Vue SFC shim, verbatim from the template.
		files: ['src/env.d.ts'],
		rules: {
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
	{
		// The JSON deserialisation boundary: responses arrive untyped and are
		// narrowed by the normalize* functions in this file. Typing them
		// `unknown` would move the casts inline without adding any safety.
		files: ['src/lib/api.ts'],
		rules: { '@typescript-eslint/no-explicit-any': 'off' },
	}
);
