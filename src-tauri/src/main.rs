// Keep a console window from opening next to the app in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        // Starting YouCam again only tells the running one, which shows its
        // camera window (main.ts). This plugin has to be the first one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.emit("youcam:second-instance", ());
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Closing the camera window quits the app, screen light included
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::Destroyed = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running YouCam");
}
