use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use super::screen_capture::{CaptureBounds, ScreenCapture, ScreenInfo};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SelectionResult {
    pub bounds: CaptureBounds,
    pub image_data: String,
    pub cancelled: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct MousePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone)]
pub struct SelectionState {
    pub is_selecting: bool,
    pub start_pos: Option<MousePosition>,
    pub current_pos: Option<MousePosition>,
    pub selection_bounds: Option<CaptureBounds>,
}

impl Default for SelectionState {
    fn default() -> Self {
        Self {
            is_selecting: false,
            start_pos: None,
            current_pos: None,
            selection_bounds: None,
        }
    }
}

pub struct SelectionOverlay {
    state: Arc<Mutex<SelectionState>>,
}

impl SelectionOverlay {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SelectionState::default())),
        }
    }

    /// Start the screen selection process
    pub async fn start_selection(app_handle: tauri::AppHandle) -> Result<SelectionResult, String> {
        println!("🎯 Starting screen selection overlay...");
        
        // Use the new interactive overlay for real drag selection
        super::interactive_overlay::InteractiveOverlay::start_interactive_selection(app_handle).await
    }

    /// Placeholder implementation for selection (will be replaced with native overlay)
    async fn show_selection_placeholder(screen_info: &ScreenInfo) -> Result<SelectionResult, String> {
        println!("⚠️  Using placeholder selection - native overlay coming next!");
        
        // Simulate a selection in the center quarter of the screen
        let bounds = CaptureBounds {
            x: (screen_info.width / 4) as i32,
            y: (screen_info.height / 4) as i32,
            width: screen_info.width / 2,
            height: screen_info.height / 2,
        };
        
        println!("📐 Simulated selection bounds: {:?}", bounds);
        
        // Capture the selected region
        match ScreenCapture::capture_region(bounds.clone()).await {
            Ok(capture_result) => Ok(SelectionResult {
                bounds: capture_result.bounds,
                image_data: capture_result.image_data,
                cancelled: false,
            }),
            Err(e) => Err(format!("Failed to capture selection: {}", e)),
        }
    }

    /// Calculate bounds from start and end positions
    pub fn calculate_bounds(start: &MousePosition, end: &MousePosition) -> CaptureBounds {
        let x = start.x.min(end.x) as i32;
        let y = start.y.min(end.y) as i32;
        let width = (start.x - end.x).abs() as u32;
        let height = (start.y - end.y).abs() as u32;
        
        CaptureBounds { x, y, width, height }
    }

    /// Update the current mouse position during selection
    pub fn update_mouse_position(&self, pos: MousePosition) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        
        if state.is_selecting {
            state.current_pos = Some(pos.clone());
            
            if let Some(start_pos) = &state.start_pos {
                state.selection_bounds = Some(Self::calculate_bounds(start_pos, &pos));
            }
        }
        
        Ok(())
    }

    /// Start drag selection
    pub fn start_drag(&self, pos: MousePosition) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        
        state.is_selecting = true;
        state.start_pos = Some(pos);
        state.current_pos = None;
        state.selection_bounds = None;
        
        println!("🖱️  Started drag selection at: {:?}", state.start_pos);
        Ok(())
    }

    /// End drag selection and return the result
    pub async fn end_drag(&self) -> Result<Option<SelectionResult>, String> {
        let bounds = {
            let mut state = self.state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
            
            if !state.is_selecting {
                return Ok(None);
            }
            
            let bounds = state.selection_bounds.clone();
            
            // Reset state
            state.is_selecting = false;
            state.start_pos = None;
            state.current_pos = None;
            state.selection_bounds = None;
            
            bounds
        };
        
        if let Some(bounds) = bounds {
            println!("✅ Drag selection completed: {:?}", bounds);
            
            // Validate bounds
            if bounds.width < 5 || bounds.height < 5 {
                return Ok(Some(SelectionResult {
                    bounds,
                    image_data: String::new(),
                    cancelled: true,
                }));
            }
            
            // Capture the selected region
            match ScreenCapture::capture_region(bounds.clone()).await {
                Ok(capture_result) => Ok(Some(SelectionResult {
                    bounds: capture_result.bounds,
                    image_data: capture_result.image_data,
                    cancelled: false,
                })),
                Err(e) => Err(format!("Failed to capture selection: {}", e)),
            }
        } else {
            Ok(None)
        }
    }

    /// Cancel the current selection
    pub fn cancel_selection(&self) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        
        state.is_selecting = false;
        state.start_pos = None;
        state.current_pos = None;
        state.selection_bounds = None;
        
        println!("❌ Selection cancelled");
        Ok(())
    }

    /// Get the current selection state
    pub fn get_state(&self) -> Result<SelectionState, String> {
        let state = self.state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;
        Ok(state.clone())
    }

    /// Check if currently selecting
    pub fn is_selecting(&self) -> bool {
        self.state.lock().map(|s| s.is_selecting).unwrap_or(false)
    }
}

// Global overlay instance
static mut OVERLAY_INSTANCE: Option<SelectionOverlay> = None;
static OVERLAY_INIT: std::sync::Once = std::sync::Once::new();

/// Get the global overlay instance
pub fn get_overlay() -> &'static SelectionOverlay {
    unsafe {
        OVERLAY_INIT.call_once(|| {
            OVERLAY_INSTANCE = Some(SelectionOverlay::new());
        });
        OVERLAY_INSTANCE.as_ref().unwrap()
    }
} 