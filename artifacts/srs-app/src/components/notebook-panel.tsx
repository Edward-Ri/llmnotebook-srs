import { BookPlus, FilePlus2, NotebookPen, Pencil, Plus, TextCursorInput, Trash2 } from "lucide-react";
import type { NoteBlock, NotebookSummary, WorkspaceReference } from "@/lib/workspace-api";
import { NoteBlockItem } from "@/components/note-block-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type SourceMetaByBlockId = Record<string, { referenceTitle?: string; paragraphLabel?: string }>;

interface NotebookPanelProps {
  documentTitle: string;
  notebooks: NotebookSummary[];
  selectedNotebookId: string | null;
  blocks: NoteBlock[];
  references: WorkspaceReference[];
  sourceMetaByBlockId: SourceMetaByBlockId;
  isNotebooksLoading: boolean;
  isBlocksLoading: boolean;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => Promise<void>;
  onRenameNotebook: (notebook: NotebookSummary) => Promise<void>;
  onDeleteNotebook: (notebook: NotebookSummary) => Promise<void>;
  onCreateBlock: (blockType: "text" | "heading") => Promise<void>;
  onSaveBlock: (blockId: string, input: { content: string }) => Promise<void>;
  onDeleteBlock: (blockId: string) => Promise<void>;
  onMoveBlockUp: (blockId: string) => Promise<void>;
  onMoveBlockDown: (blockId: string) => Promise<void>;
  onJumpToSource?: (block: NoteBlock) => void;
}

export function NotebookPanel({
  documentTitle,
  notebooks,
  selectedNotebookId,
  blocks,
  references,
  sourceMetaByBlockId,
  isNotebooksLoading,
  isBlocksLoading,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onCreateBlock,
  onSaveBlock,
  onDeleteBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onJumpToSource,
}: NotebookPanelProps) {
  const selectedNotebook = notebooks.find((notebook) => notebook.id === selectedNotebookId) ?? null;

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
              管理当前工作区下的笔记本和笔记块。
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onCreateNotebook}>
            <Plus className="h-4 w-4" />
            新建 Notebook
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isNotebooksLoading && (
            <>
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </>
          )}

          {!isNotebooksLoading && notebooks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-3 text-xs text-muted-foreground">
              还没有 Notebook，先创建一本开始整理笔记。
            </div>
          )}

          {!isNotebooksLoading && notebooks.map((notebook) => {
            const isActive = notebook.id === selectedNotebookId;
            return (
              <button
                key={notebook.id}
                type="button"
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-foreground hover:border-border",
                ].join(" ")}
                onClick={() => onSelectNotebook(notebook.id)}
              >
                <span className="truncate">{notebook.title}</span>
                <span className={isActive ? "text-primary-foreground/80" : "text-muted-foreground"}>
                  {notebook.blockCount}
                </span>
              </button>
            );
          })}
        </div>

        {selectedNotebook && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-3">
            <div>
              <div className="text-sm font-medium">{selectedNotebook.title}</div>
              <div className="text-xs text-muted-foreground">
                {selectedNotebook.blockCount} 个笔记块 · {references.length} 份 Reference
              </div>
            </div>
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

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-5">
        {!selectedNotebook && !isNotebooksLoading && (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/50 px-6 text-center">
            <BookPlus className="mb-4 h-12 w-12 text-primary" />
            <h3 className="text-lg font-semibold">还没有可编辑的 Notebook</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              先创建一本 Notebook，然后就可以从左侧把整段原文送过来，或者直接在这里整理笔记。
            </p>
          </div>
        )}

        {selectedNotebook && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onCreateBlock("text")}>
                <FilePlus2 className="h-4 w-4" />
                新建文本块
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onCreateBlock("heading")}>
                <TextCursorInput className="h-4 w-4" />
                新建标题块
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="space-y-3 pb-2">
                {isBlocksLoading && (
                  <>
                    <Skeleton className="h-28 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </>
                )}

                {!isBlocksLoading && blocks.length === 0 && (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/50 px-6 text-center">
                    <NotebookPen className="mb-4 h-10 w-10 text-primary" />
                    <h3 className="text-lg font-semibold">还没有笔记</h3>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                      可以先从左侧把整段原文送过来，也可以直接新建文本块开始记录。
                    </p>
                  </div>
                )}

                {!isBlocksLoading && blocks.map((block, index) => (
                  <NoteBlockItem
                    key={block.id}
                    block={block}
                    sourceMeta={sourceMetaByBlockId[block.id]}
                    canMoveUp={index > 0}
                    canMoveDown={index < blocks.length - 1}
                    onSave={onSaveBlock}
                    onDelete={onDeleteBlock}
                    onMoveUp={onMoveBlockUp}
                    onMoveDown={onMoveBlockDown}
                    onJumpToSource={onJumpToSource}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </section>
  );
}
