import fs from "fs";
import path from "path";
import https from "https";
import AdmZip from "adm-zip";

const DEFAULT_URL =
  "https://kenney.nl/media/pages/assets/top-down-rpg-pack/top-down-rpg-pack.zip";

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => {
        file.close();
        reject(err);
      });
  });
}

function isZip(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return buf.toString("hex").startsWith("504b");
}

async function main() {
  const url = process.env.KENNEY_TOPDOWN_URL || DEFAULT_URL;
  const root = process.cwd();
  const tmpDir = path.join(root, ".tmp_assets");
  const zipPath = path.join(tmpDir, "kenney.zip");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`Downloading Kenney assets from ${url}`);
  await download(url, zipPath);

  if (!isZip(zipPath)) {
    throw new Error(
      "Downloaded file is not a ZIP. The Kenney URL may require a direct download link."
    );
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

  const tilesetTarget = path.join(root, "assets", "tilesets", "kenney");
  const spriteTarget = path.join(root, "assets", "sprites");
  fs.mkdirSync(tilesetTarget, { recursive: true });
  fs.mkdirSync(spriteTarget, { recursive: true });

  fs.writeFileSync(path.join(tilesetTarget, "tilesheet.png"), tilesheet.getData());
  fs.writeFileSync(path.join(spriteTarget, "characters.png"), spritesheet.getData());

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("Kenney assets installed.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
