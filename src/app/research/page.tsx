"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceAttribution } from "@/components/ui/document-source-badge";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { MultiDocumentSelector } from "@/components/ui/multi-document-selector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import PDFViewerReact from "@/components/ui/pdf-viewer";
import SelectedContext from "@/components/ui/selected-context";
import ClientOnly from "@/components/ui/client-only";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
  MessageCircle,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Document {
  id: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  displayTitle?: string;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
  isLoadingPlaceholder?: boolean;
  sources?: {
    path: string;
    name: string;
    displayTitle?: string;
  }[];
}

// Filename to title mapping - you can extend this as needed
const getDisplayTitle = (filename: string): string => {
  const titleMappings: Record<string, string> = {
    "resilientdb.pdf": "ResilientDB: Global Scale Resilient Blockchain Fabric",
    "rcc.pdf":
      "Resilient Concurrent Consensus for High-Throughput Secure Transaction Processing",
  };

  const lowerFilename = filename.toLowerCase();
  return titleMappings[lowerFilename] || filename.replace(".pdf", "");
};

export default function ResearchChatPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isPreparingIndex, setIsPreparingIndex] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Add PDF text selection state and refs
  const [isTextSelectionEnabled, setIsTextSelectionEnabled] = useState(false);
  const [selectedContextItems, setSelectedContextItems] = useState<Array<{
    id: string;
    text: string;
    source?: string;
    timestamp: number;
  }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load available documents
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch("/api/research/documents");
        if (response.ok) {
          const docs = await response.json();
          // Add display titles to documents
          const docsWithTitles = docs.map((doc: Document) => ({
            ...doc,
            displayTitle: getDisplayTitle(doc.name),
          }));
          setDocuments(docsWithTitles);
        }
      } catch (error) {
        console.error("Failed to load documents:", error);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    loadDocuments();
  }, []);

  // Prepare index when document changes
  useEffect(() => {
    const prepareDocumentIndex = async () => {
      if (selectedDocuments.length > 0) {
        setIsPreparingIndex(true);

        const documentCount = selectedDocuments.length;
        const documentMessage =
          documentCount === 1
            ? `📄 **${selectedDocuments[0].displayTitle || selectedDocuments[0].name}** has been selected. Preparing document for questions...`
            : `📄 **${documentCount} documents** have been selected. Preparing documents for questions...`;

        setMessages([
          {
            id: Date.now().toString(),
            content: documentMessage,
            role: "assistant",
            timestamp: new Date().toISOString(),
          },
        ]);

        try {
          const response = await fetch("/api/research/prepare-index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentPaths: selectedDocuments.map((doc) => doc.path),
            }),
          });

          if (response.ok) {
            const readyMessage =
              documentCount === 1
                ? `✅ **${selectedDocuments[0].displayTitle || selectedDocuments[0].name}** is ready! You can now ask questions about this document.`
                : `✅ **${documentCount} documents** are ready! You can now ask questions about these documents.`;

            setMessages([
              {
                id: Date.now().toString(),
                content: readyMessage,
                role: "assistant",
                timestamp: new Date().toISOString(),
              },
            ]);
          } else {
            const error = await response.json();
            setMessages([
              {
                id: Date.now().toString(),
                content: `❌ Failed to prepare documents: ${error.error || "Unknown error"}`,
                role: "assistant",
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } catch (error) {
          console.error("Error preparing document:", error);
          setMessages([
            {
              id: Date.now().toString(),
              content: `❌ Error preparing documents. Please try again.`,
              role: "assistant",
              timestamp: new Date().toISOString(),
            },
          ]);
        } finally {
          setIsPreparingIndex(false);
        }
      }
    };

    prepareDocumentIndex();
  }, [selectedDocuments]);

  const handleSendMessage = async () => {
    if (
      !inputValue.trim() ||
      selectedDocuments.length === 0 ||
      isLoading ||
      isPreparingIndex
    )
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

    // Create a placeholder for the assistant's response
    const assistantPlaceholderMessage: Message = {
      id: (Date.now() + 1).toString(), // Ensure unique ID
      content: "",
      role: "assistant",
      timestamp: new Date().toISOString(),
      isLoadingPlaceholder: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholderMessage]);
    const currentQuery = inputValue; // Store inputValue before clearing
    setInputValue("");
    setIsLoading(true);

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
          query: currentQuery, // Use stored query
          documentPaths: selectedDocuments.map((doc) => doc.path),
          contextItems: selectedContextItems.length > 0 ? selectedContextItems : undefined,
        }),
      });

      if (!response.ok) {
        // If the response is not OK, update the placeholder to show an error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderMessage.id
              ? {
                  ...msg,
                  content:
                    "Sorry, I couldn't get a response. Please try again.",
                  isLoadingPlaceholder: false,
                }
              : msg,
          ),
        );
        throw new Error(`Failed to send message. Status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // If no reader, update placeholder to show an error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderMessage.id
              ? {
                  ...msg,
                  content:
                    "Sorry, there was an issue with the response stream.",
                  isLoadingPlaceholder: false,
                }
              : msg,
          ),
        );
        throw new Error("No response reader available");
      }

      // Remove the isLoading flag from the placeholder once we start receiving data
      // and prepare to fill its content.
      // We find it by ID and update it.
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantPlaceholderMessage.id
            ? { ...msg, isLoadingPlaceholder: false, content: "" } // Clear content, remove placeholder flag
            : msg,
        ),
      );

      const decoder = new TextDecoder();
      let buffer = "";
      let sourceInfo: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Check if we have source information at the beginning
        if (buffer.includes("__SOURCE_INFO__") && !sourceInfo) {
          const sourceInfoMatch = buffer.match(
            /__SOURCE_INFO__({[\s\S]*?})\n\n/,
          );
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
    } catch (error) {
      console.error("Chat error:", error);
      // If an error occurred and it wasn't handled by updating the placeholder already,
      // ensure the placeholder is removed or updated to an error message.
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderMessage.id && msg.isLoadingPlaceholder
            ? {
                ...msg,
                content: "Sorry, an error occurred. Please try again.",
                isLoadingPlaceholder: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDocumentKeyDown = useCallback(
    (e: React.KeyboardEvent, doc: Document) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDocumentSelect(doc);
      }
    },
    [],
  );

  const handleDocumentSelect = useCallback((doc: Document) => {
    setSelectedDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id);
      if (index === -1) {
        return [...prev, doc];
      }
      return prev; // Don't add duplicates
    });
    setIsMobileSheetOpen(false); // Close mobile sheet when document is selected
  }, []);

  const handleDocumentDeselect = useCallback((doc: Document) => {
    setSelectedDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDocuments(documents);
  }, [documents]);

  const handleDeselectAll = useCallback(() => {
    setSelectedDocuments([]);
  }, []);

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
        (contextTab as HTMLElement).click();
      }
    }
  }, []);
  
  // Handle removing a context item
  const handleRemoveContextItem = useCallback((id: string) => {
    setSelectedContextItems(prev => prev.filter(item => item.id !== id));
  }, []);
  
  // Handle clearing all context items
  const handleClearContextItems = useCallback(() => {
    setSelectedContextItems([]);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Mobile Sheet for Document Selection */}
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden fixed top-4 left-4 z-50"
              aria-label="Open document library"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-80 p-0"
            aria-describedby="mobile-sheet-description"
          >
            <SheetHeader className="border-b">
              <SheetTitle>Research Library</SheetTitle>
              <p
                id="mobile-sheet-description"
                className="text-sm text-muted-foreground sr-only"
              >
                Select a document to start chatting with AI about its contents
              </p>
            </SheetHeader>
            <div className="p-4">
              <MultiDocumentSelector
                documents={documents}
                selectedDocuments={selectedDocuments}
                isLoadingDocuments={isLoadingDocuments}
                onDocumentSelect={handleDocumentSelect}
                onDocumentDeselect={handleDocumentDeselect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onDocumentKeyDown={handleDocumentKeyDown}
                showSearch={true}
                showSelectAll={true}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar: Document Selection */}
        <Card
          className={`hidden md:flex transition-all duration-300 border-r bg-card/20 backdrop-blur-sm rounded-none ${
            isSidebarCollapsed ? "w-16" : "w-72 max-w-72"
          }`}
        >
          <div className="flex flex-col w-full">
            <CardHeader className="border-b flex flex-row items-center justify-between space-y-0 mt-[0.45rem]">
              {!isSidebarCollapsed && (
                <CardTitle className="text-lg">Research Library</CardTitle>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 h-8 w-8 hover:bg-accent/50"
                aria-label={
                  isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>

            {!isSidebarCollapsed && (
              <CardContent className="p-3 flex-1 overflow-hidden">
                <MultiDocumentSelector
                  documents={documents}
                  selectedDocuments={selectedDocuments}
                  isLoadingDocuments={isLoadingDocuments}
                  onDocumentSelect={handleDocumentSelect}
                  onDocumentDeselect={handleDocumentDeselect}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onDocumentKeyDown={handleDocumentKeyDown}
                  showSearch={true}
                  showSelectAll={true}
                />
              </CardContent>
            )}

            {isSidebarCollapsed && selectedDocuments.length > 0 && (
              <CardContent className="p-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-10 h-10 p-0 rounded-full"
                  onClick={() => setIsSidebarCollapsed(false)}
                  aria-label={`Expand sidebar to see ${selectedDocuments.length} selected documents`}
                  title={`${selectedDocuments.length} documents selected`}
                >
                  <span className="text-sm font-semibold">
                    {selectedDocuments.length > 0
                      ? selectedDocuments.length.toString()
                      : "0"}
                  </span>
                </Button>
              </CardContent>
            )}
          </div>
        </Card>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Chat Interface */}
          <Card
            className="flex-1 flex flex-col rounded-none border-0 gap-0 min-h-0 bg-card/60 backdrop-blur-sm"
            role="main"
            aria-label="Chat interface"
          >
            {selectedDocuments.length === 0 ? (
              <CardContent className="flex-1 flex items-center justify-center p-4">
                <Card className="text-center max-w-md">
                  <CardContent className="pt-6">
                    <MessageCircle
                      className="h-16 w-16 mx-auto mb-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <CardTitle className="text-xl mb-2">
                      Select Documents
                    </CardTitle>
                    <CardDescription className="mb-4">
                      Choose documents from the library to start chatting.
                    </CardDescription>
                    <Button
                      variant="outline"
                      onClick={() => setIsMobileSheetOpen(true)}
                      className="md:hidden"
                      aria-label="Browse documents to select for chatting"
                    >
                      <Menu className="h-4 w-4 mr-2" aria-hidden="true" />
                      Browse Documents
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            ) : (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        Chat with{" "}
                        {selectedDocuments.length === 1
                          ? selectedDocuments[0].displayTitle ||
                            selectedDocuments[0].name
                          : `${selectedDocuments.length} Documents`}
                      </CardTitle>
                      <CardDescription>
                        Ask questions about{" "}
                        {selectedDocuments.length === 1
                          ? "this document"
                          : "these documents"}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMobileSheetOpen(true)}
                      className="md:hidden ml-2"
                      aria-label="Change document"
                    >
                      <Menu className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea
                    className="h-full p-4"
                    role="log"
                    aria-label="Chat messages"
                    aria-live="polite"
                  >
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          role="article"
                          aria-label={`${message.role === "user" ? "Your message" : "AI response"}`}
                        >
                          <Card
                            variant="message"
                            className={`max-w-[85%] md:max-w-[80%] transition-all duration-200 ease-out ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card"
                            }`}
                          >
                            <CardContent variant="message">
                              {message.role === "user" ? (
                                <p className="text-sm leading-relaxed">
                                  {message.content}
                                </p>
                              ) : message.isLoadingPlaceholder ? (
                                <div
                                  className="flex items-center justify-center py-2"
                                  aria-label="AI is thinking"
                                >
                                  <Loader size="md" variant="loading-dots" />
                                </div>
                              ) : (
                                <div className="text-sm">
                                  <MarkdownRenderer content={message.content} />
                                  {message.sources &&
                                    message.sources.length > 0 && (
                                      <SourceAttribution
                                        sources={message.sources}
                                        className="mt-2 pt-2 border-t border-border/20"
                                        showLabel={true}
                                        clickable={false}
                                      />
                                    )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Input */}
                <CardContent
                  className="border-t p-4 flex-shrink-0"
                  role="form"
                  aria-label="Send message"
                >
                  {/* Context indicator */}
                  {/* Displays the context selected above chat text box */}
                  {selectedContextItems.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <span className="font-medium">Context enabled:</span>
                        <span>{selectedContextItems.length} item{selectedContextItems.length !== 1 ? 's' : ''} will be included with your question</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="message-input" className="sr-only">
                        Type your message about the document
                      </Label>
                      <Textarea
                        id="message-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          isPreparingIndex
                            ? "Preparing documents..."
                            : selectedDocuments.length === 0
                              ? "Select documents to start chatting..."
                              : selectedDocuments.length === 1
                                ? `Ask questions about ${selectedDocuments[0].displayTitle || selectedDocuments[0].name}...`
                                : `Ask questions about ${selectedDocuments.length} documents...`
                        }
                        className="resize-none"
                        rows={2}
                        disabled={
                          isLoading ||
                          isPreparingIndex ||
                          selectedDocuments.length === 0
                        }
                        aria-describedby="message-input-help"
                      />
                      <p id="message-input-help" className="sr-only">
                        Press Enter to send your message, or Shift+Enter for a
                        new line
                      </p>
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={
                        !inputValue.trim() ||
                        isLoading ||
                        isPreparingIndex ||
                        selectedDocuments.length === 0
                      }
                      className="px-4"
                      size="lg"
                      aria-label="Send message"
                    >
                      {isLoading || isPreparingIndex ? (
                        <Loader size="sm" aria-label="Sending..." />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          <Separator orientation="vertical" className="hidden md:block" />

          {/* Content Area: PDF Preview and Selected Context */}
          <div className="w-full md:w-2/5 hidden md:flex flex-col bg-card/40 backdrop-blur-sm rounded-none border-0 min-h-0">
            {selectedDocuments.length > 0 ? (
              <div className="h-full flex flex-col">
                <CardHeader className="border-b flex-shrink-0 px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg truncate">
                          PDF Viewer
                        </CardTitle>
                        {/* <CardDescription className="text-xs mt-1">
                          {selectedDocuments.length === 1
                            ? `Viewing: ${selectedDocuments[0].displayTitle || selectedDocuments[0].name}`
                            : `${selectedDocuments.length} documents selected`}
                        </CardDescription> */}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <span className="mr-2 text-xs font-medium">Context Selection</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isTextSelectionEnabled}
                              onChange={() => setIsTextSelectionEnabled((v) => !v)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all dark-blue-toggle"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <div className="flex-1 flex flex-col min-h-0">
                  <Tabs
                    defaultValue="document"
                    className="h-full flex flex-col"
                  >
                    <div className="px-4 pt-2">
                      <TabsList className="w-full">
                        <TabsTrigger value="document" className="flex-1">Document</TabsTrigger>
                        <TabsTrigger value="context" className="flex-1">Context</TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="flex-1 min-h-0 p-0">
                      <TabsContent
                        value="document"
                        className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
                      >
                        <Tabs
                          defaultValue={selectedDocuments[0]?.id}
                          className="h-full flex flex-col"
                        >
                          <div className="px-4 pt-2 pb-0">
                            <TabsList className="w-full justify-start overflow-x-auto">
                              {selectedDocuments.map((doc) => (
                                <TabsTrigger
                                  key={doc.id}
                                  value={doc.id}
                                  className="flex items-center gap-2 text-xs max-w-[150px] relative group"
                                  title={doc.displayTitle || doc.name}
                                >
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {doc.displayTitle || doc.name}
                                  </span>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                          </div>
                          <div className="flex-1 min-h-0">
                            {selectedDocuments.map((doc) => (
                              <TabsContent
                                key={doc.id}
                                value={doc.id}
                                className="h-full m-0 p-0 data-[state=active]:flex data-[state=inactive]:hidden"
                              >
                                <div className="h-full w-full">
                                  <ClientOnly fallback={
                                    <div className="flex items-center justify-center h-full">
                                      <Loader size="lg" />
                                      <p className="ml-2">Loading PDF viewer...</p>
                                    </div>
                                  }>
                                    <PDFViewerReact
                                      url={`/api/research/files/${doc.path}`}
                                      isTextSelectionEnabled={isTextSelectionEnabled}
                                      onTextSelect={handleAddSelectedText}
                                      documentName={doc.displayTitle || doc.name}
                                    />
                                  </ClientOnly>
                                </div>
                              </TabsContent>
                            ))}
                          </div>
                        </Tabs>
                      </TabsContent>
                      <TabsContent
                        value="context"
                        className="h-full m-0 p-4 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
                      >
                        <SelectedContext 
                          contextItems={selectedContextItems}
                          onRemove={handleRemoveContextItem}
                          onClear={handleClearContextItems}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </div>
            ) : (
              <CardContent className="h-full flex items-center justify-center">
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <FileText
                      className="h-16 w-16 mx-auto mb-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <CardDescription>
                      Select a document to view
                    </CardDescription>
                  </CardContent>
                </Card>
              </CardContent>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
