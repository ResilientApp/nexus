/**
 * PDF Coordinate Mapper
 * Maps extracted text chunks to their original PDF coordinates using layout data
 */

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutItem {
  type?: string;
  value?: string;
  md?: string;
  bBox?: BoundingBox;
  confidence?: number | null;
  element_type?: string;
  label?: string;
  lvl?: number; // for headings
}

export interface CoordinateMapping {
  nodeId: string;
  text: string;
  sourceDocument: string;
  pageNumber: number;
  layoutItems: LayoutItem[];
  // Aggregated bounding box covering all related layout items
  aggregatedBBox?: BoundingBox;
  // Individual layout items with their specific coordinates
  highlightRegions: {
    bbox: BoundingBox;
    elementType: string;
    confidence?: number | null;
    text: string;
  }[];
}

export class PDFCoordinateMapper {
  private static instance: PDFCoordinateMapper;

  private constructor() {}

  static getInstance(): PDFCoordinateMapper {
    if (!PDFCoordinateMapper.instance) {
      PDFCoordinateMapper.instance = new PDFCoordinateMapper();
    }
    return PDFCoordinateMapper.instance;
  }

  /**
   * Extract coordinate mappings from a document node
   */
  extractCoordinateMapping(node: any): CoordinateMapping | null {
    try {
      const metadata = node.metadata || {};
      const layoutItems = metadata.layout_items as LayoutItem[] || [];
      
      if (!layoutItems.length) {
        console.log('No layout items found for node:', node.id_);
        return null;
      }

      // Filter layout items that have bounding boxes
      const itemsWithBBox = layoutItems.filter(item => item.bBox);
      
      if (!itemsWithBBox.length) {
        console.log('No layout items with bounding boxes found for node:', node.id_);
        return null;
      }

      // Create highlight regions for each layout item
      const highlightRegions = itemsWithBBox.map(item => ({
        bbox: item.bBox!,
        elementType: item.element_type || item.label || item.type || 'text',
        confidence: item.confidence,
        text: item.value || item.md || '',
      }));

      // Calculate aggregated bounding box that encompasses all layout items
      const aggregatedBBox = this.calculateAggregatedBoundingBox(itemsWithBBox);

      const mapping: CoordinateMapping = {
        nodeId: node.id_ || node.node?.id_ || '',
        text: node.text || node.node?.text || '',
        sourceDocument: metadata.source_document || metadata.file_path || '',
        pageNumber: metadata.page_number || metadata.page || 0,
        layoutItems: layoutItems,
        aggregatedBBox: aggregatedBBox,
        highlightRegions: highlightRegions,
      };

      console.log(`Created coordinate mapping for node ${mapping.nodeId} with ${highlightRegions.length} highlight regions`);
      return mapping;

    } catch (error) {
      console.error('Error extracting coordinate mapping:', error);
      return null;
    }
  }

  /**
   * Calculate an aggregated bounding box that encompasses all layout items
   */
  private calculateAggregatedBoundingBox(items: LayoutItem[]): BoundingBox | undefined {
    const itemsWithBBox = items.filter(item => item.bBox);
    
    if (!itemsWithBBox.length) {
      return undefined;
    }

    // Find the bounding box that encompasses all items
    let minX = Math.min(...itemsWithBBox.map(item => item.bBox!.x));
    let minY = Math.min(...itemsWithBBox.map(item => item.bBox!.y));
    let maxX = Math.max(...itemsWithBBox.map(item => item.bBox!.x + item.bBox!.w));
    let maxY = Math.max(...itemsWithBBox.map(item => item.bBox!.y + item.bBox!.h));

    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
  }

  /**
   * Extract coordinate mappings from multiple retrieved nodes
   */
  extractCoordinateMappings(retrievedNodes: any[]): CoordinateMapping[] {
    const mappings: CoordinateMapping[] = [];
    
    for (const retrievedNode of retrievedNodes) {
      const node = retrievedNode.node || retrievedNode;
      const mapping = this.extractCoordinateMapping(node);
      
      if (mapping) {
        mappings.push(mapping);
      }
    }

    console.log(`Extracted ${mappings.length} coordinate mappings from ${retrievedNodes.length} retrieved nodes`);
    return mappings;
  }

  /**
   * Group coordinate mappings by document and page
   */
  groupMappingsByDocumentAndPage(mappings: CoordinateMapping[]): {
    [document: string]: {
      [page: number]: CoordinateMapping[]
    }
  } {
    const grouped: { [document: string]: { [page: number]: CoordinateMapping[] } } = {};

    for (const mapping of mappings) {
      const doc = mapping.sourceDocument;
      const page = mapping.pageNumber;

      if (!grouped[doc]) {
        grouped[doc] = {};
      }
      
      if (!grouped[doc][page]) {
        grouped[doc][page] = [];
      }

      grouped[doc][page].push(mapping);
    }

    return grouped;
  }

  /**
   * Find overlapping coordinate mappings within a tolerance
   */
  findOverlappingMappings(mappings: CoordinateMapping[], tolerance: number = 10): CoordinateMapping[][] {
    const groups: CoordinateMapping[][] = [];
    const processed = new Set<string>();

    for (const mapping of mappings) {
      if (processed.has(mapping.nodeId) || !mapping.aggregatedBBox) {
        continue;
      }

      const group = [mapping];
      processed.add(mapping.nodeId);

      // Find other mappings that overlap with this one
      for (const otherMapping of mappings) {
        if (processed.has(otherMapping.nodeId) || !otherMapping.aggregatedBBox) {
          continue;
        }

        if (
          mapping.sourceDocument === otherMapping.sourceDocument &&
          mapping.pageNumber === otherMapping.pageNumber &&
          this.boundingBoxesOverlap(mapping.aggregatedBBox, otherMapping.aggregatedBBox, tolerance)
        ) {
          group.push(otherMapping);
          processed.add(otherMapping.nodeId);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two bounding boxes overlap within a tolerance
   */
  private boundingBoxesOverlap(bbox1: BoundingBox, bbox2: BoundingBox, tolerance: number = 10): boolean {
    return !(
      bbox1.x + bbox1.w + tolerance < bbox2.x ||
      bbox2.x + bbox2.w + tolerance < bbox1.x ||
      bbox1.y + bbox1.h + tolerance < bbox2.y ||
      bbox2.y + bbox2.h + tolerance < bbox1.y
    );
  }

  /**
   * Create highlight data suitable for PDF viewer overlays
   */
  createHighlightData(mappings: CoordinateMapping[]): {
    [document: string]: {
      [page: number]: {
        nodeId: string;
        highlights: {
          bbox: BoundingBox;
          elementType: string;
          confidence?: number | null;
          text: string;
        }[];
        aggregatedBBox?: BoundingBox;
      }[]
    }
  } {
    const highlightData: any = {};

    for (const mapping of mappings) {
      const doc = mapping.sourceDocument;
      const page = mapping.pageNumber;

      if (!highlightData[doc]) {
        highlightData[doc] = {};
      }
      
      if (!highlightData[doc][page]) {
        highlightData[doc][page] = [];
      }

      highlightData[doc][page].push({
        nodeId: mapping.nodeId,
        highlights: mapping.highlightRegions,
        aggregatedBBox: mapping.aggregatedBBox,
      });
    }

    return highlightData;
  }
}

// Export singleton instance
export const pdfCoordinateMapper = PDFCoordinateMapper.getInstance();
