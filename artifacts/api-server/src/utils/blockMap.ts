import type { Paragraph } from "./physicalChunking";

export interface BlockMap {
  totalBlocks: number;
  blocks: Paragraph[];
  /**
   * index -> paragraph
   */
  getByIndex(index: number): Paragraph | undefined;
  /**
   * paragraph -> index
   */
  getIndexByParagraph(p: Paragraph): number | undefined;
}

export function buildBlockMap(blocks: Paragraph[]): BlockMap {
  const indexByParagraph = new Map<Paragraph, number>();
  const paragraphsByIndex = [...blocks];

  paragraphsByIndex.forEach((p, index) => {
    indexByParagraph.set(p, index);
  });

  return {
    totalBlocks: paragraphsByIndex.length,
    blocks: paragraphsByIndex,
    getByIndex(index) {
      if (index < 0 || index >= paragraphsByIndex.length) return undefined;
      return paragraphsByIndex[index];
    },
    getIndexByParagraph(p) {
      return indexByParagraph.get(p);
    },
  };
}

