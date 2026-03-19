import fs from "fs";
import path from "path";

export function loadSkill(name: "researcher" | "planner" | "maker"): string {
  const filePath = path.join(process.cwd(), "skills", `${name}.md`);
  return fs.readFileSync(filePath, "utf-8");
}
