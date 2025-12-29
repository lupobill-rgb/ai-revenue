import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Revenue OS Kernel runtime boundary adapters: allow `any` only here.
    // Policies + contract types remain strict.
    files: [
      "supabase/functions/_shared/revenue_os_kernel/dispatcher.ts",
      "supabase/functions/_shared/revenue_os_kernel/event-bus.ts",
      "supabase/functions/_shared/revenue_os_kernel/guard.ts",
      "supabase/functions/_shared/revenue_os_kernel/runtime.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
