import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import DragOverlay from './components/DragOverlay';

function OverlayApp() {
	// Force transparent background on all DOM levels
	React.useEffect(() => {
		document.documentElement.style.backgroundColor = 'transparent';
		document.body.style.backgroundColor = 'transparent';
		const root = document.getElementById('root');
		if (root) {
			root.style.backgroundColor = 'transparent';
		}
		console.log('🔍 Forced transparent background on all levels');
		console.log('✅ OverlayApp loaded successfully!');
	}, []);

	const handleSelectionComplete = async (result: any) => {
		console.log('✅ Overlay selection completed!', result);
		
		// Close the overlay window - try optimized first, then regular
		try {
			await invoke('close_transparent_overlay_optimized');
			console.log('✅ Optimized overlay window closed and main window restored');
		} catch (error) {
			console.warn('⚠️ Optimized close failed, trying regular close:', error);
			try {
				await invoke('close_transparent_overlay');
				console.log('✅ Regular overlay window closed');
			} catch (fallbackError) {
				console.error('❌ Both close methods failed:', fallbackError);
			}
		}
	};

	const handleSelectionCancel = async () => {
		console.log('❌ Overlay selection cancelled');
		
		// Close the overlay window - try optimized first, then regular
		try {
			await invoke('close_transparent_overlay_optimized');
			console.log('✅ Optimized overlay window closed and main window restored');
		} catch (error) {
			console.warn('⚠️ Optimized close failed, trying regular close:', error);
			try {
				await invoke('close_transparent_overlay');
				console.log('✅ Regular overlay window closed');
			} catch (fallbackError) {
				console.error('❌ Both close methods failed:', fallbackError);
			}
		}
	};

	return (
		<div 
			className="h-screen w-screen" 
			style={{ 
				backgroundColor: 'transparent',
				position: 'fixed',
				top: 0,
				left: 0,
				zIndex: 9999
			}}
		>
			<DragOverlay 
				onSelectionComplete={handleSelectionComplete}
				onCancel={handleSelectionCancel}
			/>
		</div>
	);
}

export default OverlayApp; 