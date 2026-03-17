import { useEffect, useMemo, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { Heading1, Heading2, Heading3, List, ListOrdered, Quote } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface SlashCommandMenuProps {
  editor: Editor | null;
  containerRef: RefObject<HTMLDivElement | null>;
}

type SlashCommandItem = {
  id: string;
  label: string;
  icon: typeof Heading1;
  keywords: string[];
  run: (editor: Editor) => void;
};

function clearCurrentSlashLine(editor: Editor) {
  const { $from } = editor.state.selection;
  return {
    from: $from.start(),
    to: $from.end(),
  };
}

const slashCommandItems: SlashCommandItem[] = [
  {
    id: "heading-1",
    label: "标题 1",
    icon: Heading1,
    keywords: ["h1", "heading", "title", "标题1", "一级标题"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading-2",
    label: "标题 2",
    icon: Heading2,
    keywords: ["h2", "heading", "title", "标题2", "二级标题"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading-3",
    label: "标题 3",
    icon: Heading3,
    keywords: ["h3", "heading", "title", "标题3", "三级标题"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: "bullet-list",
    label: "无序列表",
    icon: List,
    keywords: ["list", "bullet", "ul", "无序", "列表"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered-list",
    label: "有序列表",
    icon: ListOrdered,
    keywords: ["list", "ordered", "ol", "有序", "列表"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "blockquote",
    label: "引用块",
    icon: Quote,
    keywords: ["quote", "blockquote", "引用", "摘录"],
    run: (editor) => {
      const range = clearCurrentSlashLine(editor);
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
];

export function SlashCommandMenu({ editor, containerRef }: SlashCommandMenuProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return slashCommandItems;
    }

    return slashCommandItems.filter((item) => {
      const haystack = [item.label, ...item.keywords].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  useEffect(() => {
    if (!editor) return;

    const updateSlashState = () => {
      const selection = editor.state.selection;
      if (!selection.empty) {
        setOpen(false);
        return;
      }

      const { $from } = selection;
      const text = $from.parent.textContent ?? "";
      if (!text.startsWith("/")) {
        setOpen(false);
        return;
      }

      const rawQuery = text.slice(1);
      setQuery(rawQuery);

      const container = containerRef.current;
      if (!container) {
        setOpen(true);
        return;
      }

      const coords = editor.view.coordsAtPos(selection.from);
      const containerRect = container.getBoundingClientRect();
      setPosition({
        top: coords.bottom - containerRect.top + 8,
        left: Math.max(12, coords.left - containerRect.left),
      });
      setOpen(true);
    };

    updateSlashState();
    editor.on("update", updateSlashState);
    editor.on("selectionUpdate", updateSlashState);

    return () => {
      editor.off("update", updateSlashState);
      editor.off("selectionUpdate", updateSlashState);
    };
  }, [containerRef, editor]);

  if (!editor || !open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute z-30 w-64 overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur",
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <Command shouldFilter={false}>
        <CommandList>
          <CommandEmpty>没有匹配的命令</CommandEmpty>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => {
                  item.run(editor);
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </div>
  );
}
