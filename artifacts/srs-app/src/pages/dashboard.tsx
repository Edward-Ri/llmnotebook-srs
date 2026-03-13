import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, History, MoreHorizontal, Sparkles, Layers } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type NotebookTab = "all" | "materials" | "decks" | "history";

type RecentItemType = "material" | "deck" | "history";

interface RecentItem {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle: string;
  updatedAt: string;
  href: string;
}

interface FeaturedDeck {
  id: string;
  title: string;
  description: string;
  stats: string;
  href: string;
  accent: string;
}

const FEATURED_DECKS: FeaturedDeck[] = [
  {
    id: "foundations",
    title: "AI 基础概念精读",
    description: "从零构建对大模型与向量检索的直觉。",
    stats: "42 张卡片 · 待复习 8",
    href: "/decks/1",
    accent: "from-violet-500/80 via-fuchsia-500/70 to-amber-400/70",
  },
  {
    id: "paper-notes",
    title: "论文精读：记忆增强",
    description: "针对论文逐段拆解，强化长期记忆。",
    stats: "28 张卡片 · 今日新加 5",
    href: "/materials/1",
    accent: "from-sky-500/80 via-cyan-400/70 to-emerald-400/70",
  },
  {
    id: "coding",
    title: "TypeScript 实战手册",
    description: "常见类型体操与实际业务场景总结。",
    stats: "35 张卡片 · 待复习 3",
    href: "/decks/2",
    accent: "from-amber-500/80 via-orange-500/70 to-rose-400/70",
  },
];

const RECENT_ITEMS: RecentItem[] = [
  {
    id: "m1",
    type: "material",
    title: "NotebookLM 设计语言拆解",
    subtitle: "产品拆解 · 12 个关键词",
    updatedAt: "刚刚",
    href: "/materials/1",
  },
  {
    id: "d1",
    type: "deck",
    title: "认知科学入门精读卡片组",
    subtitle: "卡片组 · 56 张卡片",
    updatedAt: "1 小时前",
    href: "/decks/1",
  },
  {
    id: "m2",
    type: "material",
    title: "Spacing effect 经典论文",
    subtitle: "论文 · 8 个高价值段落",
    updatedAt: "昨天",
    href: "/materials/2",
  },
  {
    id: "d2",
    type: "deck",
    title: "日常英语表达卡片组",
    subtitle: "卡片组 · 80 张卡片",
    updatedAt: "昨天",
    href: "/decks/2",
  },
  {
    id: "h1",
    type: "history",
    title: "昨日复习完成 · 32 张",
    subtitle: "学习记录 · 复习 Session",
    updatedAt: "昨天 22:13",
    href: "/review",
  },
];

const TABS: { key: NotebookTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "materials", label: "我的阅读材料" },
  { key: "decks", label: "我的卡片组" },
  { key: "history", label: "我的学习记录" },
];

export default function Dashboard() {
  const [tab, setTab] = useState<NotebookTab>("all");

  const filteredItems = RECENT_ITEMS.filter((item) => {
    if (tab === "all") return true;
    if (tab === "materials") return item.type === "material";
    if (tab === "decks") return item.type === "deck";
    if (tab === "history") return item.type === "history";
    return true;
  });

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl md:text-3xl font-semibold tracking-tight"
            >
              Notebook 工作区
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-1 text-sm md:text-base text-muted-foreground"
            >
              集中管理你的阅读材料、卡片组与学习记录，一眼看清今天要学什么。
            </motion.p>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" asChild>
              <Link href="/materials/new">添加阅读材料</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/review">开始今日复习</Link>
            </Button>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium text-muted-foreground">精选学习空间</h2>
            </div>
            <span className="text-xs text-muted-foreground">基于你的最近活动自动推荐</span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
            {FEATURED_DECKS.map((deck, index) => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 min-w-[260px] max-w-xs md:min-w-[280px]"
              >
                <div
                  className={`pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br ${deck.accent}`}
                />
                <div className="relative p-4 flex flex-col h-full justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>精选卡片空间</span>
                    </div>
                    <h3 className="text-base font-semibold leading-snug">{deck.title}</h3>
                    <p className="text-xs text-muted-foreground">{deck.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{deck.stats}</span>
                    <Button size="sm" variant="secondary" className="h-7 px-3" asChild>
                      <Link href={deck.href}>
                        <span className="text-xs">进入</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-4 pb-8">
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex items-center rounded-full bg-muted/60 px-1 py-1 text-xs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="relative rounded-full px-3 py-1.5 font-medium text-xs md:text-sm text-muted-foreground"
                >
                  {tab === t.key && (
                    <motion.div
                      layoutId="tabs-underline"
                      className="absolute inset-0 rounded-full bg-background shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <History className="w-3.5 h-3.5" />
              最近打开
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredItems.map((item) => (
                <Link key={item.id} href={item.href} className="group block">
                  <div className="relative h-full rounded-2xl border border-border/60 bg-card/80 px-4 py-3 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {item.type === "material" && (
                            <>
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>阅读材料</span>
                            </>
                          )}
                          {item.type === "deck" && (
                            <>
                              <Layers className="w-3.5 h-3.5" />
                              <span>卡片组</span>
                            </>
                          )}
                          {item.type === "history" && (
                            <>
                              <History className="w-3.5 h-3.5" />
                              <span>学习记录</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => e.preventDefault()}
                        className="mt-1 rounded-full p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{item.updatedAt}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        按 Enter 打开
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
