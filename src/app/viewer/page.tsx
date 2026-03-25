"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Project = { name: string; slides: string[] };

const SCALE_STEP = 0.05;
const SCALE_MIN = 0.15;
const SCALE_MAX = 2;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const EDIT_PANEL_W = 420;
const FIT_PADDING = 80;
type EditTab = "ai" | "html";

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

    // Edit state
    const [editInput, setEditInput] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editLog, setEditLog] = useState<string[]>([]);
    const [historyState, setHistoryState] = useState<
        Record<string, { pointer: number; total: number }>
    >({});
    const [iframeKey, setIframeKey] = useState(0);
    const [editPanelOpen, setEditPanelOpen] = useState(false);
    const [editTab, setEditTab] = useState<EditTab>("ai");
    const [htmlSource, setHtmlSource] = useState("");
    const [htmlDirty, setHtmlDirty] = useState(false);
    const [isSavingHtml, setIsSavingHtml] = useState(false);
    const editInputRef = useRef<HTMLTextAreaElement>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    const [fitScale, setFitScale] = useState(1);

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
    const histKey = `${selected}/${currentSlide}`;
    const hist = historyState[histKey] ?? { pointer: -1, total: 0 };
    const canUndo = hist.pointer > 0;
    const canRedo = hist.total > 0 && hist.pointer < hist.total - 1;

    useEffect(() => setCurrentIdx(0), [selected]);

    // Fetch history state + HTML source when slide changes
    useEffect(() => {
        if (!selected || !currentSlide) return;
        fetch(`/api/save-slide?project=${selected}&file=${currentSlide}`)
            .then((r) => r.json())
            .then((data) => {
                setHistoryState((s) => ({
                    ...s,
                    [histKey]: { pointer: data.pointer, total: data.total },
                }));
            });
        fetch(`/api/slide?project=${selected}&file=${currentSlide}`)
            .then((r) => r.text())
            .then((html) => {
                setHtmlSource(html);
                setHtmlDirty(false);
            });
    }, [selected, currentSlide, histKey, iframeKey]);

    // Close dropdown on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
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
            // Don't handle arrow keys when editing
            if (editInputRef.current === document.activeElement) return;

            if (e.key === "ArrowLeft") setCurrentIdx((i) => Math.max(0, i - 1));
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

    // Auto-scroll log
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [editLog]);

    // Edit slide handler
    const handleEdit = useCallback(async () => {
        if (!editInput.trim() || !selected || !currentSlide || isEditing)
            return;

        setIsEditing(true);
        setEditLog([`> ${editInput}`]);
        const instruction = editInput;
        setEditInput("");

        try {
            const res = await fetch("/api/edit-slide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project: selected,
                    file: currentSlide,
                    instruction,
                }),
            });

            if (!res.ok) {
                setEditLog((l) => [...l, `[error] ${res.statusText}`]);
                setIsEditing(false);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n").filter(Boolean);

                for (const line of lines) {
                    try {
                        const evt = JSON.parse(line);
                        if (evt.t === "x") {
                            fullText += evt.d;
                        } else if (evt.t === "d") {
                            setEditLog((l) => [...l, evt.d]);
                        }
                    } catch {
                        // skip malformed lines
                    }
                }
            }

            // Extract HTML from the response
            let html = fullText.trim();
            if (html.startsWith("```")) {
                html = html
                    .replace(/^```(?:html)?\n?/, "")
                    .replace(/\n?```$/, "");
            }

            if (html.includes("<!DOCTYPE html>") || html.includes("<html")) {
                const saveRes = await fetch("/api/save-slide", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        project: selected,
                        file: currentSlide,
                        html,
                    }),
                });
                const saveData = await saveRes.json();

                if (saveData.ok) {
                    setHistoryState((s) => ({
                        ...s,
                        [histKey]: {
                            pointer: saveData.pointer,
                            total: saveData.total,
                        },
                    }));
                    setIframeKey((k) => k + 1);
                    setEditLog((l) => [
                        ...l,
                        `[done] 저장 완료 (${saveData.pointer + 1}/${saveData.total})`,
                    ]);
                } else {
                    setEditLog((l) => [
                        ...l,
                        `[error] 저장 실패: ${saveData.error}`,
                    ]);
                }
            } else {
                setEditLog((l) => [
                    ...l,
                    "[error] LLM이 유효한 HTML을 반환하지 않았습니다",
                ]);
            }
        } catch (err) {
            setEditLog((l) => [...l, `[error] ${err}`]);
        } finally {
            setIsEditing(false);
        }
    }, [editInput, selected, currentSlide, isEditing, histKey]);

    // Undo/Redo handler
    const handleUndoRedo = useCallback(
        async (action: "undo" | "redo") => {
            if (!selected || !currentSlide || isEditing) return;

            try {
                const res = await fetch("/api/save-slide", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        project: selected,
                        file: currentSlide,
                        action,
                    }),
                });
                const data = await res.json();

                if (data.ok) {
                    setHistoryState((s) => ({
                        ...s,
                        [histKey]: { pointer: data.pointer, total: data.total },
                    }));
                    setIframeKey((k) => k + 1);
                    const label = action === "undo" ? "undo" : "redo";
                    setEditLog((l) => [
                        ...l,
                        `[${label}] 버전 ${data.pointer + 1}/${data.total} 복원`,
                    ]);
                } else {
                    setEditLog((l) => [...l, `[error] ${data.error}`]);
                }
            } catch (err) {
                setEditLog((l) => [...l, `[error] ${err}`]);
            }
        },
        [selected, currentSlide, isEditing, histKey],
    );

    // Save HTML source directly
    const handleSaveHtml = useCallback(async () => {
        if (!selected || !currentSlide || isSavingHtml) return;
        setIsSavingHtml(true);
        try {
            const res = await fetch("/api/save-slide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project: selected,
                    file: currentSlide,
                    html: htmlSource,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setHistoryState((s) => ({
                    ...s,
                    [histKey]: { pointer: data.pointer, total: data.total },
                }));
                setIframeKey((k) => k + 1);
                setHtmlDirty(false);
                setEditLog((l) => [
                    ...l,
                    `[done] HTML 직접 수정 저장 (${data.pointer + 1}/${data.total})`,
                ]);
            }
        } catch (err) {
            setEditLog((l) => [...l, `[error] ${err}`]);
        } finally {
            setIsSavingHtml(false);
        }
    }, [selected, currentSlide, isSavingHtml, htmlSource, histKey]);

    const slideW = 1920;
    const slideH = 1080;

    // Compute fitScale so that scale=1 (100%) fits the slide in the viewport
    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;
        const compute = () => {
            const availW = el.clientWidth - FIT_PADDING * 2;
            const availH = el.clientHeight - FIT_PADDING * 2;
            const fit = Math.min(availW / slideW, availH / slideH);
            setFitScale(Math.max(0.05, fit));
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [editPanelOpen]);

    const renderScale = scale * fitScale;

    // Thumbnail sizing based on sidebar width
    const thumbPad = 30;
    const thumbW = sidebarW - thumbPad;
    const thumbScale = thumbW / slideW;
    const thumbH = slideH * thumbScale;

    const btnClass =
        "w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-sm text-gray-600 border border-gray-200 transition-colors";
    const btnDisabled = "disabled:opacity-25 disabled:hover:bg-white";

    return (
        <div className="fixed inset-0 bg-white text-gray-900 flex overflow-hidden">
            {/* Left Sidebar */}
            <aside
                className="bg-gray-50 border-r border-gray-200 overflow-hidden flex-shrink-0 flex flex-col"
                style={{ width: sidebarW }}
            >
                {/* Project selector */}
                <div
                    className="px-4 py-3 border-b border-gray-200 flex-shrink-0 relative"
                    ref={dropdownRef}
                >
                    <button
                        onClick={() => setDropdownOpen((v) => !v)}
                        className="w-full flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="text-[10px] font-medium text-orange-500 uppercase tracking-wider">
                                Project
                            </span>
                            <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
                                {selected || "선택"}
                            </span>
                        </div>
                        <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>

                    {dropdownOpen && (
                        <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/8 z-30 overflow-hidden">
                            {projects.map((p) => (
                                <button
                                    key={p.name}
                                    onClick={() => {
                                        setSelected(p.name);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                                        p.name === selected
                                            ? "bg-orange-50 text-orange-600"
                                            : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                >
                                    <span className="text-sm font-medium truncate">
                                        {p.name}
                                    </span>
                                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                                        {p.slides.length}장
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Thumbnails */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 flex flex-col gap-2">
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
                                className="pointer-events-none absolute top-0 left-0"
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
            <main
                ref={mainRef}
                className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 relative"
            >
                {currentSlide ? (
                    <div
                        style={{
                            width: slideW * renderScale,
                            height: slideH * renderScale,
                            flexShrink: 0,
                        }}
                    >
                        <iframe
                            key={`${selected}-${currentSlide}-${iframeKey}`}
                            src={`/api/slide?project=${selected}&file=${currentSlide}&_t=${iframeKey}`}
                            style={{
                                width: slideW,
                                height: slideH,
                                transform: `scale(${renderScale})`,
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
                        onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
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

                {/* Zoom bar (horizontal, bottom-right) */}
                <div
                    className="fixed bottom-6 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl px-2 py-1.5 shadow-lg shadow-black/8"
                    style={{ right: editPanelOpen ? EDIT_PANEL_W + 20 : 20 }}
                >
                    <button onClick={zoomOut} className={btnClass}>
                        −
                    </button>
                    <input
                        type="range"
                        min={SCALE_MIN * 100}
                        max={SCALE_MAX * 100}
                        value={scale * 100}
                        onChange={(e) => setScale(Number(e.target.value) / 100)}
                        className="w-28 h-5 appearance-none bg-transparent cursor-pointer accent-orange-500"
                    />
                    <button onClick={zoomIn} className={btnClass}>
                        +
                    </button>
                    <button
                        onClick={zoomFit}
                        className="h-7 px-1.5 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 text-[10px] text-gray-500 border border-gray-200 min-w-[40px] tabular-nums transition-colors"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                </div>

                {/* Edit panel toggle button */}
                {currentSlide && !editPanelOpen && (
                    <button
                        onClick={() => setEditPanelOpen(true)}
                        className="fixed top-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-colors"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                        </svg>
                        수정
                        {isEditing && (
                            <svg
                                className="w-3.5 h-3.5 animate-spin"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    className="opacity-25"
                                />
                                <path
                                    d="M4 12a8 8 0 018-8"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                    </button>
                )}
            </main>

            {/* Right Edit Panel */}
            <div
                className="flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
                style={{ width: editPanelOpen ? EDIT_PANEL_W : 0 }}
            >
                {editPanelOpen && (
                    <>
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-gray-500">
                                    {selected} /{" "}
                                    {currentSlide?.replace(".html", "")}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleUndoRedo("undo")}
                                    disabled={isEditing || !canUndo}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="되돌리기 (Undo)"
                                >
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"
                                        />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleUndoRedo("redo")}
                                    disabled={isEditing || !canRedo}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="다시 실행 (Redo)"
                                >
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"
                                        />
                                    </svg>
                                </button>
                                {hist.total > 0 && (
                                    <span className="text-[10px] text-gray-400 tabular-nums ml-0.5">
                                        {hist.pointer + 1}/{hist.total}
                                    </span>
                                )}
                                <div className="w-px h-4 bg-gray-200 mx-1" />
                                <button
                                    onClick={() => setEditPanelOpen(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 flex-shrink-0">
                            <button
                                onClick={() => setEditTab("ai")}
                                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                                    editTab === "ai"
                                        ? "text-orange-600 border-b-2 border-orange-500"
                                        : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                AI 수정
                            </button>
                            <button
                                onClick={() => setEditTab("html")}
                                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                                    editTab === "html"
                                        ? "text-orange-600 border-b-2 border-orange-500"
                                        : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                HTML
                                {htmlDirty && (
                                    <span className="ml-1 text-orange-500">
                                        *
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Tab content */}
                        {editTab === "ai" ? (
                            <>
                                {/* AI instruction input */}
                                <div className="px-4 pt-4 pb-3 flex-shrink-0">
                                    <textarea
                                        ref={editInputRef}
                                        value={editInput}
                                        onChange={(e) =>
                                            setEditInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" &&
                                                (e.metaKey || e.ctrlKey) &&
                                                !e.nativeEvent.isComposing
                                            ) {
                                                e.preventDefault();
                                                handleEdit();
                                            }
                                        }}
                                        placeholder={
                                            "수정할 내용을 입력하세요...\n\n예: 제목을 더 크게 만들어줘\n예: 배경색을 파란색으로 바꿔줘\n예: 본문 텍스트를 좌측 정렬로 변경"
                                        }
                                        disabled={isEditing}
                                        rows={5}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 resize-none"
                                    />
                                    <button
                                        onClick={handleEdit}
                                        disabled={
                                            isEditing || !editInput.trim()
                                        }
                                        className="w-full mt-3 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isEditing ? (
                                            <>
                                                <svg
                                                    className="w-4 h-4 animate-spin"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                >
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="3"
                                                        className="opacity-25"
                                                    />
                                                    <path
                                                        d="M4 12a8 8 0 018-8"
                                                        stroke="currentColor"
                                                        strokeWidth="3"
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                                수정 중...
                                            </>
                                        ) : (
                                            <>
                                                수정 실행
                                                <kbd className="text-[10px] bg-orange-600/50 px-1.5 py-0.5 rounded font-mono">
                                                    ⌘↵
                                                </kbd>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Log area */}
                                <div className="flex-1 overflow-hidden flex flex-col border-t border-gray-200">
                                    <div className="px-4 py-2 flex-shrink-0 flex items-center gap-1.5">
                                        <div
                                            className={`w-1.5 h-1.5 rounded-full ${isEditing ? "bg-orange-500 animate-pulse" : "bg-gray-300"}`}
                                        />
                                        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                                            Log
                                        </span>
                                    </div>
                                    <div
                                        ref={logRef}
                                        className="flex-1 overflow-y-auto px-4 pb-4 bg-gray-950 mx-3 mb-3 rounded-xl"
                                    >
                                        {editLog.length > 0 ? (
                                            <div className="py-3 text-xs font-mono leading-relaxed space-y-0.5">
                                                {editLog.map((line, i) => (
                                                    <div
                                                        key={i}
                                                        className={
                                                            line.startsWith(">")
                                                                ? "text-orange-400"
                                                                : line.startsWith(
                                                                        "[error]",
                                                                    )
                                                                  ? "text-red-400"
                                                                  : line.startsWith(
                                                                          "[done]",
                                                                      )
                                                                    ? "text-green-400"
                                                                    : line.startsWith(
                                                                            "[undo]",
                                                                        ) ||
                                                                        line.startsWith(
                                                                            "[redo]",
                                                                        )
                                                                      ? "text-yellow-400"
                                                                      : "text-gray-500"
                                                        }
                                                    >
                                                        {line}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center text-xs text-gray-600">
                                                수정 로그가 여기에 표시됩니다
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* HTML source editor */}
                                <div className="flex-1 overflow-hidden flex flex-col">
                                    <textarea
                                        value={htmlSource}
                                        onChange={(e) => {
                                            setHtmlSource(e.target.value);
                                            setHtmlDirty(true);
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "s" &&
                                                (e.metaKey || e.ctrlKey)
                                            ) {
                                                e.preventDefault();
                                                handleSaveHtml();
                                            }
                                            // Allow Tab to insert spaces
                                            if (e.key === "Tab") {
                                                e.preventDefault();
                                                const target =
                                                    e.target as HTMLTextAreaElement;
                                                const start =
                                                    target.selectionStart;
                                                const end = target.selectionEnd;
                                                const val = htmlSource;
                                                setHtmlSource(
                                                    val.substring(0, start) +
                                                        "  " +
                                                        val.substring(end),
                                                );
                                                requestAnimationFrame(() => {
                                                    target.selectionStart =
                                                        target.selectionEnd =
                                                            start + 2;
                                                });
                                                setHtmlDirty(true);
                                            }
                                        }}
                                        spellCheck={false}
                                        className="flex-1 w-full bg-gray-950 text-gray-300 text-xs font-mono leading-relaxed p-4 focus:outline-none resize-none"
                                    />
                                </div>
                                <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0">
                                    <button
                                        onClick={handleSaveHtml}
                                        disabled={!htmlDirty || isSavingHtml}
                                        className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSavingHtml ? (
                                            "저장 중..."
                                        ) : (
                                            <>
                                                저장
                                                <kbd className="text-[10px] bg-orange-600/50 px-1.5 py-0.5 rounded font-mono">
                                                    ⌘S
                                                </kbd>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
