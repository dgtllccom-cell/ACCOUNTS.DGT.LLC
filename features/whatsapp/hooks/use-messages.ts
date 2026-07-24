"use client";

import { useState, useEffect, useCallback } from "react";
import type { WhatsAppMessage, ConversationDetail } from "../types";
import { fetchMessages, fetchConversationDetail, sendMessage } from "../api";
import type { SendMessagePayload } from "../types";

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchConversationDetail(id);
      setDetail(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string, page = 1) => {
    try {
      const result = await fetchMessages(id, page);
      if (page === 1) {
        setMessages(result.messages);
      } else {
        setMessages((prev) => [...result.messages, ...prev]);
      }
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setDetail(null);
      return;
    }
    loadDetail(conversationId);
    loadMessages(conversationId, 1);
  }, [conversationId, loadDetail, loadMessages]);

  const send = useCallback(async (payload: SendMessagePayload) => {
    if (!conversationId) return;
    setIsSending(true);
    setError(null);
    try {
      await sendMessage(conversationId, payload);
      // Reload messages after sending
      await loadMessages(conversationId, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [conversationId, loadMessages]);

  const loadMore = useCallback(() => {
    if (!conversationId || pagination.page >= pagination.pages) return;
    loadMessages(conversationId, pagination.page + 1);
  }, [conversationId, pagination, loadMessages]);

  const addOptimisticMessage = useCallback((msg: WhatsAppMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return { messages, detail, pagination, isLoading, isSending, error, send, loadMore, addOptimisticMessage, refresh: () => conversationId && loadMessages(conversationId, 1) };
}
