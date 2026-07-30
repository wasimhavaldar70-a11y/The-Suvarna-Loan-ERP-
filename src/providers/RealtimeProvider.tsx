'use client';

// ========================================================
// SuvarnaLoan ERP - Centralized Supabase Realtime Provider
// Location: src/providers/RealtimeProvider.tsx
// ========================================================

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { supabase, isRealSupabase, getSessionUser } from '../lib/supabase/client';
import { clearDbCache } from '../lib/supabase/supabaseDb';

interface RealtimeContextType {
  lastUpdated: number;
}

const RealtimeContext = createContext<RealtimeContextType>({ lastUpdated: Date.now() });

export const useRealtime = () => useContext(RealtimeContext);

interface RealtimeProviderProps {
  children: React.ReactNode;
  shopId?: string;
}

export function RealtimeProvider({ children, shopId: propShopId }: RealtimeProviderProps) {
  const [lastUpdated, setLastUpdated] = React.useState<number>(Date.now());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !isRealSupabase || !supabase) return;

    const session = getSessionUser();
    const activeShopId = propShopId || session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) return;

    const triggerDebouncedRefresh = (targetTable: string, eventType: string, payload: any) => {
      console.log(`[RealtimeProvider] 🔥 ${eventType} event on '${targetTable}':`, payload);
      
      // ⚡ Wipe in-memory DB query cache so every component refetches fresh cloud data from Supabase
      clearDbCache();

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        setLastUpdated(Date.now());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('suvarnaloan-realtime-update', { detail: { table: targetTable, eventType } }));
        }
      }, 150);
    };

    const tables = [
      { name: 'loans', filter: `shop_id=eq.${activeShopId}` },
      { name: 'customers', filter: `shop_id=eq.${activeShopId}` },
      { name: 'gold_items', filter: `shop_id=eq.${activeShopId}` },
      { name: 'payments', filter: `shop_id=eq.${activeShopId}` },
      { name: 'shops', filter: `id=eq.${activeShopId}` },
    ];

    const events = ['INSERT', 'UPDATE', 'DELETE'] as const;

    const channelName = `central-realtime-${activeShopId}-${Math.floor(Math.random() * 10000)}`;
    let channel = supabase.channel(channelName);

    tables.forEach((t) => {
      events.forEach((evt) => {
        channel = channel.on(
          'postgres_changes',
          { event: evt, schema: 'public', table: t.name, filter: t.filter },
          (payload) => {
            triggerDebouncedRefresh(t.name, evt, payload);
          }
        );
      });
    });

    channel.subscribe((status) => {
      console.log(`[RealtimeProvider] Subscription status for shop ${activeShopId}:`, status);
    });

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [propShopId]);

  return (
    <RealtimeContext.Provider value={{ lastUpdated }}>
      {children}
    </RealtimeContext.Provider>
  );
}
