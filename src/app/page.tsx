"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Step = "idle" | "planning" | "confirming" | "making" | "viewing";
type Ratio = "1:1" | "4:5" | "16:9";

const RATIO_INFO: Record<Ratio, { label: string; width: number; height: number }> = {
  "1:1":  { label: "1:1 (1080×1080)",  width: 1080, height: 1080 },
  "4:5":  { label: "4:5 (1080×1350)",  width: 1080, height: 1350 },
  "16:9": { label: "16:9 (1920×1080)", width: 1920, height: 1080 },
};

const SLIDE_COUNTS = [5, 6, 7, 8];

// ── Session Storage ──────────────────────────────────────────────────────────
const SK = {
  content:     "cnm_content",
  slideCount:  "cnm_slideCount",
  ratio:       "cnm_ratio",
  projectName: "cnm_projectName",
  plan:        "cnm_plan",
  slides:      "cnm_slides",
};

function ssGet<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

function ssSave(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }
}

function ssClear() {
  Object.values(SK).forEach((k) => sessionStorage.removeItem(k));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractHtml(raw: string): string {
  const match = raw.match(/```html\n?([\s\S]*?)```/) || raw.match(/(<html[\s\S]*<\/html>)/);
  return match ? (match[1] || match[0]).trim() : raw.trim();
}

function generateProjectName(text: string): string {
  const safe = text.trim().split(/\s+/).slice(0, 3).join("_")
    .replace(/[^a-zA-Z0-9가-힣_]/g, "").toLowerCase();
  return safe || `project_${Date.now()}`;
}

// ── SlideIframe ───────────────────────────────────────────────────────────────
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
  displayW: number;
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

// ── Main Component ────────────────────────────────────────────────────────────
function CardNewsMaker() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 새로고침 시 첫 렌더부터 올바른 값을 쓰도록 sessionStorage에서 지연 초기화
  const [step, setStep] = useState<Step>(() => {
    if (typeof window === "undefined") return "idle";
    return (new URLSearchParams(window.location.search).get("step") ?? "idle") as Step;
  });
  const [content, setContent] = useState(() =>
    typeof window === "undefined" ? "" : ssGet(SK.content, "")
  );
  const [slideCount, setSlideCount] = useState(() =>
    typeof window === "undefined" ? 6 : ssGet(SK.slideCount, 6)
  );
  const [ratio, setRatio] = useState<Ratio>(() =>
    typeof window === "undefined" ? "4:5" : ssGet<Ratio>(SK.ratio, "4:5")
  );
  const [projectName, setProjectName] = useState(() =>
    typeof window === "undefined" ? "" : ssGet(SK.projectName, "")
  );
  const [plan, setPlan] = useState(() =>
    typeof window === "undefined" ? "" : ssGet(SK.plan, "")
  );
  const [slides, setSlides] = useState<(string | null)[]>(() => {
    if (typeof window === "undefined") return [];
    const urlStep = new URLSearchParams(window.location.search).get("step");
    return urlStep === "viewing" ? ssGet<(string | null)[]>(SK.slides, []) : [];
  });
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [customSlide, setCustomSlide] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(176);
  const [slideContainerSize, setSlideContainerSize] = useState({ w: 800, h: 600 });
  const slideContainerRef = useRef<HTMLDivElement>(null);

  // 슬라이드 컨테이너 크기 측정 (높이 기반으로 displayW 계산에 사용)
  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSlideContainerSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [step]);

  // 사이드바 드래그 리사이즈
  function handleSidebarDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMove(e: MouseEvent) {
      const next = Math.max(120, Math.min(400, startWidth + e.clientX - startX));
      setSidebarWidth(next);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // 생성 중에는 URL 동기화 효과가 상태를 덮어쓰지 않도록 막는 ref
  const generatingRef = useRef(false);

  // ── URL ↔ 상태 동기화 (뒤로가기/앞으로가기) ──────────────────────────────
  useEffect(() => {
    if (generatingRef.current) return;

    const urlStep = (searchParams.get("step") ?? "idle") as Step;

    // 과도적 상태는 직접 접근 불가 → 적절한 단계로 리다이렉트
    if (urlStep === "planning") {
      router.replace("/?step=idle");
      setStep("idle");
      return;
    }
    if (urlStep === "making") {
      const storedSlides = ssGet<(string | null)[]>(SK.slides, []);
      if (storedSlides.length > 0 && storedSlides.every(Boolean)) {
        router.replace("/?step=viewing");
        setSlides(storedSlides);
        setStep("viewing");
      } else {
        router.replace("/?step=confirming");
        setPlan(ssGet(SK.plan, ""));
        setStep("confirming");
      }
      return;
    }

    // 공통 기본 상태 복원
    setContent(ssGet(SK.content, ""));
    setSlideCount(ssGet(SK.slideCount, 6));
    setRatio(ssGet<Ratio>(SK.ratio, "4:5"));
    setProjectName(ssGet(SK.projectName, ""));

    if (urlStep === "confirming") {
      setPlan(ssGet(SK.plan, ""));
    } else if (urlStep === "viewing") {
      setPlan(ssGet(SK.plan, ""));
      setSlides(ssGet(SK.slides, []));
      setSelectedSlide(0);
      setEditingSlide(null);
    }

    setStep(urlStep);
  }, [searchParams, router]);

  // idle 입력값 자동 저장 (뒤로가기 후 복원용)
  useEffect(() => {
    if (step !== "idle") return;
    ssSave({ [SK.content]: content });
  }, [content, step]);

  useEffect(() => {
    if (step !== "idle") return;
    ssSave({ [SK.slideCount]: slideCount });
  }, [slideCount, step]);

  useEffect(() => {
    if (step !== "idle") return;
    ssSave({ [SK.ratio]: ratio });
  }, [ratio, step]);

  useEffect(() => {
    if (step !== "idle") return;
    ssSave({ [SK.projectName]: projectName });
  }, [projectName, step]);

  // ── 단계 이동 헬퍼 ────────────────────────────────────────────────────────
  function goTo(s: Step, replace = false) {
    const url = s === "idle" ? "/" : `/?step=${s}`;
    if (replace) router.replace(url);
    else router.push(url);
    setStep(s);
  }

  // ── 기획 시작 ─────────────────────────────────────────────────────────────
  async function handleStart() {
    if (!content.trim()) return;
    const pName = projectName || generateProjectName(content);
    setProjectName(pName);
    setError("");
    setPlan("");

    ssSave({
      [SK.content]: content,
      [SK.slideCount]: slideCount,
      [SK.ratio]: ratio,
      [SK.projectName]: pName,
    });

    generatingRef.current = true;
    goTo("planning", true); // idle을 planning으로 replace (뒤로가기 히스토리 미추가)

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

      ssSave({ [SK.plan]: accumulated });
      generatingRef.current = false;
      goTo("confirming"); // confirming push → 뒤로가기로 idle로 돌아올 수 있음
    } catch (e) {
      generatingRef.current = false;
      setError(String(e));
      goTo("idle", true);
    }
  }

  // ── 슬라이드 배치 파싱 ────────────────────────────────────────────────────
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

  // ── 슬라이드 제작 ─────────────────────────────────────────────────────────
  async function handleMake() {
    const initialSlides: (string | null)[] = Array(slideCount).fill(null);
    setSlides(initialSlides);
    setError("");

    ssSave({ [SK.plan]: plan });

    const indices = Array.from({ length: slideCount }, (_, i) => i + 1);
    const batches: number[][] = [];
    for (let i = 0; i < indices.length; i += 3) {
      batches.push(indices.slice(i, i + 3));
    }

    generatingRef.current = true;
    goTo("making", true); // confirming을 making으로 replace

    // setSlides updater는 React 렌더 시점에 실행되므로
    // 결과를 별도 객체에 직접 수집해야 ssSave 시점에 올바른 값을 가짐
    const allParsed: Record<number, string> = {};

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
          Object.assign(allParsed, parsed);

          setSlides((prev) => {
            const updated = [...prev];
            for (const [idxStr, html] of Object.entries(parsed)) {
              updated[Number(idxStr) - 1] = html;
            }
            return updated;
          });
        })
      );

      const finalSlides = Array.from({ length: slideCount }, (_, i) => allParsed[i + 1] ?? null);
      ssSave({ [SK.slides]: finalSlides });
      setSlides(finalSlides); // 상태도 확실하게 동기화

      generatingRef.current = false;
      setSelectedSlide(0);
      setEditingSlide(null);
      goTo("viewing"); // viewing push → 뒤로가기로 confirming으로 돌아올 수 있음
    } catch (e) {
      generatingRef.current = false;
      setError(String(e));
      goTo("confirming", true);
    }
  }

  // ── PDF 다운로드 ──────────────────────────────────────────────────────────
  const { width: slideW, height: slideH } = RATIO_INFO[ratio];

  async function handleDownloadPDF() {
    setPdfLoading(true);
    setError("");
    try {
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

        const res = await fetch("/api/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, width: slideW, height: slideH }),
        });
        if (!res.ok) throw new Error(`스크린샷 실패: ${res.status}`);

        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        if (i > 0) pdf.addPage([pdfW, pdfH], isLandscape ? "landscape" : "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfW, pdfH);
      }

      pdf.save(`${projectName}.pdf`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPdfLoading(false);
    }
  }

  // ── 슬라이드 편집 ─────────────────────────────────────────────────────────
  function startEdit(index: number) {
    setEditingSlide(index);
    setEditContent(extractHtml(slides[index] ?? ""));
  }

  function saveEdit() {
    if (editingSlide === null) return;
    const updated = [...slides];
    updated[editingSlide] = editContent;
    setSlides(updated);
    ssSave({ [SK.slides]: updated });
    setEditingSlide(null);
  }

  // ── 전체 초기화 ───────────────────────────────────────────────────────────
  function resetAll() {
    ssClear();
    setContent("");
    setPlan("");
    setSlides([]);
    setProjectName("");
    setEditingSlide(null);
    setError("");
    goTo("idle");
  }

  const completedCount = slides.filter(Boolean).length;

  // ── Viewing ───────────────────────────────────────────────────────────────
  if (step === "viewing") {
    return (
      <div className="flex h-screen bg-gray-100">
        {/* 사이드바 */}
        <aside
          style={{ width: sidebarWidth }}
          className="bg-white border-r border-gray-200 flex flex-col shrink-0"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">슬라이드</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {slides.map((html, idx) => {
              const thumbW = sidebarWidth - 16;
              return (
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
                      displayW={thumbW}
                      title={`thumb-${idx + 1}`}
                    />
                  ) : (
                    <div
                      style={{ width: thumbW, height: Math.round(thumbW * slideH / slideW) }}
                      className="bg-gray-100 flex items-center justify-center text-xs text-gray-400"
                    >
                      생성 중...
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleSidebarDragStart}
          className="w-1 hover:w-1.5 bg-gray-200 hover:bg-blue-400 cursor-col-resize shrink-0 transition-all"
        />

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

          {editingSlide !== null ? (
            // 편집 모드: 스크롤 가능
            <main className="flex-1 overflow-y-auto p-8">
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
                      displayW={Math.min(600, Math.round(600 * slideW / slideH))}
                      title="edit-preview"
                    />
                  </div>
                </div>
              </div>
            </main>
          ) : (
            // 뷰어 모드: 높이를 꽉 채우는 레이아웃
            <main className="flex-1 overflow-hidden flex flex-col min-h-0 px-6 pt-4 pb-4">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="font-semibold text-gray-800">
                  슬라이드 {selectedSlide + 1} / {slides.length}
                </h3>
                <button onClick={() => startEdit(selectedSlide)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                  HTML 편집
                </button>
              </div>

              {/* 슬라이드 컨테이너: 남은 높이를 모두 사용 */}
              <div ref={slideContainerRef} className="flex-1 min-h-0 flex items-center justify-center">
                {slides[selectedSlide] ? (() => {
                  const displayW = Math.min(
                    slideContainerSize.w,
                    Math.floor(slideContainerSize.h * (slideW / slideH))
                  );
                  return (
                    <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                      <SlideIframe
                        html={extractHtml(slides[selectedSlide]!)}
                        slideW={slideW}
                        slideH={slideH}
                        displayW={displayW}
                        title={`slide-${selectedSlide + 1}`}
                      />
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-center h-64 text-gray-400 text-sm">생성 중...</div>
                )}
              </div>

              <div className="flex justify-between mt-3 shrink-0">
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
            </main>
          )}
        </div>
      </div>
    );
  }

  // ── 나머지 단계 ───────────────────────────────────────────────────────────
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
              onClick={() => goTo("idle")}
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

// useSearchParams는 Suspense 경계가 필요
export default function Page() {
  return (
    <Suspense>
      <CardNewsMaker />
    </Suspense>
  );
}
