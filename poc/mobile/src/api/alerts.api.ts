import { analyticsApi } from './clients';
import type { Alert, AlertSummary, PaginatedResponse } from '@/types';

function formatAlertType(alertType?: string): string {
  if (!alertType) return '';
  // "LowSoilMoisture" → "Low Soil Moisture"
  return alertType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function normalizeSeverity(severity?: string): Alert['severity'] {
  const value = (severity || '').toLowerCase();
  if (value === 'critical') return 'critical';
  if (value === 'high' || value === 'medium' || value === 'warning') return 'warning';
  if (value === 'low' || value === 'info') return 'info';
  return 'info';
}

function normalizeStatus(status?: string): Alert['status'] {
  const value = (status || '').toLowerCase();
  if (value === 'acknowledged') return 'Acknowledged';
  if (value === 'resolved') return 'Resolved';
  return 'Pending';
}

function normalizeStatusParam(status?: string): string | undefined {
  const value = (status || '').trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'pending') return 'Pending';
  if (value === 'acknowledged') return 'Acknowledged';
  if (value === 'resolved') return 'Resolved';
  if (value === 'all') return 'all';
  return status;
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

function getPaginatedValue(input: unknown, camelKey: string, pascalKey: string, fallback: number): number {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const value = Number(obj[camelKey] ?? obj[pascalKey] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function getPaginatedBool(input: unknown, camelKey: string, pascalKey: string): boolean {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  return Boolean(obj[camelKey] ?? obj[pascalKey]);
}

async function getAlertsPage(params?: {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  severity?: string;
  search?: string;
  ownerId?: string;
}): Promise<PaginatedResponse<Alert>> {
  const pageNumber = params?.pageNumber || 1;
  const pageSize = params?.pageSize || 10;
  const normalizedStatus = normalizeStatusParam(params?.status);

  const response = await analyticsApi.get('/api/alerts/pending', {
    params: {
      pageNumber,
      pageSize,
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(params?.severity ? { severity: params.severity } : {}),
      ...(params?.search ? { search: params.search } : {}),
      ...(params?.ownerId ? { ownerId: params.ownerId } : {}),
    },
  });

  const data = response.data;
  const items = normalizeAlerts(data);
  const totalCount = getPaginatedValue(data, 'totalCount', 'TotalCount', items.length);
  const currentPageNumber = getPaginatedValue(data, 'pageNumber', 'PageNumber', pageNumber);
  const currentPageSize = getPaginatedValue(data, 'pageSize', 'PageSize', pageSize);
  const hasNextPage = getPaginatedBool(data, 'hasNextPage', 'HasNextPage');
  const hasPreviousPage = getPaginatedBool(data, 'hasPreviousPage', 'HasPreviousPage') || currentPageNumber > 1;

  return {
    items,
    totalCount,
    pageNumber: currentPageNumber,
    pageSize: currentPageSize,
    hasNextPage,
    hasPreviousPage,
  };
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
  getPendingPage: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<PaginatedResponse<Alert>> => {
    try {
      return await getAlertsPage({ ...params, status: 'Pending' });
    } catch {
      return {
        items: [],
        totalCount: 0,
        pageNumber: params?.pageNumber || 1,
        pageSize: params?.pageSize || 10,
        hasNextPage: false,
        hasPreviousPage: (params?.pageNumber || 1) > 1,
      };
    }
  },

  getResolvedPage: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<PaginatedResponse<Alert>> => {
    try {
      return await getAlertsPage({ ...params, status: 'Resolved' });
    } catch {
      return {
        items: [],
        totalCount: 0,
        pageNumber: params?.pageNumber || 1,
        pageSize: params?.pageSize || 10,
        hasNextPage: false,
        hasPreviousPage: (params?.pageNumber || 1) > 1,
      };
    }
  },

  getAllPage: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<PaginatedResponse<Alert>> => {
    try {
      return await getAlertsPage({ ...params, status: params?.status || 'all' });
    } catch {
      return {
        items: [],
        totalCount: 0,
        pageNumber: params?.pageNumber || 1,
        pageSize: params?.pageSize || 10,
        hasNextPage: false,
        hasPreviousPage: (params?.pageNumber || 1) > 1,
      };
    }
  },

  getPending: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    severity?: string;
    search?: string;
    ownerId?: string;
  }): Promise<Alert[]> => {
    try {
      const page = await getAlertsPage({ ...params, status: 'Pending', pageSize: 100 });
      return page.items;
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
      const page = await getAlertsPage({
        ...params,
        status: 'resolved',
        pageSize: 100,
      });
      return page.items;
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
      const page = await getAlertsPage({
        ...params,
        status: params?.status || 'all',
        pageSize: 100,
      });
      return page.items;
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
