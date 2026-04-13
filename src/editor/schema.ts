import { schema as markdownSchema } from "prosemirror-markdown";
import { Schema } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

const baseNodes = markdownSchema.spec.nodes;
const tables = tableNodes({
  tableGroup: "block",
  cellContent: "inline*",
  cellAttributes: {},
});

export const schema = new Schema({
  nodes: baseNodes.append(tables),
  marks: markdownSchema.spec.marks,
});
