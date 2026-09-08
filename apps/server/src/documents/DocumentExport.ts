import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ExternalHyperlink,
} from "docx";
import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";

function inline(tokens: readonly Token[]): (TextRun | ExternalHyperlink)[] {
  return tokens.flatMap((token): (TextRun | ExternalHyperlink)[] => {
    switch (token.type) {
      case "strong":
        return [new TextRun({ text: token.text, bold: true })];
      case "em":
        return [new TextRun({ text: token.text, italics: true })];
      case "link":
        return /^https?:\/\//i.test(token.href)
          ? [
              new ExternalHyperlink({
                link: token.href,
                children: [new TextRun({ text: token.text, style: "Hyperlink" })],
              }),
            ]
          : [new TextRun(token.text)];
      case "br":
        return [new TextRun({ text: "", break: 1 })];
      default:
        return [new TextRun("text" in token ? token.text : token.raw)];
    }
  });
}

function blocks(tokens: readonly Token[]): (Paragraph | Table)[] {
  return tokens.flatMap((token): (Paragraph | Table)[] => {
    switch (token.type) {
      case "heading":
        return [
          new Paragraph({
            heading:
              token.depth === 1
                ? HeadingLevel.HEADING_1
                : token.depth === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3,
            children: inline(token.tokens ?? []),
          }),
        ];
      case "paragraph":
        return [new Paragraph({ children: inline(token.tokens ?? []), spacing: { after: 160 } })];
      case "list":
        return token.items.map(
          (item: Tokens.ListItem, index: number) =>
            new Paragraph({
              children: [
                new TextRun(token.ordered ? `${index + 1}. ` : "• "),
                ...inline(
                  marked
                    .lexer(item.text, { gfm: true })
                    .flatMap((part) => ("tokens" in part && part.tokens ? part.tokens : [])),
                ),
              ],
              spacing: { after: 100 },
            }),
        );
      case "table":
        return [
          new Table({
            rows: [token.header, ...token.rows].map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell: Tokens.TableCell) =>
                      new TableCell({
                        children: [new Paragraph({ children: inline(cell.tokens) })],
                      }),
                  ),
                }),
            ),
          }),
        ];
      case "space":
        return [];
      case "blockquote":
        return blocks(token.tokens ?? []);
      default:
        return [new Paragraph("text" in token ? token.text : token.raw)];
    }
  });
}

export async function exportDocx(title: string, content: string) {
  return Packer.toBuffer(
    new Document({
      title,
      creator: "Workspace",
      sections: [{ children: blocks(marked.lexer(content, { gfm: true })) }],
    }),
  );
}

export function exportPdf(title: string, content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: 54,
      info: { Title: title, Creator: "Workspace" },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    for (const token of marked.lexer(content, { gfm: true })) {
      if (token.type === "space") continue;
      if (token.type === "heading")
        pdf
          .font("Helvetica-Bold")
          .fontSize(token.depth === 1 ? 22 : 16)
          .text(token.text)
          .moveDown(0.6);
      else if (token.type === "table") {
        const rows = [token.header, ...token.rows];
        const width = (pdf.page.width - 108) / token.header.length;
        for (const row of rows) {
          pdf.font("Helvetica").fontSize(10);
          const height =
            Math.max(
              ...row.map((cell: Tokens.TableCell) =>
                pdf.heightOfString(cell.text, { width: width - 12 }),
              ),
            ) + 12;
          if (pdf.y + height > pdf.page.height - 54) pdf.addPage();
          const y = pdf.y;
          row.forEach((cell: Tokens.TableCell, index: number) => {
            const x = 54 + index * width;
            pdf.rect(x, y, width, height).stroke();
            pdf.text(cell.text, x + 6, y + 6, { width: width - 12 });
          });
          pdf.x = 54;
          pdf.y = y + height;
        }
        pdf.moveDown();
      } else if (token.type === "list") {
        pdf.font("Helvetica").fontSize(11);
        token.items.forEach((item: Tokens.ListItem, index: number) =>
          pdf.text(`${token.ordered ? `${index + 1}.` : "•"} ${item.text}`).moveDown(0.3),
        );
      } else
        pdf
          .font("Helvetica")
          .fontSize(11)
          .text("text" in token ? token.text : token.raw, { lineGap: 4 })
          .moveDown(0.6);
    }
    pdf.end();
  });
}
