import { useRoute, Link } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MaterialDetail() {
  const [, params] = useRoute<{ id: string }>("/materials/:id");
  const id = params?.id ?? "";

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
                阅读材料详情（示例占位）
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                这里将展示从后端加载的原文内容、关键词列表，以及生成卡片的入口。
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">原文内容（示例）</h2>
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm leading-relaxed text-muted-foreground min-h-[200px]">
              未来这里会根据材料 ID 从后端加载真实内容。目前为 NotebookLM 风格布局的占位文本，用于验证路由与整体信息架构。
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="text-sm font-semibold mb-2">关键词与生成卡片</h3>
              <p className="text-xs text-muted-foreground mb-3">
                这里将展示从分析流程得到的关键词，并支持一键生成或跳转到校验页面。
              </p>
              <Button className="w-full mb-2" asChild>
                <Link href={`/validate?sourceId=${id}`}>跳转到卡片校验</Link>
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/analyze">从其它材料继续解析</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

