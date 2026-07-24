"use client";

import { useState, useEffect, useCallback } from "react";
import type { WhatsAppConversation, ConversationFilters } from "../types";
import { fetchConversations } from "../api";

export function useConversations(initialFilters: ConversationFilters = {}) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [filters, setFilters] = useState<ConversationFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: ConversationFilters = filters) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchConversations(f);
      setConversations(result.conversations);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = useCallback((newFilters: Partial<ConversationFilters>) => {
    const updated = { ...filters, ...newFilters, page: 1 };
    setFilters(updated);
    load(updated);
  }, [filters, load]);

  const goToPage = useCallback((page: number) => {
    const updated = { ...filters, page };
    setFilters(updated);
    load(updated);
  }, [filters, load]);

  const refresh = useCallback(() => load(filters), [filters, load]);

  return { conversations, pagination, filters, isLoading, error, applyFilters, goToPage, refresh, setConversations };
}
