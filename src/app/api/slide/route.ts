import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  const file = req.nextUrl.searchParams.get("file");

  if (!project || !file) {
    return new NextResponse("Missing project or file", { status: 400 });
  }

  // Prevent path traversal
  if (project.includes("..") || file.includes("..")) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "output", project, "html", file);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
