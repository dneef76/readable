import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./editor/Editor";

function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const contentRef = useRef<string>(content);

  const updateTitle = useCallback((path: string | null, dirty: boolean) => {
    const appWindow = getCurrentWindow();
    if (!path) {
      appWindow.setTitle("Readable");
      return;
    }
    const filename = path.split("/").pop() ?? path;
    const prefix = dirty ? "\u2022 " : "";
    appWindow.setTitle(`${prefix}${filename} \u2014 Readable`);
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      try {
        const text = await invoke<string>("read_file", { path });
        await invoke("stop_watching", {});
        setFilePath(path);
        setContent(text);
        contentRef.current = text;
        setIsDirty(false);
        updateTitle(path, false);
        await invoke("watch_file", { path });
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [updateTitle]
  );

  const handleSave = useCallback(
    async (markdown: string) => {
      try {
        let savePath = filePath;
        if (!savePath) {
          const picked = await save({
            filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
          });
          if (!picked) return;
          savePath = picked;
          setFilePath(picked);
        }
        await invoke("write_file", { path: savePath, content: markdown });
        setIsDirty(false);
        updateTitle(savePath, false);
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    },
    [filePath, updateTitle]
  );

  const handleOpen = useCallback(async () => {
    if (isDirty) {
      const proceed = await ask(
        "You have unsaved changes. Do you want to continue?",
        { title: "Unsaved Changes", kind: "warning" }
      );
      if (!proceed) return;
    }
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (selected) {
      await openFile(selected as string);
    }
  }, [isDirty, openFile]);

  const handleChange = useCallback(
    (dirty: boolean) => {
      setIsDirty(dirty);
      updateTitle(filePath, dirty);
    },
    [filePath, updateTitle]
  );

  const handleContentChange = useCallback((markdown: string) => {
    contentRef.current = markdown;
  }, []);

  // Keyboard shortcut: Cmd+O
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "o") {
        e.preventDefault();
        handleOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleOpen]);

  // Listen for "open-file" events (Finder double-click)
  useEffect(() => {
    const unlisten = listen<string>("open-file", (event) => {
      openFile(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openFile]);

  // Listen for "file-changed" events (external modifications)
  useEffect(() => {
    const unlisten = listen<string>("file-changed", async () => {
      if (!filePath) return;
      if (!isDirty) {
        // Auto-reload if clean
        try {
          const text = await invoke<string>("read_file", { path: filePath });
          setContent(text);
          contentRef.current = text;
        } catch (err) {
          console.error("Failed to reload file:", err);
        }
      } else {
        const reload = await ask(
          "The file has been modified externally. Reload and lose your changes?",
          { title: "File Changed", kind: "warning" }
        );
        if (reload) {
          try {
            const text = await invoke<string>("read_file", { path: filePath });
            setContent(text);
            contentRef.current = text;
            setIsDirty(false);
            updateTitle(filePath, false);
          } catch (err) {
            console.error("Failed to reload file:", err);
          }
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [filePath, isDirty, updateTitle]);

  // Listen for menu events
  useEffect(() => {
    const unlisten = listen("menu-open", () => {
      handleOpen();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleOpen]);

  useEffect(() => {
    const unlisten = listen("menu-save", () => {
      if (contentRef.current && filePath) {
        handleSave(contentRef.current);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleSave, filePath]);

  // Handle close-requested (unsaved changes on close)
  useEffect(() => {
    const unlisten = listen("close-requested", async () => {
      const appWindow = getCurrentWindow();
      if (!isDirty) {
        await appWindow.destroy();
        return;
      }
      const wantToSave = await ask(
        "Do you want to save changes before closing?",
        {
          title: "Unsaved Changes",
          kind: "warning",
          okLabel: "Save",
          cancelLabel: "Don't Save",
        }
      );
      if (wantToSave && contentRef.current && filePath) {
        await invoke("write_file", { path: filePath, content: contentRef.current });
      }
      await appWindow.destroy();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isDirty, filePath]);

  // Drag and drop support
  useEffect(() => {
    const unlistenDrop = listen<{ paths: string[] }>(
      "tauri://drag-drop",
      (event) => {
        setIsDragOver(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          const path = paths[0];
          if (path.endsWith(".md") || path.endsWith(".markdown")) {
            openFile(path);
          }
        }
      }
    );
    const unlistenOver = listen("tauri://drag-over", () => {
      setIsDragOver(true);
    });
    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragOver(false);
    });
    return () => {
      unlistenDrop.then((fn) => fn());
      unlistenOver.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [openFile]);

  return (
    <div className={isDragOver ? "app-root drag-over" : "app-root"}>
      {filePath ? (
        <Editor
          content={content}
          onSave={handleSave}
          onChange={handleChange}
          onContentChange={handleContentChange}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "1rem",
            color: "var(--text-secondary)",
          }}
        >
          <p style={{ fontSize: "1.1rem" }}>
            Open a markdown file to get started
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            Press{" "}
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
              }}
            >
              &#8984;O
            </kbd>{" "}
            or drag a file here
          </p>
          <button
            onClick={handleOpen}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1.5rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Open File
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
