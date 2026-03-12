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

function syncAssets() {
  const root = process.cwd();
  const assetDir = path.join(root, "assets");
  const publicAssetDir = path.join(root, "public", "assets");
  if (!fs.existsSync(assetDir)) return;
  fs.mkdirSync(publicAssetDir, { recursive: true });
  const copyRecursive = (src: string, dest: string) => {
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  };
  copyRecursive(assetDir, publicAssetDir);
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "spec-sync",
      buildStart() {
        syncSpecs();
        syncAssets();
      },
      configureServer(server) {
        syncSpecs();
        syncAssets();
        server.watcher.add(path.join(process.cwd(), "specs"));
        server.watcher.add(path.join(process.cwd(), "assets"));
        server.watcher.on("add", (file) => {
          if (file.endsWith(".json")) syncSpecs();
          if (file.includes(`${path.sep}assets${path.sep}`)) syncAssets();
        });
        server.watcher.on("change", (file) => {
          if (file.endsWith(".json")) syncSpecs();
          if (file.includes(`${path.sep}assets${path.sep}`)) syncAssets();
        });
        server.watcher.on("unlink", (file) => {
          if (file.endsWith(".json")) syncSpecs();
          if (file.includes(`${path.sep}assets${path.sep}`)) syncAssets();
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
