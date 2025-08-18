import { llamaService } from "@/lib/llama-service";
import { sessionManager } from "@/lib/session-manager";
import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../../config/environment";

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

const validateRequest = (data: RequestData): string | null => {
  const { query, documentPath, documentPaths } = data;

  if (!query) {
    return "Query is required";
  }

  if (!documentPath && !documentPaths) {
    return "Either documentPath or documentPaths is required";
  }

  if (
    documentPaths &&
    (!Array.isArray(documentPaths) || documentPaths.length === 0)
  ) {
    return "documentPaths must be a non-empty array";
  }

  if (!config.deepSeekApiKey) {
    return "DeepSeek API key is required";
  }

  return null;
};

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
        let lastChunk;
        const sourceMetadata: any[] = [];

        for await (const chunk of stream) {
          lastChunk = chunk;
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
        
        const memory = sessionManager.getSessionMemory(sessionId);
        await memory.add({ role: "assistant", content: completeResponse });
        
        const messages = await memory.get();
        console.log('Updated memory:', messages);
        
        if (lastChunk?.sourceNodes) {
          for (const sourceNode of lastChunk.sourceNodes) {
            sourceMetadata.push(sourceNode.node.metadata);
          }
        }
        controller.enqueue(
          `__SOURCE_INFO__${JSON.stringify(sourceMetadata)}\n\n`,
        );
        
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        controller.error(error);
      }
    },
  });
};

const getErrorMessage = (error: any): string => {
  if (!(error instanceof Error)) {
    return "Failed to process your question";
  }

  if (error.message.includes("401") || error.message.includes("unauthorized")) {
    return "Invalid API key. Please check your DeepSeek API key.";
  }

  if (error.message.includes("402") || error.message.includes("payment")) {
    return "Insufficient credits. Please check your DeepSeek account balance.";
  }

  return "Failed to process your question";
};

export async function POST(req: NextRequest) {
  try {
    const requestData: RequestData = await req.json();

    const validationError = validateRequest(requestData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    try {
      const documentPaths = requestData.documentPaths || [
        requestData.documentPath!,
      ];

      console.log(
        `Processing query: "${requestData.query}" for documents: ${documentPaths.join(", ")}`,
      );
      
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
      
      const sessionId = requestData.sessionId || Date.now().toString();
      const memory = sessionManager.getSessionMemory(sessionId);
      
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
      
      await memory.add({ role: "user", content: enhancedQuery });
      
      const chatHistory = await memory.get();

      const chatEngine = await llamaService.createChatEngine(documentPaths, chatHistory);

      const stream = await handleStreamingResponse(
        chatEngine,
        enhancedQuery,
        sessionId,
      );

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    } catch (processingError) {
      console.error("Error processing chat:", processingError);

      const errorMessage = getErrorMessage(processingError);
      return NextResponse.json(
        {
          error: errorMessage,
          details:
            processingError instanceof Error
              ? processingError.message
              : String(processingError),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}