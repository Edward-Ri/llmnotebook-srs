import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Play, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type DeckCard = {
  id: string;
  frontContent: string;
  backContent: string;
  status: string;
  keywordId: string | null;
  keyword?: string;
  dueDate?: string;
  documentId?: string | null;
  documentTitle?: string | null;
};

type DeckDetailResponse = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  totalCards: number;
  dueCards: number;
  cards: DeckCard[];
};

function useDeckDetail(id: string | undefined) {
  return useQuery<DeckDetailResponse>({
    queryKey: ["deck-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/decks/${id}`);
      if (!res.ok) {
        throw new Error("无法加载卡片组详情");
      }
      return (await res.json()) as DeckDetailResponse;
    },
  });
}

export default function DeckDetail() {
  const [, params] = useRoute<{ id: string }>("/decks/:id");
  const id = params?.id ?? "";

  const { data, isLoading, error } = useDeckDetail(id || undefined);

  const deck = data;

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
                {deck?.name ?? "卡片组详情"}
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                查看该卡片组下的卡片列表与统计信息，并可一键开始只针对本组的复习。
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" asChild disabled={!deck}>
            <Link href={`/review?deckId=${id}`}>
              <Play className="w-4 h-4" />
              <span>开始复习</span>
            </Link>
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            无法加载卡片组详情，请稍后重试。
          </div>
        )}

        {deck && (
          <>
            <section className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>总卡片</span>
                  <span className="text-lg font-semibold text-foreground">{deck.totalCards}</span>
                </div>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>待复习</span>
                  <span className="text-lg font-semibold text-primary">{deck.dueCards}</span>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>最近更新于 {new Date(deck.updatedAt).toLocaleString()}</span>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">卡片列表</h2>
              {deck.cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-4 text-xs text-muted-foreground">
                  该卡片组暂时还没有卡片，可以在校验页面将卡片分配到本组。
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {deck.cards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-border/60 bg-card/80 p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>卡片 #{card.id}</span>
                        </Badge>
                        {card.keyword && (
                          <Badge variant="secondary" className="text-[11px]">
                            {card.keyword}
                          </Badge>
                        )}
                      </div>
                      {card.documentTitle && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span className="truncate" title={card.documentTitle ?? undefined}>
                            来自：{card.documentTitle}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 text-sm font-medium text-foreground line-clamp-3">
                        {card.frontContent}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {card.backContent}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
