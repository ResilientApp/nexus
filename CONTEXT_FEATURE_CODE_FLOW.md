# Context Selection Feature - Code Flow Analysis

## Overview
This document provides a comprehensive code-level analysis of how the context selection feature works, showing the exact data flow from user interaction to AI response.

## 🔄 Complete Data Flow

### Step 1: Context Selection Setup
**File**: `src/app/research/page.tsx` (Lines 82-88)

```typescript
// Context selection state initialization
const [isTextSelectionEnabled, setIsTextSelectionEnabled] = useState(false);
const [selectedContextItems, setSelectedContextItems] = useState<Array<{
  id: string;
  text: string;
  source?: string;
  timestamp: number;
}>>([]);
```

**What happens**: Component initializes state to track selected context items with proper TypeScript interface.

---

### Step 2: Text Selection Handler
**File**: `src/app/research/page.tsx` (Lines 365-387)

```typescript
// Handle adding selected text from PDF viewer
const handleAddSelectedText = useCallback((text: string, documentName?: string) => {
  if (text && text.trim()) {
    const newContextItem = {
      id: `ctx-${Date.now()}`,
      text: text.trim(),
      source: documentName || "Unknown Document",
      timestamp: Date.now()
    };
    setSelectedContextItems(prev => [...prev, newContextItem]);
    
    // Switch to the context tab to show the user their selection was added
    const contextTab = document.querySelector('[data-state="inactive"][value="context"]');
    if (contextTab) {
      contextTab.click();
    }
  }
}, []);
```

**What happens**: 
- User selects text in PDF viewer
- Text is wrapped in context item object with unique ID, source document, and timestamp
- Context item added to state array
- UI automatically switches to Context tab to show user the addition

---

### Step 3: Context Display Component
**File**: `src/components/ui/selected-context.tsx` (Lines 1-67)

```typescript
interface ContextItem {
  id: string;
  text: string;
  source?: string;
  timestamp?: number;
}

const SelectedContext: React.FC<SelectedContextProps> = ({
  contextItems,
  onRemove,
  onClear,
  className = '',
}) => {
  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* Display logic for context items */}
      {contextItems.map((item) => (
        <div key={item.id} className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm">{item.text}</p>
          {item.source && (
            <div className="mt-2 text-xs text-muted-foreground">
              Source: {item.source}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
};
```

**What happens**: 
- Context items are displayed in the UI
- Each item shows the selected text and source document
- Users can remove individual items or clear all

---

### Step 4: Chat Message Preparation
**File**: `src/app/research/page.tsx` (Lines 203-225)

```typescript
const handleSendMessage = async () => {
  // Validation checks
  if (!inputValue.trim() || selectedDocuments.length === 0 || isLoading || isPreparingIndex) 
    return;

  const userMessage: Message = {
    id: Date.now().toString(),
    content: inputValue,
    role: "user",
    timestamp: new Date().toISOString(),
  };

  // Log the context being included
  if (selectedContextItems.length > 0) {
    console.log(`\n📎 Including ${selectedContextItems.length} context item(s) with user message:`);
    selectedContextItems.forEach((item, index) => {
      console.log(`   ${index + 1}. From "${item.source}": "${item.text.substring(0, 80)}${item.text.length > 80 ? '...' : ''}"`);
    });
  } else {
    console.log('\n💬 Sending message without additional context');
  }
```

**What happens**:
- User clicks send button
- System validates input and documents
- Logs context information to browser console for debugging
- Prepares user message object

---

### Step 5: API Request Construction
**File**: `src/app/research/page.tsx` (Lines 236-253)

```typescript
try {
  console.log('=== SENDING CHAT REQUEST ===');
  console.log('Original Query:', currentQuery);
  console.log('Selected Documents:', selectedDocuments.map(doc => doc.name));
  
  if (selectedContextItems.length > 0) {
    console.log('Context Items Being Sent:');
    selectedContextItems.forEach((item, index) => {
      console.log(`  ${index + 1}. Source: ${item.source}`);
      console.log(`     Text: ${item.text.substring(0, 100)}${item.text.length > 100 ? '...' : ''}`);
    });
  } else {
    console.log('No context items selected');
  }
  console.log('=== END CHAT REQUEST INFO ===');

  const response = await fetch("/api/research/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: currentQuery,
      documentPaths: selectedDocuments.map((doc) => doc.path),
      contextItems: selectedContextItems.length > 0 ? selectedContextItems : undefined,
    }),
  });
```

**What happens**:
- Comprehensive logging of request details to browser console
- API request constructed with query, document paths, and context items
- Context items only included if they exist (optional field)

---

### Step 6: API Route Handler
**File**: `src/app/api/research/chat/route.ts` (Lines 6-18)

```typescript
interface RequestData {
  query: string;
  documentPath?: string;
  documentPaths?: string[];
  tool?: string;
  language?: string;
  scope?: string[];
  sessionId?: string;
  contextItems?: Array<{
    id: string;
    text: string;
    source?: string;
    timestamp?: number;
  }>;
}
```

**What happens**: TypeScript interface defines the expected request structure including optional context items.

---

### Step 7: Context Processing in API
**File**: `src/app/api/research/chat/route.ts` (Lines 120-150)

```typescript
console.log(`Processing query: "${requestData.query}" for documents: ${documentPaths.join(", ")}`);

// Log context items if provided
if (requestData.contextItems && requestData.contextItems.length > 0) {
  console.log(`\n=== CONTEXT ITEMS PROVIDED ===`);
  requestData.contextItems.forEach((item, index) => {
    console.log(`Context ${index + 1}:`);
    console.log(`Source: ${item.source || 'Unknown'}`);
    console.log(`Text: ${item.text.substring(0, 200)}${item.text.length > 200 ? '...' : ''}`);
    console.log('---');
  });
  console.log(`=== END CONTEXT ITEMS ===\n`);
}

// Build the enhanced query with context
let enhancedQuery = requestData.query;
if (requestData.contextItems && requestData.contextItems.length > 0) {
  const contextString = requestData.contextItems
    .map((item, index) => 
      `Context ${index + 1} (from ${item.source || 'Unknown Document'}):\n${item.text}`
    )
    .join('\n\n');
  
  enhancedQuery = `${requestData.query}\n\nAdditional Context from Documents:\n${contextString}`;
  
  console.log(`\n=== FINAL ENHANCED QUERY ===`);
  console.log(enhancedQuery);
  console.log(`=== END ENHANCED QUERY ===\n`);
}
```

**What happens**:
- Server receives context items from client
- Logs each context item with source and text preview
- Constructs enhanced query by appending context to original user question
- Each context item is numbered and attributed to source document

---

### Step 8: Session Memory Integration
**File**: `src/app/api/research/chat/route.ts` (Lines 152-155)

```typescript
const sessionId = requestData.sessionId || Date.now().toString();
const memory = sessionManager.getSessionMemory(sessionId);

await memory.add({ role: "user", content: enhancedQuery });
```

**What happens**: Enhanced query (with context) is stored in session memory for chat history continuity.

---

### Step 9: LlamaIndex Chat Engine Creation
**File**: `src/lib/llama-service.ts` (Lines 226-256)

```typescript
async createChatEngine(
  documents: string[],
  ctx: ChatMessage[]
): Promise<ContextChatEngine> {
  const index = await VectorStoreIndex.fromVectorStore(this.getVectorStore());

  const retriever = index.asRetriever({
    similarityTopK: 5,
    filters: {
      filters: [
        {
          key: "source_document",
          operator: "in",
          value: documents,
        },
      ],
    },
  });
  
  const chatEngine = new ContextChatEngine({
    retriever,
    chatHistory: ctx || [],
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
  });
  return chatEngine;
}
```

**What happens**: Chat engine created with enhanced system prompt that knows how to handle additional context.

---

### Step 10: System Prompt Enhancement
**File**: `src/lib/llama-service.ts` (Lines 25-41)

```typescript
const RESEARCH_SYSTEM_PROMPT = `
You are Nexus, an AI research assistant specialized in Apache ResilientDB...
- When users provide additional context from documents in their questions, use this context along with the retrieved information to provide comprehensive answers.
- Always acknowledge when additional context has been provided and reference it in your response where relevant.
\n\n
Citation Instructions: 
    - When referencing information from documents, use the format [^id] where id is the 1-based index of the source node
    - Only include the citation markers. Do not include any other citation explanations in your response
    - When consecutive statements reference the same source document AND page, only include the citation marker once at the end of that section
    - Always include citations for each distinct source, even if from the same document but different pages
`;
```

**What happens**: System prompt instructs AI to acknowledge and use provided context in responses.

---

### Step 11: DeepSeek API Communication
**File**: `src/app/api/research/chat/route.ts` (Lines 42-75)

```typescript
const handleStreamingResponse = async (
  chatEngine: any,
  query: string,
  sessionId: string,
): Promise<ReadableStream> => {
  return new ReadableStream({
    async start(controller) {
      try {
        console.log(`\n=== SENDING TO DEEPSEEK API ===`);
        console.log(`Query being sent: ${query}`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`=== END DEEPSEEK REQUEST ===\n`);

        const stream = await chatEngine.chat({
          message: query,
          stream: true,
        });

        let completeResponse = "";
        for await (const chunk of stream) {
          const content = chunk.response || chunk.delta || "";
          if (content) {
            controller.enqueue(content);
            completeResponse += content;
          }
        }
        
        console.log(`\n=== DEEPSEEK RESPONSE COMPLETE ===`);
        console.log(`Complete response length: ${completeResponse.length} characters`);
        console.log(`Response preview: ${completeResponse.substring(0, 200)}${completeResponse.length > 200 ? '...' : ''}`);
        console.log(`=== END DEEPSEEK RESPONSE ===\n`);
```

**What happens**:
- Enhanced query (with context) sent to DeepSeek API
- Response streamed back to client
- Comprehensive logging of API interaction

---

### Step 12: Response Processing
**File**: `src/app/research/page.tsx` (Lines 290-330)

```typescript
const decoder = new TextDecoder();
let buffer = "";
let sourceInfo: any = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // Check if we have source information
  if (buffer.includes("__SOURCE_INFO__") && !sourceInfo) {
    const sourceInfoMatch = buffer.match(/__SOURCE_INFO__({[\s\S]*?})\n\n/);
    if (sourceInfoMatch) {
      try {
        sourceInfo = JSON.parse(sourceInfoMatch[1]);
        buffer = buffer.replace(/__SOURCE_INFO__[\s\S]*?\n\n/, "");
      } catch (error) {
        console.error("Failed to parse source info:", error);
      }
    }
  }

  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantPlaceholderMessage.id
        ? {
            ...msg,
            content: buffer,
            isLoadingPlaceholder: false,
            sources: sourceInfo?.sources || [],
          }
        : msg,
    ),
  );
}
```

**What happens**: 
- Streaming response processed and displayed in real-time
- Source information extracted and displayed
- UI updated with AI response that incorporates the provided context

---

## 🔍 Key Code Components Summary

### Frontend (`src/app/research/page.tsx`):
- **Lines 82-88**: Context state initialization
- **Lines 365-387**: Text selection handler
- **Lines 203-225**: Message preparation with context logging
- **Lines 236-253**: API request construction with context
- **Lines 290-330**: Response processing

### Backend API (`src/app/api/research/chat/route.ts`):
- **Lines 6-18**: Request interface with context support
- **Lines 120-150**: Context processing and query enhancement
- **Lines 42-75**: DeepSeek API communication with logging

### LlamaIndex Service (`src/lib/llama-service.ts`):
- **Lines 25-41**: Enhanced system prompt
- **Lines 226-256**: Chat engine creation

### UI Component (`src/components/ui/selected-context.tsx`):
- **Lines 1-67**: Context display and management

## 📊 Data Flow Summary

```
User Text Selection → Context State → Chat Request → API Route → Query Enhancement → 
DeepSeek API → AI Response → UI Display
```

Each step includes comprehensive logging for debugging and transparency, allowing developers to see exactly how user-selected context flows through the system and enhances the AI's responses.
