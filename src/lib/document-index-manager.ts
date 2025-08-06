import { DeepSeekLLM } from "@llamaindex/deepseek";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import {
  Document,
  LlamaParseReader,
  Settings,
  VectorStoreIndex,
} from "llamaindex";
import { join } from "path";
import { config } from "../config/environment";

class DocumentIndexManager {
  private static instance: DocumentIndexManager;
  private documentIndices: Map<string, VectorStoreIndex> = new Map();

  private constructor() {}

  static getInstance(): DocumentIndexManager {
    if (!DocumentIndexManager.instance) {
      DocumentIndexManager.instance = new DocumentIndexManager();
    }
    return DocumentIndexManager.instance;
  }

  private configureSettings(): void {
    Settings.llm = new DeepSeekLLM({
      apiKey: config.deepSeekApiKey,
      model: config.deepSeekModel,
    });

    try {
      // Use default HuggingFace embedding model
      Settings.embedModel = new HuggingFaceEmbedding() as any;
      console.log("HuggingFace embedding model initialized successfully");
    } catch (error) {
      console.error("Failed to initialize HuggingFace embedding:", error);
      throw new Error("Could not initialize embedding model. Please check your HuggingFace configuration.");
    }
  }

  // helper function to get parsed file paths
  private getParsedPaths(documentPath: string) {
    const fileName =
      documentPath
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "document";
    const parsedDir = join(process.cwd(), "documents", "parsed", fileName);
    return {
      documentsPath: join(parsedDir, "documents.json"),
      metadataPath: join(parsedDir, "metadata.json"),
      parsedDir,
    };
  }

  // helper function to check if parsed files exist and are newer than source
  private async shouldUseParsedFiles(documentPath: string): Promise<boolean> {
    try {
      const sourcePath = join(process.cwd(), documentPath);
      const { documentsPath, metadataPath } = this.getParsedPaths(documentPath);

      // check if parsed files exist
      const [sourceStats, documentsStats, metadataStats] = await Promise.all([
        stat(sourcePath),
        stat(documentsPath),
        stat(metadataPath),
      ]);

      // check if parsed files are newer than source
      return (
        documentsStats.mtime >= sourceStats.mtime &&
        metadataStats.mtime >= sourceStats.mtime
      );
    } catch (error) {
      // if any file doesn't exist or we can't stat it, we should parse
      return false;
    }
  }

  // helper function to load documents from parsed files
  private async loadParsedDocuments(documentPath: string): Promise<Document[]> {
    const { documentsPath } = this.getParsedPaths(documentPath);

    try {
      const documentsData = await readFile(documentsPath, "utf-8");
      const parsedDocuments = JSON.parse(documentsData);

      // convert to LlamaIndex Document format
      return parsedDocuments.map(
        (doc: any) =>
          new Document({
            id_: doc.id_,
            text: doc.text,
            metadata: doc.metadata || {},
          }),
      );
    } catch (error) {
      console.error("Error loading parsed documents:", error);
      throw new Error("Failed to load pre-parsed documents");
    }
  }

  // helper function to save parsed documents
  private async saveParsedDocuments(
    documentPath: string,
    documents: Document[],
  ): Promise<void> {
    try {
      const { parsedDir, documentsPath, metadataPath } =
        this.getParsedPaths(documentPath);

      // create directory if it doesn't exist
      await mkdir(parsedDir, { recursive: true });

      // prepare documents data
      const documentsData = documents.map((doc) => ({
        id_: doc.id_,
        text: doc.text,
        metadata: doc.metadata,
      }));

      // get source file stats for metadata
      const sourceStats = await stat(join(process.cwd(), documentPath));
      const metadata = {
        documentPath,
        originalFileSize: sourceStats.size,
        originalModifiedTime: sourceStats.mtime.toISOString(),
        cachedAt: new Date().toISOString(),
        documentsCount: documents.length,
        // Check if any documents have layout information
        hasLayoutData: documents.some(doc => {
          const meta = doc.metadata || {};
          return Object.keys(meta).some(key => 
            key.toLowerCase().includes('bbox') || 
            key.toLowerCase().includes('layout') || 
            key.toLowerCase().includes('coordinate') ||
            key.toLowerCase().includes('page') ||
            key.toLowerCase().includes('element')
          );
        }),
        layoutExtractionAttempted: true,
      };

      // save both files
      await Promise.all([
        writeFile(documentsPath, JSON.stringify(documentsData, null, 2)),
        writeFile(metadataPath, JSON.stringify(metadata, null, 2)),
      ]);

      console.log(`Saved parsed documents to ${parsedDir}`);
    } catch (error) {
      console.error("Error saving parsed documents:", error);
      // don't throw here as this is a optimization, not critical
    }
  }

  // helper function to parse document and save results
  private async parseAndSaveDocuments(
    documentPath: string,
  ): Promise<Document[]> {
    console.log(`Parsing document with layout extraction: ${documentPath}`);
    const filePath = join(process.cwd(), documentPath);

    try {
      // Method 1: Use loadJson() method to get structured data with layout information
      const parser = new LlamaParseReader({
        apiKey: config.llamaCloudApiKey,
        // loadJson automatically sets resultType to "json" and enables layout extraction
        // Optional: Add these parameters for better confidence score detection
        //ignore_document_elements_for_layout_detection: true,  // Force detector even for PDFs with text layer
        invalidateCache: true,  // Bust old cached jobs to get latest schema
        verbose: true,
      });

      console.log('Attempting to load JSON with layout data...');
      const jsonResults = await parser.loadJson(filePath);
      console.log(`Successfully got JSON results: ${jsonResults.length} objects`);
      
      // Process JSON results to extract documents with layout information
      const documents: Document[] = [];
      
      for (const result of jsonResults) {
        if (result.pages && Array.isArray(result.pages)) {
          console.log(`Processing ${result.pages.length} pages from JSON result`);
          
          for (const page of result.pages) {
            // Extract text content
            const text = page.text || page.md || '';
            if (text.trim()) {
              // Process layout items - use page.layout (current) instead of page.items (legacy)
              const processedLayoutItems = (page.layout || page.items || []).map((item: any) => ({
                ...item,
                // Preserve confidence from LlamaParse (null for digital PDFs, float for OCR/scanned)
                confidence: item.confidence,
                // Ensure we have element type from the 'label' or 'type' field  
                element_type: item.label || item.type || 'unknown',
              }));

              // Create document with layout metadata
              const doc = new Document({
                text: text,
                metadata: {
                  page_number: page.page || 0,
                  source_document: documentPath,
                  job_id: result.job_id,
                  file_path: result.file_path,
                  // Store layout items (using page.layout for current schema)
                  layout_items: processedLayoutItems,
                  // Store images if available
                  images: page.images || [],
                  // Store any bounding box information (check both layout and items for compatibility)
                  has_layout_data: !!(page.layout && page.layout.length > 0) || !!(page.items && page.items.length > 0),
                }
              });
              documents.push(doc);
            }
          }
        }
      }

      console.log(`Successfully processed ${documents.length} document chunks with potential layout data`);
      
      // Debug: Check if we have layout information
      const documentsWithLayout = documents.filter(doc => 
        doc.metadata?.layout_items && Array.isArray(doc.metadata.layout_items) && doc.metadata.layout_items.length > 0
      );
      
      if (documentsWithLayout.length > 0) {
        console.log(`Found ${documentsWithLayout.length} documents with layout items!`);
        
        // Show sample layout data (confidence will be null for digital PDFs, float for OCR)
        const sampleDoc = documentsWithLayout[0];
        const sampleItems = (sampleDoc.metadata?.layout_items as any[]).slice(0, 3);
        console.log('Sample layout items:', JSON.stringify(sampleItems, null, 2));
      } else {
        console.log('No documents found with layout items in metadata');
      }

      // save parsed documents for future use
      await this.saveParsedDocuments(documentPath, documents);
      return documents;

    } catch (jsonError) {
      console.warn('JSON layout extraction failed, falling back to text extraction:', jsonError);
      
      // Method 2: Fallback to standard text extraction
      const textParser = new LlamaParseReader({
        apiKey: config.llamaCloudApiKey,
        // Remove extract_layout for now to ensure basic functionality works
      });

      const documents = await textParser.loadData(filePath);
      console.log(`Successfully parsed ${documents.length} document chunks using fallback text extraction`);
      
      // save parsed documents for future use
      await this.saveParsedDocuments(documentPath, documents);
      return documents;
    }
  }

  // public method to prepare an index for a document
  async prepareIndex(documentPath: string): Promise<void> {
    this.configureSettings();

    // check if we already have an index for this document
    let documentIndex = this.documentIndices.get(documentPath);

    if (!documentIndex) {
      console.log(`Creating new index for document: ${documentPath}`);

      let documents: Document[];

      // check if we can use pre-parsed files
      if (await this.shouldUseParsedFiles(documentPath)) {
        console.log(`Loading pre-parsed documents for: ${documentPath}`);
        try {
          documents = await this.loadParsedDocuments(documentPath);
          console.log(
            `Successfully loaded ${documents.length} pre-parsed documents`,
          );
        } catch (error) {
          console.error(
            "Failed to load pre-parsed documents, falling back to parsing:",
            error,
          );
          documents = await this.parseAndSaveDocuments(documentPath);
        }
      } else {
        console.log(
          `No valid pre-parsed files found, parsing document: ${documentPath}`,
        );
        documents = await this.parseAndSaveDocuments(documentPath);
      }

      if (!documents || documents.length === 0) {
        throw new Error("No content could be extracted from the document");
      }

      // create vector index from documents
      documentIndex = await VectorStoreIndex.fromDocuments(documents);
      this.documentIndices.set(documentPath, documentIndex);

      console.log(`Successfully created index for ${documentPath}`);
    } else {
      console.log(`Index already exists for ${documentPath}`);
    }
  }

  // public method to get an index for a document
  async getIndex(documentPath: string): Promise<VectorStoreIndex | undefined> {
    let documentIndex = this.documentIndices.get(documentPath);

    if (!documentIndex) {
      console.log(
        `Index not found in memory for ${documentPath}. Attempting to rebuild from cache.`,
      );
      if (await this.shouldUseParsedFiles(documentPath)) {
        console.log(
          `Loading pre-parsed documents for rebuilding index: ${documentPath}`,
        );
        try {
          const documents = await this.loadParsedDocuments(documentPath);
          if (documents && documents.length > 0) {
            this.configureSettings();

            documentIndex = await VectorStoreIndex.fromDocuments(documents);
            this.documentIndices.set(documentPath, documentIndex);
            console.log(
              `Successfully rebuilt and cached index for ${documentPath} from parsed files.`,
            );
          } else {
            console.log(
              `No documents found in parsed files for ${documentPath}. Cannot rebuild index.`,
            );
          }
        } catch (error) {
          console.error(
            `Error rebuilding index from parsed files for ${documentPath}:`,
            error,
          );
        }
      } else {
        console.log(
          `No valid pre-parsed files found for ${documentPath}. Cannot rebuild index.`,
        );
      }
    }
    return documentIndex;
  }

  // public method to check if an index exists
  hasIndex(documentPath: string): boolean {
    return this.documentIndices.has(documentPath);
  }

  // Multi-document support methods

  // prepare indices for multiple documents
  async prepareMultipleIndices(documentPaths: string[]): Promise<void> {
    console.log(`Preparing indices for ${documentPaths.length} documents`);

    // prepare indices in parallel for better performance
    const preparePromises = documentPaths.map((documentPath) =>
      this.prepareIndex(documentPath),
    );

    await Promise.all(preparePromises);
    console.log(
      `Successfully prepared indices for all ${documentPaths.length} documents`,
    );
  }

  // get indices for multiple documents
  async getMultipleIndices(
    documentPaths: string[],
  ): Promise<Map<string, VectorStoreIndex>> {
    const indices = new Map<string, VectorStoreIndex>();

    for (const documentPath of documentPaths) {
      const index = await this.getIndex(documentPath);
      if (index) {
        indices.set(documentPath, index);
      }
    }

    return indices;
  }

  // get a combined index from multiple documents
  async getCombinedIndex(
    documentPaths: string[],
  ): Promise<VectorStoreIndex | undefined> {
    console.log(
      `Creating combined index from ${documentPaths.length} documents`,
    );

    // collect all documents from all indices by loading from parsed files
    const allDocuments: Document[] = [];

    for (const documentPath of documentPaths) {
      try {
        // Load documents directly from parsed files instead of trying to extract from index
        const documents = await this.loadParsedDocuments(documentPath);
        const documentsWithSource = documents.map(
          (doc) =>
            new Document({
              id_: doc.id_,
              text: doc.text,
              metadata: {
                ...doc.metadata,
                source_document: documentPath, // add source attribution
              },
            }),
        );
        allDocuments.push(...documentsWithSource);
        console.log(
          `Loaded ${documents.length} documents from ${documentPath}`,
        );
      } catch (error) {
        console.error(`Failed to load documents for ${documentPath}:`, error);
        // If we can't load from parsed files, we can't create a combined index
        continue;
      }
    }

    if (allDocuments.length === 0) {
      console.warn("No documents found for combined index");
      return undefined;
    }

    this.configureSettings();

    // create a new combined index
    const combinedIndex = await VectorStoreIndex.fromDocuments(allDocuments);
    console.log(
      `Successfully created combined index with ${allDocuments.length} documents`,
    );

    return combinedIndex;
  }

  // check if all indices exist for given document paths
  hasAllIndices(documentPaths: string[]): boolean {
    return documentPaths.every((path) => this.hasIndex(path));
  }

  // get all available indices
  getAllAvailableIndices(): Map<string, VectorStoreIndex> {
    return new Map(this.documentIndices);
  }

  // get all indexed document paths
  getIndexedDocumentPaths(): string[] {
    return Array.from(this.documentIndices.keys());
  }

  // clear specific indices (useful for memory management)
  clearIndices(documentPaths: string[]): void {
    documentPaths.forEach((path) => {
      if (this.documentIndices.has(path)) {
        this.documentIndices.delete(path);
        console.log(`Cleared index for ${path}`);
      }
    });
  }

  // clear all indices
  clearAllIndices(): void {
    this.documentIndices.clear();
    console.log("Cleared all indices");
  }
}

// export singleton instance
export const documentIndexManager = DocumentIndexManager.getInstance();
