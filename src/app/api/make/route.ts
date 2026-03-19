import { NextRequest } from "next/server";
import { loadSkill } from "@/lib/skills";
import { llm, MODEL } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { plan, slideIndices, totalSlides, ratio } = await req.json();

  const systemPrompt = loadSkill("maker");
  const slideList = slideIndices.map((i: number) => `slide_${String(i).padStart(2, "0")}`).join(", ");

  const userMessage = `다음 plan을 바탕으로 ${slideList}을 HTML로 만들어줘.

규칙:
- 각 슬라이드를 반드시 아래 형식으로 구분해서 출력한다
- <!-- SLIDE_NN --> 과 <!-- END_SLIDE_NN --> 사이에 완전한 HTML 문서를 넣는다
- 다른 설명이나 텍스트는 출력하지 않는다

출력 형식:
<!-- SLIDE_01 -->
<!DOCTYPE html><html>...</html>
<!-- END_SLIDE_01 -->
<!-- SLIDE_02 -->
<!DOCTYPE html><html>...</html>
<!-- END_SLIDE_02 -->

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
