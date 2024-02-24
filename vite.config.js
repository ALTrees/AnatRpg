import copy from "rollup-plugin-copy";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      input: "src/anatrpg.mjs",
      output: {
        dir: 'dist',
        entryFileNames: 'anatrpg.mjs',
        format: "es",
      },
    },
  },
  plugins: [
    copy({
      targets: [
        { src: "static/*", dest: "dist" },
      ],
      hook: "writeBundle",
    })
  ],
});
