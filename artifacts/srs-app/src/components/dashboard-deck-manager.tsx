import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListDecksQueryKey,
  useCreateDeck,
  useDeleteDeck,
  useUpdateDeck,
} from "@workspace/api-client-react";
import type { DeckSummary } from "@workspace/api-client-react";
import {
  ArrowRightLeft,
  Clock3,
  FolderPlus,
  Layers,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type DeckDialogMode = "create-root" | "create-child" | "rename" | "move" | null;

type DeckOption = {
  id: string;
  name: string;
  depth: number;
};

interface DashboardDeckManagerProps {
  decks: DeckSummary[];
  isLoading: boolean;
}

function flattenDecks(nodes: DeckSummary[], depth = 0): DeckOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenDecks(node.children ?? [], depth + 1),
  ]);
}

function collectDescendantIds(node: DeckSummary): Set<string> {
  const ids = new Set<string>();
  const stack = [...(node.children ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    ids.add(current.id);
    stack.push(...(current.children ?? []));
  }

  return ids;
}

function DeckRow({
  deck,
  depth,
  onCreateChild,
  onRename,
  onMove,
  onDelete,
}: {
  deck: DeckSummary;
  depth: number;
  onCreateChild: (deck: DeckSummary) => void;
  onRename: (deck: DeckSummary) => void;
  onMove: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
}) {
  const updatedAt = deck.updatedAt ? new Date(deck.updatedAt).toLocaleString() : "-";

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <Link href={`/decks/${deck.id}`} className="min-w-0 flex-1 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              <span>{depth === 0 ? "根卡片组" : `第 ${depth + 1} 层卡片组`}</span>
            </div>
            <div className="text-sm font-semibold leading-snug text-foreground hover:text-primary">
              {deck.name}
            </div>
            <div className="text-xs text-muted-foreground">
              New {deck.newCards} · Due {deck.dueCards} · 总卡片 {deck.totalCards} · 今日已背诵 {deck.reviewedToday}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              <span>最近更新 {updatedAt}</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:justify-end">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/review?deckId=${deck.id}`}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                开始复习
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="卡片组管理">
                  <Layers className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onCreateChild(deck)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  新建子组
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename(deck)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  重命名
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMove(deck)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  移动到...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(deck)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除卡片组
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {(deck.children ?? []).map((child) => (
        <DeckRow
          key={child.id}
          deck={child}
          depth={depth + 1}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export function DashboardDeckManager({ decks, isLoading }: DashboardDeckManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createDeckMutation = useCreateDeck();
  const updateDeckMutation = useUpdateDeck();
  const deleteDeckMutation = useDeleteDeck();

  const [dialogMode, setDialogMode] = useState<DeckDialogMode>(null);
  const [activeDeck, setActiveDeck] = useState<DeckSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckSummary | null>(null);
  const [deckName, setDeckName] = useState("");
  const [moveParentId, setMoveParentId] = useState<string>("__root");

  const deckOptions = useMemo(() => flattenDecks(decks), [decks]);
  const moveOptions = useMemo(() => {
    if (!activeDeck || dialogMode !== "move") return deckOptions;
    const blockedIds = collectDescendantIds(activeDeck);
    blockedIds.add(activeDeck.id);
    return deckOptions.filter((deck) => !blockedIds.has(deck.id));
  }, [activeDeck, deckOptions, dialogMode]);

  const closeDialog = () => {
    setDialogMode(null);
    setActiveDeck(null);
    setDeckName("");
    setMoveParentId("__root");
  };

  const refreshDecks = async () => {
    await queryClient.invalidateQueries({ queryKey: getListDecksQueryKey() });
  };

  const openCreateRootDialog = () => {
    setActiveDeck(null);
    setDeckName("");
    setDialogMode("create-root");
  };

  const openCreateChildDialog = (deck: DeckSummary) => {
    setActiveDeck(deck);
    setDeckName("");
    setDialogMode("create-child");
  };

  const openRenameDialog = (deck: DeckSummary) => {
    setActiveDeck(deck);
    setDeckName(deck.name);
    setDialogMode("rename");
  };

  const openMoveDialog = (deck: DeckSummary) => {
    setActiveDeck(deck);
    setMoveParentId(deck.parentId ?? "__root");
    setDialogMode("move");
  };

  const handleCreateOrRename = async () => {
    const trimmedName = deckName.trim();
    if (!trimmedName) {
      toast({ title: "请输入卡片组名称", variant: "destructive" });
      return;
    }

    try {
      if (dialogMode === "create-root") {
        await createDeckMutation.mutateAsync({ data: { name: trimmedName, parentId: null } });
        toast({ title: "已创建卡片组", description: trimmedName });
      } else if (dialogMode === "create-child" && activeDeck) {
        await createDeckMutation.mutateAsync({
          data: { name: trimmedName, parentId: activeDeck.id },
        });
        toast({ title: "已创建子卡片组", description: `${activeDeck.name} / ${trimmedName}` });
      } else if (dialogMode === "rename" && activeDeck) {
        await updateDeckMutation.mutateAsync({
          id: activeDeck.id,
          data: { name: trimmedName },
        });
        toast({ title: "已重命名卡片组", description: trimmedName });
      }

      await refreshDecks();
      closeDialog();
    } catch (error: any) {
      toast({
        title: dialogMode === "rename" ? "重命名失败" : "保存失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleMove = async () => {
    if (!activeDeck) return;

    try {
      await updateDeckMutation.mutateAsync({
        id: activeDeck.id,
        data: { parentId: moveParentId === "__root" ? null : moveParentId },
      });
      await refreshDecks();
      toast({ title: "已更新层级", description: activeDeck.name });
      closeDialog();
    } catch (error: any) {
      toast({
        title: "移动失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteDeckMutation.mutateAsync({ id: deleteTarget.id });
      await refreshDecks();
      toast({ title: "已删除卡片组", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error?.message ?? "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const isSaving =
    createDeckMutation.isPending || updateDeckMutation.isPending || deleteDeckMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">卡片组树管理</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            在这里维护卡片组层级。支持新建子组、重命名、移动父级，以及递归删除空子组。
          </p>
        </div>
        <Button size="sm" onClick={openCreateRootDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          新建根卡片组
        </Button>
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          正在加载你的卡片组...
        </div>
      )}

      {!isLoading && decks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
          还没有卡片组，先创建一个根卡片组开始整理结构。
        </div>
      )}

      {!isLoading && decks.length > 0 && (
        <div className="space-y-3">
          {decks.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              depth={0}
              onCreateChild={openCreateChildDialog}
              onRename={openRenameDialog}
              onMove={openMoveDialog}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogMode === "create-root" || dialogMode === "create-child" || dialogMode === "rename"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "rename"
                ? "重命名卡片组"
                : dialogMode === "create-child"
                  ? "新建子卡片组"
                  : "新建根卡片组"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create-child" && activeDeck
                ? `将在“${activeDeck.name}”下创建新的子卡片组。`
                : dialogMode === "rename"
                  ? "修改当前卡片组名称。"
                  : "创建一个新的根级卡片组。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="deck-name-input">
              卡片组名称
            </label>
            <Input
              id="deck-name-input"
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
              placeholder="输入卡片组名称"
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleCreateOrRename} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "move"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动卡片组</DialogTitle>
            <DialogDescription>
              {activeDeck
                ? `为“${activeDeck.name}”选择新的父级。不能移动到自身或自己的子组下。`
                : "为当前卡片组选择新的父级。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="deck-parent-select">
              新父级
            </label>
            <select
              id="deck-parent-select"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={moveParentId}
              onChange={(event) => setMoveParentId(event.target.value)}
            >
              <option value="__root">设为根卡片组</option>
              {moveOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {`${"- ".repeat(option.depth)}${option.name}`}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleMove} disabled={isSaving}>
              {isSaving ? "保存中..." : "确认移动"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除卡片组</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `将尝试删除“${deleteTarget.name}”及其所有空子组。若该子树内仍有卡片，将拒绝删除。`
                : "确认删除当前卡片组。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isSaving}
            >
              {isSaving ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
