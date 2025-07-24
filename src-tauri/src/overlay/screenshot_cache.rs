use std::collections::HashMap;
use std::time::{Duration, Instant};
use crate::CaptureBounds;
use base64::Engine;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct BoundsKey {
    x: i32,
    y: i32, 
    width: u32,
    height: u32,
}

impl From<CaptureBounds> for BoundsKey {
    fn from(bounds: CaptureBounds) -> Self {
        Self { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
}

#[derive(Debug, Clone)]
struct CachedCapture {
    data: String,          // Base64 PNG data
    captured_at: Instant,
    size_bytes: usize,
}

pub struct ScreenshotCache {
    cache: HashMap<BoundsKey, CachedCapture>,
    screen_info: Option<ScreenInfo>,
    png_buffer: Vec<u8>,  // Återanvänd buffer
    max_cache_size: usize,
    cache_ttl: Duration,
}

#[derive(Debug, Clone)]
struct ScreenInfo {
    width: u32,
    height: u32,
    scale_factor: f64,
    cached_at: Instant,
}

impl ScreenshotCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
            screen_info: None,
            png_buffer: Vec::with_capacity(1024 * 1024), // 1MB initial buffer
            max_cache_size: 50 * 1024 * 1024, // 50MB max cache
            cache_ttl: Duration::from_secs(30), // 30s cache TTL
        }
    }
    
    pub fn capture_optimized(&mut self, bounds: CaptureBounds) -> Result<String, String> {
        let bounds_key = BoundsKey::from(bounds.clone());
        
        // 1. Cache check
        if let Some(cached) = self.cache.get(&bounds_key) {
            if cached.captured_at.elapsed() < self.cache_ttl {
                println!("💰 Screenshot cache hit: {}x{}", bounds.width, bounds.height);
                return Ok(cached.data.clone());
            } else {
                println!("⏰ Screenshot cache expired");
                self.cache.remove(&bounds_key);
            }
        }
        
        // 2. Screen info cache
        if self.screen_info.is_none() || 
           self.screen_info.as_ref().unwrap().cached_at.elapsed() > Duration::from_secs(60) {
            self.screen_info = Some(self.get_screen_info()?);
            println!("📺 Refreshed screen info cache");
        }
        
        // 3. Optimerad capture
        let image_data = self.capture_with_reused_buffer(bounds.clone())?;
        
        // 4. Cache management
        self.add_to_cache(bounds_key, image_data.clone());
        
        Ok(image_data)
    }
    
    fn capture_with_reused_buffer(&mut self, bounds: CaptureBounds) -> Result<String, String> {
        // Använd screenshots library men med optimerad encoding
        match screenshots::Screen::all() {
            Ok(screens) => {
                if let Some(screen) = screens.first() {
                    let screen_width = screen.display_info.width;
                    let screen_height = screen.display_info.height;
                    
                    // Validate and clamp coordinates to screen bounds
                    let safe_x = bounds.x.max(0).min((screen_width as i32) - (bounds.width as i32));
                    let safe_y = bounds.y.max(0).min((screen_height as i32) - (bounds.height as i32));
                    let safe_width = bounds.width.min((screen_width as u32) - (safe_x as u32));
                    let safe_height = bounds.height.min((screen_height as u32) - (safe_y as u32));
                    
                    // Ensure minimum size
                    if safe_width < 10 || safe_height < 10 {
                        return Err(format!("Capture area too small after adjustment: {}x{}", safe_width, safe_height));
                    }
                    
                    match screen.capture_area(safe_x, safe_y, safe_width, safe_height) {
                        Ok(image) => {
                            // PNG encoding (screenshots library handles the buffer internally)
                            match image.to_png(None) {
                                Ok(png_data) => {
                                    // Store in our reusable buffer for potential future optimizations
                                    self.png_buffer.clear();
                                    self.png_buffer.extend_from_slice(&png_data);
                                    
                                    let base64_data = base64::engine::general_purpose::STANDARD.encode(&png_data);
                                    let full_data = format!("data:image/png;base64,{}", base64_data);
                                    
                                    println!("📸 Optimized capture: {}KB", png_data.len() / 1024);
                                    Ok(full_data)
                                },
                                Err(e) => Err(format!("PNG encoding failed: {}", e))
                            }
                        },
                        Err(e) => Err(format!("Screen capture failed: {}", e))
                    }
                } else {
                    Err("No screens available".to_string())
                }
            },
            Err(e) => Err(format!("Failed to access screens: {}", e))
        }
    }
    
    fn add_to_cache(&mut self, key: BoundsKey, data: String) {
        let size = data.len();
        
        // Cache size management
        if self.get_total_cache_size() + size > self.max_cache_size {
            self.evict_oldest_entries(size);
        }
        
        self.cache.insert(key, CachedCapture {
            data,
            captured_at: Instant::now(),
            size_bytes: size,
        });
        
        println!("💾 Added to screenshot cache. Total entries: {}", self.cache.len());
    }
    
    fn get_total_cache_size(&self) -> usize {
        self.cache.values().map(|cached| cached.size_bytes).sum()
    }
    
    fn evict_oldest_entries(&mut self, needed_space: usize) {
        let mut entries: Vec<_> = self.cache.iter().collect();
        entries.sort_by_key(|(_, cached)| cached.captured_at);
        
        let mut freed_space = 0;
        let mut keys_to_remove = Vec::new();
        
        for (key, cached) in entries {
            keys_to_remove.push(key.clone());
            freed_space += cached.size_bytes;
            
            if freed_space >= needed_space {
                break;
            }
        }
        
        for key in keys_to_remove {
            self.cache.remove(&key);
        }
        
        println!("🗑️ Evicted {} old cache entries, freed {}KB", 
                 self.cache.len(), freed_space / 1024);
    }
    
    fn get_screen_info(&self) -> Result<ScreenInfo, String> {
        match screenshots::Screen::all() {
            Ok(screens) => {
                if let Some(screen) = screens.first() {
                    Ok(ScreenInfo {
                        width: screen.display_info.width,
                        height: screen.display_info.height,
                        scale_factor: screen.display_info.scale_factor as f64,
                        cached_at: Instant::now(),
                    })
                } else {
                    Err("No screens available".to_string())
                }
            },
            Err(e) => Err(format!("Failed to get screen info: {}", e))
        }
    }
    
    pub fn clear_cache(&mut self) {
        self.cache.clear();
        println!("🗑️ Screenshot cache cleared");
    }
    
    pub fn get_cache_stats(&self) -> (usize, usize, usize) {
        let total_entries = self.cache.len();
        let total_size = self.get_total_cache_size();
        let expired_entries = self.cache.values()
            .filter(|cached| cached.captured_at.elapsed() > self.cache_ttl)
            .count();
        (total_entries, total_size, expired_entries)
    }
    
    pub fn cleanup_expired(&mut self) {
        let now = Instant::now();
        let before_count = self.cache.len();
        
        self.cache.retain(|_key, cached| now.duration_since(cached.captured_at) < self.cache_ttl);
        
        let after_count = self.cache.len();
        let removed = before_count - after_count;
        
        if removed > 0 {
            println!("🧹 Cleaned up {} expired screenshot cache entries", removed);
        }
    }
    
    pub fn resize_buffer(&mut self, new_capacity: usize) {
        self.png_buffer.clear();
        self.png_buffer.reserve(new_capacity);
        println!("📏 Resized PNG buffer to {}MB", new_capacity / (1024 * 1024));
    }
}

impl Default for ScreenshotCache {
    fn default() -> Self {
        Self::new()
    }
} 