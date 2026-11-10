/**
 * Dashboard Service - Data Fetchers & View Renderers
 */

import { AdminState, AdminElements, AdminTab, AbuseReport } from '../types';
import { API_URL } from '../config';
import { authHeaders } from './auth';
import { formatReason, formatDate, formatTimeAgo } from '../utils/formatters';

export function setMetric(id: string, val: string | number): void {
  const elMetric = document.getElementById(id);
  if (elMetric) elMetric.textContent = String(val);
}

// Tab 1: Overview
export async function fetchOverview(state: AdminState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/admin/overview`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const m = data.overview || data;

    setMetric('m-active-sessions', m.activeSessions ?? 0);
    setMetric('m-active-matches', m.activeMatches ?? 0);
    setMetric('m-waiting-queue', m.waitingQueue ?? 0);
    setMetric('m-pending-reports', m.pendingReports ?? 0);
    setMetric('m-under-review', m.underReviewReports ?? 0);
    setMetric('m-resolved-reports', m.resolvedReports ?? 0);
    setMetric('m-active-bans', m.activeBans ?? 0);
    setMetric('m-error-rate', `${m.errorRatePercent ?? 0}%`);
    setMetric('m-total-requests', (m.totalApiRequests ?? 0).toLocaleString());

    const maintBadge = document.getElementById('m-maintenance-badge');
    if (maintBadge) {
      maintBadge.textContent = m.maintenanceMode ? 'ACTIVE' : 'NORMAL';
      maintBadge.className = m.maintenanceMode ? 'badge badge-danger' : 'badge badge-success';
    }
  } catch (err) {
    console.warn('Overview fetch error:', err);
  }
}

// Tab 2: Users
export async function fetchUsers(state: AdminState): Promise<void> {
  const tableBody = document.getElementById('users-table-body');
  if (!tableBody) return;

  try {
    const query = new URLSearchParams();
    if (state.usersSearch) query.append('search', state.usersSearch);
    if (state.usersFilter !== 'all') query.append('status', state.usersFilter);

    const res = await fetch(`${API_URL}/admin/users?${query.toString()}`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const users = data.users || [];

    if (users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No active or matching users found.</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map((u: any) => {
      const isBanned = u.isBanned;
      const isRestricted = u.isRestricted;
      let statusBadge = '<span class="badge badge-success">Active</span>';
      if (isBanned) statusBadge = '<span class="badge badge-danger">Banned</span>';
      else if (isRestricted) statusBadge = '<span class="badge badge-warning">Restricted</span>';

      return `
        <tr>
          <td><code>${u.maskedSessionUuid || u.sessionUuid}</code></td>
          <td>${statusBadge}</td>
          <td><code>${u.maskedIpAddress || 'Hidden'}</code></td>
          <td>${u.activeMatchId ? `<code>${u.activeMatchId.substring(0, 8)}...</code>` : '<span class="text-muted">Idle</span>'}</td>
          <td>${u.reportsCount > 0 ? `<span class="badge badge-warning">${u.reportsCount}</span>` : '0'}</td>
          <td>${formatTimeAgo(u.lastSeenAt)}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn ${isRestricted ? 'action-btn-success' : 'action-btn-warning'}" onclick="window.omagleeAdmin.toggleRestrict('${u.sessionUuid}', ${!isRestricted})">
                ${isRestricted ? 'Unrestrict' : 'Restrict'}
              </button>
              ${!isBanned ? `
                <button class="action-btn action-btn-danger" onclick="window.omagleeAdmin.openBanModalForUser('${u.sessionUuid}')">
                  Ban
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Users fetch error:', err);
  }
}

// Tab 3: Reports
export async function fetchReports(state: AdminState): Promise<void> {
  const tableBody = document.getElementById('reports-table-body');
  if (!tableBody) return;

  try {
    const query = state.reportsFilter !== 'all' ? `?status=${state.reportsFilter}` : '';
    const res = await fetch(`${API_URL}/admin/reports${query}`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const reports: AbuseReport[] = data.reports || [];

    if (reports.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No reports matching current filter.</td></tr>';
      return;
    }

    tableBody.innerHTML = reports.map((r: AbuseReport) => {
      const statusColors: Record<string, string> = {
        'pending': 'badge-warning',
        'under_review': 'badge-info',
        'resolved': 'badge-success',
        'dismissed': 'badge-secondary'
      };

      return `
        <tr>
          <td><strong>${formatReason(r.reason)}</strong><div class="text-muted text-xs">${r.description || 'No description'}</div></td>
          <td><span class="badge ${statusColors[r.status] || 'badge-secondary'}">${r.status.toUpperCase()}</span></td>
          <td><code>${r.reporterSessionUuid ? r.reporterSessionUuid.substring(0, 8) + '...' : 'Unknown'}</code></td>
          <td><code>${r.reportedSessionUuid ? r.reportedSessionUuid.substring(0, 8) + '...' : 'Unknown'}</code></td>
          <td>${formatDate(r.createdAt)}</td>
          <td>
            <button class="action-btn action-btn-primary" onclick="window.omagleeAdmin.openReviewReportModal('${r.id}')">
              Review
            </button>
          </td>
        </tr>
      `;
    }).join('');

    (window as any)._cachedReports = reports;
  } catch (err) {
    console.warn('Reports fetch error:', err);
  }
}

// Tab 4: Bans
export async function fetchBans(state: AdminState): Promise<void> {
  const tableBody = document.getElementById('bans-table-body');
  if (!tableBody) return;

  try {
    const res = await fetch(`${API_URL}/admin/bans`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const bans = data.bans || [];

    if (bans.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No active suspensions or bans found.</td></tr>';
      return;
    }

    tableBody.innerHTML = bans.map((b: any) => {
      const isActive = b.status === 'active';
      return `
        <tr>
          <td><code>${b.subjectSessionUuid ? b.subjectSessionUuid.substring(0, 12) + '...' : 'Unknown'}</code></td>
          <td><strong>${b.reason}</strong></td>
          <td><span class="badge ${b.banType === 'permanent' ? 'badge-danger' : 'badge-warning'}">${b.banType.toUpperCase()}</span></td>
          <td>${formatDate(b.startsAt)}</td>
          <td>${b.expiresAt ? formatDate(b.expiresAt) : 'Never (Permanent)'}</td>
          <td>
            ${isActive ? `
              <button class="action-btn action-btn-danger" onclick="window.omagleeAdmin.revokeBan('${b.id}')">
                Revoke Ban
              </button>
            ` : '<span class="text-muted">Revoked</span>'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Bans fetch error:', err);
  }
}

// Tab 5: Matches
export async function fetchMatches(state: AdminState): Promise<void> {
  const tableBody = document.getElementById('matches-table-body');
  if (!tableBody) return;

  try {
    const query = state.matchesFilter !== 'all' ? `?status=${state.matchesFilter}` : '';
    const res = await fetch(`${API_URL}/admin/matches${query}`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const matches = data.matches || [];

    if (matches.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No matching sessions found.</td></tr>';
      return;
    }

    tableBody.innerHTML = matches.map((m: any) => {
      const isLive = m.status === 'connected';
      return `
        <tr>
          <td><code>${m.matchId.substring(0, 10)}...</code></td>
          <td><span class="badge ${isLive ? 'badge-success' : 'badge-secondary'}">${m.status.toUpperCase()}</span></td>
          <td><code>${m.participantAId?.substring(0, 8)}</code> &harr; <code>${m.participantBId?.substring(0, 8)}</code></td>
          <td>${m.durationSeconds ? `${m.durationSeconds}s` : '0s'}</td>
          <td>${m.messageCount ?? 0}</td>
          <td>${m.endedReason ? formatReason(m.endedReason) : (isLive ? '<span class="text-emerald">Live</span>' : '-')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.warn('Matches fetch error:', err);
  }
}

// Tab 6: System Health
export async function fetchSystemHealth(state: AdminState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/admin/system-health`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const c = data.components || {};

    if (c.database) {
      const dbStatus = document.getElementById('db-status');
      if (dbStatus) {
        dbStatus.textContent = c.database.status.toUpperCase();
        dbStatus.className = `badge ${c.database.connected ? 'badge-success' : 'badge-danger'}`;
      }
      setMetric('db-ping', `${c.database.pingMs ?? 0} ms`);
      setMetric('db-host', `${c.database.host}/${c.database.database}`);
    }

    if (c.reverb) {
      const revStatus = document.getElementById('reverb-status');
      if (revStatus) {
        revStatus.textContent = c.reverb.status.toUpperCase();
        revStatus.className = `badge ${c.reverb.status === 'healthy' ? 'badge-success' : 'badge-warning'}`;
      }
      setMetric('reverb-port', `${c.reverb.host}:${c.reverb.port}`);
      setMetric('reverb-rooms', c.reverb.activeRooms ?? 0);
    }

    if (c.turnRelay) {
      const turnStatus = document.getElementById('turn-status');
      if (turnStatus) {
        turnStatus.textContent = c.turnRelay.status.toUpperCase();
        turnStatus.className = `badge ${c.turnRelay.status === 'operational' ? 'badge-success' : 'badge-warning'}`;
      }
      setMetric('turn-ports', `${c.turnRelay.port} / ${c.turnRelay.tlsPort} (TLS)`);
    }

    if (c.server) {
      const srvStatus = document.getElementById('srv-status');
      if (srvStatus) {
        srvStatus.textContent = c.server.status.toUpperCase();
        srvStatus.className = 'badge badge-success';
      }
      setMetric('srv-uptime', `${Math.floor((c.server.uptimeSeconds ?? 0) / 60)} mins`);
      setMetric('srv-memory', `${c.server.memoryRssMb ?? 0} MB (RSS)`);
    }
  } catch (err) {
    console.warn('Health fetch error:', err);
  }
}

// Tab 7: Settings
export async function fetchSettings(state: AdminState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/admin/settings`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const s = data.settings || {};

    const setVal = (id: string, val: any) => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      if (inp) inp.value = String(val);
    };
    const setCheck = (id: string, val: any) => {
      const chk = document.getElementById(id) as HTMLInputElement | null;
      if (chk) chk.checked = Boolean(val);
    };

    setVal('cfg-queue-timeout', s.queueTimeoutSeconds ?? 60);
    setVal('cfg-session-inactivity', s.sessionInactivityMinutes ?? 120);
    setVal('cfg-autoban-reports', s.maxReportsBeforeAutoBan ?? 3);
    setVal('cfg-rate-limit', s.rateLimitMaxRequests ?? 120);
    setCheck('cfg-force-turn', s.forceTurnRelayOnly);
    setCheck('cfg-maintenance', s.maintenanceMode);
  } catch (err) {
    console.warn('Settings fetch error:', err);
  }
}

export async function handleSaveSettings(state: AdminState, e?: Event): Promise<void> {
  if (e) e.preventDefault();
  const btn = document.getElementById('save-settings-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  const getNumVal = (id: string, fallback: number) => {
    const val = (document.getElementById(id) as HTMLInputElement | null)?.value;
    return val ? Number(val) : fallback;
  };
  const getBoolVal = (id: string) => {
    return Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);
  };

  const payload = {
    queueTimeoutSeconds: getNumVal('cfg-queue-timeout', 60),
    sessionInactivityMinutes: getNumVal('cfg-session-inactivity', 120),
    maxReportsBeforeAutoBan: getNumVal('cfg-autoban-reports', 3),
    rateLimitMaxRequests: getNumVal('cfg-rate-limit', 120),
    forceTurnRelayOnly: getBoolVal('cfg-force-turn'),
    maintenanceMode: getBoolVal('cfg-maintenance')
  };

  try {
    const res = await fetch(`${API_URL}/admin/settings`, {
      method: 'PATCH',
      headers: authHeaders(state),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Platform settings saved successfully.');
    } else {
      alert('Failed to save settings.');
    }
  } catch {
    alert('Error updating settings.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Tab 8: Abuse Monitoring
export async function fetchAbuseMonitoring(state: AdminState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/admin/abuse-monitoring`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();

    const repeatUsersList = document.getElementById('repeat-users-list');
    if (repeatUsersList) {
      const users = data.repeatReportedUsers || [];
      repeatUsersList.innerHTML = users.length ? users.map((u: any) => `
        <div class="user-item">
          <div>
            <strong>${u.maskedSessionUuid}</strong>
            <div class="text-xs text-muted">Total Reports: ${u.reportCount}</div>
          </div>
          <div>
            <span class="badge ${u.isBanned ? 'badge-danger' : 'badge-warning'}">
              ${u.isBanned ? 'Banned' : 'Flagged'}
            </span>
          </div>
        </div>
      `).join('') : '<p class="text-muted text-sm">No repeat reported users detected.</p>';
    }

    const alertsList = document.getElementById('suspicious-alerts-list');
    if (alertsList) {
      const alerts = data.suspiciousAlerts || [];
      alertsList.innerHTML = alerts.length ? alerts.map((a: any) => `
        <div class="alert-box alert-${a.severity || 'warning'}">
          <div class="alert-content">
            <h4>${a.title}</h4>
            <p>${a.description}</p>
          </div>
          <span class="badge badge-warning">${a.count} events</span>
        </div>
      `).join('') : '<p class="text-muted text-sm">No critical abuse alerts at this time.</p>';
    }
  } catch (err) {
    console.warn('Abuse monitoring error:', err);
  }
}

// Tab 9: Audit Logs
export async function fetchAuditLogs(state: AdminState): Promise<void> {
  const tableBody = document.getElementById('audit-table-body');
  if (!tableBody) return;

  try {
    const res = await fetch(`${API_URL}/admin/audit-logs`, { headers: authHeaders(state) });
    if (!res.ok) return;
    const data = await res.json();
    const logs = data.auditLogs || [];

    if (logs.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No audit logs recorded yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = logs.map((l: any) => `
      <tr>
        <td><strong>${l.action}</strong></td>
        <td><code>${l.actorType}:${l.actorId}</code></td>
        <td>${l.targetType ? `<code>${l.targetType}:${l.targetId}</code>` : '-'}</td>
        <td>${formatDate(l.createdAt)}</td>
        <td><pre class="json-preview">${l.metadata ? JSON.stringify(l.metadata) : '{}'}</pre></td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('Audit logs fetch error:', err);
  }
}

export function switchTab(state: AdminState, el: AdminElements, tabName: AdminTab): void {
  state.activeTab = tabName;

  el.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  el.tabPanes.forEach(pane => {
    pane.style.display = pane.id === `tab-${tabName}` ? 'block' : 'none';
  });

  if (el.pageTitle) {
    const titles: Record<AdminTab, string> = {
      'overview': 'Dashboard Overview',
      'users': 'User Management & Sessions',
      'reports': 'Abuse Reports Moderation',
      'bans': 'Active Bans & Suspensions',
      'matches': 'Live WebRTC Matches',
      'system-health': 'System Health Diagnostics',
      'settings': 'Platform Configuration',
      'abuse-monitoring': 'Abuse & Anomaly Monitoring',
      'audit-logs': 'Administrator Audit Trail'
    };
    el.pageTitle.textContent = titles[tabName] || 'Admin Dashboard';
  }

  loadActiveTabData(state);
}

export function loadActiveTabData(state: AdminState): void {
  switch (state.activeTab) {
    case 'overview':
      fetchOverview(state);
      break;
    case 'users':
      fetchUsers(state);
      break;
    case 'reports':
      fetchReports(state);
      break;
    case 'bans':
      fetchBans(state);
      break;
    case 'matches':
      fetchMatches(state);
      break;
    case 'system-health':
      fetchSystemHealth(state);
      break;
    case 'settings':
      fetchSettings(state);
      break;
    case 'abuse-monitoring':
      fetchAbuseMonitoring(state);
      break;
    case 'audit-logs':
      fetchAuditLogs(state);
      break;
  }
}
