use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

struct WatcherState(Mutex<Option<RecommendedWatcher>>);
struct InitialFile(Mutex<Option<String>>);

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn watch_file(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    let app = app_handle.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
        if let Ok(event) = res {
            if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                let _ = app.emit("file-changed", &path);
            }
        }
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch file: {}", e))?;

    let state = app_handle.state::<WatcherState>();
    *state.0.lock().unwrap() = Some(watcher);

    Ok(())
}

#[tauri::command]
fn stop_watching(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<WatcherState>();
    *state.0.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
fn get_initial_file(app_handle: tauri::AppHandle) -> Option<String> {
    let state = app_handle.state::<InitialFile>();
    let result = state.0.lock().unwrap().take();
    result
}

fn build_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open = MenuItemBuilder::with_id("open", "Open\u{2026}")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let close = MenuItemBuilder::with_id("close", "Close")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open)
        .item(&save)
        .separator()
        .item(&close)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app_handle, event| {
        match event.id().as_ref() {
            "open" => {
                let _ = app_handle.emit("menu-open", ());
            }
            "save" => {
                let _ = app_handle.emit("menu-save", ());
            }
            "close" => {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.close();
                }
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(WatcherState(Mutex::new(None)))
        .manage(InitialFile(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            watch_file,
            stop_watching,
            get_initial_file,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            build_menu(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Notify frontend about close (for save prompt)
                // Don't prevent close — let it proceed naturally
                let _ = window.emit("close-requested", ());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Check if launched with a file path argument (e.g. from Finder double-click)
    if let Some(path) = std::env::args().nth(1) {
        if path.ends_with(".md") || path.ends_with(".markdown") {
            let state = app.state::<InitialFile>();
            *state.0.lock().unwrap() = Some(path);
        }
    }

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            // This fires when a file is opened while the app is already running
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Some(path_str) = path.to_str() {
                        let _ = app_handle.emit("open-file", path_str.to_string());
                    }
                }
            }
        }
    });
}
