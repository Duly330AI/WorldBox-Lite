import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import axios from "axios";

const DEFAULT_ZIP_URL = "https://www.kenney.nl/content/assets/top-down-rpg-pack.zip";
const TILEMAP_URL =
  "https://raw.githubusercontent.com/KenneyNL/RPG-Assets/master/Spritesheet/rpgTilemap_packed.png";
const CHARACTER_URL =
  "https://raw.githubusercontent.com/KenneyNL/RPG-Assets/master/Spritesheet/rpgPack_spriteSheet.png";

function isZip(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return buf.toString("hex").startsWith("504b");
}

async function download(url: string, dest: string) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  fs.writeFileSync(dest, Buffer.from(response.data));
}

async function main() {
  const root = process.cwd();
  const tmpDir = path.join(root, ".tmp_assets");
  const zipPath = path.join(tmpDir, "kenney.zip");
  const localZip = path.join(root, "assets", "kenney.zip");
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
    let downloaded = false;
    try {
      console.log(`Downloading Kenney tilesheet from ${TILEMAP_URL}`);
      await download(TILEMAP_URL, tilesheetOut);
      console.log(`Downloading Kenney characters from ${CHARACTER_URL}`);
      await download(CHARACTER_URL, spriteOut);
      downloaded = true;
    } catch (err) {
      console.warn(`Asset mirror download failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!downloaded) {
      const url = process.env.KENNEY_TOPDOWN_URL || DEFAULT_ZIP_URL;
      if (fs.existsSync(localZip)) {
        console.log("Using local assets/kenney.zip");
        fs.copyFileSync(localZip, zipPath);
      } else {
        console.log(`Downloading Kenney assets from ${url}`);
        await download(url, zipPath);
      }

      if (!isZip(zipPath)) {
        throw new Error("Downloaded file is not a ZIP.");
      }

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const tilesheet = entries.find((e) => /Tilesheet\/tilesheet\.png$/i.test(e.entryName));
      const spritesheet = entries.find((e) => /Spritesheet\/spritesheet_characters\.png$/i.test(e.entryName));

      if (!tilesheet) {
        throw new Error("Tilesheet/tilesheet.png not found in archive.");
      }
      if (!spritesheet) {
        throw new Error("Spritesheet/spritesheet_characters.png not found in archive.");
      }

      fs.writeFileSync(tilesheetOut, tilesheet.getData());
      fs.writeFileSync(spriteOut, spritesheet.getData());
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
