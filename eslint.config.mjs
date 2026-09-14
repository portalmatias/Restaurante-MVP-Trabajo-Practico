// @ts-check
// Config única de ESLint para todo el monorepo (§4: la herramienta vive solo en la raíz).
// Un bloque por workspace: cada uno declara sus `files` y su propio tsconfig para el
// linting con información de tipos.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import nextTs from 'eslint-config-next/typescript';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/build/**',
      'frontend/next-env.d.ts',
      'eslint.config.mjs',
    ],
  },
  // backend — NestJS, con linting de tipos
  {
    files: ['backend/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      eslintPluginPrettierRecommended,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: path.join(__dirname, 'backend'),
      },
    },
    rules: {
      // §7: nada de `any` sin comentario que lo justifique — se deja como error.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  // frontend — Next.js (App Router)
  {
    files: ['frontend/**/*.{ts,tsx,js,jsx,mjs}'],
    extends: [...nextVitals, ...nextTs],
    settings: {
      next: { rootDir: 'frontend' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
