import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  getGetDocumentKeywordsQueryKey,
  getGetPendingCardsQueryKey,
  getListDocumentsQueryKey,
  useGenerateCards,
  useGetDocumentKeywords,
  useListDocuments,
  useUpdateKeywordSelections,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FileText, Sparkles, Upload, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCardValidation } from "@/components/document-card-validation";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";

export default function MaterialDetail() {
  const [, params] = useRoute<{ id: string }>("/materials/:id");
  const id = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationRef = useRef<HTMLElement | null>(null);

  const {
    data: documentsData,
    isLoading: isDocsLoading,
  } = useListDocuments();

  const currentDocument = useMemo(() => {
    if (!documentsData || !id) return undefined;
    return documentsData.documents.find((doc) => String(doc.id) === id);
  }, [documentsData, id]);

  const {
    data: keywordsData,
    isLoading: isKeywordsLoading,
  } = useGetDocumentKeywords(id);

  const updateKeywordsMutation = useUpdateKeywordSelections();
  const generateCardsMutation = useGenerateCards();

  const isLoading = isDocsLoading || (id !== "" && isKeywordsLoading);
  const hasError = !isLoading && !currentDocument;
  const hasKeywords = (keywordsData?.keywords?.length ?? 0) > 0;
  const hasContent = Boolean(currentDocument?.content?.trim());
  const canGenerate = hasKeywords && hasContent;
  const showAnalyzePanel = !canGenerate;

  useEffect(() => {
    if (!keywordsData?.keywords) return;
    const selected = keywordsData.keywords
      .filter((kw) => kw.isSelected)
      .map((kw) => String(kw.id));
    setSelectedIds(selected);
  }, [keywordsData]);

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
      setDraftContent((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleAnalyze = async () => {
    if (!id) return;
    if (!draftContent.trim()) {
      toast({ title: "请先粘贴或导入文本", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const analyzeRes = await authedFetch("/api/documents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id, text: draftContent }),
      });
      if (!analyzeRes.ok) {
        throw new Error(await parseErrorMessage(analyzeRes));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetDocumentKeywordsQueryKey(id),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetPendingCardsQueryKey({ documentId: id }),
        }),
      ]);

      toast({
        title: "解析成功",
        description: "现在可以选择关键词、生成候选卡片，并直接在当前页面完成校验。",
      });
    } catch (error: any) {
      toast({
        title: "解析失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleKeyword = (keywordId: string) => {
    setSelectedIds((prev) =>
      prev.includes(keywordId)
        ? prev.filter((idValue) => idValue !== keywordId)
        : [...prev, keywordId],
    );
  };

  const handleGenerateCards = async () => {
    if (!id) return;
    if (!canGenerate) {
      toast({
        title: "请先完成材料解析",
        description: "当前材料尚未生成可用关键词或原文内容为空。",
        variant: "destructive",
      });
      return;
    }
    if (selectedIds.length === 0) {
      toast({ title: "请先选择关键词", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      await updateKeywordsMutation.mutateAsync({
        documentId: id,
        data: { selectedIds } as never,
      });
      const res = await generateCardsMutation.mutateAsync({
        data: { documentId: id, keywordIds: selectedIds } as never,
      });
      await queryClient.invalidateQueries({
        queryKey: getGetPendingCardsQueryKey({ documentId: id }),
      });
      toast({ title: "生成成功", description: `已生成 ${res.total} 张候选卡片` });
      window.requestAnimationFrame(() => {
        validationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error: any) {
      toast({
        title: "生成失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
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
                <span>阅读材料 · ID {id}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                {currentDocument?.title ?? "阅读材料详情"}
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                在当前页面完成材料解析、关键词选择、候选卡片生成与校验。
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </section>
            <section className="space-y-4">
              <Skeleton className="h-40 w-full rounded-2xl" />
            </section>
          </div>
        )}

        {hasError && !isLoading && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            找不到对应的阅读材料，可能已被删除或链接有误。
          </div>
        )}

        {!isLoading && currentDocument && (
          <div className="space-y-6">
            {showAnalyzePanel ? (
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-2xl border border-dashed border-border/70 bg-card/70 p-4 md:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      <span>粘贴或导入阅读材料后开始解析</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{draftContent.length} 字</span>
                  </div>

                  <div
                    className={[
                      "relative mt-4 min-h-[260px] rounded-xl border bg-background transition-all duration-200",
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
                      className="min-h-[260px] w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
                      placeholder={"在此粘贴你的学习材料，或将文本文件拖拽至此…\n\n支持：笔记、教材段落、文章节选、论文摘要等"}
                      value={draftContent}
                      onChange={(e) => setDraftContent(e.target.value)}
                    />
                    {isDragOver && (
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-primary/5">
                        <Upload className="mb-2 h-6 w-6 text-primary" />
                        <p className="text-xs font-medium text-primary">松开以上传文件</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        上传 .txt / .md 文件
                      </button>
                      <span className="text-muted-foreground/60">·</span>
                      <span>解析后会在当前页面继续后续操作</span>
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
                          setDraftContent((ev.target?.result as string) ?? "");
                        };
                        reader.readAsText(file, "utf-8");
                      }}
                    />

                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !draftContent.trim()}
                    >
                      {isAnalyzing ? (
                        <>
                          <Wand2 className="h-4 w-4 animate-spin" />
                          正在解析…
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4" />
                          导入并解析
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <section className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      <span>当前状态</span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>该文档还没有完成首次解析。</p>
                      <p>解析完成后会在本页展示原文、关键词和候选卡片校验区。</p>
                    </div>
                  </div>
                </section>
              </section>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <section className="lg:col-span-2 space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">原文内容</h2>
                    <div className="max-h-[480px] min-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-card/80 p-4 text-sm leading-relaxed text-muted-foreground">
                      {currentDocument.content}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>关键词与生成卡片</span>
                        </div>
                        {keywordsData && (
                          <span className="text-[11px] text-muted-foreground">
                            共 {keywordsData.keywords.length} 个关键词
                          </span>
                        )}
                      </div>

                      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                        {keywordsData?.keywords.map((kw) => {
                          const keywordId = String(kw.id);
                          return (
                            <button
                              key={kw.id}
                              type="button"
                              onClick={() => toggleKeyword(keywordId)}
                            >
                              <Badge
                                variant={selectedIds.includes(keywordId) ? "default" : "outline"}
                                className="text-[11px]"
                              >
                                {kw.word}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        className="mt-2 w-full"
                        onClick={handleGenerateCards}
                        disabled={!canGenerate || selectedIds.length === 0 || isGenerating}
                      >
                        {isGenerating ? "生成中..." : "生成候选卡片"}
                      </Button>
                    </div>
                  </section>
                </div>

                <section ref={validationRef}>
                  <DocumentCardValidation documentId={id} />
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
