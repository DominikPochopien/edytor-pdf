import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PDF_LIBS = ['mupdf', 'mupdf/*', 'fabric', 'fabric/*'];

const layerRule = (patterns, message) => ['error', { patterns: [{ group: patterns, message }] }];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'scripts/spike',
      'public',
      'node_modules',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...eslintReact.configs['strict-type-checked'],
    languageOptions: {
      ...eslintReact.configs['strict-type-checked'].languageOptions,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          // 90/180/270/360 are the page rotations defined by the PDF specification.
          ignore: [-1, 0, 1, 2, 90, 100, 180, 270, 360],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          detectObjects: false,
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': layerRule(
        [
          'react',
          'react-*',
          'zustand',
          ...PDF_LIBS,
          '**/application/**',
          '**/infrastructure/**',
          '**/ui/**',
        ],
        'Warstwa domain to czysty TypeScript: bez Reacta, bibliotek PDF i innych warstw.',
      ),
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': layerRule(
        ['react', 'react-*', ...PDF_LIBS, '**/infrastructure/**', '**/ui/**'],
        'Warstwa application zależy tylko od domain i własnych interfejsów.',
      ),
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': layerRule(
        [...PDF_LIBS, '**/infrastructure/mupdf/**'],
        'Komponenty UI nie mogą używać silnika PDF bezpośrednio – tylko przez porty z application.',
      ),
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,mjs,ts}', 'build/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
