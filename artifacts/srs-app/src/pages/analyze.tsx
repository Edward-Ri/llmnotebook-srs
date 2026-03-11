import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { FileText, Wand2, Check, Sparkles, AlertCircle } from "lucide-react";
import { useAnalyzeDocument, useUpdateKeywordSelections, useGenerateCards } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type AnalyzeStage = "input" | "keywords" | "generating";

export default function Analyze() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [stage, setStage] = useState<AnalyzeStage>("input");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documentId, setDocumentId] = useState<number | null>(null);
  
  // Keep local track of keywords returned from API
  const [keywords, setKeywords] = useState<{id: number, word: string, isSelected: boolean}[]>([]);

  const analyzeDocMutation = useAnalyzeDocument();
  const updateKeywordsMutation = useUpdateKeywordSelections();
  const generateCardsMutation = useGenerateCards();

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast({ title: "请输入文本内容", variant: "destructive" });
      return;
    }
    
    try {
      const res = await analyzeDocMutation.mutateAsync({
        data: { title: title || "未命名文档", content }
      });
      setDocumentId(res.documentId);
      setKeywords(res.keywords);
      setStage("keywords");
      toast({ title: "解析成功", description: `提取了 ${res.keywords.length} 个关键词` });
    } catch (err: any) {
      toast({ title: "解析失败", description: err.message, variant: "destructive" });
    }
  };

  const toggleKeyword = (id: number) => {
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, isSelected: !k.isSelected } : k));
  };

  const handleGenerateCards = async () => {
    if (!documentId) return;
    
    const selectedIds = keywords.filter(k => k.isSelected).map(k => k.id);
    if (selectedIds.length === 0) {
      toast({ title: "请至少选择一个关键词", variant: "destructive" });
      return;
    }

    setStage("generating");
    try {
      // First update selections
      await updateKeywordsMutation.mutateAsync({
        documentId,
        data: { selectedIds }
      });
      
      // Then generate cards
      const res = await generateCardsMutation.mutateAsync({
        data: { documentId, keywordIds: selectedIds }
      });
      
      toast({ 
        title: "生成成功", 
        description: `基于选中的关键词生成了 ${res.total} 张候选卡片`,
        className: "bg-success text-success-foreground"
      });
      
      // Navigate to validate
      setTimeout(() => setLocation("/validate"), 1500);
      
    } catch (err: any) {
      toast({ title: "生成失败", description: err.message, variant: "destructive" });
      setStage("keywords");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
          <Sparkles className="w-8 h-8 text-primary" />
          文档解析与卡片生成
        </h1>
        <p className="text-muted-foreground mt-2">
          输入学习材料，AI 将自动提取核心知识点并转化为间隔重复卡片。
        </p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <StageIndicator current={stage} stage="input" number={1} label="输入文本" />
        <div className={`h-1 flex-1 rounded-full ${stage !== "input" ? "bg-primary" : "bg-border"}`} />
        <StageIndicator current={stage} stage="keywords" number={2} label="意图过滤" />
        <div className={`h-1 flex-1 rounded-full ${stage === "generating" ? "bg-primary" : "bg-border"}`} />
        <StageIndicator current={stage} stage="generating" number={3} label="生成卡片" />
      </div>

      <AnimatePresence mode="wait">
        {stage === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-6 bg-card shadow-lg shadow-black/5 border-border/50">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">文档标题 (可选)</label>
                  <Input 
                    placeholder="例如：生物学第5章" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">学习内容</label>
                  <Textarea 
                    placeholder="在此粘贴你想学习的文本..." 
                    className="min-h-[300px] text-base leading-relaxed bg-background resize-y"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button 
                    size="lg" 
                    onClick={handleAnalyze} 
                    disabled={analyzeDocMutation.isPending}
                    className="w-full sm:w-auto px-8 gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-md hover:shadow-lg transition-all"
                  >
                    {analyzeDocMutation.isPending ? (
                      <Wand2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                    {analyzeDocMutation.isPending ? "解析中..." : "解析文本"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {stage === "keywords" && (
          <motion.div
            key="keywords"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8 bg-card shadow-lg shadow-black/5 border-border/50">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    请选择需要生成卡片的知识点
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击标签以保留或排除。AI 将仅基于选中的关键词构建问答卡片。
                  </p>
                </div>
                <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  已选: {keywords.filter(k => k.isSelected).length} / {keywords.length}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50">
                {keywords.map(kw => (
                  <button
                    key={kw.id}
                    onClick={() => toggleKeyword(kw.id)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${kw.isSelected 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 translate-y-0' 
                        : 'bg-background text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground'
                      }
                    `}
                  >
                    {kw.word}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center border-t border-border/50 pt-6">
                <Button variant="ghost" onClick={() => setStage("input")}>
                  返回修改文本
                </Button>
                <Button 
                  size="lg" 
                  onClick={handleGenerateCards}
                  disabled={updateKeywordsMutation.isPending || generateCardsMutation.isPending}
                  className="gap-2"
                >
                  <Wand2 className="w-5 h-5" />
                  生成卡片
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {stage === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center relative z-10 shadow-xl shadow-primary/30">
                <Wand2 className="w-10 h-10 text-white animate-bounce" />
              </div>
            </div>
            <h3 className="mt-8 text-2xl font-bold text-foreground">AI 正在构思卡片...</h3>
            <p className="mt-2 text-muted-foreground">基于上下文为您构建高质量的问答对，请稍候</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StageIndicator({ current, stage, number, label }: { current: string, stage: string, number: number, label: string }) {
  const isPast = current === "generating" && stage !== "generating" || current === "keywords" && stage === "input";
  const isActive = current === stage;
  
  return (
    <div className={`flex flex-col items-center gap-2 ${isActive || isPast ? 'text-primary' : 'text-muted-foreground'}`}>
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors
        ${isActive ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 
          isPast ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}
      `}>
        {isPast ? <Check className="w-5 h-5" /> : number}
      </div>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}
