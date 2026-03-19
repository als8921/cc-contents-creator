import { NextRequest } from "next/server";
import { loadSkill } from "@/lib/skills";
import { llm, MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { plan, slideIndex, totalSlides, ratio } = await req.json();

  const systemPrompt = loadSkill("maker");
  const paddedIndex = String(slideIndex).padStart(2, "0");
  const userMessage = `다음 plan을 바탕으로 slide_${paddedIndex}만 HTML로 만들어줘. 다른 슬라이드는 만들지 않는다.

비율: ${ratio}
전체 슬라이드 수: ${totalSlides}장

plan:
${plan}`;

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
