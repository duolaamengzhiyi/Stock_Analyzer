import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * FR-108 静态约束：禁止任何客户端轮询机制刷新数据。
 * 数据刷新必须依赖 Supabase Realtime 推送或显式手动刷新。
 *
 * 例外：sealos Python 侧定时器、UI 倒计时（用递归 setTimeout 实现）、测试文件。
 */
const noPollingRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "CallExpression[callee.name='setInterval'], CallExpression[callee.object.name='window'][callee.property.name='setInterval']",
      message:
        "FR-108：禁止使用 setInterval 轮询。改用 Supabase Realtime 推送或手动刷新；UI 倒计时改用递归 setTimeout。",
    },
    {
      selector: "Property[key.name='refreshInterval']",
      message:
        "FR-108：禁止使用 refreshInterval（SWR / useSWR / react-query）做轮询刷新。",
    },
    {
      selector: "Property[key.value='refreshInterval']",
      message: "FR-108：禁止使用 refreshInterval 字符串键。",
    },
  ],
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: noPollingRules,
  },
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "sealos/**",
      "node_modules/**",
      "lib/db/migrations/**",
    ],
  },
];

export default eslintConfig;
