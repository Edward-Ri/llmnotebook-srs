import { motion } from "framer-motion";
import { useGetAnalyticsSummary } from "@workspace/api-client-react";
import { Flame, Brain, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetAnalyticsSummary();

  return (
    <div className="h-full w-full overflow-y-auto">
      {/* Hero Section */}
      <div className="relative w-full h-[300px] overflow-hidden bg-slate-900 rounded-b-[2.5rem]">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />
        
        <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12 max-w-6xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-foreground tracking-tight"
          >
            欢迎回来，开始今天的学习吧
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground max-w-2xl"
          >
            你的 AI 辅助学习系统已准备就绪。解析新文档，校验生成的卡片，或直接进入今天的复习任务。
          </motion.p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 -mt-12 relative z-10 pb-20">
        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <CardAction 
            title="解析新文档" 
            desc="提取关键词并生成记忆卡片" 
            href="/analyze" 
            delay={0.2}
            color="bg-blue-500"
          />
          <CardAction 
            title="校验待定卡片" 
            desc="人工介入确保知识准确性" 
            href="/validate" 
            delay={0.3}
            color="bg-amber-500"
          />
          <CardAction 
            title="开始今日复习" 
            desc={isLoading ? "加载中..." : `${summary?.dueToday || 0} 张卡片待复习`}
            href="/review" 
            delay={0.4}
            color="bg-primary"
            highlight
          />
        </div>

        {/* Stats Grid */}
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          学习概况
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[160px] rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="待复习卡片" 
              value={summary?.dueToday || 0} 
              icon={<CheckCircle2 className="w-6 h-6" />}
              description="今日需要完成的复习量"
              delay={0.5}
            />
            <StatCard 
              title="连续学习" 
              value={`${summary?.streak || 0} 天`} 
              icon={<Flame className="w-6 h-6" />}
              description="保持学习的节奏"
              delay={0.6}
            />
            <StatCard 
              title="总掌握卡片" 
              value={summary?.activeCards || 0} 
              icon={<Layers className="w-6 h-6" />}
              description={`占总卡片 ${Math.round(((summary?.activeCards || 0) / Math.max(1, summary?.totalCards || 1)) * 100)}%`}
              delay={0.7}
            />
            <StatCard 
              title="记忆保持率" 
              value={`${Math.round((summary?.retentionRate || 0) * 100)}%`} 
              icon={<Brain className="w-6 h-6" />}
              description="基于复习结果的估算"
              delay={0.8}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CardAction({ title, desc, href, delay, color, highlight = false }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Link href={href} className="block group">
        <div className={`
          relative overflow-hidden rounded-2xl p-6 h-full border transition-all duration-300
          ${highlight 
            ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary/20 shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-1' 
            : 'bg-card border-border/50 hover:border-primary/30 hover:shadow-xl hover:-translate-y-1'
          }
        `}>
          <div className={`w-2 h-full absolute left-0 top-0 ${color}`} />
          <h3 className={`text-xl font-bold mb-2 ${highlight ? 'text-white' : 'text-foreground'}`}>{title}</h3>
          <p className={highlight ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{desc}</p>
          <div className="mt-6 flex justify-end">
            <div className={`p-2 rounded-full ${highlight ? 'bg-white/20' : 'bg-secondary'} group-hover:scale-110 transition-transform`}>
              <ArrowRight className={`w-5 h-5 ${highlight ? 'text-white' : 'text-primary'}`} />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
