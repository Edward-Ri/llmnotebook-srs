import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { Check, Loader2, PencilLine } from "lucide-react";
import { EditorBubbleMenu } from "@/components/editor-bubble-menu";
import { SlashCommandMenu } from "@/components/slash-command-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  type NotebookSummary,
  type ReferenceBlockDragPayload,
  type TiptapDoc,
  getNotebookDoc,
  saveNotebookDoc,
  updateNotebook,
} from "@/lib/workspace-api";
import { createNotebookExtensions, emptyNotebookDoc } from "@/lib/tiptap-extensions";
import { cn } from "@/lib/utils";

interface NotebookEditorProps {
  notebook: NotebookSummary;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function parseReferenceBlockDragPayload(raw: string): ReferenceBlockDragPayload | null {
  try {
    const payload = JSON.parse(raw) as ReferenceBlockDragPayload;
    return payload.type === "reference-block" ? payload : null;
  } catch {
    return null;
  }
}

function NotebookEditorSurface({
  notebook,
  initialDoc,
}: {
  notebook: NotebookSummary;
  initialDoc: TiptapDoc;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(notebook.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDraggingReference, setIsDraggingReference] = useState(false);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [willAppendAtEnd, setWillAppendAtEnd] = useState(false);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const dropNoticeTimerRef = useRef<number | null>(null);
  const latestDocRef = useRef<TiptapDoc>(initialDoc);
  const mountedRef = useRef(true);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const extensions = useMemo(() => createNotebookExtensions(), []);

  const saveDocMutation = useMutation({
    mutationFn: (doc: TiptapDoc) => saveNotebookDoc(notebook.id, { doc }),
    onMutate: () => {
      setSaveState("saving");
      setSaveError(null);
    },
    onSuccess: () => {
      if (!mountedRef.current) return;
      setSaveState("saved");
      void queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks"] });
    },
    onError: (error: unknown) => {
      if (!mountedRef.current) return;
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "保存失败");
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: (nextTitle: string) => updateNotebook(notebook.id, { title: nextTitle }),
    onSuccess: async (updated) => {
      setTitle(updated.title);
      await queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks"] });
    },
  });

  const flushSave = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void saveDocMutation.mutateAsync(latestDocRef.current);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialDoc as JSONContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[320px] px-1 py-1 outline-none " +
          "prose-headings:mb-3 prose-headings:mt-5 prose-p:my-2 prose-li:my-1 " +
          "[&_blockquote[data-source-blockquote='true']]:my-4 " +
          "[&_blockquote[data-source-blockquote='true']]:rounded-2xl " +
          "[&_blockquote[data-source-blockquote='true']]:border-l-4 " +
          "[&_blockquote[data-source-blockquote='true']]:border-l-primary " +
          "[&_blockquote[data-source-blockquote='true']]:bg-primary/5 " +
          "[&_blockquote[data-source-blockquote='true']]:px-4 " +
          "[&_blockquote[data-source-blockquote='true']]:py-3 " +
          "[&_blockquote_[data-source-content='true']]:text-foreground/90 " +
          "[&_blockquote_[data-source-label='true']]:mt-2 " +
          "[&_blockquote_[data-source-label='true']]:text-xs " +
          "[&_blockquote_[data-source-label='true']]:text-muted-foreground",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      latestDocRef.current = currentEditor.getJSON() as TiptapDoc;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void saveDocMutation.mutateAsync(latestDocRef.current);
      }, 1000);
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (dropNoticeTimerRef.current !== null) {
        window.clearTimeout(dropNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current !== null) {
        flushSave();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimerRef.current !== null) {
        flushSave();
      }
    };
  });

  useEffect(() => {
    setTitle(notebook.title);
  }, [notebook.id, notebook.title]);

  const clearDragFeedback = () => {
    dragDepthRef.current = 0;
    setIsDraggingReference(false);
    setDropIndicatorTop(null);
    setWillAppendAtEnd(false);
  };

  const showDropNotice = (message: string) => {
    if (dropNoticeTimerRef.current !== null) {
      window.clearTimeout(dropNoticeTimerRef.current);
    }
    setDropNotice(message);
    dropNoticeTimerRef.current = window.setTimeout(() => {
      setDropNotice(null);
      dropNoticeTimerRef.current = null;
    }, 1600);
  };

  const updateDropFeedback = (event: DragEvent<HTMLDivElement>) => {
    if (!editor || !editorShellRef.current) return false;

    const raw = event.dataTransfer.getData("application/json");
    const payload = parseReferenceBlockDragPayload(raw);
    if (!payload) return false;

    const coordsPosition = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });

    setIsDraggingReference(true);

    if (coordsPosition?.pos === undefined) {
      setDropIndicatorTop(null);
      setWillAppendAtEnd(true);
      return true;
    }

    const coords = editor.view.coordsAtPos(coordsPosition.pos);
    const shellRect = editorShellRef.current.getBoundingClientRect();
    const nextTop = Math.max(12, coords.top - shellRect.top);
    setDropIndicatorTop(nextTop);
    setWillAppendAtEnd(false);
    return true;
  };

  const handleCommitTitle = async () => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === notebook.title) {
      setTitle(notebook.title);
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateTitleMutation.mutateAsync(nextTitle);
      setIsEditingTitle(false);
    } catch (error: unknown) {
      setTitle(notebook.title);
      setIsEditingTitle(false);
      toast({
        title: "标题更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleEditorDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!updateDropFeedback(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleEditorDragEnter = (event: DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData("application/json");
    if (!parseReferenceBlockDragPayload(raw)) return;
    dragDepthRef.current += 1;
    void updateDropFeedback(event);
  };

  const handleEditorDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData("application/json");
    if (!parseReferenceBlockDragPayload(raw)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0 && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      clearDragFeedback();
    }
  };

  const handleEditorDrop = (event: DragEvent<HTMLDivElement>) => {
    const raw = event.dataTransfer.getData("application/json");
    if (!editor || !raw) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      const payload = parseReferenceBlockDragPayload(raw);
      if (!payload) {
        return;
      }

      const contentNode: JSONContent = {
        type: "sourceBlockquote",
        attrs: {
          sourceReferenceId: payload.referenceId,
          sourceTextBlockId: payload.textBlockId,
          sourceReferenceTitle: payload.referenceTitle,
          sourceParagraphLabel: payload.paragraphLabel,
          selectionOffset: payload.selectionOffset,
          selectionLength: payload.selectionLength,
        },
        content: [
          {
            type: "paragraph",
            content: payload.text.length > 0
              ? [{ type: "text", text: payload.text }]
              : undefined,
          },
        ],
      };

      const coordsPosition = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });

      if (coordsPosition?.pos !== undefined) {
        editor.chain().focus().insertContentAt(coordsPosition.pos, contentNode).run();
        clearDragFeedback();
        showDropNotice("已插入引用");
        return;
      }

      editor.chain().focus().insertContent(contentNode).run();
      clearDragFeedback();
      showDropNotice("已插入引用");
    } catch {
      clearDragFeedback();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-border/60 bg-background/60">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <Input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => {
                  void handleCommitTitle();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCommitTitle();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setTitle(notebook.title);
                    setIsEditingTitle(false);
                  }
                }}
                className="h-11 border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
              />
            ) : (
              <button
                type="button"
                className="inline-flex max-w-full items-center gap-2 text-left text-2xl font-semibold tracking-tight"
                onClick={() => setIsEditingTitle(true)}
              >
                <span className="truncate">{title}</span>
                <PencilLine className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              自动保存已开启。输入 `/` 可快速切换标题、列表和引用块。
            </p>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                saveState === "error" && "border-destructive/40 text-destructive",
              )}
            >
              {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveState === "saved" && <Check className="h-3.5 w-3.5" />}
              <span>
                {saveState === "saving" && "保存中"}
                {saveState === "saved" && "已保存"}
                {saveState === "error" && (saveError ?? "保存失败")}
                {saveState === "idle" && "自动保存"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div
          ref={editorShellRef}
          className={cn(
            "relative mx-auto max-w-3xl rounded-3xl transition-colors",
            isDraggingReference && "bg-primary/5 ring-1 ring-primary/30",
          )}
          onDragEnter={handleEditorDragEnter}
          onDragLeave={handleEditorDragLeave}
          onDragOver={handleEditorDragOver}
          onDrop={handleEditorDrop}
        >
          {isDraggingReference && dropIndicatorTop !== null && (
            <div
              className="pointer-events-none absolute left-3 right-3 z-20 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
              style={{ top: dropIndicatorTop }}
            />
          )}
          {isDraggingReference && willAppendAtEnd && (
            <div className="pointer-events-none absolute inset-x-4 bottom-3 z-20 rounded-xl border border-dashed border-primary/40 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              当前无法精确定位，松开后将追加到文末。
            </div>
          )}
          {dropNotice && (
            <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-border/60 bg-background/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
              {dropNotice}
            </div>
          )}
          {editor && <EditorBubbleMenu editor={editor} />}
          <SlashCommandMenu editor={editor} containerRef={editorShellRef} />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

export function NotebookEditor({ notebook }: NotebookEditorProps) {
  const notebookDocQuery = useQuery({
    queryKey: ["workspace", "notebook-doc", notebook.id],
    queryFn: () => getNotebookDoc(notebook.id),
    enabled: Boolean(notebook.id),
  });

  if (notebookDocQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-border/60 bg-background/60 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="mt-3 h-4 w-72 rounded-xl" />
        <Skeleton className="mt-6 h-[360px] w-full rounded-2xl" />
      </div>
    );
  }

  if (notebookDocQuery.isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-destructive/40 bg-destructive/5 px-6 text-center text-sm text-destructive">
        笔记文档加载失败，请稍后重试。
      </div>
    );
  }

  return (
    <NotebookEditorSurface
      key={notebook.id}
      notebook={notebook}
      initialDoc={notebookDocQuery.data?.doc ?? { ...emptyNotebookDoc, content: [...emptyNotebookDoc.content] }}
    />
  );
}
