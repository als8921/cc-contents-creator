import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";

export async function POST(req: NextRequest) {
  const { html, width, height } = await req.json();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(html, { waitUntil: "networkidle" });
    // 폰트 렌더링 추가 대기
    await page.waitForTimeout(200);

    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      headers: { "Content-Type": "image/png" },
    });
  } finally {
    await browser.close();
  }
}
