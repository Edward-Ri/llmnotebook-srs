import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetDueCards, useLogReview } from "@workspace/api-client-react";
import type { Card, DueCardsResponse } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { RefreshCw, BookOpen, Clock, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { withTimezoneHeaders } from "@/lib/timezone";

export default function Review() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const searchParams = new URLSearchParams(search);
  const deckIdParam = searchParams.get("deckId");
  const deckId = deckIdParam ?? undefined;

  const dueQuery = useGetDueCards(deckId ? { deckId } : undefined);

  const deckMeta = useQuery<{ id: string; name: string }, Error>({
    queryKey: ["/api/decks", deckId],
    enabled: !!deckId,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/decks/${deckId}`, {
        signal,
        headers: withTimezoneHeaders(),
      });
      if (!res.ok) {
        throw new Error("无法加载卡片组信息");
      }
      const json = await res.json();
      return { id: json.id, name: json.name as string };
    },
  });

  const data = dueQuery.data as (DueCardsResponse & { newCount?: number; dueCount?: number }) | undefined;
  const isLoading = dueQuery.isLoading;

  const logReviewMutation = useLogReview();
  const queryClient = useQueryClient();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [totalInitial, setTotalInitial] = useState(0);

  useEffect(() => {
    if (data?.cards && data.cards.length > 0 && totalInitial === 0) {
      setCards(data.cards);
      setTotalInitial(data.cards.length);
    }
  }, [data, totalInitial]);

  const currentCard = cards[currentIndex];
  
  const handleGrade = async (grade: number) => {
    if (!currentCard) return;

    try {
      await logReviewMutation.mutateAsync({
        data: { cardId: currentCard.id, grade }
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/reviews/due"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/decks"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/heatmap"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] }),
        deckId
          ? queryClient.invalidateQueries({ queryKey: ["deck-detail", deckId] })
          : Promise.resolve(),
      ]);
      
      // Move to next card
      setIsFlipped(false);
      setTimeout(() => {
        if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // Finished session
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#3b82f6', '#10b981']
          });
          setCurrentIndex(prev => prev + 1); // push out of bounds to trigger finish screen
        }
      }, 300); // Wait for unflip animation
      
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">
      <RefreshCw className="w-10 h-10 animate-spin text-primary opacity-50" />
    </div>;
  }

  const isDone = currentIndex >= cards.length;

  if (cards.length === 0 || isDone) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 bg-success/10 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-success/10"
        >
          <CheckCircle2 className="w-16 h-16 text-success" />
        </motion.div>
        <h2 className="text-3xl font-bold mb-4 text-foreground">今日复习已完成！</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">
          太棒了，你已经清空了今天的复习队列。间隔重复让记忆更持久。
        </p>
        <Button
          size="lg"
          onClick={() => {
            if (deckId) {
              window.location.href = `/decks/${deckId}`;
            } else {
              window.location.href = "/";
            }
          }}
          className="px-8 shadow-md"
        >
          {deckId ? "返回卡片组" : "返回主页"}
        </Button>
      </div>
    );
  }

  const progress = ((currentIndex) / totalInitial) * 100;

  return (
    <div className="h-full max-w-4xl mx-auto p-6 md:p-12 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">每日复习</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {deckId
              ? `正在复习：${deckMeta.data?.name ?? `卡片组 #${deckId}`}`
              : "当前模式：全部待复习卡片"}
          </p>
          <p className="text-xs text-muted-foreground">
            今日队列：New {data?.newCount ?? 0} · Due {data?.dueCount ?? 0} · 已背诵 {data?.todayReviewed ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-muted-foreground">
            {currentIndex + 1} / {totalInitial}
          </div>
          <div className="w-32 hidden sm:block">
            <Progress value={progress} className="h-2.5" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative perspective-1000">
        <AnimatePresence mode="wait">
          {currentCard && (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              className="flex-1 w-full relative"
            >
              <div
                className="absolute inset-0 transform-style-3d transition-transform duration-500"
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* FRONT OF CARD */}
                <UICard
                  className={`absolute inset-0 backface-hidden bg-card border-border/50 shadow-2xl flex flex-col overflow-hidden group ${
                    isFlipped ? "pointer-events-none z-0" : "pointer-events-auto z-10"
                  }`}
                >
                  <div className="flex-1 p-8 md:p-16 flex flex-col items-center justify-center text-center relative">
                    <div className="absolute top-6 left-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Brain className="w-4 h-4" /> 问题
                    </div>
                    {currentCard.keyword && (
                      <div className="absolute top-6 right-6">
                        <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full font-medium">
                          {currentCard.keyword}
                        </span>
                      </div>
                    )}
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight text-foreground">
                      {currentCard.frontContent}
                    </h2>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-border/50 text-center">
                    <Button
                      size="lg"
                      className="w-full max-w-sm mx-auto shadow-md hover:shadow-lg transition-all"
                      onClick={() => setIsFlipped(true)}
                    >
                      显示答案
                    </Button>
                  </div>
                </UICard>

                {/* BACK OF CARD */}
                <UICard
                  className={`absolute inset-0 backface-hidden rotate-y-180 bg-card border-primary/20 shadow-2xl flex flex-col overflow-hidden ${
                    isFlipped ? "pointer-events-auto z-10" : "pointer-events-none z-0"
                  }`}
                >
                  <div className="flex-1 flex flex-col overflow-y-auto">
                    {/* 1. 问题区域 */}
                    <div className="px-8 md:px-12 pt-8 pb-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4" /> 问题
                      </div>
                      <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                        {currentCard.frontContent}
                      </p>
                    </div>

                    {/* 分隔线 */}
                    <div className="mx-8 md:mx-12 border-t-2 border-primary/20 my-2" />

                    {/* 2. 答案区域 */}
                    <div className="px-8 md:px-12 py-4 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4" /> 答案
                      </div>
                      <p className="text-xl md:text-2xl font-semibold leading-relaxed text-foreground whitespace-pre-wrap">
                        {currentCard.backContent}
                      </p>
                    </div>
                  </div>

                  {/* 3. 掌握程度评级区域 */}
                  <div className="p-5 bg-muted/40 border-t border-border/50">
                    <div className="max-w-2xl mx-auto">
                      <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        对该概念的掌握程度
                      </p>
                      <div className="grid grid-cols-4 gap-2 md:gap-3">
                        <GradeButton
                          grade={0}
                          label="重来 Again"
                          sub="需要重学"
                          color="destructive"
                          onClick={() => handleGrade(0)}
                          disabled={logReviewMutation.isPending}
                        />
                        <GradeButton
                          grade={3}
                          label="困难 Hard"
                          sub="勉强回想"
                          color="warning"
                          onClick={() => handleGrade(3)}
                          disabled={logReviewMutation.isPending}
                        />
                        <GradeButton
                          grade={4}
                          label="良好 Good"
                          sub="回想顺畅"
                          color="blue-500"
                          onClick={() => handleGrade(4)}
                          disabled={logReviewMutation.isPending}
                        />
                        <GradeButton
                          grade={5}
                          label="简单 Easy"
                          sub="非常轻松"
                          color="success"
                          onClick={() => handleGrade(5)}
                          disabled={logReviewMutation.isPending}
                        />
                      </div>
                    </div>
                  </div>
                </UICard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function GradeButton({ grade, label, sub, color, onClick, disabled }: any) {
  const colorMap: Record<string, string> = {
    'destructive': 'bg-red-50 text-red-600 border-red-200 hover:bg-red-500 hover:text-white dark:bg-red-950 dark:border-red-900 dark:hover:bg-red-600',
    'warning': 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-500 hover:text-white dark:bg-orange-950 dark:border-orange-900 dark:hover:bg-orange-600',
    'blue-500': 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white dark:bg-blue-950 dark:border-blue-900 dark:hover:bg-blue-600',
    'success': 'bg-green-50 text-green-600 border-green-200 hover:bg-green-500 hover:text-white dark:bg-green-950 dark:border-green-900 dark:hover:bg-green-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border transition-all duration-200
        ${colorMap[color]} disabled:opacity-50 disabled:cursor-not-allowed group
      `}
    >
      <span className="font-bold text-sm md:text-base">{label}</span>
      <span className="text-[10px] md:text-xs opacity-80 mt-1">{sub}</span>
    </button>
  );
}

import { CheckCircle2 } from "lucide-react";
