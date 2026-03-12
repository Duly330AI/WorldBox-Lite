import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

function syncSpecs() {
  const root = process.cwd();
  const specDir = path.join(root, "specs");
  const publicSpecDir = path.join(root, "public", "specs");
  if (!fs.existsSync(specDir)) return;
  fs.mkdirSync(publicSpecDir, { recursive: true });
  const files = fs.readdirSync(specDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const src = path.join(specDir, file);
    const dest = path.join(publicSpecDir, file);
    fs.copyFileSync(src, dest);
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "spec-sync",
      buildStart() {
        syncSpecs();
      },
      configureServer(server) {
        syncSpecs();
        server.watcher.add(path.join(process.cwd(), "specs"));
        server.watcher.on("add", (file) => {
          if (file.endsWith(".json")) syncSpecs();
        });
        server.watcher.on("change", (file) => {
          if (file.endsWith(".json")) syncSpecs();
        });
        server.watcher.on("unlink", (file) => {
          if (file.endsWith(".json")) syncSpecs();
        });
      }
    }
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  },
  worker: {
    format: "es"
  }
});
