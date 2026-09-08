import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";

export const documentExtensions = [
  StarterKit.configure({ link: { openOnClick: false }, underline: false }),
  TableKit,
  Markdown,
];
