import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, type ErrorType, type BodyType } from "./custom-fetch";

export interface DeckSummary {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  totalCards: number;
  dueCards: number;
}

export interface ListDecksResponse {
  decks: DeckSummary[];
}

export const listDecks = async (
  options?: RequestInit,
): Promise<ListDecksResponse> => {
  return customFetch<ListDecksResponse>("/api/decks", {
    ...options,
    method: "GET",
  });
};

export function useListDecks<
  TData = ListDecksResponse,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Parameters<typeof useQuery<TData, TError>>[0];
  request?: RequestInit;
}) {
  const { query, request } = options ?? {};

  const queryResult = useQuery<TData, TError>({
    queryKey: query?.queryKey ?? ["/api/decks"],
    queryFn: async ({ signal }) =>
      listDecks({ signal, ...(request ?? {}) }) as unknown as TData,
    ...(query ?? {}),
  });

  return queryResult;
}

export interface CreateDeckRequest {
  name: string;
  description?: string;
}

export type CreateDeckResponse = DeckSummary;

export const createDeck = async (
  body: CreateDeckRequest,
  options?: RequestInit,
): Promise<CreateDeckResponse> => {
  return customFetch<CreateDeckResponse>("/api/decks", {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
};

export function useCreateDeck<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: Parameters<
    typeof useMutation<CreateDeckResponse, TError, { data: BodyType<CreateDeckRequest> }, TContext>
  >[0];
  request?: RequestInit;
}) {
  const queryClient = useQueryClient();
  const { mutation, request } = options ?? {};

  return useMutation<CreateDeckResponse, TError, { data: BodyType<CreateDeckRequest> }, TContext>({
    mutationKey: mutation?.mutationKey ?? ["createDeck"],
    mutationFn: async ({ data }) => createDeck(data, request),
    onSuccess: (data, variables, context) => {
      // 列表失效，方便刷新
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      if (mutation?.onSuccess) {
        mutation.onSuccess(data, variables, context);
      }
    },
    ...mutation,
  });
}

export interface AssignDeckItem {
  id: number;
  deckId: number | null;
}

export interface BatchAssignDeckRequest {
  assignments: AssignDeckItem[];
}

export interface BatchAssignDeckResponse {
  updated: number;
}

export const assignCardsToDeck = async (
  body: BatchAssignDeckRequest,
  options?: RequestInit,
): Promise<BatchAssignDeckResponse> => {
  return customFetch<BatchAssignDeckResponse>("/api/cards/batch-assign-deck", {
    ...options,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
};

export function useAssignCardsToDeck<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: Parameters<
    typeof useMutation<BatchAssignDeckResponse, TError, { data: BodyType<BatchAssignDeckRequest> }, TContext>
  >[0];
  request?: RequestInit;
}) {
  const { mutation, request } = options ?? {};

  return useMutation<
    BatchAssignDeckResponse,
    TError,
    { data: BodyType<BatchAssignDeckRequest> },
    TContext
  >({
    mutationKey: mutation?.mutationKey ?? ["assignCardsToDeck"],
    mutationFn: async ({ data }) => assignCardsToDeck(data, request),
    ...mutation,
  });
}

