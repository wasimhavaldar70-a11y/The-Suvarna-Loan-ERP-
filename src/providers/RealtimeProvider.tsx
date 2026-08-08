'use client';

// ========================================================
// SuvarnaLoan ERP - Centralized Multi-Device Supabase Realtime Provider
// Synchronizes Mobile ⇄ Computer, Tablet ⇄ Computer, Tablet ⇄ Mobile
// Location: src/providers/RealtimeProvider.tsx
// ========================================================

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { supabase, isRealSupabase, getSessionUser } from '../lib/supabase/client';
import { clearDbCache, setGlobalRealtimeChannel } from '../lib/supabase/supabaseDb';

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
    if (typeof window === 'undefined') return;

    const session = getSessionUser();
    const activeShopId = propShopId || session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) return;

    const triggerDebouncedRefresh = (targetTable: string, eventType: string, payload?: any) => {
      console.log(`[RealtimeProvider] ⚡ Realtime sync event on '${targetTable}' (${eventType}):`, payload);
      
      // Wipe targeted and dependent in-memory DB query caches
      clearDbCache(targetTable);

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        setLastUpdated(Date.now());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('suvarnaloan-realtime-update', { 
            detail: { table: targetTable, eventType, payload, timestamp: Date.now() } 
          }));
          window.dispatchEvent(new CustomEvent('suvarnaloan-db-update', { 
            detail: { table: targetTable, eventType, payload, timestamp: Date.now() } 
          }));
        }
      }, 50);
    };

    let channel: any = null;

    if (isRealSupabase && supabase) {
      // Deterministic shared channel name for this shop so all devices connect to the same room
      const channelName = `shop-realtime-${activeShopId}`;
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      });

      // Register shared Supabase Realtime channel in global database adapter for instant broadcasting
      setGlobalRealtimeChannel(channel);

      // 1. Listen for Supabase Realtime WebSocket broadcast events across all physical devices
      channel = channel.on('broadcast', { event: 'suvarnaloan_sync' }, (res: any) => {
        const table = res.payload?.table || 'payments';
        const eventType = res.payload?.eventType || 'BROADCAST_SYNC';
        triggerDebouncedRefresh(table, eventType, res.payload);
      });

      channel = channel.on('broadcast', { event: 'payment_recorded' }, (res: any) => {
        triggerDebouncedRefresh('payments', 'INSERT', res.payload);
        triggerDebouncedRefresh('loans', 'UPDATE', res.payload);
      });

      channel = channel.on('broadcast', { event: 'loan_updated' }, (res: any) => {
        triggerDebouncedRefresh('loans', 'UPDATE', res.payload);
      });

      // 2. Scoped Postgres change listeners for tenant tables
      const tables = [
        { name: 'loans', filter: `shop_id=eq.${activeShopId}` },
        { name: 'customers', filter: `shop_id=eq.${activeShopId}` },
        { name: 'gold_items', filter: `shop_id=eq.${activeShopId}` },
        { name: 'payments', filter: `shop_id=eq.${activeShopId}` },
        { name: 'loan_disbursements', filter: `shop_id=eq.${activeShopId}` },
        { name: 'shops', filter: `id=eq.${activeShopId}` },
      ];

      const events = ['INSERT', 'UPDATE', 'DELETE'] as const;
      tables.forEach((t) => {
        events.forEach((evt) => {
          channel = channel.on(
            'postgres_changes',
            { event: evt, schema: 'public', table: t.name, filter: t.filter },
            (payload: any) => {
              triggerDebouncedRefresh(t.name, evt, payload);
            }
          );
        });
      });

      // 3. Global fallback Postgres change listeners for payments, loans, and tranches
      ['payments', 'loans', 'loan_disbursements'].forEach((tableName) => {
        events.forEach((evt) => {
          channel = channel.on(
            'postgres_changes',
            { event: evt, schema: 'public', table: tableName },
            (payload: any) => {
              const rowShopId = (payload.new as any)?.shop_id || (payload.old as any)?.shop_id;
              if (!rowShopId || rowShopId === activeShopId || String(rowShopId).toLowerCase() === String(activeShopId).toLowerCase()) {
                triggerDebouncedRefresh(tableName, evt, payload);
              }
            }
          );
        });
      });

      channel.subscribe((status: string) => {
        console.log(`[RealtimeProvider] Realtime channel status for shop ${activeShopId}:`, status);
      });
    }

    // 4. Same-device cross-tab BroadcastChannel
    let tabChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        tabChannel = new BroadcastChannel('suvarnaloan-sync');
        tabChannel.onmessage = (event) => {
          if (event.data?.table) {
            triggerDebouncedRefresh(event.data.table, event.data?.eventType || 'TAB_UPDATE', event.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization warning:', err);
      }
    }

    // 5. Mobile & Tablet Focus / Visibility Change / Online Revalidation
    const handleRevalidate = () => {
      clearDbCache();
      triggerDebouncedRefresh('payments', 'FOCUS_REVALIDATE');
      triggerDebouncedRefresh('loans', 'FOCUS_REVALIDATE');
      triggerDebouncedRefresh('loan_disbursements', 'FOCUS_REVALIDATE');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleRevalidate);
      window.addEventListener('online', handleRevalidate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleRevalidate();
        }
      });
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (tabChannel) tabChannel.close();
      setGlobalRealtimeChannel(null);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleRevalidate);
        window.removeEventListener('online', handleRevalidate);
      }
      if (supabase && channel) {
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
