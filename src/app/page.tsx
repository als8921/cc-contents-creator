"use client";

import { useState, useRef } from "react";

type Step = "idle" | "planning" | "confirming" | "making" | "converting" | "done";
type Ratio = "1:1" | "4:5" | "16:9";

const RATIOS: { value: Ratio; label: string }[] = [
  { value: "1:1", label: "1:1 (1080×1080)" },
  { value: "4:5", label: "4:5 (1080×1350)" },
  { value: "16:9", label: "16:9 (1920×1080)" },
];

const SLIDE_COUNTS = [5, 6, 7, 8];

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [content, setContent] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [projectName, setProjectName] = useState("");
  const [plan, setPlan] = useState("");
  const [slides, setSlides] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [pngFiles, setPngFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const planRef = useRef<HTMLTextAreaElement>(null);

  function generateProjectName(text: string): string {
    const words = text.trim().split(/\s+/).slice(0, 3).join("_");
    const safe = words.replace(/[^a-zA-Z0-9가-힣_]/g, "").toLowerCase();
    return safe || `project_${Date.now()}`;
  }

  async function handleStart() {
    if (!content.trim()) return;
    const pName = projectName || generateProjectName(content);
    setProjectName(pName);
    setStep("planning");
    setPlan("");
    setError("");

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, slideCount, ratio, projectName: pName }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setPlan(accumulated);
      }

      setStep("confirming");
    } catch (e) {
      setError(String(e));
      setStep("idle");
    }
  }

  async function handleMake() {
    setStep("making");
    setSlides([]);
    setCurrentSlide(0);
    const newSlides: string[] = [];

    try {
      for (let i = 1; i <= slideCount; i++) {
        setCurrentSlide(i);
        const res = await fetch("/api/make", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            slideIndex: i,
            totalSlides: slideCount,
            ratio,
            projectName,
          }),
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let html = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          html += decoder.decode(value, { stream: true });
          const updated = [...newSlides, html];
          setSlides(updated);
        }

        newSlides.push(html);
        setSlides([...newSlides]);
      }

      setStep("converting");
      await handleConvert();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleConvert() {
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, ratio, scale: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setPngFiles(data.files);
        setStep("done");
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  // Extract HTML from LLM response
  function extractHtml(raw: string): string {
    const match = raw.match(/```html\n?([\s\S]*?)```/) || raw.match(/(<html[\s\S]*<\/html>)/);
    return match ? (match[1] || match[0]).trim() : raw.trim();
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">카드뉴스 메이커</h1>
      <p className="text-gray-500 mb-10">내용을 입력하면 AI가 카드뉴스를 만들어드립니다.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {/* STEP 1: Input */}
      {step === "idle" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
            <textarea
              className="w-full h-48 border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="카드뉴스로 만들고 싶은 내용을 자유롭게 입력하세요.&#10;(글, 자료, 아이디어 무엇이든)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">장수</label>
              <div className="flex gap-2">
                {SLIDE_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSlideCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      slideCount === n
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {n}장
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">크기</label>
              <div className="flex flex-col gap-2">
                {RATIOS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setRatio(value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
                      ratio === value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트명 <span className="text-gray-400 font-normal">(선택, 영문/숫자/언더스코어)</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="비워두면 자동 생성"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!content.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            카드뉴스 만들기 →
          </button>
        </div>
      )}

      {/* STEP 2: Planning */}
      {step === "planning" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="font-semibold text-gray-800">기획 중...</h2>
          </div>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto">
            {plan || "기획을 생성하고 있습니다..."}
          </pre>
        </div>
      )}

      {/* STEP 3: Confirm plan */}
      {step === "confirming" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <h2 className="font-semibold text-gray-800">기획안을 확인해주세요</h2>
          <p className="text-sm text-gray-500">내용을 수정한 후 제작을 시작할 수 있습니다.</p>
          <textarea
            ref={planRef}
            className="w-full h-96 border border-gray-200 rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep("idle")}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              다시 입력
            </button>
            <button
              onClick={handleMake}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              슬라이드 제작 시작 →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Making slides */}
      {(step === "making" || step === "converting") && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>
                {step === "converting"
                  ? "PNG 변환 중..."
                  : `슬라이드 제작 중... ${currentSlide}/${slideCount}`}
              </span>
              <span>{step === "converting" ? "100%" : `${Math.round((currentSlide / slideCount) * 100)}%`}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: step === "converting" ? "100%" : `${(currentSlide / slideCount) * 100}%`,
                }}
              />
            </div>
          </div>

          {slides.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">미리보기</h3>
              <div className="grid grid-cols-2 gap-4">
                {slides.map((html, idx) => {
                  const cleanHtml = extractHtml(html);
                  const blob = new Blob([cleanHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  return (
                    <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="text-xs text-gray-400 px-3 py-1 bg-gray-50 border-b border-gray-100">
                        slide_{String(idx + 1).padStart(2, "0")}
                      </div>
                      <iframe
                        src={url}
                        className="w-full"
                        style={{ height: "200px", transform: "scale(0.5)", transformOrigin: "top left", width: "200%", pointerEvents: "none" }}
                        title={`slide ${idx + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: Done */}
      {step === "done" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg">✓</div>
            <h2 className="font-semibold text-gray-800">완성!</h2>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">저장 위치</p>
            <p className="text-sm font-mono text-gray-500">output/{projectName}/images/</p>
            <ul className="text-sm text-gray-500 space-y-1 mt-2">
              {pngFiles.map((f) => <li key={f}>• {f}</li>)}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {slides.map((html, idx) => {
              const cleanHtml = extractHtml(html);
              const blob = new Blob([cleanHtml], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              return (
                <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="text-xs text-gray-400 px-3 py-1 bg-gray-50 border-b border-gray-100">
                    slide_{String(idx + 1).padStart(2, "0")}
                  </div>
                  <iframe
                    src={url}
                    className="w-full"
                    style={{ height: "200px", transform: "scale(0.5)", transformOrigin: "top left", width: "200%", pointerEvents: "none" }}
                    title={`slide ${idx + 1}`}
                  />
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              setStep("idle");
              setContent("");
              setPlan("");
              setSlides([]);
              setPngFiles([]);
              setProjectName("");
            }}
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            새 카드뉴스 만들기
          </button>
        </div>
      )}
    </main>
  );
}
