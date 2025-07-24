use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, mpsc};
use super::screen_capture::{ScreenCapture, CaptureBounds, ScreenInfo};
use super::selection_overlay::SelectionResult;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DragState {
    pub is_dragging: bool,
    pub start_x: f64,
    pub start_y: f64,
    pub current_x: f64,
    pub current_y: f64,
}

impl Default for DragState {
    fn default() -> Self {
        Self {
            is_dragging: false,
            start_x: 0.0,
            start_y: 0.0,
            current_x: 0.0,
            current_y: 0.0,
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ContentAnalysis {
    pub content_type: ContentType,
    pub confidence: f32,
    pub text_content: Option<String>,
    pub needs_ocr: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum ContentType {
    PlainText,
    ImageWithText,
    PureImage,
    Unknown,
}

pub struct InteractiveOverlay {
    app_handle: Option<AppHandle>,
    overlay_window: Option<WebviewWindow>,
    drag_state: Arc<Mutex<DragState>>,
    selection_receiver: Option<mpsc::Receiver<SelectionResult>>,
}

impl InteractiveOverlay {
    pub fn new() -> Self {
        Self {
            app_handle: None,
            overlay_window: None,
            drag_state: Arc::new(Mutex::new(DragState::default())),
            selection_receiver: None,
        }
    }

    /// Start the interactive selection process with real overlay
    pub async fn start_interactive_selection(app_handle: AppHandle) -> Result<SelectionResult, String> {
        println!("🚀 Starting REAL fullscreen overlay for screen drag selection...");
        
        // Get screen information first
        let screen_info = ScreenCapture::get_screen_info()?;
        if screen_info.is_empty() {
            return Err("No screens available".to_string());
        }
        
        let primary_screen = &screen_info[0];
        println!("📺 Primary screen: {}x{}", primary_screen.width, primary_screen.height);
        
        // Create the transparent overlay window that covers entire screen
        let overlay_window = Self::create_fullscreen_overlay(&app_handle, primary_screen).await?;
        
        // Start the selection process
        Self::handle_fullscreen_selection(overlay_window, &app_handle).await
    }

    /// Create a transparent fullscreen overlay window
    async fn create_fullscreen_overlay(app_handle: &AppHandle, screen_info: &ScreenInfo) -> Result<WebviewWindow, String> {
        println!("🖼️ Creating transparent fullscreen overlay window...");
        
        // Create overlay window configuration  
        let overlay_window = WebviewWindowBuilder::new(
            app_handle,
            "selection-overlay",
            WebviewUrl::App("selection-overlay.html".into())
        )
        .title("FrameSense Selection Overlay")
        .inner_size(screen_info.width as f64, screen_info.height as f64)
        .position(0.0, 0.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .build()
        .map_err(|e| format!("Failed to create overlay window: {}", e))?;

        println!("✅ Transparent overlay window created successfully!");
        
        Ok(overlay_window)
    }

    /// Handle the selection process with fullscreen drag interaction
    async fn handle_fullscreen_selection(overlay_window: WebviewWindow, app_handle: &AppHandle) -> Result<SelectionResult, String> {
        println!("🎯 Starting fullscreen drag selection process...");
        
        // Create channel for selection communication
        let (tx, rx) = mpsc::channel::<SelectionResult>();
        
        // Store the sender in the app state so it can be accessed by Tauri commands
        // TODO: Remove this when fully migrated to OverlayManager
        // {
        //     let state = app_handle.state::<crate::AppState>();
        //     *state.overlay_sender.lock().unwrap() = Some(tx);
        // }
        
        // Show the overlay window
        overlay_window.show().map_err(|e| format!("Failed to show overlay: {}", e))?;
        overlay_window.set_focus().map_err(|e| format!("Failed to focus overlay: {}", e))?;
        
        println!("👁️ Overlay window is now visible and ready for interaction");
        
        // Wait for selection result
        let result = tokio::task::spawn_blocking(move || {
            match rx.recv() {
                Ok(result) => {
                    println!("✅ Received selection result from overlay!");
                    result
                },
                Err(_) => {
                    println!("❌ Selection was cancelled or failed");
                    SelectionResult {
                        bounds: CaptureBounds { x: 0, y: 0, width: 0, height: 0 },
                        image_data: String::new(),
                        cancelled: true,
                    }
                }
            }
        }).await.map_err(|e| format!("Task error: {}", e))?;
        
        // Clean up: remove sender from state and close the overlay window
        // TODO: Remove this when fully migrated to OverlayManager
        // {
        //     let state = app_handle.state::<crate::AppState>();
        //     *state.overlay_sender.lock().unwrap() = None;
        // }
        
        overlay_window.close().map_err(|e| format!("Failed to close overlay: {}", e))?;
        
        Ok(result)
    }

    /// Analyze captured content to determine if it's text, image, etc.
    fn analyze_content(image_data: &str) -> ContentAnalysis {
        println!("🔍 Analyzing content type...");
        
        // Basic analysis - in full implementation this would use:
        // 1. Text detection algorithms
        // 2. Image analysis
        // 3. OCR confidence scoring
        
        // For MVP: Simulate intelligent detection
        let has_text_patterns = image_data.len() > 1000; // Rough heuristic
        
        if has_text_patterns {
            ContentAnalysis {
                content_type: ContentType::ImageWithText,
                confidence: 0.8,
                text_content: None,
                needs_ocr: true,
            }
        } else {
            ContentAnalysis {
                content_type: ContentType::PureImage,
                confidence: 0.9,
                text_content: None,
                needs_ocr: false,
            }
        }
    }

    /// Process the selection based on content type
    pub async fn process_selection(result: &SelectionResult) -> Result<ProcessedContent, String> {
        println!("⚙️ Processing selection based on content type...");
        
        let content_analysis = Self::analyze_content(&result.image_data);
        
        match content_analysis.content_type {
            ContentType::PlainText => {
                println!("📝 Plain text detected - direct processing");
                // Direct text processing
                Ok(ProcessedContent {
                    content_type: ContentType::PlainText,
                    extracted_text: Some("Detected plain text content".to_string()),
                    ai_analysis: Some("This appears to be plain text content that can be directly processed.".to_string()),
                })
            },
            ContentType::ImageWithText => {
                println!("🔍 Image with text detected - running OCR");
                // OCR processing
                let ocr_text = Self::run_ocr(&result.image_data).await?;
                Ok(ProcessedContent {
                    content_type: ContentType::ImageWithText,
                    extracted_text: Some(ocr_text.clone()),
                    ai_analysis: Some(format!("OCR extracted text: {}", ocr_text)),
                })
            },
            ContentType::PureImage => {
                println!("🖼️ Pure image detected - AI image analysis");
                // AI image analysis
                Ok(ProcessedContent {
                    content_type: ContentType::PureImage,
                    extracted_text: None,
                    ai_analysis: Some("This appears to be an image without significant text content.".to_string()),
                })
            },
            ContentType::Unknown => {
                println!("❓ Unknown content type - general analysis");
                Ok(ProcessedContent {
                    content_type: ContentType::Unknown,
                    extracted_text: None,
                    ai_analysis: Some("Content type could not be determined.".to_string()),
                })
            }
        }
    }

    /// Run OCR on the image data
    async fn run_ocr(_image_data: &str) -> Result<String, String> {
        println!("🔤 Running OCR analysis...");
        
        // For MVP: Simulate OCR processing
        // In full implementation: Use Tesseract native bindings
        
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        // Simulate extracted text
        Ok("Sample OCR extracted text from the selected region".to_string())
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ProcessedContent {
    pub content_type: ContentType,
    pub extracted_text: Option<String>,
    pub ai_analysis: Option<String>,
}

// Global overlay instance
static mut INTERACTIVE_OVERLAY: Option<InteractiveOverlay> = None;
static INTERACTIVE_INIT: std::sync::Once = std::sync::Once::new();

/// Get the global interactive overlay instance
pub fn get_interactive_overlay() -> &'static mut InteractiveOverlay {
    unsafe {
        INTERACTIVE_INIT.call_once(|| {
            INTERACTIVE_OVERLAY = Some(InteractiveOverlay::new());
        });
        INTERACTIVE_OVERLAY.as_mut().unwrap()
    }
} 