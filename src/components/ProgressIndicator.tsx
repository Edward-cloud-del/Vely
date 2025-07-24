import React from 'react';
import { useAppStore } from '../stores/app-store';

const ProgressIndicator: React.FC = () => {
  const { processingStage } = useAppStore();

  const stages = [
    { id: 'capture', label: 'Capturing screen...', icon: '📸' },
    { id: 'processing', label: 'Processing image...', icon: '⚙️' },
    { id: 'ocr', label: 'Reading text...', icon: '🔍' },
    { id: 'ai', label: 'Analyzing with AI...', icon: '🤖' },
    { id: 'done', label: 'Complete!', icon: '✨' },
  ];

  const currentStageIndex = stages.findIndex(stage => stage.id === processingStage);
  const currentStage = stages[currentStageIndex] || stages[0];

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-6 min-w-[300px]">
        <div className="flex items-center space-x-4">
          {/* Animated icon */}
          <div className="relative">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-2xl">{currentStage.icon}</span>
            </div>
            <div className="absolute -inset-1 bg-primary-200 rounded-full animate-ping opacity-25"></div>
          </div>
          
          {/* Progress content */}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">FrameSense</h3>
            <p className="text-sm text-gray-600 mb-3">{currentStage.label}</p>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${((currentStageIndex + 1) / stages.length) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stage indicators */}
        <div className="flex justify-between mt-4 px-1">
          {stages.map((stage, index) => (
            <div 
              key={stage.id}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                index <= currentStageIndex 
                  ? 'bg-primary-600' 
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator; 