import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  // Dart Sass 1.80+ 对 @import 和旧 JS API 发出弃用警告。
  // uni-app 通过 additionalData 注入 uni.scss 变量，被引入的 scss 依赖该注入，
  // 因此不能安全迁移到 @use；旧 JS API 由 vite-plugin-uni 内部调用，代码层无法改。
  // 这两条仅为弃用提示、不影响编译，统一静默以保持构建输出干净。
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["import", "legacy-js-api"],
      },
    },
  },
});
