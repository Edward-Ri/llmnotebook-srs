import { useEffect, useRef, useState, type DragEvent } from "react";
import { BookOpen, Sparkles, Trash2, Upload } from "lucide-react";
import type {
  ReferenceBlock,
  ReferenceBlockDragPayload,
  ReferenceOutlineNode,
  ReferenceSelectionPayload,
  WorkspaceReference,
} from "@/lib/workspace-api";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type FlatOutlineNode = {
  node: ReferenceOutlineNode;
  depth: number;
};

function flattenOutline(nodes: ReferenceOutlineNode[], depth = 0): FlatOutlineNode[] {
  const result: FlatOutlineNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.children.length > 0) {
      result.push(...flattenOutline(node.children, depth + 1));
    }
  }
  return result;
}

interface ReferencePanelProps {
  references: WorkspaceReference[];
  selectedReferenceId: string | null;
  blocks: ReferenceBlock[];
  outline: ReferenceOutlineNode[];
  selectedKeywordIds: string[];
  isReferencesLoading: boolean;
  isBlocksLoading: boolean;
  isOutlineLoading: boolean;
  isGenerating: boolean;
  canGenerate: boolean;
  onSelectReference: (referenceId: string) => void;
  onOpenImport: () => void;
  onDeleteReference: (reference: WorkspaceReference) => Promise<void>;
  onToggleKeyword: (keywordId: string) => void;
  onGenerateCards: () => Promise<void>;
  onOpenValidation: () => void;
  onSendBlockToNotebook: (block: ReferenceBlock) => Promise<void>;
  onSendSelectionToNotebook: (payload: ReferenceSelectionPayload) => Promise<void>;
}

export function ReferencePanel({
  references,
  selectedReferenceId,
  blocks,
  outline,
  selectedKeywordIds,
  isReferencesLoading,
  isBlocksLoading,
  isOutlineLoading,
  isGenerating,
  canGenerate,
  onSelectReference,
  onOpenImport,
  onDeleteReference,
  onToggleKeyword,
  onGenerateCards,
  onOpenValidation,
  onSendBlockToNotebook,
  onSendSelectionToNotebook,
}: ReferencePanelProps) {
  const flatOutline = flattenOutline(outline);
  const selectedReference = references.find((reference) => reference.id === selectedReferenceId) ?? null;
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectionPayload, setSelectionPayload] = useState<ReferenceSelectionPayload | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });

  const clearSelectionToolbar = () => {
    setSelectionPayload(null);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
        clearSelectionToolbar();
      }
    };
    const handleScroll = () => {
      clearSelectionToolbar();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const handleDragStart = (event: DragEvent<HTMLElement>, block: ReferenceBlock) => {
    if (!selectedReferenceId) return;
    const payload: ReferenceBlockDragPayload = {
      type: "reference-block",
      text: block.content,
      referenceId: selectedReferenceId,
      textBlockId: block.id,
      positionIndex: block.positionIndex,
    };
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", block.content);
  };
  const handleSelectionCapture = () => {
    if (!selectedReferenceId || !contentContainerRef.current) {
      clearSelectionToolbar();
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      clearSelectionToolbar();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      clearSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as Element | null);
    const endNode = range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : (range.endContainer as Element | null);

    if (!startNode || !endNode) {
      clearSelectionToolbar();
      return;
    }

    const startBlock = startNode.closest<HTMLElement>("[data-text-block-id]");
    const endBlock = endNode.closest<HTMLElement>("[data-text-block-id]");
    if (!startBlock || !endBlock || startBlock !== endBlock) {
      clearSelectionToolbar();
      return;
    }

    if (!contentContainerRef.current.contains(startBlock)) {
      clearSelectionToolbar();
      return;
    }

    const textBlockId = startBlock.dataset.textBlockId;
    if (!textBlockId) {
      clearSelectionToolbar();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      clearSelectionToolbar();
      return;
    }

    setSelectionPayload({
      type: "reference-selection",
      text,
      referenceId: selectedReferenceId,
      textBlockId,
      selectionOffset: range.startOffset,
      selectionLength: selection.toString().length,
    });
    setToolbarPosition({
      top: Math.max(rect.top - 64, 12),
      left: rect.left + rect.width / 2,
    });
  };

  return (
    <section className="flex h-full min-h-[480px] flex-col rounded-3xl border border-border/60 bg-card/80">
      <div className="border-b border-border/60 px-4 py-4 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Reference 阅读区</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">原文与关键词</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              逐份切换 Reference，阅读原文、选择关键词并生成候选卡片。
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={onOpenImport}>
            <Upload className="h-4 w-4" />
            导入 Reference
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isReferencesLoading && (
            <>
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </>
          )}

          {!isReferencesLoading && references.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-3 text-xs text-muted-foreground">
              还没有导入任何 Reference，先新增一份材料。
            </div>
          )}

          {!isReferencesLoading && references.map((reference) => {
            const isActive = reference.id === selectedReferenceId;
            return (
              <button
                key={reference.id}
                type="button"
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-foreground hover:border-border",
                ].join(" ")}
                onClick={() => onSelectReference(reference.id)}
              >
                <span className="max-w-[200px] truncate">{reference.title}</span>
                <span className={isActive ? "text-primary-foreground/80" : "text-muted-foreground"}>
                  {reference.keywordCount}
                </span>
              </button>
            );
          })}
        </div>

        {selectedReference && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-3">
            <div>
              <div className="text-sm font-medium">{selectedReference.title}</div>
              <div className="text-xs text-muted-foreground">
                {selectedReference.textBlockCount} 段原文 · {selectedReference.keywordCount} 个关键词
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => onDeleteReference(selectedReference)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)] md:px-5">
        <div className="min-h-0 rounded-3xl border border-border/60 bg-background/50">
          <div className="border-b border-border/60 px-4 py-3 text-sm font-medium">原文段落</div>
          <ScrollArea className="h-[420px] md:h-full">
            <div
              ref={contentContainerRef}
              className="space-y-3 p-4"
              onMouseUp={handleSelectionCapture}
              onKeyUp={handleSelectionCapture}
            >
              {isBlocksLoading && (
                <>
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </>
              )}

              {!isBlocksLoading && blocks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  当前 Reference 还没有可展示的原文段落。
                </div>
              )}

              {!isBlocksLoading && blocks.map((block) => (
                <article
                  key={block.id}
                  id={`reference-block-id-${block.id}`}
                  data-position-index={block.positionIndex}
                  data-text-block-id={block.id}
                  draggable={Boolean(selectedReferenceId)}
                  onDragStart={(event) => handleDragStart(event, block)}
                  className="rounded-2xl border border-border/60 bg-card/90 p-4 transition-colors active:cursor-grabbing md:cursor-grab"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>第 {block.positionIndex + 1} 段</span>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => onSendBlockToNotebook(block)}>
                      <span>📋</span>
                      送到笔记
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{block.content}</p>
                </article>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-background/50">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>目录与关键词</span>
              </div>
              <span className="text-xs text-muted-foreground">
                已选 {selectedKeywordIds.length} 个
              </span>
            </div>
          </div>

          <ScrollArea className="h-[320px] flex-1 md:h-full">
            <div className="space-y-3 p-4">
              {isOutlineLoading && (
                <>
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </>
              )}

              {!isOutlineLoading && flatOutline.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  当前 Reference 还没有目录结构。
                </div>
              )}

              {!isOutlineLoading && flatOutline.map(({ node, depth }) => (
                <div key={node.id} className="rounded-2xl border border-border/60 bg-card/90 p-3">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      const target = document.querySelector(
                        `[data-position-index="${node.startIndex}"]`,
                      );
                      target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <div style={{ paddingLeft: `${depth * 12}px` }}>
                      <div className="text-sm font-medium text-foreground">{node.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        段落 {node.startIndex + 1} - {node.endIndex + 1}
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-1.5" style={{ paddingLeft: `${depth * 12}px` }}>
                    {node.keywords.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">本节暂无关键词</span>
                    )}
                    {node.keywords.map((keyword) => {
                      const isSelected = selectedKeywordIds.includes(keyword.id);
                      return (
                        <button
                          key={keyword.id}
                          type="button"
                          onClick={() => onToggleKeyword(keyword.id)}
                        >
                          <Badge variant={isSelected ? "default" : "outline"}>{keyword.word}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 px-4 py-4">
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" disabled={!canGenerate || isGenerating} onClick={() => void onGenerateCards()}>
                {isGenerating ? "生成中..." : "生成候选卡片"}
              </Button>
              <Button variant="outline" onClick={onOpenValidation}>
                校验候选卡片
              </Button>
            </div>
          </div>
        </div>
      </div>
      <SelectionToolbar
        open={Boolean(selectionPayload)}
        top={toolbarPosition.top}
        left={toolbarPosition.left}
        text={selectionPayload?.text ?? ""}
        onSend={async () => {
          if (!selectionPayload) return;
          await onSendSelectionToNotebook(selectionPayload);
          clearSelectionToolbar();
          window.getSelection()?.removeAllRanges();
        }}
      />
    </section>
  );
}
