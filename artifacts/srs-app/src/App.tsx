import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrainCircuit, LayoutDashboard, FileText, CheckSquare, Brain, BarChart3, Plus } from "lucide-react";

import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Analyze from "@/pages/analyze";
import Validate from "@/pages/validate";
import Review from "@/pages/review";
import Analytics from "@/pages/analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const NAV_ITEMS = [
  { title: "总览面板", url: "/", icon: LayoutDashboard },
  { title: "文档解析", url: "/analyze", icon: FileText },
  { title: "卡片校验", url: "/validate", icon: CheckSquare },
  { title: "间隔复习", url: "/review", icon: Brain },
  { title: "学习分析", url: "/analytics", icon: BarChart3 },
];

function TopNav() {
  const [location] = useLocation();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-16 gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
          <BrainCircuit className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="text-sm font-semibold tracking-tight">AI 记忆引擎</span>
          <span className="text-[11px] text-muted-foreground">NotebookLM 风格学习工作台</span>
        </div>
      </div>

      <nav className="flex-1 flex justify-center">
        <div className="relative inline-flex items-center gap-1 rounded-full bg-muted/60 px-1 py-1 backdrop-blur">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.url;
            return (
              <Link key={item.url} href={item.url}>
                <button
                  className={`
                    relative overflow-hidden rounded-full px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium
                    flex items-center gap-1.5 transition-colors
                    ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="topnav-pill"
                      className="absolute inset-0 rounded-full bg-background shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">{item.title}</span>
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 rounded-full px-3 md:px-4">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">新建</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/analyze">新建阅读材料</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // TODO: 接入新建卡片组逻辑（POST /decks）
              }}
            >
              新建卡片组
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analyze" component={Analyze} />
      <Route path="/validate" component={Validate} />
      <Route path="/review" component={Review} />
      <Route path="/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="flex flex-col h-screen w-full bg-background">
              <header className="border-b border-border/60 bg-background/80 backdrop-blur z-40">
                <TopNav />
              </header>
              <main className="flex-1 overflow-y-auto">
                <Router />
              </main>
            </div>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
