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
  getReferenceBlocks,
  getReferenceOutline,
  importReference,
  listNotebooks,
  listReferences,
  removeNotebook,
  type ReferenceOutlineNode,
  type ReferenceSelectionPayload,
  type WorkspaceReference,
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
  const [isNotebookDropActive, setIsNotebookDropActive] = useState(false);

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
    retry: false,
  });

  const notebooksQuery = useQuery({
    queryKey: ["workspace", "notebooks", id],
    queryFn: () => listNotebooks(id),
    enabled: Boolean(id),
    retry: false,
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
  const currentReferenceKeywordIds = useMemo(() => collectKeywordIds(outline), [outline]);
  const visibleSelectedKeywordIds = useMemo(
    () => currentReferenceKeywordIds.filter((keywordId) => selectedIds.includes(keywordId)),
    [currentReferenceKeywordIds, selectedIds],
  );

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

  const refreshNotebookList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace", "notebooks", id] });
  }, [id, queryClient]);

  const handleSendSelectionToNotebook = async (payload: ReferenceSelectionPayload) => {
    if (!ensureNotebookSelected()) return;
    try {
      await createNoteBlock(selectedNotebookId as string, {
        blockType: "quote",
        content: payload.text,
        sourceReferenceId: payload.referenceId,
        sourceTextBlockId: payload.textBlockId,
        selectionOffset: payload.selectionOffset,
        selectionLength: payload.selectionLength,
      });
      await refreshNotebookList();
      toast({
        title: "已发送选区到 Notebook",
        description: `已保存 ${payload.selectionLength} 个字符`,
      });
    } catch (error: any) {
      toast({
        title: "发送失败",
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

  const isWorkspaceMissing = Boolean(
    id &&
    (
      (referencesQuery.error instanceof Error && referencesQuery.error.message.includes("DOCUMENT_NOT_FOUND")) ||
      (notebooksQuery.error instanceof Error && notebooksQuery.error.message.includes("DOCUMENT_NOT_FOUND"))
    ),
  );
  const isLoading = isDocsLoading || referencesQuery.isLoading || notebooksQuery.isLoading || (id !== "" && isKeywordsLoading);
  const hasError = !isLoading && isWorkspaceMissing;
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

        {!isLoading && !hasError && (
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
                  onSendSelectionToNotebook={handleSendSelectionToNotebook}
                />
                <NotebookPanel
                  documentTitle={workspaceTitle}
                  notebooks={notebooks}
                  selectedNotebookId={selectedNotebookId}
                  references={references}
                  isNotebooksLoading={notebooksQuery.isLoading}
                  onSelectNotebook={setSelectedNotebookId}
                  onCreateNotebook={handleCreateNotebook}
                  onRenameNotebook={handleRenameNotebook}
                  onDeleteNotebook={handleDeleteNotebook}
                  isDropActive={isNotebookDropActive}
                  onDragStateChange={setIsNotebookDropActive}
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
                        onSendSelectionToNotebook={handleSendSelectionToNotebook}
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
                        references={references}
                        isNotebooksLoading={notebooksQuery.isLoading}
                        onSelectNotebook={setSelectedNotebookId}
                        onCreateNotebook={handleCreateNotebook}
                        onRenameNotebook={handleRenameNotebook}
                        onDeleteNotebook={handleDeleteNotebook}
                        isDropActive={isNotebookDropActive}
                        onDragStateChange={setIsNotebookDropActive}
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
