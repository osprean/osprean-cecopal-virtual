import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // El backend devuelve formas dinámicas (notificaciones.payload,
      // pipeline.state). Tipar progresivamente — warn por ahora.
      '@typescript-eslint/no-explicit-any': 'warn',
      // CECOVI está en iteración rápida: bajamos a warn las reglas
      // estilísticas que bloquean CI sin marcar bugs reales.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
