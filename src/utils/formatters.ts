/**
 * Admin Formatters & Utilities
 */

export function formatReason(reason?: string): string {
  if (!reason) return 'General';
  return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

export function formatTimeAgo(timestamp?: number | string | null): string {
  if (!timestamp) return 'Just now';
  const timeNum = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const normalized = timeNum < 1e12 ? timeNum * 1000 : timeNum;
  const diff = Math.floor((Date.now() - normalized) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
