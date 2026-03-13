import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Wand2, Check, Star, X, ChevronRight, Upload, FileText } from "lucide-react";
import { useAnalyzeDocument, useUpdateKeywordSelections, useGenerateCards } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type Stage = "input" | "keywords" | "generating";

interface Keyword {
  id: number;
  word: string;
  isSelected: boolean;
  isCore?: boolean;
  count?: number;
  context?: string;
}

/* ─────────────────────────────────────────────
   Utility: count occurrences + get first context
───────────────────────────────────────────── */
function enrichKeywords(keywords: { id: number; word: string; isSelected: boolean }[], content: string): Keyword[] {
  return keywords.map((kw) => {
    const regex = new RegExp(kw.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = [...content.matchAll(regex)];
    const count = matches.length;
    let context = "";
    if (matches.length > 0 && matches[0].index !== undefined) {
      const idx = matches[0].index;
      const start = Math.max(0, idx - 20);
      const end = Math.min(content.length, idx + kw.word.length + 40);
      context = (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
    }
    return { ...kw, count, context, isCore: false };
  });
}

/* ─────────────────────────────────────────────
   Highlight text with keyword marks
───────────────────────────────────────────── */
function HighlightedText({
  content,
  keywords,
  hoveredKeyword,
  activeKeyword,
}: {
  content: string;
  keywords: Keyword[];
  hoveredKeyword: number | null;
  activeKeyword: number | null;
}) {
  const selectedWords = keywords.filter((k) => k.isSelected).map((k) => k.word);
  const hoveredWord = keywords.find((k) => k.id === hoveredKeyword)?.word ?? null;
  const activeWord = keywords.find((k) => k.id === activeKeyword)?.word ?? null;

  if (selectedWords.length === 0) {
    return (
      <p className="notion-body whitespace-pre-wrap leading-relaxed text-[15px] text-gray-700">
        {content}
      </p>
    );
  }

  const allWords = Array.from(new Set(selectedWords));
  const pattern = allWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = content.split(regex);

  let firstActiveRendered = false;

  return (
    <p className="notion-body whitespace-pre-wrap leading-[1.75] text-[15px] text-[#37352f]">
      {parts.map((part, i) => {
        const matchedKw = allWords.find((w) => w.toLowerCase() === part.toLowerCase());
        if (!matchedKw) return <span key={i}>{part}</span>;

        const kw = keywords.find((k) => k.word.toLowerCase() === matchedKw.toLowerCase());
        const isHovered = hoveredWord?.toLowerCase() === part.toLowerCase();
        const isActive = activeWord?.toLowerCase() === part.toLowerCase();
        const isFirstActive = isActive && !firstActiveRendered;
        if (isFirstActive) firstActiveRendered = true;

        return (
          <mark
            key={i}
            data-keyword={kw?.id}
            id={isFirstActive ? `kw-first-${kw?.id}` : undefined}
            className={[
              "rounded-[3px] px-[2px] transition-all duration-300",
              isHovered
                ? "bg-[#e8f3ff] text-[#1a6cf6] ring-1 ring-[#1a6cf6]/30 scale-[1.03]"
                : isActive
                ? "bg-[#fef3c7] text-[#92400e] ring-1 ring-[#f59e0b]/40 scale-[1.02]"
                : kw?.isCore
                ? "bg-[#ede9fe] text-[#5b21b6]"
                : "bg-[#e0f2fe] text-[#0369a1]",
            ].join(" ")}
          >
            {part}
          </mark>
        );
      })}
    </p>
  );
}

/* ─────────────────────────────────────────────
   Step progress bar
───────────────────────────────────────────── */
function StepBar({ stage }: { stage: Stage }) {
  const steps = [
    { key: "input", label: "输入文本", num: 1 },
    { key: "keywords", label: "意图过滤", num: 2 },
    { key: "generating", label: "生成卡片", num: 3 },
  ];
  const stageOrder: Record<Stage, number> = { input: 0, keywords: 1, generating: 2 };
  const current = stageOrder[stage];

  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => {
        const done = stageOrder[s.key as Stage] < current;
        const active = stageOrder[s.key as Stage] === current;
        return (
          <div key={s.key} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
                  done
                    ? "bg-[#6366f1] text-white"
                    : active
                    ? "bg-[#6366f1] text-white ring-4 ring-[#6366f1]/20"
                    : "bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span
                className={[
                  "text-[11px] font-medium whitespace-nowrap",
                  active ? "text-[#6366f1]" : done ? "text-[#6366f1]/70" : "text-gray-400",
                ].join(" ")}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "h-[1.5px] flex-1 mx-2 mb-5 rounded-full transition-all duration-500",
                  done || (active && i === 0) ? "bg-[#6366f1]/40" : "bg-gray-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Skeleton loader for sidebar list
───────────────────────────────────────────── */
function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="w-4 h-4 rounded bg-gray-200 mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-2/3" />
        <div className="h-2.5 bg-gray-100 rounded w-full" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export default function Analyze() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("input");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [hoveredKeyword, setHoveredKeyword] = useState<number | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const textRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeDocMutation = useAnalyzeDocument();
  const updateKeywordsMutation = useUpdateKeywordSelections();
  const generateCardsMutation = useGenerateCards();

  /* ── Drag & drop ── */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent((ev.target?.result as string) ?? "");
      setTitle(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsText(file, "utf-8");
  }, []);

  /* ── Analyze ── */
  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast({ title: "请先输入或粘贴文本", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await analyzeDocMutation.mutateAsync({
        data: { title: title || "未命名文档", content },
      });
      setDocumentId(res.documentId);
      setKeywords(enrichKeywords(res.keywords, content));
      // small delay so skeleton shows
      await new Promise((r) => setTimeout(r, 400));
      setStage("keywords");
    } catch (err: any) {
      toast({ title: "解析失败", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Keyword sidebar actions ── */
  const toggleKeyword = (id: number) =>
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, isSelected: !k.isSelected } : k)));

  const toggleCore = (id: number) =>
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, isCore: !k.isCore } : k)));

  const excludeKeyword = (id: number) =>
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, isSelected: false } : k)));

  /* ── Click on sidebar item → scroll left panel ── */
  const handleKeywordClick = (id: number) => {
    setActiveKeyword(id);
    setTimeout(() => {
      const el = textRef.current?.querySelector(`#kw-first-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setActiveKeyword(null), 2000);
  };

  /* ── Generate cards ── */
  const handleGenerateCards = async () => {
    if (!documentId) return;
    const selectedIds = keywords.filter((k) => k.isSelected).map((k) => k.id);
    if (selectedIds.length === 0) {
      toast({ title: "请至少选择一个知识点", variant: "destructive" });
      return;
    }
    setStage("generating");
    try {
      await updateKeywordsMutation.mutateAsync({ documentId, data: { selectedIds } });
      const res = await generateCardsMutation.mutateAsync({ data: { documentId, keywordIds: selectedIds } });
      toast({ title: "生成成功", description: `已生成 ${res.total} 张候选卡片` });
      setTimeout(() => setLocation("/validate"), 1200);
    } catch (err: any) {
      toast({ title: "生成失败", description: err.message, variant: "destructive" });
      setStage("keywords");
    }
  };

  const selectedCount = keywords.filter((k) => k.isSelected).length;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Top bar ── */}
      <div className="shrink-0 px-8 pt-8 pb-0">
        <StepBar stage={stage} />
      </div>

      {/* ── Stages ── */}
      <AnimatePresence mode="wait">
        {/* ════ STAGE 1: INPUT ════ */}
        {stage === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 flex flex-col items-center justify-center px-8 pb-8"
          >
            <div className="w-full max-w-2xl">
              {/* Notion-style page title input */}
              <input
                type="text"
                placeholder="无标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-3xl font-bold text-[#37352f] placeholder-gray-300 border-none outline-none bg-transparent mb-4 leading-tight"
                style={{ fontFamily: "inherit" }}
              />

              {/* Large editor zone */}
              <div
                className={[
                  "relative w-full min-h-[320px] rounded-xl border transition-all duration-200",
                  isDragOver
                    ? "border-[#6366f1] bg-[#f5f3ff] shadow-lg shadow-[#6366f1]/10"
                    : "border-gray-200 bg-gray-50/50 hover:border-gray-300",
                ].join(" ")}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <textarea
                  className="w-full h-full min-h-[320px] p-5 bg-transparent border-none outline-none resize-none text-[15px] leading-[1.75] text-[#37352f] placeholder-gray-400"
                  placeholder={"在此粘贴你的学习材料，或将文本文件拖拽至此…\n\n支持：笔记、教材段落、文章节选、论文摘要等"}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{ fontFamily: "inherit" }}
                />
                {/* Drag overlay hint */}
                {isDragOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[#f5f3ff]/80 pointer-events-none">
                    <Upload className="w-8 h-8 text-[#6366f1] mb-2" />
                    <p className="text-sm font-medium text-[#6366f1]">松开以上传文件</p>
                  </div>
                )}
              </div>

              {/* Helper row */}
              <div className="flex items-center justify-between mt-3 mb-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  上传 .txt 文件
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setContent((ev.target?.result as string) ?? "");
                    setTitle(file.name.replace(/\.[^.]+$/, ""));
                  };
                  reader.readAsText(file, "utf-8");
                }} />
                <span className="text-xs text-gray-300">{content.length} 字</span>
              </div>

              {/* Primary CTA */}
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !content.trim()}
                className={[
                  "w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                  "bg-[#6366f1] text-white shadow-sm hover:bg-[#5254cc] hover:shadow-md active:scale-[0.99]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {isLoading ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin" />
                    正在解析…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    开始解析
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ════ STAGE 2: KEYWORDS (split layout) ════ */}
        {stage === "keywords" && (
          <motion.div
            key="keywords"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 flex overflow-hidden"
          >
            {/* LEFT: original text with highlights */}
            <div ref={textRef} className="flex-1 overflow-y-auto px-10 py-8 border-r border-gray-100">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-[#37352f] mb-1">{title || "文档内容"}</h2>
                <p className="text-xs text-gray-400 mb-6">
                  {keywords.filter((k) => k.isSelected).length} 个知识点已高亮
                </p>
                <HighlightedText
                  content={content}
                  keywords={keywords}
                  hoveredKeyword={hoveredKeyword}
                  activeKeyword={activeKeyword}
                />
              </div>
            </div>

            {/* RIGHT: keyword sidebar */}
            <div className="w-[340px] shrink-0 flex flex-col bg-white border-l border-gray-100 shadow-[-4px_0_20px_rgba(0,0,0,0.03)]">
              {/* Sidebar header */}
              <div className="px-5 pt-6 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-semibold text-[#37352f]">提取的知识点</h3>
                  <span className="text-xs text-[#6366f1] font-medium bg-[#f0f0ff] px-2 py-0.5 rounded-full">
                    已选 {selectedCount} / {keywords.length}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">鼠标悬停可在原文中定位，点击可聚焦跳转</p>
              </div>

              {/* Keyword list */}
              <div className="flex-1 overflow-y-auto py-2">
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)
                  : keywords.map((kw) => (
                    <KeywordRow
                      key={kw.id}
                      kw={kw}
                      isHovered={hoveredKeyword === kw.id}
                      onHover={() => setHoveredKeyword(kw.id)}
                      onLeave={() => setHoveredKeyword(null)}
                      onClick={() => handleKeywordClick(kw.id)}
                      onToggle={() => toggleKeyword(kw.id)}
                      onCore={() => toggleCore(kw.id)}
                      onExclude={() => excludeKeyword(kw.id)}
                    />
                  ))}
              </div>

              {/* Sidebar footer CTA */}
              <div className="px-5 py-4 border-t border-gray-100 bg-white">
                <button
                  onClick={handleGenerateCards}
                  disabled={selectedCount === 0}
                  className={[
                    "w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                    "bg-[#6366f1] text-white shadow-sm hover:bg-[#5254cc] hover:shadow-md active:scale-[0.99]",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  确认选择，继续生成卡片
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setStage("input")}
                  className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  返回修改文本
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════ STAGE 3: GENERATING ════ */}
        {stage === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center justify-center gap-5"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-[#6366f1]/20 blur-2xl animate-pulse" />
              <div className="w-16 h-16 rounded-2xl bg-[#6366f1] flex items-center justify-center shadow-lg shadow-[#6366f1]/30 relative z-10">
                <Wand2 className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-[#37352f] mb-1">AI 正在构思卡片…</h3>
              <p className="text-sm text-gray-400">基于上下文为您构建高质量的问答对，请稍候</p>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#6366f1]/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────
   KeywordRow sub-component
───────────────────────────────────────────── */
function KeywordRow({
  kw,
  isHovered,
  onHover,
  onLeave,
  onClick,
  onToggle,
  onCore,
  onExclude,
}: {
  kw: Keyword;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onToggle: () => void;
  onCore: () => void;
  onExclude: () => void;
}) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={[
        "group flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 border-l-2",
        isHovered
          ? "bg-[#f5f3ff] border-l-[#6366f1]"
          : kw.isSelected
          ? "bg-transparent border-l-transparent hover:bg-gray-50"
          : "bg-transparent border-l-transparent opacity-50 hover:opacity-80 hover:bg-gray-50",
      ].join(" ")}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={[
          "mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-all duration-150",
          kw.isSelected
            ? "bg-[#6366f1] border-[#6366f1]"
            : "bg-white border-gray-300 hover:border-[#6366f1]",
        ].join(" ")}
      >
        {kw.isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={["text-sm font-semibold leading-snug", kw.isSelected ? "text-[#37352f]" : "text-gray-400"].join(" ")}>
            {kw.word}
          </span>
          {kw.isCore && (
            <span className="text-[10px] bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-medium">核心</span>
          )}
          {kw.count !== undefined && kw.count > 0 && (
            <span className="text-[10px] text-gray-400">×{kw.count}</span>
          )}
        </div>
        {kw.context && (
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{kw.context}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onCore(); }}
          title={kw.isCore ? "取消核心" : "标为核心"}
          className={["w-6 h-6 rounded flex items-center justify-center transition-colors",
            kw.isCore ? "text-[#d97706] hover:bg-[#fef3c7]" : "text-gray-300 hover:text-[#d97706] hover:bg-[#fef3c7]"
          ].join(" ")}
        >
          <Star className="w-3 h-3" fill={kw.isCore ? "currentColor" : "none"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExclude(); }}
          title="排除此知识点"
          className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
