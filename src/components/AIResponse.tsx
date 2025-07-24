import React from 'react';

interface AIResponseProps {
	response: string;
	onDismiss?: () => void;
}

export default function AIResponse({ response, onDismiss }: AIResponseProps) {
	return (
		<div 
			className="p-3 rounded-xl border border-white/10 backdrop-blur-sm overflow-y-auto"
			style={{
				backgroundColor: 'rgba(20, 20, 20, 0.7)',
				maxHeight: 'calc(100vh - 68px)',
				minHeight: 60,
			}}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1 min-w-0">
					<h3 className="text-xs font-medium text-gray-300 mb-2">
						AI Response
					</h3>
					<div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
						{response}
					</div>
				</div>
				
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
						title="Dismiss"
					>
						<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				)}
			</div>
			
			{/* Action buttons */}
			<div className="mt-2 pt-2 border-t border-white/10 flex justify-end space-x-2">
				<button className="px-2 py-1 text-xs text-gray-300 hover:text-gray-100 transition-colors">
					Copy
				</button>
				<button className="px-2 py-1 text-xs text-gray-300 hover:text-gray-100 transition-colors">
					Ask Follow-up
				</button>
			</div>
		</div>
	);
} 