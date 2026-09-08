import { documentExtensions } from "./documentExtensions";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Table2,
  Undo2,
  Redo2,
  Link2,
} from "lucide-react";
import { Button } from "../ui/button";
import { useEffect } from "react";
import "./documents.css";

export function DocumentEditor({
  content,
  onChange,
  readOnly = false,
}: {
  readonly content: string;
  readonly onChange?: (value: string) => void;
  readonly readOnly?: boolean;
}) {
  const editor = useEditor({
    extensions: documentExtensions,
    content,
    contentType: "markdown",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "workspace-prose outline-none",
        role: "textbox",
        "aria-label": readOnly ? "Document preview" : "Document content",
        "aria-readonly": String(readOnly),
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: updated }) => onChange?.(updated.getMarkdown()),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold"),
      italic: current?.isActive("italic"),
      heading: current?.isActive("heading"),
      list: current?.isActive("bulletList"),
      ordered: current?.isActive("orderedList"),
    }),
  });
  useEffect(() => {
    if (editor && editor.getMarkdown() !== content)
      editor.commands.setContent(content, { contentType: "markdown", emitUpdate: false });
  }, [content, editor]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!readOnly && editor && (
        <div
          className="flex flex-wrap gap-1 border-b border-border px-4 py-2"
          role="toolbar"
          aria-label="Text formatting"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bold"
            aria-pressed={active?.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Italic"
            aria-pressed={active?.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Heading"
            aria-pressed={active?.heading}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bullet list"
            aria-pressed={active?.list}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Numbered list"
            aria-pressed={active?.ordered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Insert table"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
            }
          >
            <Table2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add link"
            onClick={() => {
              const href = window.prompt("Link address (https://…)");
              if (href && /^https?:\/\//i.test(href))
                editor.chain().focus().setLink({ href }).run();
            }}
          >
            <Link2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-auto px-6 py-6" />
    </div>
  );
}
