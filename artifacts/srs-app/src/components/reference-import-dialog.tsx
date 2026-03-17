import { useEffect, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ReferenceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; text: string }) => Promise<void>;
  isSubmitting: boolean;
}

export function ReferenceImportDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: ReferenceImportDialogProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setText("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入新 Reference</DialogTitle>
          <DialogDescription>
            粘贴文本或上传 `.txt` / `.md` 文件，后端会自动完成解析与关键词提取。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">标题</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：操作系统课程笔记（第 3 章）"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">正文</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (loadEvent) => {
                    setText((loadEvent.target?.result as string) ?? "");
                  };
                  reader.readAsText(file, "utf-8");
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                上传文件
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-[280px]"
              placeholder="在这里粘贴学习材料内容"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={isSubmitting || !title.trim() || !text.trim()}
            onClick={async () => {
              await onSubmit({ title: title.trim(), text });
            }}
          >
            <Upload className={isSubmitting ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
            {isSubmitting ? "导入中..." : "导入并解析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
