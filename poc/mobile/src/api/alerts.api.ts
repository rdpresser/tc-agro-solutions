import { analyticsApi } from './clients';
import type { Alert, AlertSummary } from '@/types';

function formatAlertType(alertType?: string): string {
  if (!alertType) return '';
  // "LowSoilMoisture" → "Low Soil Moisture"
  return alertType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function normalizeSeverity(severity?: string): Alert['severity'] {
  const value = (severity || '').toLowerCase();
  if (value === 'warning') return 'medium';
  if (value === 'info') return 'low';
  return (value || 'low') as Alert['severity'];
}

function normalizeStatus(status?: string): Alert['status'] {
  const value = (status || '').toLowerCase();
  if (value === 'acknowledged') return 'Acknowledged';
  if (value === 'resolved') return 'Resolved';
  return 'Pending';
}

function normalizeAlerts(input: unknown): Alert[] {
  let raw: unknown[] = [];
  if (Array.isArray(input)) {
    raw = input;
  } else if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    // API may wrap the array in "data", "items", or "results"
    const arr = obj.data ?? obj.items ?? obj.results;
    if (Array.isArray(arr)) {
      raw = arr;
    }
  }

  return raw.map((item) => {
    const alert = item as Partial<Alert> & { alertType?: string };
    return {
      ...alert,
      id: alert.id || '',
      title: alert.title || formatAlertType(alert.alertType) || 'Alert',
      message: alert.message || '',
      severity: normalizeSeverity(alert.severity),
      status: normalizeStatus(alert.status),
      createdAt: alert.createdAt || new Date().toISOString(),
    } as Alert;
  });
}

function extractPagePayload(input: unknown): { items: Alert[]; hasNextPage: boolean } {
  const source = (input && typeof input === 'object') ? input as { hasNextPage?: boolean } : {};
  return {
    items: normalizeAlerts(input),
    hasNextPage: Boolean(source.hasNextPage),
  };
}

async function fetchAllAlertPages(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<Alert[]> {
  const all: Alert[] = [];
  let pageNumber = 1;
  let keepLoading = true;
  const maxPages = 20;

  while (keepLoading && pageNumber <= maxPages) {
    const response = await analyticsApi.get(endpoint, {
      params: { pageNumber, pageSize: 100, ...params },
    });
    const page = extractPagePayload(response.data);
    all.push(...page.items);
    keepLoading = page.hasNextPage && page.items.length > 0;
    pageNumber += 1;
    if (!page.hasNextPage && page.items.length < 100) {
      break;
    }
  }

  const deduped = new Map<string, Alert>();
  all.forEach((alert) => deduped.set(alert.id, alert));
  return Array.from(deduped.values());
}

export const alertsApi = {
  getPending: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      return await fetchAllAlertPages('/api/alerts/pending', params);
    } catch {
      return [];
    }
  },

  getResolved: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      return await fetchAllAlertPages('/api/alerts/pending', {
        ...params,
        status: 'resolved',
      });
    } catch {
      return [];
    }
  },

  getAll: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      return await fetchAllAlertPages('/api/alerts/pending', {
        ...params,
        status: params?.status || 'all',
      });
    } catch {
      return [];
    }
  },

  getSummary: async (windowHours = 24, ownerId?: string): Promise<AlertSummary | null> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending/summary', {
        params: { windowHours, ownerId },
      });
      const data = response.data;
      // Handle both camelCase and PascalCase
      return {
        pendingAlertsTotal: Number(data?.pendingAlertsTotal ?? data?.PendingAlertsTotal ?? 0),
        affectedPlotsCount: Number(data?.affectedPlotsCount ?? data?.AffectedPlotsCount ?? 0),
        affectedSensorsCount: Number(data?.affectedSensorsCount ?? data?.AffectedSensorsCount ?? 0),
        criticalPendingCount: Number(data?.criticalPendingCount ?? data?.CriticalPendingCount ?? 0),
        highPendingCount: Number(data?.highPendingCount ?? data?.HighPendingCount ?? 0),
        mediumPendingCount: Number(data?.mediumPendingCount ?? data?.MediumPendingCount ?? 0),
        lowPendingCount: Number(data?.lowPendingCount ?? data?.LowPendingCount ?? 0),
        newPendingInWindowCount: Number(data?.newPendingInWindowCount ?? data?.NewPendingInWindowCount ?? 0),
        windowHours: Number(data?.windowHours ?? data?.WindowHours ?? windowHours),
      };
    } catch {
      return null;
    }
  },

  resolve: async (id: string, notes?: string): Promise<void> => {
    await analyticsApi.put(`/api/alerts/${id}/resolve`, {
      resolutionNotes: notes || undefined,
    });
  },
};
