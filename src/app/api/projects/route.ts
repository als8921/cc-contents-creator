import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const outputDir = path.join(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) {
    return NextResponse.json({ projects: [] });
  }

  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  const projects = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => {
      const htmlDir = path.join(outputDir, e.name, "html");
      let slides: string[] = [];
      if (fs.existsSync(htmlDir)) {
        slides = fs
          .readdirSync(htmlDir)
          .filter((f) => f.endsWith(".html"))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] ?? "0");
            const numB = parseInt(b.match(/\d+/)?.[0] ?? "0");
            return numA - numB;
          });
      }
      return { name: e.name, slides };
    })
    .filter((p) => p.slides.length > 0);

  return NextResponse.json({ projects });
}
