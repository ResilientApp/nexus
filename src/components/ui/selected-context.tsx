import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { Trash2 } from 'lucide-react';

interface ContextItem {
  id: string;
  text: string;
  source?: string;
  timestamp?: number;
}

interface SelectedContextProps {
  contextItems: ContextItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  className?: string;
}

const SelectedContext: React.FC<SelectedContextProps> = ({
  contextItems,
  onRemove,
  onClear,
  className = '',
}) => {
  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">Selected Context</CardTitle>
          {contextItems.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClear}
              className="h-8 px-2 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-1 overflow-hidden">
        {contextItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No context selected yet. Enable text selection and highlight text in the document.
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {contextItems.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-muted/50 rounded-lg border border-border relative group"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <p className="text-sm">{item.text}</p>
                  {item.source && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Source: {item.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default SelectedContext;
