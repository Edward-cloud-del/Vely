import React, { useEffect, useState } from 'react';
import { useAppStore, AIResult } from '../stores/app-store';
import { invoke } from '@tauri-apps/api/core';
import ModelSelector from './ModelSelector';

interface ResultOverlayProps {
  result: AIResult;
}

const ResultOverlay: React.FC<ResultOverlayProps> = ({ result }) => {
  const { 
    setCurrentResult, 
    user, 
    selectedModel 
  } = useAppStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    // No auto-close - user must manually dismiss
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentResult(null);
    }, 300); // Wait for animation to complete
  };

  const handleCopyText = async () => {
    try {
      await invoke('copy_to_clipboard', { text: result.content });
      // Show success feedback
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleUpgrade = () => {
    window.open('http://localhost:8080/payments', '_blank');
  };

  // Removed model selector functionality to match AIResponse simplicity

  const getTypeIcon = () => {
    switch (result.type) {
      case 'text':
        return '📝';
      case 'image':
        return '🖼️';
      case 'hybrid':
        return '🔄';
      default:
        return '✨';
    }
  };

  const getModelIcon = () => {
    if (selectedModel.includes('GPT')) return '🤖';
    if (selectedModel.includes('Claude')) return '🧠';
    if (selectedModel.includes('Gemini')) return '💎';
    if (selectedModel.includes('Llama')) return '🦙';
    return '🤖';
  };

  const getTierColor = () => {
    const tier = user?.tier.tier || 'free';
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-700';
      case 'premium': return 'bg-blue-100 text-blue-700';
      case 'pro': return 'bg-purple-100 text-purple-700';
      case 'enterprise': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Safe position values to avoid TypeScript errors
  const positionX = result.position?.x ?? undefined;
  const positionY = result.position?.y ?? undefined;
  const hasPosition = positionX !== undefined && positionY !== undefined;

  return (
    <>
      {/* Seamless AI Response - No backdrop, no modal overlay */}
      <div 
        className={`p-3 rounded-xl border border-white/10 backdrop-blur-sm overflow-y-auto transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{
          backgroundColor: 'rgba(20, 20, 20, 0.7)',
          maxHeight: 'calc(100vh - 68px)',
          minHeight: 60,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <h3 className="text-xs font-medium text-gray-300 mb-2 flex items-center justify-between">
              <span>AI Response</span>
              <button
                onClick={handleClose}
                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
                title="Dismiss"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </h3>

            {/* AI Response Content */}
            <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
              {result.content}
            </div>

          </div>
        </div>
        
        {/* Action buttons */}
        <div className="mt-2 pt-2 border-t border-white/10 flex justify-end space-x-2">
          <button 
            onClick={handleCopyText}
            className="px-2 py-1 text-xs text-gray-300 hover:text-gray-100 transition-colors"
          >
            Copy
          </button>
          <button 
            onClick={handleUpgrade}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </>
  );
};

export default ResultOverlay; 