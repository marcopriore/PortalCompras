import nextConfig from "eslint-config-next"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextConfig,
  {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "error",
    },
  },
  {
    ignores: [
      "components/ui/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "tests/**",
    ],
  },
]