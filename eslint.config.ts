import { renton } from "@renton/eslint-config";

export default renton({
  jsonc: true,
  markdown: false,
  stylistic: {
    quotes: "double",
    semi: true,
  },
  typescript: true,
  yaml: true,
}, {
  rules: {
    "unicorn/consistent-class-member-order": "off", // 与 preset 的 perfectionist/sort-classes 冲突（private 方法 vs public 方法排序相反）
    "unicorn/no-top-level-assignment-in-function": "off", // 模块级可变状态（index.ts:61 inflightRequests、index.ts:66 configLoadPromise、server.ts:11 isShuttingDown）
    "unicorn/no-top-level-side-effects": "off", // Hono app.use / Bun.serve 在模块顶层注册
    "unicorn/prefer-await": "off", // src/index.ts:69 必须先保存 configLoadPromise 再 await（单飞/配置缓存）
  },
});
