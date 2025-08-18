# Context Selection Feature Testing Guide

## Overview
The context selection feature has been implemented to allow users to select text from documents and include it as additional context when asking questions to the AI chatbot. This provides more targeted and relevant responses by giving the AI specific text snippets from the documents.

## How It Works

### 1. Context Selection Process
1. **Enable Text Selection**: Toggle the "Context Selection" switch in the right panel
2. **Select Text**: Highlight any text in the PDF viewer
3. **Add to Context**: The selected text automatically gets added to the "Context" tab
4. **Ask Questions**: When you submit a question, all context items are included with your query

### 2. Technical Implementation

#### Frontend Changes
- **Context Items State**: `selectedContextItems` array stores context with id, text, source, and timestamp
- **Context Indicator**: Blue banner appears above input when context items are present
- **Enhanced Request**: Context items are sent along with the query to the API

#### Backend Changes
- **Enhanced Query Building**: Context items are prepended to the user's query
- **Logging**: Comprehensive logging shows:
  - Context items being processed
  - Enhanced query construction
  - Final prompt sent to DeepSeek API
  - Response details

### 3. Testing Steps

#### Step 1: Setup
1. Navigate to `/research` page
2. Select one or more documents from the library
3. Wait for documents to be prepared

#### Step 2: Add Context
1. Enable "Context Selection" toggle
2. Select text from the PDF viewer 
3. Verify text appears in the "Context" tab
4. Add multiple text selections if desired

#### Step 3: Ask Questions
1. Type a question in the input box
2. Notice the blue context indicator showing "X items will be included"
3. Submit the question
4. Observe console logs for detailed processing information

#### Step 4: Verify Response
1. Check that the AI acknowledges the provided context
2. Verify the response incorporates information from both the context and retrieved documents
3. Review console logs to see the enhanced query that was sent

### 4. Console Logging

The implementation includes comprehensive logging to display:

```
=== SENDING CHAT REQUEST ===
Original Query: [user's question]
Selected Documents: [document names]
Context Items Being Sent:
  1. Source: [document name]
     Text: [first 100 chars of context...]
=== END CHAT REQUEST INFO ===

=== CONTEXT ITEMS PROVIDED ===
Context 1:
Source: [document name]
Text: [first 200 chars...]
---
=== END CONTEXT ITEMS ===

=== FINAL ENHANCED QUERY ===
[user question]

Additional Context from Documents:
Context 1 (from [document name]):
[full context text]
=== END ENHANCED QUERY ===

=== SENDING TO DEEPSEEK API ===
Query being sent: [enhanced query]
Session ID: [session id]
=== END DEEPSEEK REQUEST ===

=== DEEPSEEK RESPONSE COMPLETE ===
Complete response length: [X] characters
Response preview: [first 200 chars...]
=== END DEEPSEEK RESPONSE ===
```

### 5. Expected Behavior

- **Without Context**: Normal document-based Q&A
- **With Context**: AI acknowledges provided context and incorporates it into responses
- **Multiple Context Items**: All context items are included and numbered
- **Source Attribution**: Context includes source document names
- **Visual Feedback**: Blue indicator shows when context will be included

### 6. Key Features

1. **Context Preservation**: Context items persist until manually removed
2. **Source Tracking**: Each context item includes the source document name
3. **Visual Indicators**: Clear UI feedback for context status
4. **Enhanced Prompts**: Context is prepended to queries without modifying existing system prompts
5. **Comprehensive Logging**: Full transparency of prompt construction and API communication

This implementation ensures that the AI receives additional context while maintaining the existing prompt structure and functionality.
