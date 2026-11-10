/**
 * Omaglee Admin Dashboard - TypeScript Entry Point
 * Real-time User Moderation, Abuse Reporting, WebRTC Analytics & System Management
 */

import { AdminState, AdminElements, AdminTab } from './types';
import { updateAuthView, handleLogin, handleLogout } from './services/auth';
import { switchTab, loadActiveTabData, fetchUsers, fetchReports, fetchMatches, handleSaveSettings } from './services/dashboard';
import { toggleRestrict, revokeBan, openReviewReportModal, resolveReport, openBanModalForUser, handleCreateBan } from './services/moderation';

export class AdminDashboardApp {
  public state: AdminState;
  public el!: AdminElements;

  constructor() {
    this.state = {
      token: localStorage.getItem('omaglee_admin_token'),
      currentUser: (() => {
        try {
          const u = localStorage.getItem('omaglee_admin_user');
          return u ? JSON.parse(u) : null;
        } catch {
          return null;
        }
      })(),
      activeTab: 'overview',
      refreshInterval: null,
      activeReport: null,
      usersSearch: '',
      usersFilter: 'all',
      reportsFilter: 'all',
      matchesFilter: 'all'
    };
  }

  public init(): void {
    this.el = this.initElements();
    this.setupEvents();
    this.exposeGlobalHelpers();
    updateAuthView(this.state, this.el, () => this.onAuthenticated());
  }

  private initElements(): AdminElements {
    return {
      loginView: document.getElementById('login-view'),
      dashboardView: document.getElementById('dashboard-view'),
      loginForm: document.getElementById('login-form') as HTMLFormElement | null,
      usernameInput: document.getElementById('login-username') as HTMLInputElement | null,
      passwordInput: document.getElementById('login-password') as HTMLInputElement | null,
      loginError: document.getElementById('login-error'),
      loginBtn: document.getElementById('login-submit-btn') as HTMLButtonElement | null,

      adminNameText: document.getElementById('admin-name-text'),
      adminRoleBadge: document.getElementById('admin-role-badge'),
      logoutBtn: document.getElementById('admin-logout-btn'),
      refreshBtn: document.getElementById('admin-refresh-btn'),
      navItems: document.querySelectorAll('.nav-item') as NodeListOf<HTMLElement>,
      tabPanes: document.querySelectorAll('.tab-content-pane') as NodeListOf<HTMLElement>,
      pageTitle: document.getElementById('page-title-text'),

      reviewModal: document.getElementById('review-modal'),
      closeReviewBtn: document.getElementById('close-review-btn'),
      createBanModal: document.getElementById('create-ban-modal'),
      closeCreateBanBtn: document.getElementById('close-create-ban-btn'),
      openCreateBanBtn: document.getElementById('open-create-ban-btn'),
      createBanForm: document.getElementById('create-ban-form') as HTMLFormElement | null,

      userSearchInput: document.getElementById('user-search-input') as HTMLInputElement | null,
      userStatusSelect: document.getElementById('user-status-select') as HTMLSelectElement | null,
      reportFilterSelect: document.getElementById('report-filter-select') as HTMLSelectElement | null,
      matchFilterSelect: document.getElementById('match-filter-select') as HTMLSelectElement | null,

      settingsForm: document.getElementById('settings-form') as HTMLFormElement | null,
    };
  }

  private setupEvents(): void {
    const el = this.el;

    if (el.loginForm) {
      el.loginForm.addEventListener('submit', (e) => {
        handleLogin(this.state, el, e, () => {
          updateAuthView(this.state, el, () => this.onAuthenticated());
        });
      });
    }

    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', () => {
        handleLogout(this.state, el, () => {
          updateAuthView(this.state, el, () => {});
        });
      });
    }

    if (el.refreshBtn) {
      el.refreshBtn.addEventListener('click', () => loadActiveTabData(this.state));
    }

    // Nav tabs
    el.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab as AdminTab;
        if (tab) switchTab(this.state, el, tab);
      });
    });

    // Modals
    if (el.closeReviewBtn) {
      el.closeReviewBtn.addEventListener('click', () => {
        if (el.reviewModal) el.reviewModal.style.display = 'none';
      });
    }
    if (el.closeCreateBanBtn) {
      el.closeCreateBanBtn.addEventListener('click', () => {
        if (el.createBanModal) el.createBanModal.style.display = 'none';
      });
    }
    if (el.openCreateBanBtn) {
      el.openCreateBanBtn.addEventListener('click', () => openBanModalForUser(el, ''));
    }
    if (el.createBanForm) {
      el.createBanForm.addEventListener('submit', (e) => handleCreateBan(this.state, el, e));
    }

    // Search & Filter listeners
    if (el.userSearchInput) {
      el.userSearchInput.addEventListener('input', (e) => {
        this.state.usersSearch = (e.target as HTMLInputElement).value.trim();
        fetchUsers(this.state);
      });
    }
    if (el.userStatusSelect) {
      el.userStatusSelect.addEventListener('change', (e) => {
        this.state.usersFilter = (e.target as HTMLSelectElement).value;
        fetchUsers(this.state);
      });
    }
    if (el.reportFilterSelect) {
      el.reportFilterSelect.addEventListener('change', (e) => {
        this.state.reportsFilter = (e.target as HTMLSelectElement).value;
        fetchReports(this.state);
      });
    }
    if (el.matchFilterSelect) {
      el.matchFilterSelect.addEventListener('change', (e) => {
        this.state.matchesFilter = (e.target as HTMLSelectElement).value;
        fetchMatches(this.state);
      });
    }

    // Settings
    if (el.settingsForm) {
      el.settingsForm.addEventListener('submit', (e) => handleSaveSettings(this.state, e));
    }
  }

  private onAuthenticated(): void {
    loadActiveTabData(this.state);
    if (!this.state.refreshInterval) {
      this.state.refreshInterval = setInterval(() => loadActiveTabData(this.state), 15000) as any;
    }
  }

  private exposeGlobalHelpers(): void {
    (window as any).omagleeAdmin = {
      toggleRestrict: (sessionUuid: string, shouldRestrict: boolean) => toggleRestrict(this.state, sessionUuid, shouldRestrict),
      revokeBan: (banId: string) => revokeBan(this.state, banId),
      openReviewReportModal: (reportId: string) => openReviewReportModal(this.state, this.el, reportId),
      openBanModalForUser: (sessionUuid: string) => openBanModalForUser(this.el, sessionUuid),
      resolveReport: (action: 'dismiss' | 'review' | 'ban') => resolveReport(this.state, this.el, action)
    };
  }
}

// Auto-instantiate when document is loaded
const adminApp = new AdminDashboardApp();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => adminApp.init());
} else {
  adminApp.init();
}

export default adminApp;
