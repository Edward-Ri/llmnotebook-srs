import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code2, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorBubbleMenuProps {
  editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: currentEditor }) => currentEditor.state.selection.empty === false}
      className="flex items-center gap-1 rounded-xl border border-border/60 bg-background/95 p-1 shadow-lg backdrop-blur"
    >
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("code") ? "default" : "ghost"}
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 className="h-4 w-4" />
      </Button>
    </BubbleMenu>
  );
}
