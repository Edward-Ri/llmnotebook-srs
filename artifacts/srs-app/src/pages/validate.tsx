import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetPendingCards,
  useValidateCardsBatch,
  useListDecks,
  useCreateDeck,
  useBatchAssignDeck,
} from "@workspace/api-client-react";
import type {
  Card,
  CardValidationItemAction,
  DeckSummary,
} from "@workspace/api-client-react";
import { Check, X, Edit3, ArrowRight, Save, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type ValidationState = {
  action: CardValidationItemAction;
  frontContent: string;
  backContent: string;
  deckId?: number | null;
};

export default function Validate() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const documentIdParam = searchParams.get("documentId");
  const documentId = documentIdParam || undefined;

  const { data, isLoading } = useGetPendingCards(
    documentId ? { documentId } : undefined,
  );
  const validateBatchMutation = useValidateCardsBatch();
  const { data: decksData } = useListDecks();
  const createDeckMutation = useCreateDeck();
  const assignDeckMutation = useBatchAssignDeck();
  const { toast } = useToast();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validations, setValidations] = useState<Record<number, ValidationState>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);

  // Editable fields state
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  useEffect(() => {
    if (data?.cards) {
      setCards(data.cards);
    }
  }, [data]);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? (Object.keys(validations).length / cards.length) * 100 : 0;

  useEffect(() => {
    if (currentCard) {
      setEditFront(currentCard.frontContent);
      setEditBack(currentCard.backContent);
      setIsEditing(false);
    }
  }, [currentCard, currentIndex]);

  const handleAction = (action: CardValidationItemAction) => {
    if (!currentCard) return;

    setValidations(prev => ({
      ...prev,
      [currentCard.id]: {
        action,
        frontContent: action === "edit" ? editFront : currentCard.frontContent,
        backContent: action === "edit" ? editBack : currentCard.backContent,
        deckId: selectedDeckId ?? undefined,
      }
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleBatchSubmit = async () => {
    const payload = Object.entries(validations).map(([id, val]) => ({
      id: parseInt(id),
      action: val.action,
      frontContent: val.frontContent,
      backContent: val.backContent,
    }));

    const assignments = Object.entries(validations)
      .filter(([, val]) => val.deckId !== undefined)
      .map(([id, val]) => ({
        id: parseInt(id, 10),
        deckId: val.deckId ?? null,
      }));

    try {
      await validateBatchMutation.mutateAsync({ data: { validations: payload } });
      if (assignments.length > 0) {
        await assignDeckMutation.mutateAsync({ data: { assignments } });
      }
      toast({ title: "校验完成", description: `成功处理了 ${payload.length} 张卡片` });
      // Reset state or refetch
      setCards([]);
      setCurrentIndex(0);
      setValidations({});
      setSelectedDeckId(null);
    } catch (err: any) {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
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
        const deck = await createDeckMutation.mutateAsync({ data: { name } });
        setSelectedDeckId(deck.id);
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

    const numericId = Number(value);
    if (!Number.isNaN(numericId)) {
      setSelectedDeckId(numericId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isDone = cards.length > 0 && Object.keys(validations).length === cards.length;
  const showEmpty = cards.length === 0;

  if (showEmpty) {
    // 没有待校验卡片时，直接返回到总览面板，而不展示单独的“空状态页面”
    setLocation("/");
    return null;
  }

  if (isDone) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <UICard className="max-w-md w-full p-8 text-center bg-card shadow-xl border-border/50">
          <Layers className="w-16 h-16 text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">审查完毕</h2>
          <p className="text-muted-foreground mb-8">
            您已审查 {cards.length} 张卡片。
          </p>
          <Button 
            size="lg" 
            className="w-full bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25"
            onClick={handleBatchSubmit}
            disabled={validateBatchMutation.isPending}
          >
            {validateBatchMutation.isPending ? "保存中..." : "提交所有校验结果"}
          </Button>
        </UICard>
      </div>
    );
  }

  return (
    <div className="h-full max-w-6xl mx-auto p-6 flex flex-col">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">双屏卡片校验</h1>
          <p className="text-sm text-muted-foreground">
            决定保留、修改还是丢弃 AI 生成的卡片，并可一次性分配到指定卡片组。
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold mb-1">
              进度 {Object.keys(validations).length} / {cards.length}
            </div>
            <div className="w-40 md:w-48">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] text-muted-foreground">分配到卡片组</span>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-xs md:text-sm"
              value={selectedDeckId ?? ""}
              onChange={(e) => handleDeckChange(e.target.value)}
            >
              <option value="">不分配</option>
              {decksData?.decks.map((deck: DeckSummary) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}（{deck.totalCards} 张）
                </option>
              ))}
              <option value="__new">新建卡片组…</option>
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentCard && (
          <motion.div 
            key={currentCard.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]"
          >
            {/* Left Pane - Original */}
            <UICard className="flex flex-col border-border/50 shadow-sm bg-slate-50/50 dark:bg-slate-900/50">
              <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50 rounded-t-xl">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  AI 原始生成
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {currentCard.keyword}
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">问题 (Front)</label>
                  <div className="p-4 bg-background rounded-xl border border-border/50 shadow-sm min-h-[100px] text-lg">
                    {currentCard.frontContent}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">答案 (Back)</label>
                  <div className="p-4 bg-background rounded-xl border border-border/50 shadow-sm min-h-[150px] text-lg whitespace-pre-wrap">
                    {currentCard.backContent}
                  </div>
                </div>
              </div>
            </UICard>

            {/* Right Pane - Editable/Action */}
            <UICard className="flex flex-col border-primary/20 shadow-md bg-card relative">
              <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5 rounded-t-xl">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary" />
                  您的修改版
                </span>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8">
                    启用编辑
                  </Button>
                )}
              </div>
              
              <div className="p-6 flex-1 flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">修改问题</label>
                  <Textarea 
                    className={`min-h-[100px] text-lg resize-none ${isEditing ? 'border-primary ring-2 ring-primary/20' : 'bg-muted/30 cursor-not-allowed opacity-80'}`}
                    value={editFront}
                    onChange={e => setEditFront(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-primary uppercase tracking-wider mb-2 block">修改答案</label>
                  <Textarea 
                    className={`min-h-[150px] text-lg resize-none ${isEditing ? 'border-primary ring-2 ring-primary/20' : 'bg-muted/30 cursor-not-allowed opacity-80'}`}
                    value={editBack}
                    onChange={e => setEditBack(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-border/50 bg-background/50 rounded-b-xl flex gap-3">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                  onClick={() => handleAction("discard")}
                >
                  <X className="w-5 h-5 mr-2" />
                  丢弃
                </Button>
                
                {isEditing ? (
                  <Button 
                    size="lg" 
                    className="flex-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25"
                    onClick={() => handleAction("edit")}
                  >
                    <Save className="w-5 h-5 mr-2" />
                    保存修改并保留
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    className="flex-2 bg-success hover:bg-success/90 text-white shadow-lg shadow-success/25"
                    onClick={() => handleAction("keep")}
                  >
                    <Check className="w-5 h-5 mr-2" />
                    完美，直接保留
                  </Button>
                )}
              </div>
            </UICard>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Dummy icon to avoid import errors if WAnd2 is missing from above scope
import { Wand2 } from "lucide-react";
