import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  getGetDocumentKeywordsQueryKey,
  getGetPendingCardsQueryKey,
  getListDocumentsQueryKey,
  useGenerateCards,
  useGetDocumentKeywords,
  useListDocuments,
  useUpdateKeywordSelections,
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, PanelsTopLeft } from "lucide-react";
import { ReferenceImportDialog } from "@/components/reference-import-dialog";
import { ReferencePanel } from "@/components/reference-panel";
import { NotebookPanel } from "@/components/notebook-panel";
import { DocumentCardValidation } from "@/components/document-card-validation";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createNoteBlock,
  createNotebook,
  deleteReference,
  getNotebookBlocks,
  getReferenceBlocks,
  getReferenceOutline,
  importReference,
  listNotebooks,
  listReferences,
  removeNoteBlock,
  removeNotebook,
  reorderNoteBlocks,
  type NoteBlock,
  type ReferenceBlock,
  type ReferenceOutlineNode,
  type WorkspaceReference,
  updateNoteBlock,
  updateNotebook,
} from "@/lib/workspace-api";

function collectKeywordIds(nodes: ReferenceOutlineNode[]): string[] {
  const ids = new Set<string>();
  const walk = (items: ReferenceOutlineNode[]) => {
    items.forEach((item) => {
      item.keywords.forEach((keyword) => ids.add(keyword.id));
      if (item.children.length > 0) {
        walk(item.children);
      }
    });
  };
  walk(nodes);
  return [...ids];
}

function reorderIds(ids: string[], blockId: string, direction: "up" | "down") {
  const index = ids.findIndex((id) => id === blockId);
  if (index < 0) return ids;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export default function MaterialDetail() {
  const [, params] = useRoute<{ id: string }>("/materials/:id");
  const id = params?.id ?? "";
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [pendingJumpSource, setPendingJumpSource] = useState<{
    referenceId: string;
    textBlockId: string | null;
  } | null>(null);

  const {
    data: documentsData,
    isLoading: isDocsLoading,
  } = useListDocuments();
  const currentDocument = useMemo(() => {
    if (!documentsData || !id) return undefined;
    return documentsData.documents.find((doc) => String(doc.id) === id);
  }, [documentsData, id]);

  const {
    data: keywordsData,
    isLoading: isKeywordsLoading,
  } = useGetDocumentKeywords(id);

  useEffect(() => {
    if (!keywordsData?.keywords) return;
    const selected = keywordsData.keywords
      .filter((keyword) => keyword.isSelected)
      .map((keyword) => String(keyword.id));
    setSelectedIds(selected);
  }, [keywordsData]);

  const referencesQuery = useQuery({
    queryKey: ["workspace", "references", id],
    queryFn: () => listReferences(id),
    enabled: Boolean(id),
  });

  const notebooksQuery = useQuery({
    queryKey: ["workspace", "notebooks", id],
    queryFn: () => listNotebooks(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const references = referencesQuery.data?.references ?? [];
    if (references.length === 0) {
      setSelectedReferenceId(null);
      return;
    }
    if (!selectedReferenceId || !references.some((reference) => reference.id === selectedReferenceId)) {
      setSelectedReferenceId(references[0].id);
    }
  }, [referencesQuery.data?.references, selectedReferenceId]);

  useEffect(() => {
    const notebooks = notebooksQuery.data?.notebooks ?? [];
    if (notebooks.length === 0) {
      setSelectedNotebookId(null);
      return;
    }
    if (!selectedNotebookId || !notebooks.some((notebook) => notebook.id === selectedNotebookId)) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooksQuery.data?.notebooks, selectedNotebookId]);

  const referenceOutlineQuery = useQuery({
    queryKey: ["workspace", "reference-outline", selectedReferenceId],
    queryFn: () => getReferenceOutline(selectedReferenceId as string),
    enabled: Boolean(selectedReferenceId),
  });

  const referenceBlocksQuery = useQuery({
    queryKey: ["workspace", "reference-blocks", selectedReferenceId],
    queryFn: () => getReferenceBlocks(selectedReferenceId as string),
    enabled: Boolean(selectedReferenceId),
  });

  const noteBlocksQuery = useQuery({
    queryKey: ["workspace", "note-blocks", selectedNotebookId],
    queryFn: () => getNotebookBlocks(selectedNotebookId as string),
    enabled: Boolean(selectedNotebookId),
  });

  const updateKeywordsMutation = useUpdateKeywordSelections();
  const generateCardsMutation = useGenerateCards();

  const importReferenceMutation = useMutation({
    mutationFn: (input: { title: string; text: string }) => importReference(id, input),
  });

  const createNotebookMutation = useMutation({
    mutationFn: (title: string) => createNotebook(id, { title }),
  });

  const references = referencesQuery.data?.references ?? [];
  const notebooks = notebooksQuery.data?.notebooks ?? [];
  const outline = referenceOutlineQuery.data?.toc ?? [];
  const blocks = referenceBlocksQuery.data?.blocks ?? [];
  const noteBlocks = noteBlocksQuery.data?.blocks ?? [];
  const currentReferenceKeywordIds = useMemo(() => collectKeywordIds(outline), [outline]);
  const visibleSelectedKeywordIds = useMemo(
    () => currentReferenceKeywordIds.filter((keywordId) => selectedIds.includes(keywordId)),
    [currentReferenceKeywordIds, selectedIds],
  );

  const referenceTitleById = useMemo(() => {
    return Object.fromEntries(references.map((reference) => [reference.id, reference.title]));
  }, [references]);

  const sourceMetaByBlockId = useMemo(() => {
    const sourceBlockById = new Map(blocks.map((block) => [block.id, block]));
    return Object.fromEntries(
      noteBlocks.map((block) => {
        const sourceBlock = block.sourceTextBlockId ? sourceBlockById.get(block.sourceTextBlockId) : undefined;
        return [
          block.id,
          {
            referenceTitle: block.sourceReferenceId ? referenceTitleById[block.sourceReferenceId] : undefined,
            paragraphLabel: sourceBlock ? `第 ${sourceBlock.positionIndex + 1} 段` : undefined,
          },
        ];
      }),
    );
  }, [blocks, noteBlocks, referenceTitleById]);

  useEffect(() => {
    if (!pendingJumpSource || pendingJumpSource.referenceId !== selectedReferenceId) return;
    if (!pendingJumpSource.textBlockId) {
      setPendingJumpSource(null);
      return;
    }
    const element = document.getElementById(`reference-block-id-${pendingJumpSource.textBlockId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingJumpSource(null);
  }, [pendingJumpSource, selectedReferenceId, blocks]);

  const invalidateWorkspaceQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDocumentKeywordsQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: ["workspace", "references", id] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] }),
      queryClient.invalidateQueries({ queryKey: getGetPendingCardsQueryKey({ documentId: id }) }),
    ]);
  }, [id, queryClient]);

  const handleToggleKeyword = useCallback((keywordId: string) => {
    setSelectedIds((prev) => (
      prev.includes(keywordId)
        ? prev.filter((idValue) => idValue !== keywordId)
        : [...prev, keywordId]
    ));
  }, []);

  const handleImportReference = async (input: { title: string; text: string }) => {
    try {
      const result = await importReferenceMutation.mutateAsync(input);
      await invalidateWorkspaceQueries();
      setSelectedReferenceId(result.reference.id);
      setIsImportOpen(false);
      toast({ title: "Reference 已导入", description: result.reference.title });
    } catch (error: any) {
      toast({
        title: "导入失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReference = async (reference: WorkspaceReference) => {
    if (!window.confirm(`确认删除 Reference「${reference.title}」吗？`)) return;
    try {
      await deleteReference(reference.id);
      await invalidateWorkspaceQueries();
      if (selectedReferenceId === reference.id) {
        setSelectedReferenceId(null);
      }
      toast({ title: "已删除 Reference", description: reference.title });
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleCreateNotebook = async () => {
    const title = window.prompt("请输入 Notebook 标题", "学习笔记");
    if (!title?.trim()) return;
    try {
      const notebook = await createNotebookMutation.mutateAsync(title.trim());
      await queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] });
      setSelectedNotebookId(notebook.id);
      toast({ title: "Notebook 已创建", description: notebook.title });
    } catch (error: any) {
      toast({
        title: "创建失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleRenameNotebook = async (notebook: { id: string; title: string }) => {
    const title = window.prompt("请输入新的 Notebook 标题", notebook.title);
    if (!title?.trim() || title.trim() === notebook.title) return;
    try {
      await updateNotebook(notebook.id, { title: title.trim() });
      await queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] });
      toast({ title: "Notebook 已更新", description: title.trim() });
    } catch (error: any) {
      toast({
        title: "更新失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNotebook = async (notebook: { id: string; title: string }) => {
    if (!window.confirm(`确认删除 Notebook「${notebook.title}」吗？`)) return;
    try {
      await removeNotebook(notebook.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] }),
        queryClient.invalidateQueries({ queryKey: ["workspace", "note-blocks", notebook.id] }),
      ]);
      if (selectedNotebookId === notebook.id) {
        setSelectedNotebookId(null);
      }
      toast({ title: "Notebook 已删除", description: notebook.title });
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const ensureNotebookSelected = useCallback(() => {
    if (!selectedNotebookId) {
      toast({
        title: "请先创建或选择 Notebook",
        description: "右侧需要先有一个可写入的 Notebook。",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [selectedNotebookId, toast]);

  const refreshSelectedNotebook = useCallback(async () => {
    if (!selectedNotebookId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] }),
      queryClient.invalidateQueries({ queryKey: ["workspace", "note-blocks", selectedNotebookId] }),
    ]);
  }, [id, queryClient, selectedNotebookId]);

  const handleCreateBlock = async (blockType: "text" | "heading") => {
    if (!ensureNotebookSelected()) return;
    try {
      await createNoteBlock(selectedNotebookId as string, {
        blockType,
        content: blockType === "heading" ? "新的标题" : "新的笔记",
      });
      await refreshSelectedNotebook();
    } catch (error: any) {
      toast({
        title: "创建笔记块失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleSendBlockToNotebook = async (block: ReferenceBlock) => {
    if (!ensureNotebookSelected()) return;
    if (!selectedReferenceId) return;
    try {
      await createNoteBlock(selectedNotebookId as string, {
        blockType: "quote",
        content: block.content,
        sourceReferenceId: selectedReferenceId,
        sourceTextBlockId: block.id,
      });
      await refreshSelectedNotebook();
      toast({ title: "已发送到 Notebook", description: `已加入第 ${block.positionIndex + 1} 段` });
    } catch (error: any) {
      toast({
        title: "发送失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleSaveBlock = async (blockId: string, input: { content: string }) => {
    try {
      await updateNoteBlock(blockId, input);
      await refreshSelectedNotebook();
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await removeNoteBlock(blockId);
      await refreshSelectedNotebook();
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    if (!selectedNotebookId) return;
    const nextOrder = reorderIds(noteBlocks.map((block) => block.id), blockId, direction);
    if (nextOrder.join("|") === noteBlocks.map((block) => block.id).join("|")) return;
    try {
      await reorderNoteBlocks(selectedNotebookId, nextOrder);
      await refreshSelectedNotebook();
    } catch (error: any) {
      toast({
        title: "重排失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleGenerateCards = async () => {
    if (!id || !selectedReferenceId) return;
    if (visibleSelectedKeywordIds.length === 0) {
      toast({ title: "请先选择关键词", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      await updateKeywordsMutation.mutateAsync({
        documentId: id,
        data: { selectedIds } as never,
      });
      const result = await generateCardsMutation.mutateAsync({
        data: { documentId: id, keywordIds: visibleSelectedKeywordIds } as never,
      });
      await queryClient.invalidateQueries({
        queryKey: getGetPendingCardsQueryKey({ documentId: id }),
      });
      setIsValidationOpen(true);
      toast({ title: "生成成功", description: `已生成 ${result.total} 张候选卡片` });
    } catch (error: any) {
      toast({
        title: "生成失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleJumpToSource = (block: NoteBlock) => {
    if (!block.sourceReferenceId) return;
    setSelectedReferenceId(block.sourceReferenceId);
    setPendingJumpSource({
      referenceId: block.sourceReferenceId,
      textBlockId: block.sourceTextBlockId,
    });
  };

  const isLoading = isDocsLoading || (id !== "" && isKeywordsLoading);
  const hasError = !isLoading && !currentDocument;
  const workspaceTitle = currentDocument?.title ?? "工作区详情";

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild size="icon" variant="ghost" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <PanelsTopLeft className="h-3.5 w-3.5 text-primary" />
                <span>工作区 · ID {id}</span>
              </div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{workspaceTitle}</h1>
              <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                左侧管理 Reference 和关键词，右侧整理 Notebook，底部完成候选卡片校验。
              </p>
            </div>
          </div>
          <Button className="gap-1.5" onClick={() => setIsImportOpen(true)}>
            <BookOpen className="h-4 w-4" />
            导入新 Reference
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-[720px] rounded-3xl" />
            <Skeleton className="h-[720px] rounded-3xl" />
          </div>
        )}

        {hasError && !isLoading && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            找不到对应的工作区，可能已被删除或链接有误。
          </div>
        )}

        {!isLoading && currentDocument && (
          <>
            {isMobile ? (
              <div className="space-y-6">
                <ReferencePanel
                  references={references}
                  selectedReferenceId={selectedReferenceId}
                  blocks={blocks}
                  outline={outline}
                  selectedKeywordIds={visibleSelectedKeywordIds}
                  isReferencesLoading={referencesQuery.isLoading}
                  isBlocksLoading={referenceBlocksQuery.isLoading}
                  isOutlineLoading={referenceOutlineQuery.isLoading}
                  isGenerating={isGenerating}
                  canGenerate={visibleSelectedKeywordIds.length > 0}
                  onSelectReference={setSelectedReferenceId}
                  onOpenImport={() => setIsImportOpen(true)}
                  onDeleteReference={handleDeleteReference}
                  onToggleKeyword={handleToggleKeyword}
                  onGenerateCards={handleGenerateCards}
                  onOpenValidation={() => setIsValidationOpen(true)}
                  onSendBlockToNotebook={handleSendBlockToNotebook}
                />
                <NotebookPanel
                  documentTitle={workspaceTitle}
                  notebooks={notebooks}
                  selectedNotebookId={selectedNotebookId}
                  blocks={noteBlocks}
                  references={references}
                  sourceMetaByBlockId={sourceMetaByBlockId}
                  isNotebooksLoading={notebooksQuery.isLoading}
                  isBlocksLoading={noteBlocksQuery.isLoading}
                  onSelectNotebook={setSelectedNotebookId}
                  onCreateNotebook={handleCreateNotebook}
                  onRenameNotebook={handleRenameNotebook}
                  onDeleteNotebook={handleDeleteNotebook}
                  onCreateBlock={handleCreateBlock}
                  onSaveBlock={handleSaveBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onMoveBlockUp={(blockId) => handleMoveBlock(blockId, "up")}
                  onMoveBlockDown={(blockId) => handleMoveBlock(blockId, "down")}
                  onJumpToSource={handleJumpToSource}
                />
              </div>
            ) : (
              <div className="h-[calc(100vh-12rem)] min-h-[720px]">
                <ResizablePanelGroup direction="horizontal" className="rounded-3xl border border-border/60 bg-background/40">
                  <ResizablePanel defaultSize={58} minSize={45}>
                    <div className="h-full p-3">
                      <ReferencePanel
                        references={references}
                        selectedReferenceId={selectedReferenceId}
                        blocks={blocks}
                        outline={outline}
                        selectedKeywordIds={visibleSelectedKeywordIds}
                        isReferencesLoading={referencesQuery.isLoading}
                        isBlocksLoading={referenceBlocksQuery.isLoading}
                        isOutlineLoading={referenceOutlineQuery.isLoading}
                        isGenerating={isGenerating}
                        canGenerate={visibleSelectedKeywordIds.length > 0}
                        onSelectReference={setSelectedReferenceId}
                        onOpenImport={() => setIsImportOpen(true)}
                        onDeleteReference={handleDeleteReference}
                        onToggleKeyword={handleToggleKeyword}
                        onGenerateCards={handleGenerateCards}
                        onOpenValidation={() => setIsValidationOpen(true)}
                        onSendBlockToNotebook={handleSendBlockToNotebook}
                      />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={42} minSize={32}>
                    <div className="h-full p-3">
                      <NotebookPanel
                        documentTitle={workspaceTitle}
                        notebooks={notebooks}
                        selectedNotebookId={selectedNotebookId}
                        blocks={noteBlocks}
                        references={references}
                        sourceMetaByBlockId={sourceMetaByBlockId}
                        isNotebooksLoading={notebooksQuery.isLoading}
                        isBlocksLoading={noteBlocksQuery.isLoading}
                        onSelectNotebook={setSelectedNotebookId}
                        onCreateNotebook={handleCreateNotebook}
                        onRenameNotebook={handleRenameNotebook}
                        onDeleteNotebook={handleDeleteNotebook}
                        onCreateBlock={handleCreateBlock}
                        onSaveBlock={handleSaveBlock}
                        onDeleteBlock={handleDeleteBlock}
                        onMoveBlockUp={(blockId) => handleMoveBlock(blockId, "up")}
                        onMoveBlockDown={(blockId) => handleMoveBlock(blockId, "down")}
                        onJumpToSource={handleJumpToSource}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            )}
          </>
        )}
      </div>

      <ReferenceImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSubmit={handleImportReference}
        isSubmitting={importReferenceMutation.isPending}
      />

      <Sheet open={isValidationOpen} onOpenChange={setIsValidationOpen}>
        <SheetContent side="bottom" className="h-[70vh] overflow-y-auto px-4 pb-6 pt-10 md:px-6">
          <SheetHeader>
            <SheetTitle>候选卡片校验</SheetTitle>
            <SheetDescription>
              在当前工作区中集中审阅、保留、编辑并分配新生成的候选卡片。
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <DocumentCardValidation documentId={id} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
