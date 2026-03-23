import { create } from 'zustand';

export interface MetricsSummary {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  failoverCalls: number;
  windowStart: string;
}

export interface ChartDataPoint {
  timestamp: number; // unix ms
  totalCalls: number;
  successCalls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
}

const RING_BUFFER_SIZE = 60;

interface MonitoringStore {
  summary: MetricsSummary | null;
  chartData: ChartDataPoint[];
  isConnected: boolean;
  lastUpdated: number | null;

  setSummary: (summary: MetricsSummary) => void;
  addDataPoint: (point: ChartDataPoint) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useMonitoringStore = create<MonitoringStore>((set) => ({
  summary: null,
  chartData: [],
  isConnected: false,
  lastUpdated: null,

  setSummary: (summary) =>
    set((state) => {
      const point: ChartDataPoint = {
        timestamp: Date.now(),
        totalCalls: summary.totalCalls,
        successCalls: summary.successCalls,
        successRate: summary.successRate,
        avgLatencyMs: summary.avgLatencyMs,
        totalTokens: summary.totalTokens,
        totalCostUsd: summary.totalCostUsd,
      };
      const chartData = [...state.chartData, point].slice(-RING_BUFFER_SIZE);
      return { summary, chartData, lastUpdated: Date.now() };
    }),

  addDataPoint: (point) =>
    set((state) => ({
      chartData: [...state.chartData, point].slice(-RING_BUFFER_SIZE),
      lastUpdated: Date.now(),
    })),

  setConnected: (isConnected) => set({ isConnected }),

  reset: () => set({ summary: null, chartData: [], isConnected: false, lastUpdated: null }),
}));
