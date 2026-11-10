/**
 * Omaglee Admin Dashboard - Type Definitions
 */

export interface AdminUser {
  username: string;
  role: string;
}

export interface AdminOverview {
  activeSessions: number;
  activeMatches: number;
  waitingQueue: number;
  pendingReports: number;
  underReviewReports: number;
  resolvedReports: number;
  activeBans: number;
  errorRatePercent: number;
  totalApiRequests: number;
  maintenanceMode: boolean;
}

export interface UserSession {
  sessionUuid: string;
  maskedSessionUuid?: string;
  isBanned?: boolean;
  isRestricted?: boolean;
  maskedIpAddress?: string;
  activeMatchId?: string | null;
  reportsCount: number;
  lastSeenAt?: number | string;
}

export interface AbuseReport {
  id: string;
  reason: string;
  description?: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  reporterSessionUuid?: string;
  reportedSessionUuid?: string;
  createdAt: string;
}

export interface BanEntry {
  id: string;
  subjectSessionUuid: string;
  reason: string;
  banType: 'temporary' | 'permanent';
  startsAt: string;
  expiresAt?: string | null;
  status: 'active' | 'revoked';
}

export interface LiveMatch {
  matchId: string;
  status: string;
  participantAId?: string;
  participantBId?: string;
  durationSeconds?: number;
  messageCount?: number;
  endedReason?: string | null;
}

export interface SystemHealthData {
  components?: {
    database?: {
      status: string;
      connected: boolean;
      pingMs?: number;
      host?: string;
      database?: string;
    };
    reverb?: {
      status: string;
      host?: string;
      port?: number;
      activeRooms?: number;
    };
    turnRelay?: {
      status: string;
      port?: number;
      tlsPort?: number;
    };
    server?: {
      status: string;
      uptimeSeconds?: number;
      memoryRssMb?: number;
    };
  };
}

export interface PlatformSettings {
  queueTimeoutSeconds: number;
  sessionInactivityMinutes: number;
  maxReportsBeforeAutoBan: number;
  rateLimitMaxRequests: number;
  forceTurnRelayOnly: boolean;
  maintenanceMode: boolean;
}

export interface RepeatUser {
  maskedSessionUuid: string;
  reportCount: number;
  isBanned: boolean;
}

export interface SuspiciousAlert {
  severity: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  count: number;
}

export interface AbuseMonitoringData {
  repeatReportedUsers?: RepeatUser[];
  suspiciousAlerts?: SuspiciousAlert[];
}

export interface AuditLog {
  id?: string;
  action: string;
  actorType: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
  metadata?: any;
}

export type AdminTab =
  | 'overview'
  | 'users'
  | 'reports'
  | 'bans'
  | 'matches'
  | 'system-health'
  | 'settings'
  | 'abuse-monitoring'
  | 'audit-logs';

export interface AdminState {
  token: string | null;
  currentUser: AdminUser | null;
  activeTab: AdminTab;
  refreshInterval: number | null;
  activeReport: AbuseReport | null;
  usersSearch: string;
  usersFilter: string;
  reportsFilter: string;
  matchesFilter: string;
}

export interface AdminElements {
  loginView: HTMLElement | null;
  dashboardView: HTMLElement | null;
  loginForm: HTMLFormElement | null;
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  loginError: HTMLElement | null;
  loginBtn: HTMLButtonElement | null;

  adminNameText: HTMLElement | null;
  adminRoleBadge: HTMLElement | null;
  logoutBtn: HTMLElement | null;
  refreshBtn: HTMLElement | null;
  navItems: NodeListOf<HTMLElement>;
  tabPanes: NodeListOf<HTMLElement>;
  pageTitle: HTMLElement | null;

  reviewModal: HTMLElement | null;
  closeReviewBtn: HTMLElement | null;
  createBanModal: HTMLElement | null;
  closeCreateBanBtn: HTMLElement | null;
  openCreateBanBtn: HTMLElement | null;
  createBanForm: HTMLFormElement | null;

  userSearchInput: HTMLInputElement | null;
  userStatusSelect: HTMLSelectElement | null;
  reportFilterSelect: HTMLSelectElement | null;
  matchFilterSelect: HTMLSelectElement | null;

  settingsForm: HTMLFormElement | null;
}
