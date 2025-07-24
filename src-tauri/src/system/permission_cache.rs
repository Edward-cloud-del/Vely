use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    ScreenRecording,
    Accessibility,
    FullDiskAccess,
}

#[derive(Debug, Clone)]
pub struct PermissionResult {
    granted: bool,
    checked_at: Instant,
    expires_at: Instant,
}

pub struct PermissionCache {
    cache: HashMap<Permission, PermissionResult>,
    default_ttl: Duration,
}

impl PermissionCache {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
            default_ttl: Duration::from_secs(300), // 5 minutes cache
        }
    }
    
    pub fn check_permission_cached(&mut self, perm: Permission) -> Result<bool, String> {
        // Cache check
        if let Some(cached) = self.cache.get(&perm) {
            if Instant::now() < cached.expires_at {
                println!("💰 Cache hit for {:?}: {}", perm, cached.granted);
                return Ok(cached.granted);
            } else {
                println!("⏰ Cache expired for {:?}", perm);
            }
        }
        
        // Cache miss - check native (simplified since we can't use await here)
        println!("🔍 Checking {:?} permission natively", perm);
        let granted = self.check_permission_native_sync(perm.clone())?;
        
        // Update cache
        let now = Instant::now();
        self.cache.insert(perm.clone(), PermissionResult {
            granted,
            checked_at: now,
            expires_at: now + self.default_ttl,
        });
        
        println!("💾 Cached {:?}: {} for {}s", perm, granted, self.default_ttl.as_secs());
        Ok(granted)
    }
    
    fn check_permission_native_sync(&self, perm: Permission) -> Result<bool, String> {
        match perm {
            Permission::ScreenRecording => {
                // For macOS screen recording, we rely on system prompts
                // In a real implementation, you'd use macOS APIs to check this
                // For now, return true since macOS will prompt if needed
                Ok(true)
            },
            Permission::Accessibility => {
                // For macOS accessibility, we rely on system prompts
                // In a real implementation, you'd use macOS APIs to check this
                // For now, return true since macOS will prompt if needed
                Ok(true)
            },
            Permission::FullDiskAccess => {
                // For macOS full disk access
                // In a real implementation, you'd use macOS APIs to check this
                // For now, return true since most FrameSense features don't need this
                Ok(true)
            }
        }
    }
    
    pub fn clear_cache(&mut self) {
        self.cache.clear();
        println!("🗑️ Permission cache cleared");
    }
    
    pub fn get_cache_stats(&self) -> (usize, usize) {
        let total_entries = self.cache.len();
        let expired_entries = self.cache.values()
            .filter(|result| Instant::now() >= result.expires_at)
            .count();
        (total_entries, expired_entries)
    }
    
    pub fn cleanup_expired(&mut self) {
        let now = Instant::now();
        let before_count = self.cache.len();
        
        self.cache.retain(|_perm, result| now < result.expires_at);
        
        let after_count = self.cache.len();
        let removed = before_count - after_count;
        
        if removed > 0 {
            println!("🧹 Cleaned up {} expired permission cache entries", removed);
        }
    }
}

impl Default for PermissionCache {
    fn default() -> Self {
        Self::new()
    }
} 