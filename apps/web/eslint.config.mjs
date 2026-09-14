import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Words on screen come from src/messages, never from the JSX (docs/i18n.md).
  // A warning while screens move over module by module; an error after.
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    ignores: ["src/app/dev-preview/**"],
    rules: {
      "react/jsx-no-literals": [
        "warn",
        { noStrings: false, ignoreProps: true, allowedStrings: ["·", "—", "–", "/", "(", ")", "%", "+", "−", ":", "×"] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
