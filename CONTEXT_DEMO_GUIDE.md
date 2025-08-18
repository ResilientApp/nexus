# Context Selection Feature - Working Demo Guide

## 🎯 Overview
The context selection feature is now **FULLY IMPLEMENTED** and working. This guide shows you exactly how to test it.

## ✅ Current Status
- **Frontend**: ✅ Context items sent with chat requests
- **Backend**: ✅ Enhanced query construction with context
- **API**: ✅ Context integration with DeepSeek API
- **Logging**: ✅ Comprehensive console output
- **PostgreSQL**: ✅ Running on port 5432

## 🚀 Step-by-Step Testing Instructions

### Step 1: Access the Application
- Navigate to: **http://localhost:3000/research**
- The application should load the research interface

### Step 2: Select Documents
1. Click "Browse Documents" or use the document selector
2. Select one or more PDF documents (e.g., rcc.pdf, resilientdb.pdf)
3. Wait for the documents to be prepared (you'll see status messages)

### Step 3: Enable Context Selection
1. Look for the "Context Selection" toggle in the right panel
2. Toggle it ON (it should turn blue/active)
3. The PDF viewer should now allow text selection

### Step 4: Add Context
1. **Select text** from the PDF viewer by highlighting any text
2. The selected text should automatically appear in the **"Context" tab**
3. You can add multiple text selections from different parts of the document
4. Each context item will show the source document name

### Step 5: Ask Questions with Context
1. Switch to the chat input area
2. Type a question about the documents
3. **Look for the blue indicator** that shows "X context items will be included"
4. Submit your question
5. **Watch the console logs** for detailed processing information

## 📊 Expected Console Output

### Frontend Console (Browser DevTools):
```
💬 Sending message without additional context
OR
📎 Including 2 context item(s) with user message:
   1. From "rcc.pdf": "ResilientDB provides a scalable blockchain fabric..."
   2. From "resilientdb.pdf": "The consensus protocol ensures..."

=== SENDING CHAT REQUEST ===
Original Query: How do these papers compare?
Selected Documents: ["rcc.pdf", "resilientdb.pdf"]
Context Items Being Sent:
  1. Source: rcc.pdf
     Text: ResilientDB provides a scalable blockchain fabric...
=== END CHAT REQUEST INFO ===
```

### Backend Console (Terminal):
```
Processing query: "How do these papers compare?" for documents: documents/rcc.pdf, documents/resilientdb.pdf

=== CONTEXT ITEMS PROVIDED ===
Context 1:
Source: rcc.pdf
Text: ResilientDB provides a scalable blockchain fabric that enables high-throughput transaction processing...
---
=== END CONTEXT ITEMS ===

=== FINAL ENHANCED QUERY ===
How do these papers compare?

Additional Context from Documents:
Context 1 (from rcc.pdf):
ResilientDB provides a scalable blockchain fabric that enables high-throughput transaction processing through its innovative consensus mechanism.
=== END ENHANCED QUERY ===

=== SENDING TO DEEPSEEK API ===
Query being sent: [full enhanced query with context]
Session ID: 1754467700123
=== END DEEPSEEK REQUEST ===

=== DEEPSEEK RESPONSE COMPLETE ===
Complete response length: 1543 characters
Response preview: Based on the provided context about ResilientDB...
=== END DEEPSEEK RESPONSE ===
```

## 🔍 What to Look For

### Visual Indicators:
- ✅ Blue "Context Selection" toggle
- ✅ Selected text appears in Context tab
- ✅ Blue banner above chat input when context is present
- ✅ Context item count displayed

### Console Logs:
- ✅ Frontend: Context items being sent details
- ✅ Backend: Enhanced query construction
- ✅ Backend: DeepSeek API interaction logs
- ✅ Response processing confirmation

### AI Response:
- ✅ AI acknowledges provided context
- ✅ Response incorporates both context and retrieved information
- ✅ More targeted and relevant answers

## 🛠 Technical Details

### How It Works:
1. **Text Selection**: User selects text from PDF viewer
2. **Context Storage**: Text stored with source document name
3. **Query Enhancement**: Context prepended to user question
4. **API Request**: Enhanced query sent to DeepSeek API
5. **AI Response**: DeepSeek processes query with additional context

### Key Features:
- **Non-Breaking**: Existing functionality unchanged
- **Optional**: Context inclusion is optional
- **Source Attribution**: Each context item tagged with document
- **Multiple Items**: Support for multiple context selections
- **Real-Time**: Live updating of context status

## 🎉 Success Criteria

The feature is working correctly when you see:
1. ✅ Text can be selected from PDF viewer
2. ✅ Selected text appears in Context tab
3. ✅ Console shows context being processed
4. ✅ Enhanced query visible in terminal logs
5. ✅ AI response acknowledges and uses the context

## 🔧 Troubleshooting

If you encounter issues:
1. **Check PostgreSQL**: Ensure PostgreSQL is running on port 5432
2. **Check Console**: Look for error messages in browser/terminal
3. **Refresh Page**: Try refreshing the research page
4. **Check Documents**: Ensure documents are selected and prepared

## 📍 Current Application Status

- **URL**: http://localhost:3000/research
- **Status**: ✅ **LIVE AND WORKING**
- **Database**: ✅ PostgreSQL running
- **Features**: ✅ All context functionality implemented

The context selection feature is now fully operational and ready for demonstration!
