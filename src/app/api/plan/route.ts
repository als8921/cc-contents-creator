import { NextRequest } from "next/server";
import { loadSkill } from "@/lib/skills";
import { llm, MODEL } from "@/lib/llm";
import { streamClaudeWithLogs } from "@/lib/claude-cli";

export async function POST(req: NextRequest) {
  const { content, slideCount, ratio, mode = "api", bgColor, primaryColor } = await req.json();

  // ── CLI 모드: claude -p 로 실행 (CLAUDE.md + 도구 자동 로드) ──
  if (mode === "cli") {
    const plannerSkill = loadSkill("planner");

    const prompt = `당신은 카드뉴스 기획 전문가입니다. 아래 스킬 규칙을 반드시 따르세요.

=== 스킬: planner.md ===
${plannerSkill}
=== 스킬 끝 ===

다음 자료를 바탕으로 카드뉴스를 기획해줘.
파일 저장은 하지 말고, plan.md 형식의 기획안 텍스트만 출력해줘.

자료:
${content}

조건:
- 슬라이드 수: ${slideCount}장
- 비율: ${ratio}
- 배경: 흰색(${bgColor}) 바탕에 주요색(${primaryColor})의 은은한 블러(blur) 효과
- 주요색(Primary): ${primaryColor}`;

    return new Response(streamClaudeWithLogs(prompt), {
      headers: { "Content-Type": "application/x-ndjson", "X-Mode": "cli" },
    });
  }

  // ── API 모드: LLM API 직접 호출 ──
  const systemPrompt = loadSkill("planner");
  const userMessage = `다음 자료를 바탕으로 카드뉴스를 기획해줘.

자료:
${content}

조건:
- 슬라이드 수: ${slideCount}장
- 비율: ${ratio}
- 배경: 흰색(${bgColor}) 바탕에 주요색(${primaryColor})의 은은한 블러(blur) 효과
- 주요색(Primary): ${primaryColor}`;

  const stream = await llm.chat.completions.create({
    model: MODEL,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        controller.enqueue(new TextEncoder().encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
