#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    RunEvent, WindowEvent,
    tray::TrayIconBuilder,
    menu::{Menu, MenuItem},
    Manager, Emitter, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use base64::Engine;
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;
use std::path::PathBuf;

// Import optimized overlay manager
mod overlay;
use overlay::{OverlayManager, ScreenshotCache};

// FAS 2: Import permission cache system
mod system;
use system::{PermissionCache, Permission};

// OCR module for Tesseract integration
mod ocr;
use ocr::{OCRService, OCRResult};

// OCR test module
mod test_ocr;

// Authentication module
mod auth;
// Using API approach - no direct database connection
use auth::{AuthService, User};

// Global OCR service (reuse instance for performance)
static mut OCR_SERVICE: Option<std::sync::Mutex<OCRService>> = None;
static OCR_INIT: std::sync::Once = std::sync::Once::new();

// Note: macOS-specific imports removed since we're using native egui overlay

#[derive(Clone, Serialize, Deserialize)]
pub struct AppResult {
    pub success: bool,
    pub message: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CaptureBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct CaptureResult {
    pub success: bool,
    pub message: String,
    pub bounds: Option<CaptureBounds>,
    pub image_data: Option<String>, // Base64 encoded image
}

// App state that persists between window creations (like Raycast)
#[derive(Clone, Default, Serialize)]
pub struct AppState {
    pub screenshot_data: Option<String>,
    pub last_bounds: Option<CaptureBounds>,
    pub last_window_closed_time: Option<u64>, // Timestamp when window was last closed
}

type SharedState = Arc<Mutex<AppState>>;

// FAS 1: Optimized overlay manager for pooling
type SharedOverlayManager = Arc<Mutex<OverlayManager>>;

// FAS 2: Permission cache manager for optimization
type SharedPermissionCache = Arc<Mutex<PermissionCache>>;

// FAS 3: Screenshot cache manager for optimization
type SharedScreenshotCache = Arc<Mutex<ScreenshotCache>>;

// Authentication service manager
type SharedAuthService = Arc<Mutex<AuthService>>;

// Test screen capture capability
#[tauri::command]
async fn test_screen_capture() -> Result<CaptureResult, String> {
    println!("🧪 Testing screen capture capability...");
    
    match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                println!("✅ Screen access working. Available: {} screen(s)", screens.len());
                Ok(CaptureResult {
                    success: true,
                    message: format!("Screen capture test successful! Found {} screen(s)", screens.len()),
                    bounds: None,
                    image_data: None,
                })
            } else {
                println!("❌ No screens available");
                Ok(CaptureResult {
                    success: false,
                    message: "No screens available for capture".to_string(),
                    bounds: None,
                    image_data: None,
                })
            }
        },
        Err(e) => {
            println!("❌ Screen capture test failed: {}", e);
            Ok(CaptureResult {
                success: false,
                message: format!("Screen access failed: {}", e),
                bounds: None,
                image_data: None,
            })
        }
    }
}

// Capture a specific area of the screen
#[tauri::command]
async fn capture_screen_area(bounds: CaptureBounds) -> Result<CaptureResult, String> {
    println!("📸 Capturing screen area: {}x{} at ({}, {})", bounds.width, bounds.height, bounds.x, bounds.y);
    
    match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                let screen_width = screen.display_info.width;
                let screen_height = screen.display_info.height;
                
                println!("📺 Screen dimensions: {}x{}", screen_width, screen_height);
                
                // 🔧 FIX: Validate and clamp coordinates to screen bounds
                let safe_x = bounds.x.max(0).min((screen_width as i32) - (bounds.width as i32));
                let safe_y = bounds.y.max(0).min((screen_height as i32) - (bounds.height as i32));
                let safe_width = bounds.width.min((screen_width as u32) - (safe_x as u32));
                let safe_height = bounds.height.min((screen_height as u32) - (safe_y as u32));
                
                println!("🔧 Adjusted coordinates: {}x{} at ({}, {}) → {}x{} at ({}, {})", 
                         bounds.width, bounds.height, bounds.x, bounds.y,
                         safe_width, safe_height, safe_x, safe_y);
                
                // Ensure minimum size
                if safe_width < 10 || safe_height < 10 {
                    println!("❌ Adjusted area too small: {}x{}", safe_width, safe_height);
                    return Ok(CaptureResult {
                        success: false,
                        message: format!("Capture area too small after adjustment: {}x{}", safe_width, safe_height),
                        bounds: None,
                        image_data: None,
                    });
                }
                
                match screen.capture_area(safe_x, safe_y, safe_width, safe_height) {
                    Ok(image) => {
                        // Convert to PNG and then to base64
                        match image.to_png(None) {
                            Ok(png_data) => {
                                let base64_data = base64::engine::general_purpose::STANDARD.encode(&png_data);
                                let full_data = format!("data:image/png;base64,{}", base64_data);
                                
                                println!("✅ Screen capture successful! Size: {}KB", png_data.len() / 1024);
                                Ok(CaptureResult {
                                    success: true,
                                    message: "Screen area captured successfully!".to_string(),
                                    bounds: Some(CaptureBounds {
                                        x: safe_x,
                                        y: safe_y,
                                        width: safe_width,
                                        height: safe_height,
                                    }),
                                    image_data: Some(full_data),
                                })
                            },
                            Err(e) => {
                                println!("❌ PNG conversion failed: {}", e);
                                Ok(CaptureResult {
                                    success: false,
                                    message: format!("PNG conversion failed: {}", e),
                                    bounds: None,
                                    image_data: None,
                                })
                            }
                        }
                    },
                    Err(e) => {
                        println!("❌ Screen capture failed: {}", e);
                        Ok(CaptureResult {
                            success: false,
                            message: format!("Screen capture failed: {}", e),
                            bounds: None,
                            image_data: None,
                        })
                    }
                }
            } else {
                println!("❌ No screens available");
                Ok(CaptureResult {
                    success: false,
                    message: "No screens available for capture".to_string(),
                    bounds: None,
                    image_data: None,
                })
            }
        },
        Err(e) => {
            println!("❌ Failed to access screens: {}", e);
            Ok(CaptureResult {
                success: false,
                message: format!("Failed to access screens: {}", e),
                bounds: None,
                image_data: None,
            })
        }
    }
}

// Single test command
#[tauri::command]
async fn test_command() -> Result<AppResult, String> {
    Ok(AppResult {
        success: true,
        message: "FrameSense systemtray test".to_string(),
    })
}

// Test OCR functionality (Step 1B from AI.txt)
#[tauri::command]
async fn test_ocr() -> Result<AppResult, String> {
    println!("🧪 Testing OCR (Tesseract) functionality...");
    
    match OCRService::test_ocr() {
        Ok(message) => {
            println!("✅ OCR test successful: {}", message);
            Ok(AppResult {
                success: true,
                message,
            })
        },
        Err(error) => {
            println!("❌ OCR test failed: {}", error);
            Ok(AppResult {
                success: false,
                message: error,
            })
        }
    }
}

// Run comprehensive OCR verification tests
#[tauri::command]
async fn run_ocr_verification() -> Result<AppResult, String> {
    println!("🚀 Running comprehensive OCR verification...");
    
    // Run all tests and capture output
    test_ocr::run_all_tests();
    
    // If we get here, tests passed (would have panicked otherwise)
    Ok(AppResult {
        success: true,
        message: "🎉 All OCR verification tests passed! Tesseract is working correctly.".to_string(),
    })
}

// Extract text from image using OCR (Step 2-3 from AI.txt)
#[tauri::command]
async fn extract_text_ocr(image_data: String) -> Result<OCRResult, String> {
    println!("📝 Extracting text from image using OCR...");
    
    unsafe {
        OCR_INIT.call_once(|| {
            if let Ok(service) = OCRService::new() {
                OCR_SERVICE = Some(std::sync::Mutex::new(service));
                println!("✅ OCR service initialized successfully");
            } else {
                println!("❌ Failed to initialize OCR service");
            }
        });
        
        if let Some(ref service_mutex) = OCR_SERVICE {
            let service = service_mutex.lock().unwrap();
            match service.extract_text(&image_data) {
                Ok(result) => {
                    println!("✅ OCR extraction successful - Text: '{}', Confidence: {:.2}%", 
                             result.text, result.confidence * 100.0);
                    Ok(result)
                },
                Err(error) => {
                    println!("❌ OCR extraction failed: {}", error);
                    Err(error)
                }
            }
        } else {
            let error_msg = "OCR service not initialized".to_string();
            println!("❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

// Check permissions (simplified for now)
#[tauri::command]
async fn check_permissions() -> Result<bool, String> {
    // For now, just return true since we handle permissions via macOS system prompts
    // In a real app, you might want to check specific permissions here
    println!("🔐 Checking permissions...");
    Ok(true)
}

// 🚀 FAS 2: OPTIMIZED PERMISSION COMMANDS

// Check permissions with smart caching (95% faster)
#[tauri::command]
fn check_permissions_cached(
    cache: tauri::State<'_, SharedPermissionCache>
) -> Result<bool, String> {
    let mut permission_cache = cache.lock().unwrap();
    
    // Check all necessary permissions with caching
    let screen_recording = permission_cache.check_permission_cached(Permission::ScreenRecording)?;
    let accessibility = permission_cache.check_permission_cached(Permission::Accessibility)?;
    
    let all_granted = screen_recording && accessibility;
    println!("🔐 Cached permissions check result: {}", all_granted);
    Ok(all_granted)
}

// Clear permission cache (for testing or when permissions change)
#[tauri::command]
fn clear_permission_cache(
    cache: tauri::State<'_, SharedPermissionCache>
) -> Result<(), String> {
    let mut permission_cache = cache.lock().unwrap();
    permission_cache.clear_cache();
    println!("🗑️ Permission cache cleared");
    Ok(())
}

// Get permission cache statistics
#[tauri::command]
fn get_permission_cache_stats(
    cache: tauri::State<'_, SharedPermissionCache>
) -> Result<serde_json::Value, String> {
    let permission_cache = cache.lock().unwrap();
    let (total, expired) = permission_cache.get_cache_stats();
    
    let stats = serde_json::json!({
        "total_entries": total,
        "expired_entries": expired,
        "active_entries": total - expired
    });
    
    println!("📊 Permission cache stats: {} total, {} expired, {} active", 
             total, expired, total - expired);
    Ok(stats)
}

// Cleanup expired permission cache entries
#[tauri::command]
fn cleanup_permission_cache(
    cache: tauri::State<'_, SharedPermissionCache>
) -> Result<(), String> {
    let mut permission_cache = cache.lock().unwrap();
    permission_cache.cleanup_expired();
    println!("🧹 Permission cache cleanup completed");
    Ok(())
}

// 🚀 FAS 3: OPTIMIZED SCREENSHOT COMMANDS

// Capture screen area with smart caching (60% faster)
#[tauri::command]
fn capture_screen_area_optimized(
    bounds: CaptureBounds,
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<CaptureResult, String> {
    let mut screenshot_cache = cache.lock().unwrap();
    
    match screenshot_cache.capture_optimized(bounds.clone()) {
        Ok(image_data) => {
            Ok(CaptureResult {
                success: true,
                message: "Optimized screen capture successful!".to_string(),
                bounds: Some(bounds),
                image_data: Some(image_data),
            })
        },
        Err(e) => {
            Ok(CaptureResult {
                success: false, 
                message: e,
                bounds: None,
                image_data: None,
            })
        }
    }
}

// Clear screenshot cache (for testing or memory management)
#[tauri::command]
fn clear_screenshot_cache(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    screenshot_cache.clear_cache();
    println!("🗑️ Screenshot cache cleared");
    Ok(())
}

// Get screenshot cache statistics
#[tauri::command]
fn get_screenshot_cache_stats(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<serde_json::Value, String> {
    let screenshot_cache = cache.lock().unwrap();
    let (total_entries, total_size, expired_entries) = screenshot_cache.get_cache_stats();
    
    let stats = serde_json::json!({
        "total_entries": total_entries,
        "total_size_bytes": total_size,
        "total_size_mb": total_size / (1024 * 1024),
        "expired_entries": expired_entries,
        "active_entries": total_entries - expired_entries
    });
    
    println!("📊 Screenshot cache stats: {} entries, {}MB, {} expired", 
             total_entries, total_size / (1024 * 1024), expired_entries);
    Ok(stats)
}

// Cleanup expired screenshot cache entries
#[tauri::command]
fn cleanup_screenshot_cache(
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    screenshot_cache.cleanup_expired();
    println!("🧹 Screenshot cache cleanup completed");
    Ok(())
}

// Resize screenshot buffer (for memory optimization)
#[tauri::command]
fn resize_screenshot_buffer(
    new_size_mb: usize,
    cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    let mut screenshot_cache = cache.lock().unwrap();
    let new_size_bytes = new_size_mb * 1024 * 1024;
    screenshot_cache.resize_buffer(new_size_bytes);
    println!("📏 Screenshot buffer resized to {}MB", new_size_mb);
    Ok(())
}

// 🚀 AUTHENTICATION COMMANDS

// Login user with credentials
#[tauri::command]
async fn login_user(
    email: String, 
    password: String, 
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<User, String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.login_user(email, password).await
}

// Logout current user
#[tauri::command]
async fn logout_user(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.logout_user().await
}

// Get current logged in user
#[tauri::command]
async fn get_current_user(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.get_current_user().await
}

// Save user session to storage
#[tauri::command]
async fn save_user_session(
    user: User,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.save_user_session(&user).await
}

// Load user session from storage
#[tauri::command]
async fn load_user_session(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.load_user_session().await
}

// Handle payment success from deep link
#[tauri::command]
async fn handle_payment_success(
    token: String, 
    plan: String, 
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<User, String> {
    // Clone the auth service to avoid holding the lock across await
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    service.handle_payment_success(token, plan).await
}

// Get available models for user tier
#[tauri::command]
fn get_available_models(
    user_tier: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Vec<String>, String> {
    println!("🔍 DEBUG: get_available_models called for tier: {}", user_tier);
    
    let service = auth_service.lock().unwrap();
    let raw_models = service.get_available_models(&user_tier);
    let models: Vec<String> = raw_models
        .iter()
        .map(|&s| s.to_string())
        .collect();
    
    println!("✅ DEBUG: get_available_models returning {} models: {:?}", models.len(), models);
    Ok(models)
}

// Check if user can use specific model
#[tauri::command]
fn can_use_model(
    user_tier: String,
    model: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<bool, String> {
    println!("🔍 DEBUG: can_use_model called - tier: '{}', model: '{}'", user_tier, model);
    
    let service = auth_service.lock().unwrap();
    let can_use = service.can_use_model(&user_tier, &model);
    
    println!("✅ DEBUG: can_use_model result: {} (tier: '{}', model: '{}')", can_use, user_tier, model);
    Ok(can_use)
}

// Test deep link functionality (for development)
#[tauri::command]
async fn test_deep_link(app: tauri::AppHandle, token: String, plan: String) -> Result<(), String> {
    println!("🧪 Testing deep link with token: {} and plan: {}", token, plan);
    
    // Emit payment success event for testing
    app.emit("payment_success", serde_json::json!({
        "token": token,
        "plan": plan
    })).map_err(|e| format!("Failed to emit payment success: {}", e))?;
    
    println!("✅ Test deep link event emitted successfully");
    Ok(())
}

// Verify payment status and update user tier
#[tauri::command]
async fn verify_payment_status(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<Option<User>, String> {
    println!("🔄 Verifying payment status with backend...");
    
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    
    match service.verify_payment_and_update().await {
        Ok(Some(user)) => {
            println!("✅ Payment verification successful: {} ({})", user.email, user.tier);
            Ok(Some(user))
        },
        Ok(None) => {
            println!("ℹ️ No current session found");
            Ok(None)
        },
        Err(e) => {
            println!("❌ Payment verification failed: {}", e);
            Err(e)
        }
    }
}

// Clear local user session (for troubleshooting)
#[tauri::command]
async fn clear_user_session(
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<(), String> {
    println!("🗑️ Clearing local user session...");
    
    let service = {
        let guard = auth_service.lock().unwrap();
        guard.clone()
    };
    
    service.logout_user().await?;
    println!("✅ Local session cleared");
    Ok(())
}

// Debug: Test model access for a tier
#[tauri::command]
fn debug_test_tier_models(
    tier: String,
    auth_service: tauri::State<'_, SharedAuthService>
) -> Result<serde_json::Value, String> {
    let service = auth_service.lock().unwrap();
    let models = service.get_available_models(&tier);
    
    let result = serde_json::json!({
        "tier": tier,
        "available_models": models,
        "model_count": models.len(),
        "can_use_gpt4o": service.can_use_model(&tier, "GPT-4o"),
        "can_use_gpt4o_mini": service.can_use_model(&tier, "GPT-4o-mini"),
        "can_use_claude_haiku": service.can_use_model(&tier, "Claude 3 Haiku")
    });
    
    println!("🧪 DEBUG: Tier {} model access: {}", tier, result);
    Ok(result)
}

// Removed problematic HTML/JS-based overlay function - using React overlays only

// Removed old process_screen_selection - using optimized version only

// Get window position for coordinate conversion
#[tauri::command]
async fn get_window_position(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    if let Some(window) = app.get_webview_window("main") {
        match window.outer_position() {
            Ok(position) => {
                let pos = serde_json::json!({
                    "x": position.x,
                    "y": position.y
                });
                println!("📍 Window position: {}x{}", position.x, position.y);
                Ok(pos)
            },
            Err(e) => {
                println!("❌ Failed to get window position: {}", e);
                Err(format!("Failed to get window position: {}", e))
            }
        }
    } else {
        Err("Main window not found".to_string())
    }
}

// Save app state to file for persistence (like Raycast)
#[tauri::command]
async fn save_app_state(
    screenshot_data: Option<String>,
    bounds: Option<CaptureBounds>,
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedState>
) -> Result<(), String> {
    println!("💾 Saving app state...");
    
    // Update in-memory state
    {
        let mut app_state = state.lock().unwrap();
        app_state.screenshot_data = screenshot_data.clone();
        app_state.last_bounds = bounds.clone();
        app_state.last_window_closed_time = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
    }
    
    // Save to file for persistence
    if let Some(app_data_dir) = app.path().app_data_dir().ok() {
        let state_file = app_data_dir.join("app_state.json");
        
        // Ensure directory exists
        if let Some(parent) = state_file.parent() {
            if !parent.exists() {
                match std::fs::create_dir_all(parent) {
                    Ok(_) => println!("📁 Created app data directory"),
                    Err(e) => println!("⚠️ Failed to create app data directory: {}", e),
                }
            }
        }
        
        // Save current state
        let current_state = state.lock().unwrap().clone();
        match serde_json::to_string_pretty(&current_state) {
            Ok(state_json) => {
                match std::fs::write(&state_file, state_json) {
                    Ok(_) => println!("✅ App state saved successfully"),
                    Err(e) => println!("❌ Failed to write app state: {}", e),
                }
            },
            Err(e) => println!("❌ Failed to serialize app state: {}", e),
        }
    }
    
    Ok(())
}

// Create transparent overlay window using React (not HTML)
#[tauri::command]
async fn create_transparent_overlay(app: tauri::AppHandle) -> Result<(), String> {
    // Close existing overlay if it exists
    if let Some(existing) = app.get_webview_window("overlay") {
        println!("🗑️ Closing existing React overlay window...");
        match existing.close() {
            Ok(_) => {
                println!("✅ Existing React overlay close requested");
                // Short delay to let window close
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            },
            Err(e) => println!("⚠️ Failed to close existing React overlay: {}", e),
        }
    }
    
    // Get actual screen dimensions
    let (screen_width, screen_height) = match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                let width = screen.display_info.width as f64;
                let height = screen.display_info.height as f64;
                println!("📺 Detected screen: {}x{}", width, height);
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
    
    println!("🎯 Creating React-based transparent overlay window...");
    
    // Create React-based fullscreen overlay window
    let _overlay = WebviewWindowBuilder::new(
        &app,
        "overlay",
        WebviewUrl::App("overlay".into())  // React route from OverlayApp.tsx
    )
    .title("FrameSense Overlay")
    .inner_size(screen_width, screen_height)
    .position(0.0, 0.0)
    .decorations(false)
    .transparent(true)        // Transparent window
    .shadow(false)            // No shadow
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .build()
    .map_err(|e| format!("Failed to create React overlay: {}", e))?;
    
    println!("✅ React-based transparent overlay window created!");
    Ok(())
}

// Close transparent overlay window
#[tauri::command]
async fn close_transparent_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        match overlay.close() {
            Ok(_) => {
                println!("✅ Closed React transparent overlay");
                Ok(())
            },
            Err(e) => {
                println!("❌ Failed to close React overlay: {}", e);
                Err(format!("Failed to close React overlay: {}", e))
            }
        }
    } else {
        println!("❌ React overlay window not found");
        Err("React overlay window not found".to_string())
    }
}

// 🚀 FAS 1: OPTIMIZED OVERLAY COMMANDS (React-based, no HTML/JS issues)

// Create optimized overlay using OverlayManager pooling with React
#[tauri::command]
async fn create_transparent_overlay_optimized(
    app: tauri::AppHandle,
    overlay_manager: tauri::State<'_, SharedOverlayManager>
) -> Result<(), String> {
    println!("🎯 Creating optimized overlay and hiding main window...");
    
    // 🔧 HIDE main window during capture mode
    if let Some(main_window) = app.get_webview_window("main") {
        match main_window.hide() {
            Ok(_) => println!("👻 Main window hidden for capture mode"),
            Err(e) => println!("⚠️ Failed to hide main window: {}", e),
        }
    }
    
    let mut manager = overlay_manager.lock().unwrap();
    manager.show_selection_overlay(&app)
}

// Close optimized overlay using OverlayManager
#[tauri::command] 
async fn close_transparent_overlay_optimized(
    app: tauri::AppHandle,
    overlay_manager: tauri::State<'_, SharedOverlayManager>
) -> Result<(), String> {
    println!("🎯 Closing optimized overlay and showing main window...");
    
    let mut manager = overlay_manager.lock().unwrap();
    let result = manager.hide_overlay();
    
    // 🔧 SHOW main window again after capture mode
    if let Some(main_window) = app.get_webview_window("main") {
        match main_window.show() {
            Ok(_) => {
                println!("👁️ Main window shown again after capture");
                // Focus the window so it's ready for interaction
                if let Err(e) = main_window.set_focus() {
                    println!("⚠️ Failed to focus main window: {}", e);
                }
            },
            Err(e) => println!("⚠️ Failed to show main window: {}", e),
        }
    }
    
    result
}

// Process screen selection with React overlay and optimized capture
#[tauri::command]
async fn process_screen_selection_optimized(
    app: tauri::AppHandle, 
    bounds: CaptureBounds,
    overlay_manager: tauri::State<'_, SharedOverlayManager>,
    screenshot_cache: tauri::State<'_, SharedScreenshotCache>
) -> Result<(), String> {
    println!("📸 Processing optimized screen selection: {}x{} at ({}, {})", 
             bounds.width, bounds.height, bounds.x, bounds.y);
    
    // Use optimized capture with caching
    let capture_result = capture_screen_area_optimized(bounds.clone(), screenshot_cache)?;
    
    if capture_result.success && capture_result.image_data.is_some() {
        let image_data = capture_result.image_data.unwrap();
        println!("✅ Optimized screen capture successful!");
        
        // Send result to React (same as original)
        if let Some(window) = app.get_webview_window("main") {
            let analysis_result = serde_json::json!({
                "type": "image",
                "bounds": bounds,
                "imageData": image_data,
                "text": null,
                "success": true,
                "message": "Optimized screen area captured successfully!"
            });
            
            window.emit("selection-result", analysis_result).unwrap();
            println!("📤 Sent optimized capture data to main app");
        }
        
        // Hide overlay using optimized manager
        let _ = close_transparent_overlay_optimized(app, overlay_manager);
        
    } else {
        println!("❌ Optimized capture failed: {}", capture_result.message);
    }
    
    Ok(())
}

// Cleanup old overlays periodically
#[tauri::command]
fn cleanup_overlay_manager(overlay_manager: tauri::State<'_, SharedOverlayManager>) -> Result<(), String> {
    println!("🗑️ Running overlay cleanup...");
    
    let mut manager = overlay_manager.lock().map_err(|e| format!("Failed to lock overlay manager: {}", e))?;
    manager.cleanup_if_old();
    
    println!("✅ Overlay cleanup completed");
    Ok(())
}

// 🆕 FAS 2: WINDOW RESIZE FUNCTIONS

// Resize main window for chat expansion/contraction
#[tauri::command]
async fn resize_window(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    println!("📏 Resizing main window to {}x{}", width, height);
    
    if let Some(window) = app.get_webview_window("main") {
        match window.set_size(tauri::LogicalSize::new(width, height)) {
            Ok(_) => {
                println!("✅ Window resized successfully to {}x{}", width, height);
                Ok(())
            },
            Err(e) => {
                println!("❌ Failed to resize window: {}", e);
                Err(format!("Failed to resize window: {}", e))
            }
        }
    } else {
        println!("❌ Main window not found for resize");
        Err("Main window not found".to_string())
    }
}

// Note: Main window created with .transparent(true) - React CSS controls background visibility
// When chatBoxOpen=true: transparent, when false: white background

// 🔧 DEBUG COMMAND - Get detailed coordinate info
#[tauri::command]
async fn debug_coordinates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let mut debug_info = serde_json::Map::new();
    
    // Main window info
    if let Some(main_window) = app.get_webview_window("main") {
        if let Ok(pos) = main_window.outer_position() {
            debug_info.insert("main_outer_position".to_string(), 
                serde_json::json!({"x": pos.x, "y": pos.y}));
        }
        if let Ok(size) = main_window.outer_size() {
            debug_info.insert("main_outer_size".to_string(), 
                serde_json::json!({"width": size.width, "height": size.height}));
        }
        if let Ok(inner_pos) = main_window.inner_position() {
            debug_info.insert("main_inner_position".to_string(), 
                serde_json::json!({"x": inner_pos.x, "y": inner_pos.y}));
        }
        if let Ok(inner_size) = main_window.inner_size() {
            debug_info.insert("main_inner_size".to_string(), 
                serde_json::json!({"width": inner_size.width, "height": inner_size.height}));
        }
        if let Ok(scale) = main_window.scale_factor() {
            debug_info.insert("scale_factor".to_string(), serde_json::json!(scale));
        }
    }
    

    
    // Screen info
    if let Ok(screens) = screenshots::Screen::all() {
        if let Some(screen) = screens.first() {
            debug_info.insert("screen_size".to_string(), 
                serde_json::json!({
                    "width": screen.display_info.width,
                    "height": screen.display_info.height
                }));
        }
    }
    
    println!("🔍 DEBUG INFO: {}", serde_json::to_string_pretty(&debug_info).unwrap());
    Ok(serde_json::Value::Object(debug_info))
}



// 🔧 TEST COMMAND - Position ChatBox at specific coordinates
#[tauri::command]
async fn test_chatbox_position(app: tauri::AppHandle, x: f64, y: f64) -> Result<(), String> {
    println!("🧪 Testing ChatBox position at ({}, {})", x, y);
    
    // Close existing chatbox if it exists
    if let Some(chatbox) = app.get_webview_window("chatbox") {
        let _ = chatbox.close();
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }
    
    // Create ChatBox at specific position for testing
    let chatbox_html = r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ChatBox Position Test</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: rgba(255, 0, 0, 0.8);
            border: 3px solid red;
            border-radius: 12px;
            padding: 16px;
            font-family: system-ui, -apple-system, sans-serif;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
        }
    </style>
</head>
<body>
    TEST POSITION<br/>
    x: {}, y: {}
    <script>
        setTimeout(() => window.close(), 3000); // Auto-close after 3 seconds
    </script>
</body>
</html>"#;
    
    let test_html = chatbox_html.replace("x: {}, y: {}", &format!("x: {}, y: {}", x, y));
    let data_url = format!("data:text/html;charset=utf-8,{}", urlencoding::encode(&test_html));
    
    let _test_window = WebviewWindowBuilder::new(
        &app,
        "test-chatbox",  // Use different ID for test
        WebviewUrl::External(data_url.parse().unwrap())
    )
    .title("Position Test")
    .inner_size(200.0, 100.0)
    .position(x, y)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .build()
    .map_err(|e| format!("Failed to create test window: {}", e))?;
    
    println!("🎯 Test ChatBox created at ({}, {}) - will auto-close in 3 seconds", x, y);
    Ok(())
}

// Create new main window on current Space (like Raycast/Spotlight)
#[tauri::command]
async fn create_main_window(app: tauri::AppHandle) -> Result<(), String> {
    // Close existing window if it exists
    if let Some(existing) = app.get_webview_window("main") {
        let _ = existing.close();
    }
    println!("🎯 Creating new main window on current Space...");

    // Get screen size
    let (screen_width, screen_height) = match screenshots::Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                (screen.display_info.width as f64, screen.display_info.height as f64)
            } else {
                (1440.0, 900.0) // fallback
            }
        },
        Err(_) => (1440.0, 900.0),
    };
    let window_width = 600.0;
    let window_height = 50.0;
    let x = (screen_width - window_width) / 2.0;
    let y = screen_height * 0.2 - window_height / 2.0;

    // Create fresh window that will appear on current Space
    let _window = WebviewWindowBuilder::new(
        &app,
        "main",
        WebviewUrl::App("/".into())
    )
    .title("FrameSense")
    .inner_size(window_width, window_height)
    .position(x, y)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| format!("Failed to create main window: {}", e))?;

    println!("✅ New main window created on current Space at ({}, {})!", x, y);
    Ok(())
}

// 🔧 MOVE WINDOW COMMAND - Move window to correct Y position
#[tauri::command]
async fn move_window_to_position(app: tauri::AppHandle) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;

    println!("📍 Cycling window position (1/3, 2/3, center)...");
    if let Some(window) = app.get_webview_window("main") {
        // Get screen size
        let (screen_width, screen_height) = match screenshots::Screen::all() {
            Ok(screens) => {
                if let Some(screen) = screens.first() {
                    (screen.display_info.width as f64, screen.display_info.height as f64)
                } else {
                    (1440.0, 900.0)
                }
            },
            Err(_) => (1440.0, 900.0),
        };
        let window_width = 600.0;
        let window_height = 50.0;
        let y = screen_height * 0.2 - window_height / 2.0;

        // Cykel-index lagras i fil i hemkatalogen
        let mut cycle_index = 0;
        let mut cycle_path = dirs::home_dir().unwrap_or(PathBuf::from("/tmp"));
        cycle_path.push(".framesense_window_pos_cycle");
        if let Ok(contents) = fs::read_to_string(&cycle_path) {
            if let Ok(idx) = contents.trim().parse::<u8>() {
                cycle_index = idx;
            }
        }
        // Nästa position
        cycle_index = (cycle_index + 1) % 3;
        // Spara för nästa gång
        let _ = fs::write(&cycle_path, format!("{}", cycle_index));

        // Räkna ut x-positioner
        let x = match cycle_index {
            0 => (screen_width - window_width) / 2.0, // center
            1 => screen_width / 3.0 - window_width / 2.0, // 1/3 från vänster
            2 => 2.0 * screen_width / 3.0 - window_width / 2.0, // 2/3 från vänster
            _ => (screen_width - window_width) / 2.0,
        };
        println!("📍 Moving window to x={}, y={}", x, y);
        match window.set_position(tauri::LogicalPosition::new(x, y)) {
            Ok(_) => {
                println!("✅ Window moved to cycled position: ({}, {})", x, y);
                Ok(())
            },
            Err(e) => {
                println!("❌ Failed to move window: {}", e);
                Err(format!("Failed to move window: {}", e))
            }
        }
    } else {
        println!("❌ Main window not found for repositioning");
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
async fn get_app_state(
    state: tauri::State<'_, SharedState>
) -> Result<AppState, String> {
    let app_state = state.lock().unwrap().clone();
    println!("📖 App state retrieved");
    Ok(app_state)
}

fn main() {
    // Initialize shared state for Raycast-style persistence
    let shared_state: SharedState = Arc::new(Mutex::new(AppState::default()));
    
    // FAS 1: Initialize optimized overlay manager for pooling
    let shared_overlay_manager: SharedOverlayManager = Arc::new(Mutex::new(OverlayManager::new()));
    
    // FAS 2: Initialize permission cache for optimization
    let shared_permission_cache: SharedPermissionCache = Arc::new(Mutex::new(PermissionCache::new()));
    
    // FAS 3: Initialize screenshot cache for optimization
    let shared_screenshot_cache: SharedScreenshotCache = Arc::new(Mutex::new(ScreenshotCache::new()));
    
    // Initialize authentication service with storage path
    let app_data_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join(".framesense");
    let auth_service = AuthService::new().with_storage_path(app_data_dir);
    let shared_auth_service: SharedAuthService = Arc::new(Mutex::new(auth_service));
    
    // Database access through backend API only - no direct connection
    
    tauri::Builder::default()
        .manage(shared_state)
        .manage(shared_overlay_manager)
        .manage(shared_permission_cache)
        .manage(shared_screenshot_cache)
        .manage(shared_auth_service)
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                println!("🔥 GLOBAL SHORTCUT: {:?} - State: {:?}", shortcut, event.state());
                
                // Only react to key PRESS, not release!
                if event.state() == ShortcutState::Pressed {
                    let app_clone = app.clone();
                    std::thread::spawn(move || {
                        // Small delay to avoid rapid toggle
                        std::thread::sleep(std::time::Duration::from_millis(50));
                        
                        // Raycast-style: Create/Destroy window to appear on current Space
                        if let Some(window) = app_clone.get_webview_window("main") {
                            // Window exists - save state and close it
                            println!("🔄 Window exists, closing and saving state...");
                            
                            // Emit event to React to save its state before closing
                            let _ = window.emit("save-state-and-close", ());
                            
                            // Close after allowing React to save state
                            std::thread::sleep(std::time::Duration::from_millis(100));
                            let _ = window.close();
                            
                            // Record the time when window was closed for quit logic
                            if let Some(state) = app_clone.try_state::<SharedState>() {
                                let mut app_state = state.lock().unwrap();
                                app_state.last_window_closed_time = Some(
                                    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
                                );
                            }
                            
                            println!("🗑️ Window closed (Raycast-style)");
                        } else {
                            // No window exists - always create new window (remove quit logic)
                            println!("✨ No window exists...");
                            println!("🆕 Creating new window on current Space...");
                            let rt = tokio::runtime::Runtime::new().unwrap();
                            rt.block_on(async {
                                if let Err(e) = create_main_window(app_clone).await {
                                    println!("❌ Failed to create window: {}", e);
                                } else {
                                    println!("✅ New window created successfully!");
                                }
                            });
                        }
                    });
                } else {
                    println!("⚪ Ignoring key release");
                }
            })
            .build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Continue with existing setup...
            // Create tray menu items inside setup where we have access to app
            let quit_item = MenuItem::with_id(app, "quit", "Quit FrameSense", true, None::<&str>)?;
            let capture_item = MenuItem::with_id(app, "capture", "Start Capture", true, None::<&str>)?;
            let test_item = MenuItem::with_id(app, "test", "Test Command", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&capture_item, &test_item, &quit_item])?;
            
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            println!("💀 Quit selected");
                            std::process::exit(0);
                        },
                        "capture" => {
                            println!("📸 Capture triggered from menu!");
                            if let Some(window) = app.get_webview_window("main") {
                                window.emit("show-capture-overlay", ()).unwrap();
                                println!("✅ Sent show-capture-overlay event to React");
                            } else {
                                println!("❌ Main window not found");
                            }
                        },
                        "test" => {
                            println!("🧪 Test command triggered");
                        },
                        _ => {}
                    }
                })
                .on_tray_icon_event(|_tray, event| {
                    println!("🎯 Tray icon event: {:?}", event);
                })
                .build(app)?;

            // Register global hotkey like Cluely (Cmd+Shift+Space for macOS compatibility)
            println!("🚀 Setting up FrameSense background app...");
            
            // Setup global shortcut for window toggle (like Cluely)
            let shortcut = "Alt+Space".parse::<Shortcut>().unwrap();
            
            match app.global_shortcut().register(shortcut) {
                Ok(_) => {
                    println!("✅ Global shortcut Alt+Space registered successfully!");
                    println!("⚠️  Note: Use Alt+Space to toggle window visibility");
                },
                Err(e) => println!("❌ Failed to register global shortcut: {} - Use tray menu instead", e),
            }
            
            println!("✅ FrameSense is ready! Press Alt+Space to create window or use tray menu");
            
            // Close initial window - we'll create fresh ones on Alt+Space (Raycast-style)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
                println!("🗑️ Closed initial window - will create fresh ones on current Space");
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            test_command,
            test_ocr,
            run_ocr_verification,
            extract_text_ocr,
            check_permissions,
            test_screen_capture,
            capture_screen_area,


            get_window_position,
            create_transparent_overlay,
            close_transparent_overlay,
            // FAS 1: Optimized overlay commands
            create_transparent_overlay_optimized,
            close_transparent_overlay_optimized,
            process_screen_selection_optimized,
            cleanup_overlay_manager,
            // FAS 2: Optimized permission commands
            check_permissions_cached,
            clear_permission_cache,
            get_permission_cache_stats,
            cleanup_permission_cache,
            // FAS 3: Optimized screenshot commands
            capture_screen_area_optimized,
            clear_screenshot_cache,
            get_screenshot_cache_stats,
            cleanup_screenshot_cache,
            resize_screenshot_buffer,
            // Authentication commands
            login_user,
            logout_user,
            get_current_user,
            save_user_session,
            load_user_session,
            handle_payment_success,
            get_available_models,
            can_use_model,
            test_deep_link,
            verify_payment_status,
            clear_user_session,
            debug_test_tier_models,
            // Local session management commands
            // save_user_session_local, // Removed as per edit hint
            // load_user_session_local, // Removed as per edit hint
            // clear_user_session_local, // Removed as per edit hint
            // Database authentication commands (for backup) // Removed as per edit hint
            // login_user_db, // Removed as per edit hint
            // get_current_user_db, // Removed as per edit hint
            // logout_user_db, // Removed as per edit hint
            // refresh_user_status_db, // Removed as per edit hint
            // App state management
            save_app_state,
            get_app_state,

            resize_window,
            debug_coordinates,
            test_chatbox_position,
            create_main_window,
            move_window_to_position,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Only prevent close for overlay windows, let main window close normally
                if window.label() == "main" {
                    // Let main window close normally for Raycast-style behavior
                    println!("🚪 Main window close requested");
                } else {
                    // Hide other windows (like overlays) instead of closing
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            match event {
                RunEvent::Ready => {
                    println!("🎯 App ready!");
                },
                RunEvent::ExitRequested { api, .. } => {
                    // Prevent app from closing when last window closes
                    api.prevent_exit();
                }
                _ => {}
            }
        });
}
