"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Project = { name: string; slides: string[] };

const SCALE_STEP = 0.05;
const SCALE_MIN = 0.15;
const SCALE_MAX = 1.5;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;

export default function ViewerPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [currentIdx, setCurrentIdx] = useState(0);
    const [scale, setScale] = useState(1);
    const [sidebarW, setSidebarW] = useState(260);
    const [dragging, setDragging] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dragRef = useRef<{ startX: number; startW: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/projects")
            .then((r) => r.json())
            .then((data) => {
                setProjects(data.projects);
                if (data.projects.length > 0)
                    setSelected(data.projects[0].name);
            });
    }, []);

    const currentProject = projects.find((p) => p.name === selected);
    const slides = currentProject?.slides ?? [];
    const currentSlide = slides[currentIdx];

    useEffect(() => setCurrentIdx(0), [selected]);

    // Close dropdown on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    const zoomIn = useCallback(
        () => setScale((s) => Math.min(SCALE_MAX, s + SCALE_STEP)),
        [],
    );
    const zoomOut = useCallback(
        () => setScale((s) => Math.max(SCALE_MIN, s - SCALE_STEP)),
        [],
    );
    const zoomFit = useCallback(() => setScale(1), []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft")
                setCurrentIdx((i) => Math.max(0, i - 1));
            if (e.key === "ArrowRight")
                setCurrentIdx((i) => Math.min(slides.length - 1, i + 1));
            if ((e.metaKey || e.ctrlKey) && e.key === "=") {
                e.preventDefault();
                zoomIn();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "-") {
                e.preventDefault();
                zoomOut();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "0") {
                e.preventDefault();
                zoomFit();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [slides.length, zoomIn, zoomOut, zoomFit]);

    // Resize drag handlers
    const onDragStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragRef.current = { startX: e.clientX, startW: sidebarW };
            setDragging(true);
        },
        [sidebarW],
    );

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = e.clientX - dragRef.current.startX;
            const next = Math.min(
                SIDEBAR_MAX,
                Math.max(SIDEBAR_MIN, dragRef.current.startW + delta),
            );
            setSidebarW(next);
        };
        const onUp = () => setDragging(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [dragging]);

    // Thumbnail sizing based on sidebar width
    const slideW = 1920;
    const slideH = 1080;
    const thumbPad = 52;
    const thumbW = sidebarW - thumbPad;
    const thumbScale = thumbW / slideW;
    const thumbH = slideH * thumbScale;

    const btnClass =
        "w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-sm text-gray-600 border border-gray-200 transition-colors";
    const btnDisabled = "disabled:opacity-25 disabled:hover:bg-white";

    return (
        <div className="fixed inset-0 bg-white text-gray-900 flex overflow-hidden">
            {/* Sidebar */}
            <aside
                className="bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0 flex flex-col"
                style={{ width: sidebarW }}
            >
                {/* Project selector — dropdown card */}
                <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen((v) => !v)}
                        className="w-full flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="text-[10px] font-medium text-orange-500 uppercase tracking-wider">Project</span>
                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">{selected || "선택"}</span>
                        </div>
                        <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {dropdownOpen && (
                        <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/8 z-30 overflow-hidden">
                            {projects.map((p) => (
                                <button
                                    key={p.name}
                                    onClick={() => { setSelected(p.name); setDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                                        p.name === selected
                                            ? "bg-orange-50 text-orange-600"
                                            : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                >
                                    <span className="text-sm font-medium truncate">{p.name}</span>
                                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{p.slides.length}장</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Thumbnails */}
                <div className="flex-1 overflow-y-auto py-4 pl-6 pr-7 flex flex-col gap-4">
                    {slides.map((s, i) => (
                        <button
                            key={s}
                            onClick={() => setCurrentIdx(i)}
                            className={`group relative rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                                i === currentIdx
                                    ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-gray-50"
                                    : "ring-1 ring-gray-300 hover:ring-gray-400"
                            }`}
                            style={{ width: thumbW, height: thumbH }}
                        >
                            <iframe
                                src={`/api/slide?project=${selected}&file=${s}`}
                                tabIndex={-1}
                                className="pointer-events-none"
                                style={{
                                    width: slideW,
                                    height: slideH,
                                    transform: `scale(${thumbScale})`,
                                    transformOrigin: "top left",
                                }}
                                title={`thumb-${s}`}
                            />
                            <div
                                className={`absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] font-medium ${
                                    i === currentIdx
                                        ? "bg-orange-500 text-white"
                                        : "bg-white/80 text-gray-500 group-hover:bg-white/90"
                                }`}
                            >
                                {s.replace(".html", "")}
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Resize handle */}
            <div
                onMouseDown={onDragStart}
                className={`w-1.5 flex-shrink-0 cursor-col-resize hover:bg-orange-400/30 transition-colors ${
                    dragging ? "bg-orange-400/40" : "bg-transparent"
                }`}
            />

            {/* Main area */}
            <main className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 relative">
                {currentSlide ? (
                    <div
                        style={{
                            width: slideW * scale,
                            height: slideH * scale,
                            flexShrink: 0,
                        }}
                    >
                        <iframe
                            key={`${selected}-${currentSlide}`}
                            src={`/api/slide?project=${selected}&file=${currentSlide}`}
                            style={{
                                width: slideW,
                                height: slideH,
                                transform: `scale(${scale})`,
                                transformOrigin: "top left",
                                display: "block",
                            }}
                            className="rounded shadow-xl shadow-black/10 border border-gray-200"
                            title={currentSlide}
                        />
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm">
                        프로젝트를 선택하세요
                    </p>
                )}

                {/* Floating control bar */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl px-2 py-1.5 shadow-lg shadow-black/8">
                    <button
                        onClick={() =>
                            setCurrentIdx((i) => Math.max(0, i - 1))
                        }
                        disabled={currentIdx === 0}
                        className={`${btnClass} ${btnDisabled}`}
                    >
                        ‹
                    </button>

                    <span className="text-xs text-gray-500 min-w-[56px] text-center tabular-nums select-none">
                        {slides.length > 0
                            ? `${currentIdx + 1} / ${slides.length}`
                            : "—"}
                    </span>

                    <button
                        onClick={() =>
                            setCurrentIdx((i) =>
                                Math.min(slides.length - 1, i + 1),
                            )
                        }
                        disabled={currentIdx >= slides.length - 1}
                        className={`${btnClass} ${btnDisabled}`}
                    >
                        ›
                    </button>

                </div>

                {/* Right zoom slider */}
                <div className="fixed right-5 bottom-6 z-20 flex flex-col items-center gap-2 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl px-1.5 py-2 shadow-lg shadow-black/8">
                    <button onClick={zoomIn} className={btnClass}>
                        +
                    </button>
                    <input
                        type="range"
                        min={SCALE_MIN * 100}
                        max={SCALE_MAX * 100}
                        value={scale * 100}
                        onChange={(e) =>
                            setScale(Number(e.target.value) / 100)
                        }
                        className="w-8 h-32 appearance-none bg-transparent cursor-pointer accent-orange-500"
                        style={{
                            writingMode: "vertical-lr",
                            direction: "rtl",
                        }}
                    />
                    <button onClick={zoomOut} className={btnClass}>
                        −
                    </button>
                    <button
                        onClick={zoomFit}
                        className="h-7 px-1.5 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-[10px] text-gray-500 border border-gray-200 min-w-[40px] tabular-nums transition-colors"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                </div>
            </main>
        </div>
    );
}
