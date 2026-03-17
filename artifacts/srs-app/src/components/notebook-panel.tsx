import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ArrowLeft, BookPlus, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import type { NotebookSummary, WorkspaceReference } from "@/lib/workspace-api";
import { NotebookEditor } from "@/components/notebook-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NotebookViewMode = "list" | "editor";

function formatNotebookUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface NotebookPanelProps {
  documentTitle: string;
  notebooks: NotebookSummary[];
  selectedNotebookId: string | null;
  references: WorkspaceReference[];
  isNotebooksLoading: boolean;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => Promise<void>;
  onRenameNotebook: (notebook: NotebookSummary) => Promise<void>;
  onDeleteNotebook: (notebook: NotebookSummary) => Promise<void>;
  isDropActive: boolean;
  onDragStateChange: (active: boolean) => void;
}

export function NotebookPanel({
  documentTitle,
  notebooks,
  selectedNotebookId,
  references,
  isNotebooksLoading,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  isDropActive,
  onDragStateChange,
}: NotebookPanelProps) {
  const [viewMode, setViewMode] = useState<NotebookViewMode>("list");
  const selectedNotebook = notebooks.find((notebook) => notebook.id === selectedNotebookId) ?? null;
  const isEditorOpen = selectedNotebook !== null && viewMode === "editor";
  const notebookCards = useMemo(
    () => notebooks.map((notebook) => ({
      ...notebook,
      updatedLabel: formatNotebookUpdatedAt(notebook.updatedAt),
      summary: notebook.blockCount > 0
        ? `${notebook.blockCount} 个历史笔记块可迁移到富文本编辑器`
        : "空白 Notebook，点击进入编辑器开始记录",
    })),
    [notebooks],
  );

  useEffect(() => {
    if (!selectedNotebookId) {
      setViewMode("list");
    }
  }, [selectedNotebookId]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isEditorOpen ? "copy" : "none";
    onDragStateChange(true);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    onDragStateChange(false);
    if (!isEditorOpen) return;
    if (!event.dataTransfer.getData("application/json")) return;
    event.preventDefault();
  };
  const handleOpenNotebook = (notebookId: string) => {
    onSelectNotebook(notebookId);
    setViewMode("editor");
  };

  return (
    <section className="flex h-full min-h-[480px] flex-col rounded-3xl border border-border/60 bg-card/80">
      <div className="border-b border-border/60 px-4 py-4 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              <span>{documentTitle || "当前工作区"}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Notebook</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {viewMode === "editor" ? "沉浸式编辑当前 Notebook。" : "管理当前工作区下的笔记本。"}
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              await onCreateNotebook();
              setViewMode("editor");
            }}
          >
            <Plus className="h-4 w-4" />
            新建 Notebook
          </Button>
        </div>

        {viewMode === "editor" && selectedNotebook && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-3">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => onRenameNotebook(selectedNotebook)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onDeleteNotebook(selectedNotebook)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-4 py-4 md:px-5",
          isDropActive && "rounded-b-3xl bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragEnter={(event) => {
          if (!event.dataTransfer.getData("application/json")) return;
          onDragStateChange(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          onDragStateChange(false);
        }}
        onDrop={(event) => {
          void handleDrop(event);
        }}
      >
        {viewMode === "list" && (
          <>
            {isDropActive && (
              <div className="mb-4 rounded-2xl border border-dashed border-primary bg-primary/10 px-4 py-4 text-center text-sm text-primary">
                {selectedNotebook
                  ? "请先打开一个 Notebook，再把引用拖入编辑器。"
                  : "请先创建并打开一个 Notebook，再把引用拖入编辑器。"}
              </div>
            )}

            {isNotebooksLoading && (
              <div className="grid gap-3">
                <Skeleton className="h-28 w-full rounded-3xl" />
                <Skeleton className="h-28 w-full rounded-3xl" />
                <Skeleton className="h-28 w-full rounded-3xl" />
              </div>
            )}

            {!isNotebooksLoading && notebooks.length === 0 && (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/50 px-6 text-center">
                <BookPlus className="mb-4 h-12 w-12 text-primary" />
                <h3 className="text-lg font-semibold">还没有可编辑的 Notebook</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  先创建一本 Notebook，再进入富文本编辑器开始整理工作区笔记。
                </p>
              </div>
            )}

            {!isNotebooksLoading && notebooks.length > 0 && (
              <div className="grid gap-3">
                {notebookCards.map((notebook) => {
                  const isActive = notebook.id === selectedNotebookId;
                  return (
                    <button
                      key={notebook.id}
                      type="button"
                      className={cn(
                        "group rounded-3xl border border-border/60 bg-background/70 p-4 text-left transition-colors hover:border-primary/40 hover:bg-background",
                        isActive && "border-primary/40 bg-primary/5",
                      )}
                      onClick={() => handleOpenNotebook(notebook.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-base font-semibold">{notebook.title}</div>
                            {isActive && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                当前选中
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {notebook.summary}
                          </p>
                          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{notebook.blockCount} 个块</span>
                            <span>更新于 {notebook.updatedLabel}</span>
                            <span>{references.length} 份 Reference</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onRenameNotebook(notebook);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onDeleteNotebook(notebook);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewMode === "editor" && selectedNotebook && (
          <>
            {isDropActive && (
              <div className="mb-4 rounded-2xl border border-dashed border-primary bg-primary/10 px-4 py-4 text-center text-sm text-primary">
                当前版本暂时仍按旧逻辑追加到 Notebook 末尾；下一步会接入编辑器内精确插入。
              </div>
            )}

            <NotebookEditor notebook={selectedNotebook} />
          </>
        )}
      </div>
    </section>
  );
}
