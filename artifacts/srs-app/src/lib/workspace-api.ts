import { authedFetch } from "@/lib/authed-fetch";

export type WorkspaceReference = {
  id: string;
  title: string;
  createdAt: string;
  textBlockCount: number;
  keywordCount: number;
};

export type ReferenceBlock = {
  id: string;
  content: string;
  positionIndex: number;
};

export type ReferenceOutlineKeyword = {
  id: string;
  word: string;
};

export type ReferenceOutlineNode = {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  children: ReferenceOutlineNode[];
  keywords: ReferenceOutlineKeyword[];
};

export type ReferenceOutlineResponse = {
  documentId: string;
  reference: {
    id: string;
    title: string;
  };
  toc: ReferenceOutlineNode[];
};

export type NotebookSummary = {
  id: string;
  title: string;
  blockCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteBlock = {
  id: string;
  pageId: string;
  userId: string;
  documentId: string;
  sourceTextBlockId: string | null;
  sourceReferenceId: string | null;
  content: string;
  blockType: "text" | "quote" | "heading";
  positionIndex: number;
  selectionOffset: number | null;
  selectionLength: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteBlockInput = {
  content: string;
  blockType?: "text" | "quote" | "heading";
  sourceTextBlockId?: string | null;
  sourceReferenceId?: string | null;
  selectionOffset?: number | null;
  selectionLength?: number | null;
  insertAtIndex?: number | null;
};

async function parseErrorMessage(response: Response) {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data.map((item) => item?.message).filter(Boolean).join("；") || raw;
    }
    return data?.message ?? data?.error ?? raw;
  } catch {
    return raw || "请求失败";
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await authedFetch(input, init);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

export function listReferences(documentId: string) {
  return requestJson<{ references: WorkspaceReference[] }>(`/api/documents/${documentId}/references`);
}

export function importReference(documentId: string, data: { title: string; text: string }) {
  return requestJson<{
    reference: {
      id: string;
      documentId: string;
      title: string;
      createdAt: string;
    };
    tocSource: string;
    toc: ReferenceOutlineNode[];
    keywords: Array<{ id: string; word: string }>;
  }>(`/api/documents/${documentId}/references`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteReference(referenceId: string) {
  return requestJson<{ ok: true }>(`/api/references/${referenceId}`, {
    method: "DELETE",
  });
}

export function getReferenceOutline(referenceId: string) {
  return requestJson<ReferenceOutlineResponse>(`/api/references/${referenceId}/outline`);
}

export function getReferenceBlocks(referenceId: string) {
  return requestJson<{ blocks: ReferenceBlock[] }>(`/api/references/${referenceId}/blocks`);
}

export function listNotebooks(documentId: string) {
  return requestJson<{ notebooks: NotebookSummary[] }>(`/api/documents/${documentId}/notebooks`);
}

export function createNotebook(documentId: string, data: { title: string }) {
  return requestJson<NotebookSummary>(`/api/documents/${documentId}/notebooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateNotebook(notebookId: string, data: { title: string }) {
  return requestJson<NotebookSummary>(`/api/notebooks/${notebookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function removeNotebook(notebookId: string) {
  return requestJson<{ ok: true }>(`/api/notebooks/${notebookId}`, {
    method: "DELETE",
  });
}

export function getNotebookBlocks(notebookId: string) {
  return requestJson<{ blocks: NoteBlock[] }>(`/api/notebooks/${notebookId}/blocks`);
}

export function createNoteBlock(notebookId: string, data: CreateNoteBlockInput) {
  return requestJson<NoteBlock>(`/api/notebooks/${notebookId}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateNoteBlock(blockId: string, data: { content?: string; blockType?: NoteBlock["blockType"] }) {
  return requestJson<NoteBlock>(`/api/notes/blocks/${blockId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function removeNoteBlock(blockId: string) {
  return requestJson<{ ok: true }>(`/api/notes/blocks/${blockId}`, {
    method: "DELETE",
  });
}

export function reorderNoteBlocks(notebookId: string, blockIdsInOrder: string[]) {
  return requestJson<{ ok: true }>(`/api/notebooks/${notebookId}/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockIdsInOrder }),
  });
}
