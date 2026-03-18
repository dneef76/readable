import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
} from "prosemirror-markdown";
import { schema } from "./schema";
import { Node } from "prosemirror-model";
import markdownit from "markdown-it";

// Use "default" preset which includes table support (commonmark does not)
const md = markdownit("default", { html: false });

export const markdownParser = new MarkdownParser(
  schema,
  md,
  {
    ...defaultMarkdownParser.tokens,
    // Table token mappings (markdown-it produces these, but prosemirror-markdown doesn't handle them by default)
    table: { block: "table" },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: "table_row" },
    th: { block: "table_header" },
    td: { block: "table_cell" },
  }
);

export const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table(state, node) {
      node.forEach((row, _, i) => {
        if (i > 0) state.write("\n");
        row.forEach((cell, _, j) => {
          if (j > 0) state.write(" | ");
          else state.write("| ");
          const content = cell.textContent;
          state.write(content);
        });
        state.write(" |");
        if (i === 0) {
          state.write("\n");
          row.forEach((_, __, j) => {
            if (j > 0) state.write(" | ");
            else state.write("| ");
            state.write("---");
          });
          state.write(" |");
        }
      });
      state.write("\n");
      state.closeBlock(node);
    },
    table_row() {
      // Handled by table serializer
    },
    table_cell(state, node) {
      state.renderInline(node);
    },
    table_header(state, node) {
      state.renderInline(node);
    },
  },
  defaultMarkdownSerializer.marks
);

export function parseMarkdown(content: string): Node {
  return markdownParser.parse(content) || schema.node("doc", null, []);
}

export function serializeMarkdown(doc: Node): string {
  return markdownSerializer.serialize(doc);
}
