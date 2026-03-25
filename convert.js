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
  const scale = scaleFlag !== -1 ? Number(args[scaleFlag + 1]) : 2;

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

      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: scale,
      });
      const page = await context.newPage();

      const html = fs.readFileSync(htmlPath, "utf-8");
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      await page.screenshot({
        path: pngPath,
        type: "png",
      });

      await context.close();
      console.log(`  ${pngName}`);
    }));
    console.log(`Done! PNGs saved to ${pngDir}/`);

    // PNG → PDF 변환
    const pdfDir = path.join("output", projectName, "pdf");
    fs.mkdirSync(pdfDir, { recursive: true });

    const pngFiles = fs.readdirSync(pngDir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    const pdfPath = path.join(pdfDir, `${projectName}.pdf`);

    const w = size.width * scale;
    const h = size.height * scale;

    console.log(`\nConverting ${pngFiles.length} PNGs to PDF...`);

    const images = pngFiles.map((f) => {
      const data = fs.readFileSync(path.join(pngDir, f));
      return `data:image/png;base64,${data.toString("base64")}`;
    });

    const pdfHtml = `<!DOCTYPE html><html><head><style>
      @page { size: ${w}px ${h}px; margin: 0; }
      body { margin: 0; }
      img { width: ${w}px; height: ${h}px; display: block; page-break-after: always; }
      img:last-child { page-break-after: auto; }
    </style></head><body>${images.map((src) => `<img src="${src}">`).join("")}</body></html>`;

    const pdfPage = await browser.newPage();
    await pdfPage.setContent(pdfHtml, { waitUntil: "networkidle" });
    await pdfPage.pdf({
      path: pdfPath,
      width: `${w}px`,
      height: `${h}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await pdfPage.close();

    console.log(`Done! PDF saved to ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
