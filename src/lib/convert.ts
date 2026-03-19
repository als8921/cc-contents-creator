import { chromium } from "playwright";
import fs from "fs";
import path from "path";

export const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1920, height: 1080 },
} as const;

export type Ratio = keyof typeof RATIOS;

export async function convertProjectToPng(
  projectName: string,
  ratio: Ratio,
  scale = 1
): Promise<string[]> {
  const outputDir = path.join(process.cwd(), "output", projectName);
  const htmlDir = path.join(outputDir, "html");
  const imagesDir = path.join(outputDir, "images");

  if (!fs.existsSync(htmlDir)) throw new Error(`html 폴더가 없습니다: ${htmlDir}`);

  fs.mkdirSync(imagesDir, { recursive: true });

  const htmlFiles = fs
    .readdirSync(htmlDir)
    .filter((f) => f.endsWith(".html"))
    .sort();

  if (htmlFiles.length === 0) throw new Error("HTML 파일이 없습니다.");

  const { width, height } = RATIOS[ratio];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();

  const results: string[] = [];

  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(htmlDir, htmlFile);
    const pngName = htmlFile.replace(".html", ".png");
    const pngPath = path.join(imagesDir, pngName);

    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: pngPath });
    results.push(`images/${pngName}`);
  }

  await browser.close();
  return results;
}
