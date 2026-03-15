import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers, Play, Clock, BookOpen, Pencil, Trash2 } from "lucide-react";
import { getListDecksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";

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
  newCards?: number;
  reviewedToday?: number;
  cards: DeckCard[];
};

function useDeckDetail(id: string | undefined) {
  return useQuery<DeckDetailResponse>({
    queryKey: ["deck-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await authedFetch(`/api/decks/${id}`);
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [editingCard, setEditingCard] = useState<DeckCard | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const deleteCardsBatchMutation = useMutation({
    mutationFn: async (payload: { deckId: string; ids: string[] }) => {
      const res = await authedFetch("/api/cards/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "批量删除卡片失败");
      }
      return (await res.json()) as { deleted: number };
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: async (payload: { cardId: string; frontContent: string; backContent: string }) => {
      const res = await authedFetch(`/api/cards/${payload.cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontContent: payload.frontContent,
          backContent: payload.backContent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "更新卡片失败");
      }
      return (await res.json()) as DeckCard;
    },
  });
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await authedFetch(`/api/cards/${cardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "删除卡片失败");
      }
      return (await res.json()) as { deleted: number };
    },
  });

  const deck = data;
  const cardIds = useMemo(() => deck?.cards.map((card) => card.id) ?? [], [deck?.cards]);
  const allSelected = cardIds.length > 0 && selectedCardIds.length === cardIds.length;

  const refreshDeckData = async (deckId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["deck-detail", deckId] }),
      queryClient.invalidateQueries({ queryKey: getListDecksQueryKey() }),
    ]);
  };

  useEffect(() => {
    setSelectedCardIds([]);
  }, [id, deck?.updatedAt, deck?.totalCards]);

  useEffect(() => {
    if (!editingCard) return;
    setEditFront(editingCard.frontContent);
    setEditBack(editingCard.backContent);
  }, [editingCard]);

  const toggleCard = (cardId: string, checked: boolean) => {
    setSelectedCardIds((prev) =>
      checked ? Array.from(new Set([...prev, cardId])) : prev.filter((id) => id !== cardId),
    );
  };

  const toggleAllCards = (checked: boolean) => {
    setSelectedCardIds(checked ? cardIds : []);
  };

  const handleDeleteSelected = async () => {
    if (!deck || selectedCardIds.length === 0) return;
    if (!window.confirm(`确定删除已选中的 ${selectedCardIds.length} 张卡片吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const result = await deleteCardsBatchMutation.mutateAsync({
        deckId: deck.id,
        ids: selectedCardIds,
      });

      await refreshDeckData(deck.id);
      setSelectedCardIds([]);
      toast({
        title: "已删除卡片",
        description: `成功删除 ${result.deleted} 张卡片`,
      });
    } catch (deleteError: any) {
      toast({
        title: "删除失败",
        description: deleteError?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleSaveCard = async () => {
    if (!deck || !editingCard) return;
    const frontContent = editFront.trim();
    const backContent = editBack.trim();

    if (!frontContent || !backContent) {
      toast({
        title: "内容不能为空",
        description: "卡片正反面都需要填写内容。",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateCardMutation.mutateAsync({
        cardId: editingCard.id,
        frontContent,
        backContent,
      });
      await refreshDeckData(deck.id);
      setEditingCard(null);
      toast({
        title: "已保存卡片修改",
        description: "卡片内容已更新。",
      });
    } catch (saveError: any) {
      toast({
        title: "保存失败",
        description: saveError?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCard = async (card: DeckCard) => {
    if (!deck) return;
    if (!window.confirm("确定删除这张卡片吗？此操作不可撤销。")) {
      return;
    }

    try {
      const result = await deleteCardMutation.mutateAsync(card.id);
      await refreshDeckData(deck.id);
      setSelectedCardIds((prev) => prev.filter((id) => id !== card.id));
      if (editingCard?.id === card.id) {
        setEditingCard(null);
      }
      toast({
        title: "已删除卡片",
        description: `成功删除 ${result.deleted} 张卡片`,
      });
    } catch (deleteError: any) {
      toast({
        title: "删除失败",
        description: deleteError?.message ?? "请稍后重试",
        variant: "destructive",
      });
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
                  <span>新卡</span>
                  <span className="text-lg font-semibold text-foreground">{deck.newCards ?? 0}</span>
                </div>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>待复习</span>
                  <span className="text-lg font-semibold text-primary">{deck.dueCards}</span>
                </div>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>今日已背诵</span>
                  <span className="text-lg font-semibold text-foreground">{deck.reviewedToday ?? 0}</span>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                <span>最近更新于 {new Date(deck.updatedAt).toLocaleString()}</span>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">卡片列表</h2>
                {deck.cards.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
                      <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAllCards(checked === true)} />
                      <span>全选本组</span>
                    </label>
                    <Badge variant="outline" className="text-[11px]">
                      已选 {selectedCardIds.length} / {deck.cards.length}
                    </Badge>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={selectedCardIds.length === 0 || deleteCardsBatchMutation.isPending}
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{deleteCardsBatchMutation.isPending ? "删除中..." : "删除所选"}</span>
                    </Button>
                  </div>
                )}
              </div>
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
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={selectedCardIds.includes(card.id)}
                            onCheckedChange={(checked) => toggleCard(card.id, checked === true)}
                            aria-label={`选择卡片 ${card.id}`}
                          />
                          <Badge variant="outline" className="text-[11px] flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            <span>卡片 #{card.id}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {card.keyword && (
                            <Badge variant="secondary" className="text-[11px]">
                              {card.keyword}
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingCard(card)}
                            aria-label="编辑卡片"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => void handleDeleteCard(card)}
                            disabled={deleteCardMutation.isPending}
                            aria-label="删除卡片"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑卡片</DialogTitle>
            <DialogDescription>
              修改卡片正反面内容后保存，刷新后会保留最新内容。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">正面</label>
              <Textarea
                value={editFront}
                onChange={(event) => setEditFront(event.target.value)}
                placeholder="输入卡片正面内容"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">背面</label>
              <Textarea
                value={editBack}
                onChange={(event) => setEditBack(event.target.value)}
                placeholder="输入卡片背面内容"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCard(null)}>
              取消
            </Button>
            <Button onClick={() => void handleSaveCard()} disabled={updateCardMutation.isPending}>
              {updateCardMutation.isPending ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
