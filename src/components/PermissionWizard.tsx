import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PermissionWizardProps {
  onPermissionsGranted: () => void;
}

const PermissionWizard: React.FC<PermissionWizardProps> = ({ onPermissionsGranted }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  const requestPermissions = async () => {
    setIsRequesting(true);
    try {
      const success = await invoke('request_permissions');
      if (success) {
        onPermissionsGranted();
      } else {
        setShowManualSteps(true);
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setShowManualSteps(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const openSystemPreferences = async () => {
    try {
      await invoke('open_system_preferences');
    } catch (error) {
      console.error('Failed to open System Preferences:', error);
    }
  };

  if (showManualSteps) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Enable Screen Access</h2>
            <p className="text-gray-600">
              FrameSense needs permission to capture your screen. Please follow these steps:
            </p>
            
            <div className="text-left space-y-3">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                <span className="text-gray-700">Open System Preferences</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                <span className="text-gray-700">Go to Security & Privacy</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                <span className="text-gray-700">Click "Screen Recording"</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                <span className="text-gray-700">Check the box next to "FrameSense"</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={openSystemPreferences}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Open System Preferences
              </button>
              <button
                onClick={onPermissionsGranted}
                className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                I've enabled permissions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to FrameSense!</h1>
            <p className="text-gray-600">
              Give FrameSense superpowers by enabling screen access
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">🖥️ Smart screen capture</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">🔐 100% private & secure</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">⚡ Instant AI insights</span>
            </div>
          </div>

          <button
            onClick={requestPermissions}
            disabled={isRequesting}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-lg"
          >
            {isRequesting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Requesting access...</span>
              </div>
            ) : (
              'Enable Screen Access 🚀'
            )}
          </button>

          <p className="text-xs text-gray-500">
            We only access your screen when you explicitly capture content
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionWizard; 