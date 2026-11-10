/**
 * Auth Service - Admin Credentials & Session Management
 */

import { AdminState, AdminElements } from '../types';
import { API_URL } from '../config';

export function authHeaders(state: AdminState): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.token || ''}`
  };
}

export function showLoginError(el: AdminElements, msg: string): void {
  if (!el.loginError) return;
  el.loginError.textContent = msg;
  el.loginError.style.display = 'block';
}

export function updateAuthView(state: AdminState, el: AdminElements, onAuthenticated: () => void): void {
  if (!state.token || !state.currentUser) {
    if (el.loginView) el.loginView.style.display = 'flex';
    if (el.dashboardView) el.dashboardView.style.display = 'none';
    if (state.refreshInterval) {
      clearInterval(state.refreshInterval);
      state.refreshInterval = null;
    }
  } else {
    if (el.loginView) el.loginView.style.display = 'none';
    if (el.dashboardView) el.dashboardView.style.display = 'flex';

    if (el.adminNameText) el.adminNameText.textContent = state.currentUser.username || 'Admin';
    if (el.adminRoleBadge) el.adminRoleBadge.textContent = state.currentUser.role || 'Super Admin';

    onAuthenticated();
  }
}

export async function handleLogin(
  state: AdminState,
  el: AdminElements,
  e: Event | undefined,
  onSuccess: () => void
): Promise<void> {
  if (e) e.preventDefault();
  const username = el.usernameInput?.value.trim() || 'superadmin';
  const password = el.passwordInput?.value || '';

  if (!password) {
    showLoginError(el, 'Please enter the administrator password.');
    return;
  }

  if (el.loginBtn) el.loginBtn.disabled = true;
  if (el.loginError) el.loginError.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.token) {
      state.token = data.token;
      state.currentUser = data.user || { username, role: 'super_admin' };
      localStorage.setItem('omaglee_admin_token', state.token!);
      localStorage.setItem('omaglee_admin_user', JSON.stringify(state.currentUser));
      onSuccess();
    } else {
      showLoginError(el, data.message || 'Invalid administrator credentials.');
    }
  } catch {
    showLoginError(el, 'Connection to admin backend failed.');
  } finally {
    if (el.loginBtn) el.loginBtn.disabled = false;
  }
}

export function handleLogout(state: AdminState, el: AdminElements, onLoggedOut: () => void): void {
  state.token = null;
  state.currentUser = null;
  localStorage.removeItem('omaglee_admin_token');
  localStorage.removeItem('omaglee_admin_user');
  onLoggedOut();
}
