import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { loadSkill } from "@/lib/skills";
import { streamClaudeWithLogs } from "@/lib/claude-cli";

export async function POST(req: NextRequest) {
  const { project, file, instruction } = await req.json();

  if (!project || !file || !instruction) {
    return new Response("Missing project, file, or instruction", { status: 400 });
  }
  if (project.includes("..") || file.includes("..")) {
    return new Response("Invalid path", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "output", project, "html", file);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const currentHtml = fs.readFileSync(filePath, "utf-8");
  const makerSkill = loadSkill("maker");

  const prompt = `당신은 카드뉴스 HTML/CSS 수정 전문가입니다. 아래 디자인 규칙을 참고하세요.

=== 디자인 규칙 (maker.md) ===
${makerSkill}
=== 규칙 끝 ===

아래는 현재 슬라이드의 HTML입니다:

\`\`\`html
${currentHtml}
\`\`\`

사용자의 수정 요청:
${instruction}

규칙:
- 수정 요청에 해당하는 부분만 변경하고, 나머지는 그대로 유지한다
- 완전한 HTML 문서를 출력한다 (<!DOCTYPE html>부터 </html>까지)
- HTML 코드만 출력한다. 설명이나 마크다운 코드 블록(\`\`\`) 없이 순수 HTML만 출력한다
- 기존 디자인 톤과 일관성을 유지한다`;

  return new Response(streamClaudeWithLogs(prompt), {
    headers: { "Content-Type": "application/x-ndjson", "X-Mode": "cli" },
  });
}
