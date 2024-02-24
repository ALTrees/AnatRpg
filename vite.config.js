import copy from "rollup-plugin-copy";
import scss from "rollup-plugin-scss";
import less from "rollup-plugin-less";
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
    }),
    less({
      fileName: "styles/anatrpg.css",
      sourceMap: false,
      watch: ["src/styles/*.less"],
    })
  ],
});
