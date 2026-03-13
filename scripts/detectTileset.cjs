const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const IMAGE = process.env.TILESET_IMAGE || "assets/tilesets/kenney/tilesheet.png";
const OUTPUT = process.env.TILESET_OUTPUT || "assets/tileset/tileset.json";
const CANDIDATES = [8, 16, 24, 32, 48, 64];
const SPACINGS = [0, 1, 2];

function main() {
  if (!fs.existsSync(IMAGE)) {
    console.error(`Tileset image not found: ${IMAGE}`);
    process.exit(1);
  }

  fs.createReadStream(IMAGE)
    .pipe(new PNG())
    .on("parsed", function () {
      const w = this.width;
      const h = this.height;
      let tileSize = null;
      let spacing = 0;
      let columns = 0;
      let rows = 0;
      for (const t of CANDIDATES) {
        for (const s of SPACINGS) {
          const stride = t + s;
          if ((w + s) % stride !== 0 || (h + s) % stride !== 0) continue;
          tileSize = t;
          spacing = s;
          columns = (w + s) / stride;
          rows = (h + s) / stride;
          break;
        }
        if (tileSize) break;
      }
      if (!tileSize) {
        console.error(`No valid tile size found for ${w}x${h}`);
        process.exit(1);
      }
      const tiles = {};
      let id = 0;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const px = x * (tileSize + spacing);
          const py = y * (tileSize + spacing);
          tiles[String(id)] = { x, y, px, py };
          id += 1;
        }
      }
      const tileset = {
        image: path.basename(IMAGE),
        imageWidth: w,
        imageHeight: h,
        tileSize,
        spacing,
        columns,
        rows,
        totalTiles: id,
        tiles
      };
      const outDir = path.dirname(OUTPUT);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(OUTPUT, JSON.stringify(tileset, null, 2));
      console.log(
        `Tiles generated: ${id} (tileSize=${tileSize}, spacing=${spacing}, columns=${columns}, rows=${rows})`
      );
    })
    .on("error", (err) => {
      console.error(`Failed to parse PNG: ${err.message}`);
      process.exit(1);
    });
}

main();
