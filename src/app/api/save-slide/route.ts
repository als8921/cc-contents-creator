import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HISTORY_DIR = ".history";

function getHistoryDir(project: string, file: string) {
  const base = path.join(process.cwd(), "output", project, "html", HISTORY_DIR, file.replace(".html", ""));
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  return base;
}

function getVersions(historyDir: string): string[] {
  return fs.readdirSync(historyDir).filter((f) => f.endsWith(".html")).sort();
}

function getPointer(historyDir: string): number {
  const pFile = path.join(historyDir, ".pointer");
  if (fs.existsSync(pFile)) return parseInt(fs.readFileSync(pFile, "utf-8").trim(), 10);
  return -1;
}

function setPointer(historyDir: string, val: number) {
  fs.writeFileSync(path.join(historyDir, ".pointer"), String(val), "utf-8");
}

function validate(project: string, file: string) {
  if (!project || !file) return "Missing fields";
  if (project.includes("..") || file.includes("..")) return "Invalid path";
  return null;
}

// Save new version (called after LLM edit)
export async function POST(req: NextRequest) {
  const { project, file, html } = await req.json();

  const err = validate(project, file);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (!html) return NextResponse.json({ error: "Missing html" }, { status: 400 });

  const filePath = path.join(process.cwd(), "output", project, "html", file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const historyDir = getHistoryDir(project, file);
  const versions = getVersions(historyDir);
  let pointer = getPointer(historyDir);

  // First edit: save original as v0001
  if (versions.length === 0) {
    const original = fs.readFileSync(filePath, "utf-8");
    fs.writeFileSync(path.join(historyDir, "v0001.html"), original, "utf-8");
    pointer = 0;
  }

  // Remove all versions after current pointer (discard redo history on new edit)
  const allVersions = getVersions(historyDir);
  for (let i = pointer + 1; i < allVersions.length; i++) {
    fs.unlinkSync(path.join(historyDir, allVersions[i]));
  }

  // Save new version
  const newNum = pointer + 2; // pointer is 0-indexed, filenames are 1-indexed
  const newName = `v${String(newNum).padStart(4, "0")}.html`;
  fs.writeFileSync(path.join(historyDir, newName), html, "utf-8");

  // Update pointer and main file
  setPointer(historyDir, pointer + 1);
  fs.writeFileSync(filePath, html, "utf-8");

  const total = getVersions(historyDir).length;
  return NextResponse.json({ ok: true, pointer: pointer + 1, total });
}

// Undo / Redo
export async function PATCH(req: NextRequest) {
  const { project, file, action } = await req.json();

  const err = validate(project, file);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const filePath = path.join(process.cwd(), "output", project, "html", file);
  const historyDir = getHistoryDir(project, file);
  const versions = getVersions(historyDir);
  const pointer = getPointer(historyDir);

  if (versions.length === 0) {
    return NextResponse.json({ error: "No history" }, { status: 400 });
  }

  let newPointer = pointer;
  if (action === "undo") {
    if (pointer <= 0) return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
    newPointer = pointer - 1;
  } else if (action === "redo") {
    if (pointer >= versions.length - 1) return NextResponse.json({ error: "Nothing to redo" }, { status: 400 });
    newPointer = pointer + 1;
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const targetFile = path.join(historyDir, versions[newPointer]);
  const restoredHtml = fs.readFileSync(targetFile, "utf-8");
  fs.writeFileSync(filePath, restoredHtml, "utf-8");
  setPointer(historyDir, newPointer);

  return NextResponse.json({
    ok: true,
    pointer: newPointer,
    total: versions.length,
  });
}

// GET: query current history state
export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  const file = req.nextUrl.searchParams.get("file");

  if (!project || !file) return NextResponse.json({ pointer: -1, total: 0 });

  const historyDir = getHistoryDir(project, file);
  const versions = getVersions(historyDir);
  const pointer = getPointer(historyDir);

  return NextResponse.json({ pointer, total: versions.length });
}
