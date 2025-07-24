import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import OverlayApp from './OverlayApp';
import './index.css';

// Check if this is the overlay window - more robust detection
const isOverlay = 
	window.location.pathname === '/overlay' || 
	window.location.hash.includes('overlay') ||
	window.location.search.includes('overlay') ||
	document.title.includes('Selection') ||
	document.title.includes('Overlay');

console.log('🔍 Window detection:', {
	pathname: window.location.pathname,
	hash: window.location.hash,
	search: window.location.search,
	title: document.title,
	isOverlay: isOverlay
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		{isOverlay ? <OverlayApp /> : <App />}
	</React.StrictMode>
);
