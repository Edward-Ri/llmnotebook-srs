import { useMemo, useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useListDocuments,
  useGetDocumentKeywords,
  useUpdateKeywordSelections,
  useGenerateCards,
} from "@workspace/api-client-react";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function MaterialDetail() {
  const [, params] = useRoute<{ id: string }>("/materials/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

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

  useEffect(() => {
    if (!keywordsData?.keywords) return;
    const selected = keywordsData.keywords
      .filter((kw) => kw.isSelected)
      .map((kw) => kw.id);
    setSelectedIds(selected);
  }, [keywordsData]);

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
      await updateKeywordsMutation.mutateAsync({ documentId: id, data: { selectedIds } });
      const res = await generateCardsMutation.mutateAsync({
        data: { documentId: id, keywordIds: selectedIds },
      });
      toast({ title: "生成成功", description: `已生成 ${res.total} 张候选卡片` });
      setLocation(`/validate?documentId=${id}`);
    } catch (error: any) {
      toast({ title: "生成失败", description: error?.message ?? "请稍后重试", variant: "destructive" });
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
                右侧点击关键词进行选择，批量生成并进入卡片校验。
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">原文内容</h2>
              <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm leading-relaxed text-muted-foreground min-h-[220px] max-h-[480px] overflow-y-auto whitespace-pre-wrap">
                {currentDocument.content}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>关键词与生成卡片</span>
                  </div>
                  {keywordsData && (
                    <span className="text-[11px] text-muted-foreground">
                      共 {keywordsData.keywords.length} 个关键词
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {keywordsData?.keywords.map((kw) => (
                    <button key={kw.id} type="button" onClick={() => toggleKeyword(kw.id)}>
                      <Badge
                        variant={selectedIds.includes(kw.id) ? "default" : "outline"}
                        className="text-[11px]"
                      >
                        {kw.word}
                      </Badge>
                    </button>
                  ))}
                  {!keywordsData && (
                    <p className="text-xs text-muted-foreground">
                      暂无关键词数据，可以前往解析页重新生成。
                    </p>
                  )}
                </div>

                {!canGenerate && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    当前材料尚未解析完成，请先前往解析页生成关键词与文本结构。
                    <div className="mt-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/analyze">前往解析</Link>
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full mt-2"
                  onClick={handleGenerateCards}
                  disabled={!canGenerate || selectedIds.length === 0 || isGenerating}
                >
                  {isGenerating ? "生成中..." : "批量生成并进入卡片校验"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
