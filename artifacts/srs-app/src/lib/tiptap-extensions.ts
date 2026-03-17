import { mergeAttributes, Node } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

function buildSourceLabel(attrs: Record<string, unknown>) {
  const referenceTitle = typeof attrs.sourceReferenceTitle === "string" ? attrs.sourceReferenceTitle : "";
  const paragraphLabel = typeof attrs.sourceParagraphLabel === "string" ? attrs.sourceParagraphLabel : "";
  const pieces = [referenceTitle, paragraphLabel].filter(Boolean);
  return pieces.length > 0 ? `引自 ${pieces.join(" · ")}` : "引自 Reference";
}

export const SourceBlockquote = Node.create({
  name: "sourceBlockquote",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      sourceReferenceId: { default: null },
      sourceTextBlockId: { default: null },
      sourceReferenceTitle: { default: null },
      sourceParagraphLabel: { default: null },
      selectionOffset: { default: null },
      selectionLength: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "blockquote[data-source-blockquote='true']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const label = buildSourceLabel(HTMLAttributes);

    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, {
        "data-source-blockquote": "true",
      }),
      ["div", { "data-source-content": "true" }, 0],
      ["footer", { "data-source-label": "true" }, label],
    ];
  },
});

export const emptyNotebookDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
} as const;

export function createNotebookExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "heading" ? "输入标题" : "输入 '/' 打开命令…"),
    }),
    SourceBlockquote,
  ];
}
