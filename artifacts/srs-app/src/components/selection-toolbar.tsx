import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type SelectionToolbarProps = {
  open: boolean;
  top: number;
  left: number;
  text: string;
  onSend: () => Promise<void>;
};

export function SelectionToolbar({
  open,
  top,
  left,
  text,
  onSend,
}: SelectionToolbarProps) {
  if (!open) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 rounded-2xl border border-border/60 bg-background/95 px-3 py-2 shadow-xl backdrop-blur"
      style={{ top, left }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <div className="mb-2 max-w-[280px] truncate text-xs text-muted-foreground">
        {text}
      </div>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => void onSend()}>
        <Send className="h-3.5 w-3.5" />
        发送到笔记
      </Button>
    </div>
  );
}
