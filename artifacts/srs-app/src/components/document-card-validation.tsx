import { useEffect, useMemo, useState } from "react";
import {
  getGetPendingCardsQueryKey,
  getListDecksQueryKey,
  getListDocumentsQueryKey,
  useBatchAssignDeck,
  useCreateDeck,
  useGetPendingCards,
  useListDecks,
  useValidateCardsBatch,
} from "@workspace/api-client-react";
import type {
  Card,
  CardValidationItemAction,
  DeckSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Edit3, Layers, Save, Wand2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ValidationState = {
  action: CardValidationItemAction;
  frontContent: string;
  backContent: string;
};

interface DocumentCardValidationProps {
  documentId: string;
}

export function DocumentCardValidation({
  documentId,
}: DocumentCardValidationProps) {
  const pendingParams = { documentId };
  const { data, isLoading } = useGetPendingCards(pendingParams);
  const validateBatchMutation = useValidateCardsBatch();
  const assignDeckMutation = useBatchAssignDeck();
  const createDeckMutation = useCreateDeck();
  const { data: decksData } = useListDecks();
  const { toast } = useToast();
  const { user, loading, refresh } = useAuth();
  const queryClient = useQueryClient();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validations, setValidations] = useState<Record<string, ValidationState>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  const deckOptions = useMemo(() => {
    const flattenDecks = (nodes: DeckSummary[], depth = 0): Array<DeckSummary & { depth: number }> =>
      nodes.flatMap((node) => [
        { ...node, depth },
        ...flattenDecks(node.children ?? [], depth + 1),
      ]);

    return flattenDecks((decksData?.decks ?? []) as DeckSummary[]);
  }, [decksData?.decks]);

  useEffect(() => {
    setCards(data?.cards ?? []);
    setCurrentIndex(0);
    setValidations({});
    setSelectedDeckId(null);
  }, [data?.cards, documentId]);

  const currentCard = cards[currentIndex];
  const reviewedCount = Object.keys(validations).length;
  const progress = cards.length > 0 ? (reviewedCount / cards.length) * 100 : 0;

  useEffect(() => {
    if (!currentCard) return;
    setEditFront(currentCard.frontContent);
    setEditBack(currentCard.backContent);
    setIsEditing(false);
  }, [currentCard, currentIndex]);

  const handleAction = (action: CardValidationItemAction) => {
    if (!currentCard) return;
    const cardId = String(currentCard.id);

    setValidations((prev) => ({
      ...prev,
      [cardId]: {
        action,
        frontContent: action === "edit" ? editFront : currentCard.frontContent,
        backContent: action === "edit" ? editBack : currentCard.backContent,
      },
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBatchSubmit = async () => {
    const keptIds = Object.entries(validations)
      .filter(([, val]) => val.action === "keep" || val.action === "edit")
      .map(([id]) => id);

    if (keptIds.length > 0 && !selectedDeckId) {
      toast({
        title: "请选择卡片组",
        description: "保留的卡片需要分配到卡片组后才能保存。",
        variant: "destructive",
      });
      return;
    }

    const payload = Object.entries(validations).map(([id, val]) => ({
      id,
      action: val.action,
      frontContent: val.frontContent,
      backContent: val.backContent,
    }));

    try {
      await validateBatchMutation.mutateAsync({
        data: { validations: payload } as never,
      });
      if (keptIds.length > 0 && selectedDeckId) {
        await assignDeckMutation.mutateAsync({
          data: {
            assignments: keptIds.map((id) => ({
              id,
              deckId: selectedDeckId,
            })),
          } as never,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetPendingCardsQueryKey(pendingParams),
        }),
        queryClient.invalidateQueries({ queryKey: getListDecksQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }),
      ]);

      toast({ title: "校验完成", description: `成功处理了 ${payload.length} 张卡片` });
    } catch (err: any) {
      toast({
        title: "提交失败",
        description: err?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDeckChange = async (value: string) => {
    if (value === "") {
      setSelectedDeckId(null);
      return;
    }

    if (value === "__new") {
      const name = window.prompt("请输入新卡片组名称");
      if (!name) return;

      try {
        if (loading || !user) {
          await refresh();
        }
        const deck = await createDeckMutation.mutateAsync({ data: { name } });
        await queryClient.invalidateQueries({ queryKey: getListDecksQueryKey() });
        setSelectedDeckId(String(deck.id));
        toast({ title: "已创建卡片组", description: deck.name });
      } catch (error: any) {
        toast({
          title: "创建卡片组失败",
          description: error?.message ?? "请稍后重试",
          variant: "destructive",
        });
      }
      return;
    }

    setSelectedDeckId(value);
  };

  const isDone = cards.length > 0 && reviewedCount === cards.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">候选卡片校验</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            在当前阅读材料内直接审阅、修改并保存候选卡片。
          </p>
        </div>
        {cards.length > 0 && (
          <div className="text-right">
            <div className="text-sm font-medium">
              进度 {reviewedCount} / {cards.length}
            </div>
            <div className="mt-2 w-40 md:w-48">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5">
        {isLoading && (
          <div className="flex min-h-[180px] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-4 py-10 text-center">
            <Layers className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">暂无待校验卡片</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              在上方选择关键词并生成候选卡片后，会直接出现在这里。
            </p>
          </div>
        )}

        {!isLoading && isDone && (
          <div className="rounded-2xl border border-border/60 bg-background/50 px-4 py-8 text-center">
            <Layers className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h3 className="text-xl font-semibold">审查完毕</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              已完成 {cards.length} 张候选卡片的审阅，可以提交保存。
            </p>
            <div className="mx-auto mt-6 max-w-xs space-y-3 text-left">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">分配到卡片组</span>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={selectedDeckId ?? ""}
                  onChange={(e) => handleDeckChange(e.target.value)}
                >
                  <option value="">请选择卡片组</option>
                  {deckOptions.map((deck) => (
                    <option key={deck.id} value={String(deck.id)}>
                      {`${"- ".repeat(deck.depth)}${deck.name}`}（{deck.totalCards} 张）
                    </option>
                  ))}
                  <option value="__new">新建卡片组…</option>
                </select>
              </div>
              <Button
                className="w-full"
                onClick={handleBatchSubmit}
                disabled={
                  validateBatchMutation.isPending ||
                  assignDeckMutation.isPending ||
                  createDeckMutation.isPending
                }
              >
                {validateBatchMutation.isPending || assignDeckMutation.isPending
                  ? "保存中..."
                  : "提交所有校验结果"}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !isDone && currentCard && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid min-h-[420px] grid-cols-1 gap-5 lg:grid-cols-2"
            >
              <UICard className="flex flex-col border-border/50 bg-slate-50/50 shadow-sm">
                <div className="flex items-center justify-between gap-3 rounded-t-xl border-b border-border/50 bg-background/60 p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Wand2 className="h-4 w-4 text-primary" />
                    AI 原始生成
                  </span>
                  {currentCard.keyword && (
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                      {currentCard.keyword}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-5 p-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      问题
                    </label>
                    <div className="min-h-[96px] rounded-xl border border-border/50 bg-background p-4 text-base">
                      {currentCard.frontContent}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      答案
                    </label>
                    <div className="min-h-[140px] whitespace-pre-wrap rounded-xl border border-border/50 bg-background p-4 text-base">
                      {currentCard.backContent}
                    </div>
                  </div>
                </div>
              </UICard>

              <UICard className="relative flex flex-col border-primary/20 bg-card shadow-md">
                <div className="flex items-center justify-between gap-3 rounded-t-xl border-b border-border/50 bg-primary/5 p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Edit3 className="h-4 w-4 text-primary" />
                    你的修改版
                  </span>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-8"
                    >
                      启用编辑
                    </Button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-5 p-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-primary">
                      修改问题
                    </label>
                    <Textarea
                      className={`min-h-[96px] resize-none text-base ${
                        isEditing
                          ? "border-primary ring-2 ring-primary/20"
                          : "cursor-not-allowed bg-muted/30 opacity-80"
                      }`}
                      value={editFront}
                      onChange={(e) => setEditFront(e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-primary">
                      修改答案
                    </label>
                    <Textarea
                      className={`min-h-[140px] resize-none text-base ${
                        isEditing
                          ? "border-primary ring-2 ring-primary/20"
                          : "cursor-not-allowed bg-muted/30 opacity-80"
                      }`}
                      value={editBack}
                      onChange={(e) => setEditBack(e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="flex gap-3 rounded-b-xl border-t border-border/50 bg-background/50 p-5">
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                    onClick={() => handleAction("discard")}
                  >
                    <X className="mr-2 h-5 w-5" />
                    丢弃
                  </Button>

                  {isEditing ? (
                    <Button
                      size="lg"
                      className="flex-[2] bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
                      onClick={() => handleAction("edit")}
                    >
                      <Save className="mr-2 h-5 w-5" />
                      保存修改并保留
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="flex-[2] bg-green-600 text-white shadow-lg shadow-green-600/25 hover:bg-green-700"
                      onClick={() => handleAction("keep")}
                    >
                      <Check className="mr-2 h-5 w-5" />
                      直接保留
                    </Button>
                  )}
                </div>
              </UICard>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
