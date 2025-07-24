use tauri::{WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use std::time::{Duration, Instant};
use screenshots;

pub struct OverlayManager {
    overlay_window: Option<WebviewWindow>,
    is_active: bool,
    last_used: Option<Instant>,
}

impl OverlayManager {
    pub fn new() -> Self {
        Self {
            overlay_window: None,
            is_active: false,
            last_used: None,
        }
    }
    
    pub fn show_selection_overlay(&mut self, app: &tauri::AppHandle) -> Result<(), String> {
        match &self.overlay_window {
            Some(window) => {
                // ♻️ Återanvänd befintlig overlay
                window.show().map_err(|e| format!("Failed to show overlay: {}", e))?;
                
                // Ensure focus for event handling when reusing
                if let Err(e) = window.set_focus() {
                    println!("⚠️ Could not set focus on reused overlay: {}", e);
                }
                
                self.is_active = true;
                println!("♻️ Reusing existing React overlay window");
            },
            None => {
                // 🆕 Skapa första gången med React istället för HTML
                let overlay = self.create_react_overlay_once(app)?;
                self.overlay_window = Some(overlay);
                self.is_active = true;
                println!("🆕 Created new React overlay window");
            }
        }
        self.last_used = Some(Instant::now());
        Ok(())
    }
    
    pub fn hide_overlay(&mut self) -> Result<(), String> {
        if let Some(window) = &self.overlay_window {
            window.hide().map_err(|e| format!("Failed to hide overlay: {}", e))?;
            self.is_active = false;
            println!("👁️ React overlay hidden (not destroyed)");
        }
        Ok(())
    }
    
    pub fn cleanup_if_old(&mut self) {
        // Rensa overlay om den inte använts på 5 minuter
        if let Some(last_used) = self.last_used {
            if last_used.elapsed() > Duration::from_secs(300) && !self.is_active {
                if let Some(window) = &self.overlay_window {
                    window.close().ok();
                    self.overlay_window = None;
                    println!("🗑️ Cleaned up old React overlay window");
                }
            }
        }
    }
    
    pub fn is_overlay_active(&self) -> bool {
        self.is_active
    }
    
    fn create_react_overlay_once(&self, app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
        println!("🚀 Creating optimized React overlay...");
        
        // Get screen dimensions for fullscreen overlay
        let (screen_width, screen_height) = match screenshots::Screen::all() {
            Ok(screens) => {
                if let Some(screen) = screens.first() {
                    let width = screen.display_info.width as f64;
                    let height = screen.display_info.height as f64;
                    println!("📺 React overlay using screen: {}x{}", width, height);
                    (width, height)
                } else {
                    println!("⚠️ No screens found, using fallback 1920x1080");
                    (1920.0, 1080.0)
                }
            },
            Err(e) => {
                println!("❌ Failed to get screen info: {}, using fallback", e);
                (1920.0, 1080.0)
            }
        };
        
        // Create React-based overlay window (use same ID as regular overlay for consistency)
        let overlay = WebviewWindowBuilder::new(
            app,
            "overlay",  // 🔧 FIX: Use same ID as regular overlay
            WebviewUrl::App("overlay".into())  // React route från OverlayApp.tsx
        )
        .title("FrameSense Selection")
        .inner_size(screen_width, screen_height)
        .position(0.0, 0.0)
        .decorations(false)      // No window borders
        .transparent(true)       // Make window transparent!
        .always_on_top(true)     // Above all other windows
        .skip_taskbar(true)      // Don't show in taskbar
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(true)           // Ensure window can receive events
        .build()
        .map_err(|e| format!("Failed to create React overlay: {}", e))?;
        
        // Force focus to ensure events work
        if let Err(e) = overlay.set_focus() {
            println!("⚠️ Could not set React overlay focus: {}", e);
        }
        
        println!("✅ React overlay created successfully (no HTML/JS issues)!");
        Ok(overlay)
    }
}

impl Default for OverlayManager {
    fn default() -> Self {
        Self::new()
    }
} 