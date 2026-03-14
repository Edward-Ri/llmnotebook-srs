import { useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Plus, Upload, FileText, ArrowLeft, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function NewMaterialNotebook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("Untitled notebook");
  const [content, setContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseErrorMessage = async (res: Response) => {
    const raw = await res.text();
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.map((item) => item?.message).filter(Boolean).join("；") || raw;
      }
      return data?.message ?? data?.error ?? raw;
    } catch {
      return raw || "请求失败";
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleImport = async () => {
    if (!content.trim()) {
      toast({ title: "请先粘贴或导入文本", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const createRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "未命名文档" }),
      });
      if (!createRes.ok) {
        throw new Error(await parseErrorMessage(createRes));
      }
      const created = await createRes.json();
      const documentId = created?.document?.id;
      if (!documentId) {
        throw new Error("创建文档失败：缺少 documentId");
      }

      const analyzeRes = await fetch("/api/documents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, text: content }),
      });
      if (!analyzeRes.ok) {
        throw new Error(await parseErrorMessage(analyzeRes));
      }
      const res = await analyzeRes.json();

      toast({
        title: "Notebook 已创建",
        description: "已为该 Notebook 提取初始关键词，可以继续在详情页操作。",
      });

      await queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setLocation(`/materials/${res.documentId ?? documentId}`);
    } catch (err: any) {
      toast({
        title: "导入失败",
        description: err?.message ?? "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Header: back + title */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild size="icon" variant="ghost" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>新建 Notebook</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xl md:text-2xl font-semibold tracking-tight bg-transparent border-none outline-none focus:ring-0 p-0"
              />
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                先创建一本文档 Notebook，随后在下方添加来源进行文本分析和生成卡片。
              </p>
            </div>
          </div>
        </div>

        {/* Layout: left sources + right import panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sources column */}
          <section className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>来源</span>
                </div>
                <span className="text-[11px] text-muted-foreground">0 个来源</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center gap-1.5"
                onClick={() => {
                  const el = document.getElementById("import-panel");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                添加来源
              </Button>
              <p className="text-[11px] text-muted-foreground">
                支持从长文本、摘录或外部文档中导入内容作为 Notebook 的知识来源。
              </p>
            </div>
          </section>

          {/* Import panel */}
          <section
            id="import-panel"
            className="lg:col-span-2 rounded-2xl border border-dashed border-border/70 bg-card/70 p-4 md:p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Upload className="w-3.5 h-3.5 text-primary" />
                <span>根据以下内容生成 Notebook 来源</span>
              </div>
            </div>

            <div
              className={[
                "relative w-full min-h-[220px] rounded-xl border transition-all duration-200 bg-background",
                isDragOver
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border hover:border-border/80",
              ].join(" ")}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <textarea
                className="w-full h-full min-h-[220px] p-4 bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70"
                placeholder={"在此粘贴你的学习材料，或将文本文件拖拽至此…\n\n支持：笔记、教材段落、文章节选、论文摘要等"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {isDragOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-primary/5 pointer-events-none">
                  <Upload className="w-6 h-6 text-primary mb-2" />
                  <p className="text-xs font-medium text-primary">松开以上传文件</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FileText className="w-3.5 h-3.5" />
                  上传 .txt / .md 文件
                </button>
                <span className="text-muted-foreground/60">·</span>
                <span>{content.length} 字</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setContent((ev.target?.result as string) ?? "");
                  };
                  reader.readAsText(file, "utf-8");
                }}
              />

              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleImport}
                disabled={isImporting || !content.trim()}
              >
                {isImporting ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin" />
                    正在分析…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    导入并分析
                  </>
                )}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
