'use client';

import React, { useState } from 'react';
import { Button } from './button';
import { Loader } from './loader';
import { Textarea } from './textarea';

interface PDFViewerReactProps {
  url: string;
  isTextSelectionEnabled: boolean;
  onTextSelect?: (text: string, documentName?: string) => void;
  documentName?: string;
}

const PDFViewerReact: React.FC<PDFViewerReactProps> = ({
  url,
  isTextSelectionEnabled,
  onTextSelect,
  documentName
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [textInput, setTextInput] = useState('');

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
  };

  const handleAddText = () => {
    if (textInput && textInput.trim() && onTextSelect) {
      onTextSelect(textInput.trim(), documentName);
      setTextInput(''); // Clear input after adding
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-card p-3 border-b">
        {isTextSelectionEnabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Add Text to Context:</span>
              <span className="text-xs text-muted-foreground">
                Copy text from the PDF and paste it below
              </span>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste text from the PDF here..."
                className="flex-1 min-h-[60px] max-h-[140px] resize-none overflow-y-auto"
                rows={2}
              />
              <Button
                variant="outline"
                onClick={handleAddText}
                disabled={!textInput.trim()}
                title="Add text to context"
                className="flex items-center gap-1 px-3"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1">
                  <path d="M2.5 3C2.22386 3 2 3.22386 2 3.5C2 3.77614 2.22386 4 2.5 4H12.5C12.7761 4 13 3.77614 13 3.5C13 3.22386 12.7761 3 12.5 3H2.5ZM2.5 7C2.22386 7 2 7.22386 2 7.5C2 7.77614 2.22386 8 2.5 8H12.5C12.7761 8 13 7.77614 13 7.5C13 7.22386 12.7761 7 12.5 7H2.5ZM2 11.5C2 11.2239 2.22386 11 2.5 11H12.5C12.7761 11 13 11.2239 13 11.5C13 11.7761 12.7761 12 12.5 12H2.5C2.22386 12 2 11.7761 2 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
                Add Text
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* PDF Viewer */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-background/80">
            <Loader size="lg" />
            <p className="mt-3 text-sm text-muted-foreground">Loading PDF document...</p>
          </div>
        )}
        
        <iframe
          src={url}
          className="w-full h-full border-0"
          onLoad={handleLoad}
          onError={handleError}
          title="PDF Document"
          style={{ 
            minHeight: '600px',
            background: '#f5f5f5'
          }}
        />
      </div>
    </div>
  );
};

export default PDFViewerReact;
