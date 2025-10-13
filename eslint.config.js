import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginSvelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";

export default [
  // Globally ignored files
  {
    ignores: [
      ".svelte-kit/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "vite.config.ts",
      "playwright.config.ts",
      "reference/**",
      "eslint.config.js",
      "report/**",
      ".wrangler/**",
      "worker/**",
      "src/lib/wasm/**",
    ],
  },
  // Prepackaged defaults
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs["flat/recommended"],
  eslintConfigPrettier,
  // Custom (Type/Java)script file treatment
  {
    files: ["src/**/*.js", "src/**/*.ts"],
    plugins: {
      import: eslintPluginImport,
      prettier: eslintPluginPrettier,
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          "types": {
            "unknown": {},
            "never": {},
            "any": { }
          },
        },
      ],
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-require-imports": "error",
      "no-case-declarations": "off",
      "no-useless-catch": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-inferrable-types": 0,
      "import/no-relative-packages": "error",
      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-unused-modules": "error",
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            {
              "group": ["../"],
              "message": "Relative parent imports are not allowed.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          "selector": "ImportExpression",
          "message": "Dynamic imports are disallowed.",
        },
        {
          "selector": "TSImportType",
          "message": "Type-only import() expressions are not allowed.",
        },
      ],
      "prettier/prettier": ["error", {}, { "usePrettierrc": true }],
      "sort-imports": "off",
      "no-underscore-dangle": "error",
      "no-magic-numbers": ["error", {
        "ignore": [0, 1, 2],
        "ignoreArrayIndexes": true,
      }],
    },
  },
  // WASM loader files that need dynamic imports
  {
    files: ["src/lib/cam/offset/clipper-init.ts", "src/lib/algorithms/offset-calculation/offset-adapter.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Test file overrides
  {
    files: ["**/*.test.ts", "**/*.test.js"],
    rules: {
      "no-magic-numbers": "off",
      "no-underscore-dangle": "off",
      "@typescript-eslint/no-restricted-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Svelte file overrides
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        cancelAnimationFrame: "readonly",
        requestAnimationFrame: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLCanvasElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        ResizeObserver: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        Element: "readonly",
        DragEvent: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        Worker: "readonly",
        FileReader: "readonly",
        File: "readonly",
        FileList: "readonly",
        Blob: "readonly",
        URL: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        alert: "readonly",
        navigator: "readonly",
        performance: "readonly",
        prompt: "readonly",
        HTMLSelectElement: "readonly",
      },
    },
    rules: {
      "svelte/no-at-html-tags": "error",
      "svelte/no-at-debug-tags": "error",
      "svelte/valid-compile": "error",
      "svelte/no-unused-svelte-ignore": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error", {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^\\$\\$",
        }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-case-declarations": "off",
      "@typescript-eslint/no-unused-expressions": [
        "error", {
          allowShortCircuit: true,
          allowTernary: true,
        }
      ],
      "no-magic-numbers": "off",
    },
  },
];
