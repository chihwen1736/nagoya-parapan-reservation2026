import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages 部署在 https://<帳號>.github.io/nagoya-parapan-reservation2026/，
// 所以 base 必須設成 "/nagoya-parapan-reservation2026/"，如果之後改了 repo 名稱記得同步修改這裡。
export default defineConfig({
  base: "/nagoya-parapan-reservation2026/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
