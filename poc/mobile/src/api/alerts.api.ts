import { analyticsApi } from './clients';
import type { Alert, AlertSummary } from '@/types';

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
  const raw = Array.isArray(input)
    ? input
    : (input && typeof input === 'object' && Array.isArray((input as { items?: unknown[] }).items))
      ? (input as { items: unknown[] }).items
      : [];

  return raw.map((item) => {
    const alert = item as Partial<Alert>;
    return {
      ...alert,
      id: alert.id || '',
      title: alert.title || 'Alert',
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

  getAll: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      return await fetchAllAlertPages('/api/alerts', params);
    } catch {
      try {
        // Fallback for environments where only /pending exists.
        return await fetchAllAlertPages('/api/alerts/pending', { ...params, status: params?.status || 'all' });
      } catch {
        return [];
      }
    }
  },

  getSummary: async (windowHours = 24, ownerId?: string): Promise<AlertSummary | null> => {
    try {
      const response = await analyticsApi.get('/api/alerts/pending/summary', {
        params: { windowHours, ownerId },
      });
      return response.data;
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
