import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Save, Trash2, X } from "lucide-react";
import type { NoteBlock } from "@/lib/workspace-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SourceMeta = {
  referenceTitle?: string;
  paragraphLabel?: string;
};

interface NoteBlockItemProps {
  block: NoteBlock;
  sourceMeta?: SourceMeta;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSave: (blockId: string, input: { content: string }) => Promise<void>;
  onDelete: (blockId: string) => Promise<void>;
  onMoveUp: (blockId: string) => Promise<void>;
  onMoveDown: (blockId: string) => Promise<void>;
  onJumpToSource?: (block: NoteBlock) => void;
}

export function NoteBlockItem({
  block,
  sourceMeta,
  canMoveUp,
  canMoveDown,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  onJumpToSource,
}: NoteBlockItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(block.content);
  const isQuote = block.blockType === "quote";
  const isHeading = block.blockType === "heading";

  useEffect(() => {
    setDraftContent(block.content);
    setIsEditing(false);
  }, [block.content, block.id]);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/60 bg-background/70 p-3",
        isQuote && "border-l-4 border-l-primary bg-primary/5",
        isHeading && "bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>{block.blockType}</span>
            <span>#{block.positionIndex + 1}</span>
          </div>

          {isEditing ? (
            <Textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              className="min-h-[120px]"
              onKeyDown={async (event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  if (!draftContent.trim()) return;
                  await onSave(block.id, { content: draftContent.trim() });
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftContent(block.content);
                  setIsEditing(false);
                }
              }}
            />
          ) : (
            <p
              className={cn(
                "whitespace-pre-wrap text-sm leading-6 text-foreground",
                isHeading && "text-base font-semibold",
                isQuote && "italic text-foreground/90",
              )}
            >
              {block.content}
            </p>
          )}

          {isQuote && (
            <div className="mt-3 text-xs text-muted-foreground">
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => onJumpToSource?.(block)}
              >
                <span>📎</span>
                <span>
                  引自 {sourceMeta?.referenceTitle ?? "Reference"}
                  {sourceMeta?.paragraphLabel ? ` · ${sourceMeta.paragraphLabel}` : ""}
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isEditing ? (
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  if (!draftContent.trim()) return;
                  await onSave(block.id, { content: draftContent.trim() });
                }}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setDraftContent(block.content);
                  setIsEditing(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" disabled={!canMoveUp} onClick={() => onMoveUp(block.id)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled={!canMoveDown} onClick={() => onMoveDown(block.id)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={async () => {
              if (!window.confirm("确认删除这个笔记块吗？")) return;
              await onDelete(block.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
