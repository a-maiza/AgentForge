'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useMonitoringStore, type MetricsSummary } from '@/stores/monitoring.store';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface MetricsUpdatePayload {
  workspaceId: string;
  metrics: MetricsSummary;
  timestamp: string;
}

export function useMonitoringSocket(workspaceId: string | undefined): void {
  const socketRef = useRef<Socket | null>(null);
  const { setSummary, setConnected } = useMonitoringStore();

  useEffect(() => {
    if (!workspaceId) return;

    const socket = io(`${API_URL}/monitoring`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_workspace', { workspaceId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('metrics_update', (payload: MetricsUpdatePayload) => {
      if (payload.metrics) {
        setSummary(payload.metrics);
      }
    });

    return () => {
      socket.emit('leave_workspace', { workspaceId });
      socket.disconnect();
      setConnected(false);
    };
  }, [workspaceId, setSummary, setConnected]);
}
