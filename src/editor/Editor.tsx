import { useEffect, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap, selectAll } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { parseMarkdown, serializeMarkdown } from "./markdown";
import "./editor.css";

interface EditorProps {
  content: string;
  onSave: (markdown: string) => void;
  onChange: (dirty: boolean) => void;
  onContentChange?: (markdown: string) => void;
}

export function Editor({ content, onSave, onChange, onContentChange }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const savedContentRef = useRef(content);

  useEffect(() => {
    if (!editorRef.current) return;

    const doc = parseMarkdown(content);
    savedContentRef.current = content;

    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-a": selectAll,
          "Mod-s": (_state, _dispatch, view) => {
            if (view) {
              const markdown = serializeMarkdown(view.state.doc);
              onSave(markdown);
              savedContentRef.current = markdown;
              onChange(false);
            }
            return true;
          },
        }),
        keymap(baseKeymap),
        dropCursor(),
        gapCursor(),
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement;
          const link = target.closest("a");
          if (link && event.metaKey) {
            event.preventDefault();
            const href = link.getAttribute("href");
            if (href) {
              import("@tauri-apps/plugin-shell").then(({ open }) => {
                open(href);
              });
            }
            return true;
          }
          return false;
        },
      },
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        if (transaction.docChanged) {
          onChange(true);
          if (onContentChange) {
            onContentChange(serializeMarkdown(newState.doc));
          }
        }
      },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [content, onSave, onChange]);

  return (
    <div className="editor-wrapper">
      <div className="editor-container" ref={editorRef} />
    </div>
  );
}
