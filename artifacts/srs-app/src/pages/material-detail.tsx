import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useListDocuments, useGetDocumentKeywords } from "@workspace/api-client-react";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialDetail() {
  const [, params] = useRoute<{ id: string }>("/materials/:id");
  const id = params?.id ?? "";
  const numericId = Number.isNaN(Number(id)) ? undefined : Number(id);

  const {
    data: documentsData,
    isLoading: isDocsLoading,
  } = useListDocuments();

  const currentDocument = useMemo(() => {
    if (!documentsData || !numericId) return undefined;
    return documentsData.documents.find((doc) => doc.id === numericId);
  }, [documentsData, numericId]);

  const {
    data: keywordsData,
    isLoading: isKeywordsLoading,
  } = useGetDocumentKeywords(
    numericId
      ? {
          params: { documentId: numericId },
        }
      : // @ts-expect-error: orval hook currently requires params, guarded by enabled
        undefined,
    {
      query: {
        enabled: !!numericId,
      },
    },
  );

  const isLoading = isDocsLoading || (numericId != null && isKeywordsLoading);
  const hasError = !isLoading && !currentDocument;

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
                左侧是原文内容，右侧展示从分析流程得到的关键词，并可跳转到卡片校验与继续解析。
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
                    <Badge key={kw.id} variant={kw.isSelected ? "default" : "outline"} className="text-[11px]">
                      {kw.word}
                    </Badge>
                  ))}
                  {!keywordsData && (
                    <p className="text-xs text-muted-foreground">
                      暂无关键词数据，可以前往解析页重新生成。
                    </p>
                  )}
                </div>

                <Button className="w-full mt-2" asChild>
                  <Link href={`/validate?documentId=${id}`}>跳转到卡片校验</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/analyze">从其它材料继续解析</Link>
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
