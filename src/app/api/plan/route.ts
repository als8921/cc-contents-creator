import { NextRequest } from "next/server";
import { loadSkill } from "@/lib/skills";
import { llm, MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { content, slideCount, ratio } = await req.json();

  const systemPrompt = loadSkill("planner");
  const userMessage = `다음 자료를 바탕으로 카드뉴스를 기획해줘.

자료:
${content}

조건:
- 슬라이드 수: ${slideCount}장
- 비율: ${ratio}`;

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
