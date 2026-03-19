"use client";

import { useState } from "react";

type Step = "idle" | "planning" | "confirming" | "making" | "viewing";
type Ratio = "1:1" | "4:5" | "16:9";

const RATIO_INFO: Record<Ratio, { label: string; width: number; height: number }> = {
  "1:1":  { label: "1:1 (1080×1080)",  width: 1080, height: 1080 },
  "4:5":  { label: "4:5 (1080×1350)",  width: 1080, height: 1350 },
  "16:9": { label: "16:9 (1920×1080)", width: 1920, height: 1080 },
};

const SLIDE_COUNTS = [5, 6, 7, 8];
const THUMB_W = 152;

function extractHtml(raw: string): string {
  const match = raw.match(/```html\n?([\s\S]*?)```/) || raw.match(/(<html[\s\S]*<\/html>)/);
  return match ? (match[1] || match[0]).trim() : raw.trim();
}

// 슬라이드를 비율에 맞게 렌더링하는 iframe 컴포넌트
function SlideIframe({
  html,
  slideW,
  slideH,
  displayW,
  title,
}: {
  html: string;
  slideW: number;
  slideH: number;
  displayW: number; // 화면에 보여줄 너비(px)
  title: string;
}) {
  const displayH = Math.round(displayW * (slideH / slideW));
  const scale = displayW / slideW;

  return (
    <div style={{ width: displayW, height: displayH, overflow: "hidden", position: "relative", flexShrink: 0 }}>
      <iframe
        srcDoc={html}
        title={title}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: slideW,
          height: slideH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          border: "none",
        }}
      />
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [content, setContent] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [projectName, setProjectName] = useState("");
  const [plan, setPlan] = useState("");
  const [slides, setSlides] = useState<(string | null)[]>([]);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [customSlide, setCustomSlide] = useState(false);

  const { width: slideW, height: slideH } = RATIO_INFO[ratio];

  function generateProjectName(text: string): string {
    const safe = text.trim().split(/\s+/).slice(0, 3).join("_")
      .replace(/[^a-zA-Z0-9가-힣_]/g, "").toLowerCase();
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
        body: JSON.stringify({ content, slideCount, ratio }),
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

  // 배치 응답에서 슬라이드별 HTML 파싱
  function parseBatchResponse(text: string, slideIndices: number[]): Record<number, string> {
    const result: Record<number, string> = {};
    for (const idx of slideIndices) {
      const pad = String(idx).padStart(2, "0");
      const match = text.match(
        new RegExp(`<!--\\s*SLIDE_${pad}\\s*-->([\\s\\S]*?)<!--\\s*END_SLIDE_${pad}\\s*-->`)
      );
      if (match) result[idx] = match[1].trim();
    }
    return result;
  }

  async function handleMake() {
    setStep("making");
    setSlides(Array(slideCount).fill(null));
    setError("");

    // 3장씩 배치로 나누기
    const indices = Array.from({ length: slideCount }, (_, i) => i + 1);
    const batches: number[][] = [];
    for (let i = 0; i < indices.length; i += 3) {
      batches.push(indices.slice(i, i + 3));
    }

    try {
      await Promise.all(
        batches.map(async (slideIndices) => {
          const res = await fetch("/api/make", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, slideIndices, totalSlides: slideCount, ratio }),
          });

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
          }

          const parsed = parseBatchResponse(text, slideIndices);
          setSlides((prev) => {
            const updated = [...prev];
            for (const [idxStr, html] of Object.entries(parsed)) {
              updated[Number(idxStr) - 1] = html;
            }
            return updated;
          });
        })
      );

      setSelectedSlide(0);
      setEditingSlide(null);
      setStep("viewing");
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    setError("");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const isLandscape = ratio === "16:9";
      const pdfW = isLandscape ? 297 : 210;
      const pdfH = Math.round((slideH / slideW) * pdfW);

      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: [pdfW, pdfH],
      });

      const validSlides = slides.filter(Boolean) as string[];

      for (let i = 0; i < validSlides.length; i++) {
        const html = extractHtml(validSlides[i]);

        const iframe = document.createElement("iframe");
        iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${slideW}px;height:${slideH}px;border:none;`;
        document.body.appendChild(iframe);

        await new Promise<void>((resolve) => {
          iframe.onload = () => resolve();
          iframe.srcdoc = html;
        });

        const canvas = await html2canvas(iframe.contentDocument!.documentElement, {
          width: slideW,
          height: slideH,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        document.body.removeChild(iframe);

        if (i > 0) pdf.addPage([pdfW, pdfH], isLandscape ? "landscape" : "portrait");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
      }

      pdf.save(`${projectName}.pdf`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPdfLoading(false);
    }
  }

  function startEdit(index: number) {
    setEditingSlide(index);
    setEditContent(extractHtml(slides[index] ?? ""));
  }

  function saveEdit() {
    if (editingSlide === null) return;
    const updated = [...slides];
    updated[editingSlide] = editContent;
    setSlides(updated);
    setEditingSlide(null);
  }

  function resetAll() {
    setStep("idle");
    setContent("");
    setPlan("");
    setSlides([]);
    setProjectName("");
    setEditingSlide(null);
    setError("");
  }

  const completedCount = slides.filter(Boolean).length;

  // ── Viewing ─────────────────────────────────────────────────────────────────
  if (step === "viewing") {
    return (
      <div className="flex h-screen bg-gray-100">
        {/* 사이드바 */}
        <aside className="w-44 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">슬라이드</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {slides.map((html, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedSlide(idx); setEditingSlide(null); }}
                className={`w-full rounded-lg overflow-hidden border-2 transition-all ${
                  selectedSlide === idx ? "border-blue-500 shadow-md" : "border-transparent hover:border-gray-300"
                }`}
              >
                <div className="text-xs text-gray-400 py-0.5 bg-gray-50 text-center border-b border-gray-100">
                  {idx + 1}
                </div>
                {html ? (
                  <SlideIframe
                    html={extractHtml(html)}
                    slideW={slideW}
                    slideH={slideH}
                    displayW={THUMB_W}
                    title={`thumb-${idx + 1}`}
                  />
                ) : (
                  <div
                    style={{ width: THUMB_W, height: Math.round(THUMB_W * slideH / slideW) }}
                    className="bg-gray-100 flex items-center justify-center text-xs text-gray-400"
                  >
                    생성 중...
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* 메인 */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={resetAll} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
                ← 새로 만들기
              </button>
              <span className="text-gray-200">|</span>
              <span className="text-sm font-medium text-gray-700">{projectName}</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{ratio}</span>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pdfLoading ? "PDF 생성 중..." : "PDF 다운로드"}
            </button>
          </header>

          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          <main className="flex-1 overflow-y-auto p-8">
            {editingSlide !== null ? (
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">슬라이드 {editingSlide + 1} 편집</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingSlide(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                      취소
                    </button>
                    <button onClick={saveEdit} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      저장
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 items-start">
                  <textarea
                    className="h-[600px] font-mono text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                    <SlideIframe
                      html={editContent}
                      slideW={slideW}
                      slideH={slideH}
                      displayW={Math.round(600 * slideW / slideH) > 600 ? 600 : Math.round(600 * slideW / slideH)}
                      title="edit-preview"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    슬라이드 {selectedSlide + 1} / {slides.length}
                  </h3>
                  <button onClick={() => startEdit(selectedSlide)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    HTML 편집
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  {slides[selectedSlide] ? (
                    <SlideIframe
                      html={extractHtml(slides[selectedSlide]!)}
                      slideW={slideW}
                      slideH={slideH}
                      displayW={672}
                      title={`slide-${selectedSlide + 1}`}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">생성 중...</div>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setSelectedSlide((s) => Math.max(0, s - 1))}
                    disabled={selectedSlide === 0}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => setSelectedSlide((s) => Math.min(slides.length - 1, s + 1))}
                    disabled={selectedSlide === slides.length - 1}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ── 나머지 단계 ──────────────────────────────────────────────────────────────
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">카드뉴스 메이커</h1>
      <p className="text-gray-500 mb-10">내용을 입력하면 AI가 카드뉴스를 만들어드립니다.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">{error}</div>
      )}

      {step === "idle" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">내용</label>
            <textarea
              className="w-full h-48 border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={"카드뉴스로 만들고 싶은 내용을 자유롭게 입력하세요.\n(글, 자료, 아이디어 무엇이든)"}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">장수</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {SLIDE_COUNTS.map((n) => (
                    <button
                      key={n}
                      onClick={() => { setSlideCount(n); setCustomSlide(false); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        slideCount === n && !customSlide ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomSlide(true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      customSlide ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    직접
                  </button>
                </div>
                {customSlide && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="장수 입력 (1~20)"
                    autoFocus
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (v >= 1 && v <= 20) setSlideCount(v);
                    }}
                    className="w-full py-2 px-3 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">크기</label>
              <div className="flex flex-col gap-2">
                {(Object.entries(RATIO_INFO) as [Ratio, typeof RATIO_INFO[Ratio]][]).map(([value, { label }]) => (
                  <button
                    key={value}
                    onClick={() => setRatio(value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
                      ratio === value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              프로젝트명 <span className="text-gray-400 font-normal">(선택)</span>
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

      {step === "confirming" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">기획안을 확인해주세요</h2>
            <p className="text-sm text-gray-500 mt-1">내용을 수정한 후 제작을 시작할 수 있습니다.</p>
          </div>
          <textarea
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

      {step === "making" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>슬라이드 생성 중... {completedCount}/{slideCount}</span>
              <span>{Math.round((completedCount / slideCount) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(completedCount / slideCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {slides.map((html, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="text-xs text-gray-400 py-1 bg-gray-50 text-center border-b border-gray-100">
                  slide_{String(idx + 1).padStart(2, "0")}
                </div>
                {html ? (
                  <SlideIframe
                    html={extractHtml(html)}
                    slideW={slideW}
                    slideH={slideH}
                    displayW={208}
                    title={`making-${idx + 1}`}
                  />
                ) : (
                  <div
                    style={{ height: Math.round(208 * slideH / slideW) }}
                    className="bg-gray-50 flex items-center justify-center"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
