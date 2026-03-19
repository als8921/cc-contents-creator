import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "output");

export function saveFile(projectName: string, relativePath: string, content: string): void {
  const filePath = path.join(OUTPUT_DIR, projectName, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function readFile(projectName: string, relativePath: string): string {
  const filePath = path.join(OUTPUT_DIR, projectName, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}
