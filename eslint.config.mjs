import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import { flatRecommended as firebaseRulesRecommended } from "@firebase/eslint-plugin-security-rules";

export default defineConfig([
  {
    ignores: [".next/**/*", "node_modules/**/*", "dist/**/*"],
  },
  ...next,
  firebaseRulesRecommended,
]);
