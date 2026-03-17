import type { Editor } from "@tiptap/react";

interface SlashCommandMenuProps {
  editor: Editor | null;
}

// Phase 3.1 第一阶段先预留组件边界，下一阶段再接完整的 slash command 交互。
export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  void editor;
  return null;
}
