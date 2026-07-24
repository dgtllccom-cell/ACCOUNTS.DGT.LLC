"use client";

import { useEffect, useRef } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type RealtimeOptions = {
  onNewMessage?: (conversationId: string) => void;
  onConversationUpdate?: (conversationId: string) => void;
  countryIds?: string[];
  cityBranchIds?: string[];
};

/**
 * Subscribes to Supabase Realtime on whatsapp_messages and whatsapp_conversations
 * tables so the inbox updates live without polling.
 */
export function useWhatsAppRealtime({
  onNewMessage,
  onConversationUpdate,
  countryIds = [],
  cityBranchIds = []
}: RealtimeOptions) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClientSupabaseClient>["channel"]> | null>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createClientSupabaseClient>;
    try {
      supabase = createClientSupabaseClient();
    } catch {
      // Supabase not configured — skip realtime
      return;
    }

    const channel = supabase
      .channel("whatsapp-inbox-realtime")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: cityBranchIds.length > 0
            ? `city_branch_id=in.(${cityBranchIds.join(",")})`
            : undefined
        },
        (payload: any) => {
          const conversationId = payload.new?.conversation_id;
          if (conversationId) onNewMessage?.(conversationId);
        }
      )
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_conversations",
          filter: cityBranchIds.length > 0
            ? `city_branch_id=in.(${cityBranchIds.join(",")})`
            : undefined
        },
        (payload: any) => {
          const conversationId = payload.new?.id;
          if (conversationId) onConversationUpdate?.(conversationId);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewMessage, onConversationUpdate, cityBranchIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
}
