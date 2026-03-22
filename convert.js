#!/usr/bin/env node

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
};

async function main() {
  const args = process.argv.slice(2);
  const projectName = args[0];

  if (!projectName) {
    console.error("Usage: node convert.js <project_name> [--ratio 16:9] [--scale 2]");
    process.exit(1);
  }

  const ratioFlag = args.indexOf("--ratio");
  const ratioKey = ratioFlag !== -1 ? args[ratioFlag + 1] : "1:1";
  const scaleFlag = args.indexOf("--scale");
  const scale = scaleFlag !== -1 ? Number(args[scaleFlag + 1]) : 1;

  const size = RATIOS[ratioKey];
  if (!size) {
    console.error(`Unknown ratio: ${ratioKey}. Use one of: ${Object.keys(RATIOS).join(", ")}`);
    process.exit(1);
  }

  const htmlDir = path.join("output", projectName, "html");
  const pngDir = path.join("output", projectName, "png");

  if (!fs.existsSync(htmlDir)) {
    console.error(`HTML directory not found: ${htmlDir}`);
    process.exit(1);
  }

  fs.mkdirSync(pngDir, { recursive: true });

  const files = fs.readdirSync(htmlDir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  if (files.length === 0) {
    console.error("No HTML files found.");
    process.exit(1);
  }

  console.log(`Converting ${files.length} slides (${ratioKey}, scale ${scale}x)...`);

  const browser = await chromium.launch({ headless: true });

  try {
    await Promise.all(files.map(async (file) => {
      const htmlPath = path.resolve(htmlDir, file);
      const pngName = file.replace(".html", ".png");
      const pngPath = path.join(pngDir, pngName);

      const page = await browser.newPage();
      await page.setViewportSize({
        width: size.width * scale,
        height: size.height * scale,
      });

      const html = fs.readFileSync(htmlPath, "utf-8");
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      await page.screenshot({
        path: pngPath,
        type: "png",
        clip: { x: 0, y: 0, width: size.width * scale, height: size.height * scale },
      });

      await page.close();
      console.log(`  ${pngName}`);
    }));
  } finally {
    await browser.close();
  }

  console.log(`Done! PNGs saved to ${pngDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
