import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, BookOpen, Wand2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";

export default function NewMaterialNotebook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading, refresh } = useAuth();

  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const parseErrorMessage = async (res: Response) => {
    const raw = await res.text();
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.map((item) => item?.message).filter(Boolean).join("；") || raw;
      }
      return data?.message ?? data?.error ?? raw;
    } catch {
      return raw || "请求失败";
    }
  };

  const handleCreate = async () => {
    const normalizedTitle = title.trim() || "未命名阅读材料";
    setIsCreating(true);
    try {
      if (loading || !user) {
        await refresh();
      }
      const createRes = await authedFetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalizedTitle }),
      });
      if (!createRes.ok) {
        throw new Error(await parseErrorMessage(createRes));
      }

      const created = await createRes.json();
      const documentId = created?.document?.id;
      if (!documentId) {
        throw new Error("创建文档失败：缺少 documentId");
      }

      queryClient.setQueryData(
        getListDocumentsQueryKey(),
        (prev: { documents?: Array<Record<string, unknown>> } | undefined) => {
          const nextDocument = {
            id: documentId,
            title: created.document.title ?? normalizedTitle,
            content: "",
            createdAt: created.document.createdAt ?? new Date().toISOString(),
            keywordCount: 0,
            cardCount: 0,
          };

          const existing = prev?.documents ?? [];
          if (existing.some((doc) => String(doc.id) === documentId)) {
            return prev;
          }

          return {
            ...prev,
            documents: [nextDocument, ...existing],
          };
        },
      );

      toast({
        title: "Notebook 已创建",
        description: "请在文档详情页粘贴或导入材料并开始解析。",
      });

      await queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setLocation(`/materials/${documentId}`);
    } catch (err: any) {
      toast({
        title: "创建失败",
        description: err?.message ?? "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild size="icon" variant="ghost" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入阅读材料标题"
                className="w-full bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus:ring-0 md:text-3xl"
              />
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-border/60 bg-card/80 p-5 md:p-6">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>创建后将在文档详情页继续后续流程</span>
            </div>
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
              之后的流程会统一在单个阅读材料页面完成：
              <br />
              1. 粘贴或上传原文
              <br />
              2. 解析阅读材料并提取关键词
              <br />
              3. 生成候选卡片
              <br />
              4. 直接在该页面校验候选卡片
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Wand2 className="h-4 w-4 animate-spin" />
                  正在创建…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  创建并前往文档
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
