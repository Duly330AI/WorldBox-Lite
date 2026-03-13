import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

function isZip(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return buf.toString("hex").startsWith("504b");
}

async function main() {
  const root = process.cwd();
  const tmpDir = path.join(root, ".tmp_assets");
  const tilesetTarget = path.join(root, "assets", "tilesets", "kenney");
  const spriteTarget = path.join(root, "assets", "sprites");
  const publicTilesetTarget = path.join(root, "public", "assets", "tilesets", "kenney");
  const publicSpriteTarget = path.join(root, "public", "assets", "sprites");
  const tilesheetOut = path.join(tilesetTarget, "tilesheet.png");
  const spriteOut = path.join(spriteTarget, "characters.png");
  const publicTilesheetOut = path.join(publicTilesetTarget, "tilesheet.png");
  const publicSpriteOut = path.join(publicSpriteTarget, "characters.png");

  if (
    fs.existsSync(tilesheetOut) &&
    fs.existsSync(spriteOut) &&
    fs.existsSync(publicTilesheetOut) &&
    fs.existsSync(publicSpriteOut)
  ) {
    console.log("Kenney assets already installed.");
    return;
  }

  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(tilesetTarget, { recursive: true });
  fs.mkdirSync(spriteTarget, { recursive: true });
  fs.mkdirSync(publicTilesetTarget, { recursive: true });
  fs.mkdirSync(publicSpriteTarget, { recursive: true });

  try {
    if (!fs.existsSync(tilesheetOut) || !fs.existsSync(spriteOut)) {
      throw new Error("Missing local PNGs in assets/. Expected tilesheet.png and characters.png.");
    }

    fs.copyFileSync(tilesheetOut, publicTilesheetOut);
    fs.copyFileSync(spriteOut, publicSpriteOut);
    console.log("Kenney assets installed.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Asset setup warning: ${message}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
