/**
 * Moderation Service - Ban Enforcement, Restrictions & Report Resolution
 */

import { AdminState, AdminElements, AbuseReport } from '../types';
import { API_URL } from '../config';
import { authHeaders } from './auth';
import { formatReason } from '../utils/formatters';
import { fetchUsers, fetchBans, fetchReports } from './dashboard';

export async function toggleRestrict(state: AdminState, sessionUuid: string, shouldRestrict: boolean): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/admin/users/${sessionUuid}/restrict`, {
      method: 'POST',
      headers: authHeaders(state),
      body: JSON.stringify({ isRestricted: shouldRestrict })
    });
    if (res.ok) {
      fetchUsers(state);
    }
  } catch {
    alert('Failed to update user restriction.');
  }
}

export async function revokeBan(state: AdminState, banId: string): Promise<void> {
  if (!confirm('Are you sure you want to revoke this ban?')) return;
  try {
    const res = await fetch(`${API_URL}/admin/bans/${banId}`, {
      method: 'DELETE',
      headers: authHeaders(state)
    });
    if (res.ok) {
      fetchBans(state);
    }
  } catch {
    alert('Failed to revoke ban.');
  }
}

export function openReviewReportModal(state: AdminState, el: AdminElements, reportId: string): void {
  const cachedReports: AbuseReport[] = (window as any)._cachedReports || [];
  const report = cachedReports.find(r => r.id === reportId);
  if (!report || !el.reviewModal) return;

  state.activeReport = report;
  const reasonEl = document.getElementById('modal-report-reason');
  const descEl = document.getElementById('modal-report-desc');
  const userEl = document.getElementById('modal-reported-user');

  if (reasonEl) reasonEl.textContent = formatReason(report.reason);
  if (descEl) descEl.textContent = report.description || 'No additional details provided.';
  if (userEl) userEl.textContent = report.reportedSessionUuid || 'Unknown';

  el.reviewModal.style.display = 'flex';
}

export async function resolveReport(state: AdminState, el: AdminElements, action: 'dismiss' | 'review' | 'ban'): Promise<void> {
  if (!state.activeReport) return;

  try {
    let status = 'resolved';
    if (action === 'dismiss') status = 'dismissed';
    if (action === 'review') status = 'under_review';

    await fetch(`${API_URL}/admin/reports/${state.activeReport.id}`, {
      method: 'PATCH',
      headers: authHeaders(state),
      body: JSON.stringify({
        status,
        resolution: action === 'dismiss' ? 'Dismissed by moderator' : 'Resolved after review'
      })
    });

    if (action === 'ban' && state.activeReport.reportedSessionUuid) {
      await fetch(`${API_URL}/admin/bans`, {
        method: 'POST',
        headers: authHeaders(state),
        body: JSON.stringify({
          subjectSessionUuid: state.activeReport.reportedSessionUuid,
          reason: `Banned following report: ${state.activeReport.reason}`,
          banType: 'temporary',
          durationHours: 24,
          reportId: state.activeReport.id
        })
      });
    }

    if (el.reviewModal) el.reviewModal.style.display = 'none';
    state.activeReport = null;
    fetchReports(state);
  } catch {
    alert('Failed to update report status.');
  }
}

export function openBanModalForUser(el: AdminElements, sessionUuid: string): void {
  if (!el.createBanModal) return;
  const inp = document.getElementById('ban-session-uuid') as HTMLInputElement | null;
  if (inp) inp.value = sessionUuid || '';
  el.createBanModal.style.display = 'flex';
}

export async function handleCreateBan(state: AdminState, el: AdminElements, e?: Event): Promise<void> {
  if (e) e.preventDefault();
  const sessionUuid = (document.getElementById('ban-session-uuid') as HTMLInputElement | null)?.value.trim();
  const reason = (document.getElementById('ban-reason') as HTMLInputElement | null)?.value.trim() || 'Terms Violation';
  const banType = (document.getElementById('ban-type') as HTMLSelectElement | null)?.value || 'temporary';
  const durationHours = Number((document.getElementById('ban-duration') as HTMLInputElement | null)?.value || 24);

  if (!sessionUuid) {
    alert('Session UUID is required.');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/bans`, {
      method: 'POST',
      headers: authHeaders(state),
      body: JSON.stringify({
        subjectSessionUuid: sessionUuid,
        reason,
        banType,
        durationHours
      })
    });

    if (res.ok) {
      if (el.createBanModal) el.createBanModal.style.display = 'none';
      fetchBans(state);
    } else {
      alert('Failed to create ban.');
    }
  } catch {
    alert('Error creating ban.');
  }
}
