import { useRoute, Link } from "wouter";
import { ArrowLeft, Layers, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeckDetail() {
  const [, params] = useRoute<{ id: string }>("/decks/:id");
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
                <Layers className="w-3.5 h-3.5" />
                <span>卡片组 · ID {id}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                卡片组详情（示例占位）
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                这里将展示卡片组名称、统计信息以及卡片列表，并提供一键开始复习。
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" asChild>
            <Link href={`/review?deckId=${id}`}>
              <Play className="w-4 h-4" />
              <span>开始复习</span>
            </Link>
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">卡片预览（示例）</h2>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            未来这里会从后端加载该卡片组下的全部卡片。在接入 API 之前，当前实现主要用于验证 NotebookLM 风格的路由与布局。
          </div>
        </section>
      </div>
    </div>
  );
}

