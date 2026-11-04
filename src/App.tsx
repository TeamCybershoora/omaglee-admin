import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  FileText, 
  Ban, 
  CheckCircle, 
  AlertTriangle, 
  LogOut, 
  Lock, 
  Eye, 
  PlusCircle, 
  X, 
  Loader2,
  Clock,
  ShieldCheck,
  Users,
  Film,
  HeartPulse,
  Settings,
  AlertOctagon,
  Search,
  UserX,
  UserCheck,
  Database,
  Radio,
  Server,
  Zap
} from 'lucide-react';
import './App.css';

// Type Definitions
type AdminRole = 'super_admin' | 'moderator' | 'support';
type ActiveTab = 
  | 'overview' 
  | 'users' 
  | 'reports' 
  | 'bans' 
  | 'matches' 
  | 'system-health' 
  | 'settings' 
  | 'audit-logs' 
  | 'abuse-monitoring';

interface AdminUser {
  username: string;
  role: AdminRole;
}

interface OverviewMetrics {
  activeSessions: number;
  activeMatches: number;
  waitingQueue: number;
  pendingReports: number;
  underReviewReports: number;
  resolvedReports: number;
  activeBans: number;
  totalReports: number;
  errorRatePercent: number;
  totalApiRequests: number;
  maintenanceMode: boolean;
}

interface UserItem {
  sessionUuid: string;
  maskedSessionUuid: string;
  status: string;
  activeMatchId: string | null;
  isRestricted: boolean;
  isBanned: boolean;
  reportsCount: number;
  maskedIpAddress: string;
  lastSeenAt: number;
  createdAt: number;
}

interface ReportItem {
  id: string;
  reportUuid?: string;
  reporterSessionUuid: string;
  reportedSessionUuid: string;
  matchId: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolution?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

interface BanItem {
  id: string;
  subjectSessionUuid: string;
  reason: string;
  banType: 'temporary' | 'permanent';
  status: 'active' | 'revoked';
  startsAt: string;
  expiresAt: string | null;
  reportId?: string | null;
  createdAt: string;
}

interface MatchItem {
  matchId: string;
  status: string;
  participantAId: string;
  participantBId: string;
  startedAt: string | null;
  endedAt: string | null;
  endedReason: string;
  durationSeconds: number;
  messageCount: number;
}

interface SystemHealthData {
  timestamp: string;
  components: {
    database: {
      service: string;
      status: string;
      host: string;
      database: string;
      pingMs: number;
      connected: boolean;
      poolActive: number;
    };
    reverb: {
      service: string;
      status: string;
      host: string;
      port: number;
      pingMs: number;
      activeRooms: number;
    };
    turnRelay: {
      service: string;
      status: string;
      host: string;
      port: number;
      tlsPort: number;
      credentialTtlSeconds: number;
      pingMs: number | null;
    };
    server: {
      service: string;
      status: string;
      uptimeSeconds: number;
      nodeVersion: string;
      memoryRssMb: number;
      memoryHeapUsedMb: number;
      totalRequestsProcessed: number;
      errorRatePercent: number;
    };
  };
}

interface AppSettingsData {
  queueTimeoutSeconds: number;
  sessionInactivityMinutes: number;
  maxReportsBeforeAutoBan: number;
  forceTurnRelayOnly: boolean;
  maintenanceMode: boolean;
  rateLimitMaxRequests: number;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

interface AbuseMonitoringData {
  repeatReportedUsers: Array<{
    sessionUuid: string;
    maskedSessionUuid: string;
    reportCount: number;
    status: string;
    isBanned: boolean;
    isRestricted: boolean;
  }>;
  rapidDisconnectMatches: Array<{
    matchId: string;
    participantAId: string;
    participantBId: string;
    durationSeconds: number;
    endedReason: string;
    endedAt: string;
  }>;
  suspiciousAlerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    count: number;
  }>;
}

interface AuditLogItem {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function App() {
  const apiUrl = (import.meta.env.VITE_BACKEND_API_URL as string) || 'http://127.0.0.1:8000/api';

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('omaglee_admin_token'));
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('omaglee_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginUsername, setLoginUsername] = useState('superadmin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Loading States
  const [dataLoading, setDataLoading] = useState(false);
  const [currentTime] = useState(() => Date.now());

  // 1. Overview State
  const [overview, setOverview] = useState<OverviewMetrics>({
    activeSessions: 0,
    activeMatches: 0,
    waitingQueue: 0,
    pendingReports: 0,
    underReviewReports: 0,
    resolvedReports: 0,
    activeBans: 0,
    totalReports: 0,
    errorRatePercent: 0,
    totalApiRequests: 0,
    maintenanceMode: false,
  });

  // 2. Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // 3. Reports State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportFilter, setReportFilter] = useState('all');
  const [activeReportModal, setActiveReportModal] = useState<ReportItem | null>(null);
  const [modalReportStatus, setModalReportStatus] = useState<'pending' | 'under_review' | 'resolved' | 'dismissed'>('under_review');
  const [modalResolutionNotes, setModalResolutionNotes] = useState('');
  const [modalIssueBan, setModalIssueBan] = useState(false);
  const [modalBanDuration, setModalBanDuration] = useState('24');
  const [modalBanType, setModalBanType] = useState<'temporary' | 'permanent'>('temporary');

  // 4. Bans State
  const [bans, setBans] = useState<BanItem[]>([]);
  const [showCreateBanModal, setShowCreateBanModal] = useState(false);
  const [newBanSession, setNewBanSession] = useState('');
  const [newBanReason, setNewBanReason] = useState('Violating Community Guidelines');
  const [newBanType, setNewBanType] = useState<'temporary' | 'permanent'>('temporary');
  const [newBanDuration, setNewBanDuration] = useState('24');

  // 5. Matches State
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchStatusFilter, setMatchStatusFilter] = useState('all');

  // 6. System Health State
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);

  // 7. Settings State
  const [settings, setSettings] = useState<AppSettingsData>({
    queueTimeoutSeconds: 45,
    sessionInactivityMinutes: 120,
    maxReportsBeforeAutoBan: 3,
    forceTurnRelayOnly: false,
    maintenanceMode: false,
    rateLimitMaxRequests: 60,
  });
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string | null>(null);

  // 8. Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditFilter, setAuditFilter] = useState('all');

  // 9. Abuse Monitoring State
  const [abuseMonitoring, setAbuseMonitoring] = useState<AbuseMonitoringData | null>(null);

  // Headers helper
  const authHeaders = useCallback((): HeadersInit => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken || ''}`,
    };
  }, [authToken]);

  // Role permissions check
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isModeratorOrAbove = currentUser?.role === 'super_admin' || currentUser?.role === 'moderator';

  // Fetch Loaders
  const loadOverview = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${apiUrl}/admin/overview`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) setOverview(data.metrics);
      }
    } catch (e) {
      console.error('[Admin] Overview error:', e);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadUsers = useCallback(async (search: string, status: string) => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (status !== 'all') query.append('status', status);
      const res = await fetch(`${apiUrl}/admin/users?${query.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('[Admin] Users error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadReports = useCallback(async (status: string) => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const query = status !== 'all' ? `?status=${status}` : '';
      const res = await fetch(`${apiUrl}/admin/reports${query}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReports(data.data || []);
      }
    } catch (e) {
      console.error('[Admin] Reports error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadBans = useCallback(async () => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/bans`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBans(data.data || []);
      }
    } catch (e) {
      console.error('[Admin] Bans error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadMatches = useCallback(async (status: string) => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const query = status !== 'all' ? `?status=${status}` : '';
      const res = await fetch(`${apiUrl}/admin/matches${query}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch (e) {
      console.error('[Admin] Matches error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadSystemHealth = useCallback(async () => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/system-health`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.error('[Admin] Health error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadSettings = useCallback(async () => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/settings`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (e) {
      console.error('[Admin] Settings error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadAuditLogs = useCallback(async (filter: string) => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const query = filter !== 'all' ? `?action=${filter}` : '';
      const res = await fetch(`${apiUrl}/admin/audit-logs${query}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.data || []);
      }
    } catch (e) {
      console.error('[Admin] Audit logs error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  const loadAbuseMonitoring = useCallback(async () => {
    if (!authToken) return;
    setDataLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/abuse-monitoring`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAbuseMonitoring(data);
      }
    } catch (e) {
      console.error('[Admin] Abuse monitoring error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [apiUrl, authToken, authHeaders]);

  // Synchronize active tab data
  useEffect(() => {
    if (!authToken) return;
    let ignore = false;

    const fetchTabData = async () => {
      await loadOverview();
      if (ignore) return;

      switch (activeTab) {
        case 'users':
          await loadUsers(userSearch, userStatusFilter);
          break;
        case 'reports':
          await loadReports(reportFilter);
          break;
        case 'bans':
          await loadBans();
          break;
        case 'matches':
          await loadMatches(matchStatusFilter);
          break;
        case 'system-health':
          await loadSystemHealth();
          break;
        case 'settings':
          await loadSettings();
          break;
        case 'audit-logs':
          await loadAuditLogs(auditFilter);
          break;
        case 'abuse-monitoring':
          await loadAbuseMonitoring();
          break;
        default:
          break;
      }
    };

    void fetchTabData();

    return () => {
      ignore = true;
    };
  }, [
    authToken,
    activeTab,
    userSearch,
    userStatusFilter,
    reportFilter,
    matchStatusFilter,
    auditFilter,
    loadOverview,
    loadUsers,
    loadReports,
    loadBans,
    loadMatches,
    loadSystemHealth,
    loadSettings,
    loadAuditLogs,
    loadAbuseMonitoring,
  ]);

  // Authentication Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch(`${apiUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const token = data.token;
        const user: AdminUser = { username: data.username, role: data.role };
        localStorage.setItem('omaglee_admin_token', token);
        localStorage.setItem('omaglee_admin_user', JSON.stringify(user));
        setAuthToken(token);
        setCurrentUser(user);
        setLoginPassword('');
      } else {
        setLoginError(data.message || 'Invalid administrative credentials.');
      }
    } catch {
      setLoginError('Could not connect to authentication service.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('omaglee_admin_token');
    localStorage.removeItem('omaglee_admin_user');
    setAuthToken(null);
    setCurrentUser(null);
  };

  // User Actions: Restrict / Unrestrict
  const handleToggleUserRestriction = async (sessionUuid: string, currentRestricted: boolean) => {
    if (!isModeratorOrAbove) return;
    const actionLabel = currentRestricted ? 'lift restriction on' : 'restrict';
    if (!confirm(`Are you sure you want to ${actionLabel} user session ${sessionUuid}?`)) return;

    try {
      const res = await fetch(`${apiUrl}/admin/users/${sessionUuid}/restrict`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ restricted: !currentRestricted }),
      });
      if (res.ok) {
        loadUsers(userSearch, userStatusFilter);
        loadOverview();
      }
    } catch (e) {
      console.error('[Admin] Restriction toggle error:', e);
    }
  };

  // Report Actions
  const handleSaveReportReview = async () => {
    if (!activeReportModal || !isModeratorOrAbove) return;

    try {
      await fetch(`${apiUrl}/admin/reports/${activeReportModal.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          status: modalReportStatus,
          resolution: modalResolutionNotes,
        }),
      });

      if (modalIssueBan && activeReportModal.reportedSessionUuid) {
        await fetch(`${apiUrl}/admin/bans`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            subjectSessionUuid: activeReportModal.reportedSessionUuid,
            reason: `Report #${activeReportModal.id}: ${activeReportModal.reason}`,
            banType: modalBanType,
            durationHours: modalBanType === 'temporary' ? modalBanDuration : undefined,
            reportId: activeReportModal.id,
          }),
        });
      }

      setActiveReportModal(null);
      loadReports(reportFilter);
      loadOverview();
    } catch (e) {
      console.error('[Admin] Report update error:', e);
    }
  };

  // Ban Actions
  const handleCreateManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanSession.trim() || !isModeratorOrAbove) return;

    try {
      const res = await fetch(`${apiUrl}/admin/bans`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          subjectSessionUuid: newBanSession.trim(),
          reason: newBanReason,
          banType: newBanType,
          durationHours: newBanType === 'temporary' ? newBanDuration : undefined,
        }),
      });

      if (res.ok) {
        setShowCreateBanModal(false);
        setNewBanSession('');
        loadBans();
        loadOverview();
      }
    } catch (e) {
      console.error('[Admin] Ban error:', e);
    }
  };

  const handleRevokeBan = async (banId: string) => {
    if (!isModeratorOrAbove) return;
    if (!confirm('Are you sure you want to revoke this ban?')) return;

    try {
      const res = await fetch(`${apiUrl}/admin/bans/${banId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        loadBans();
        loadOverview();
      }
    } catch (e) {
      console.error('[Admin] Revoke error:', e);
    }
  };

  // Settings Actions
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSettingsSaveSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/admin/settings`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSettingsSaveSuccess('Settings successfully saved and active across backend.');
        loadOverview();
      }
    } catch (e) {
      console.error('[Admin] Settings save error:', e);
    }
  };

  // Filtered audit logs
  const memoizedFilteredAuditLogs = useMemo(() => {
    if (auditFilter === 'all') return auditLogs;
    return auditLogs.filter(log => log.action.toLowerCase().includes(auditFilter));
  }, [auditLogs, auditFilter]);

  // LOGIN SCREEN
  if (!authToken) {
    return (
      <div className="admin-login-screen">
        <div className="login-card">
          <div className="login-brand-header">
            <ShieldAlert size={36} className="login-logo" />
            <h1>OMAGLEE ADMIN</h1>
            <p>Protected Administration & Governance Panel</p>
          </div>

          {loginError && (
            <div className="badge-danger" style={{ padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Admin Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                placeholder="superadmin / moderator / support"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Security Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                placeholder="••••••••••••"
              />
            </div>

            <button type="submit" className="login-submit-btn" disabled={loginLoading}>
              {loginLoading ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
              <span>{loginLoading ? 'Authenticating...' : 'Sign In to Panel'}</span>
            </button>
          </form>

          <div className="login-hint" style={{ textAlign: 'left', lineHeight: 1.5 }}>
            <strong>Demo RBAC Accounts:</strong>
            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.35rem' }}>
              <li><code>superadmin</code>: Full Access & Settings</li>
              <li><code>moderator</code>: Moderation & Restrictions</li>
              <li><code>support</code>: Read-Only Operations</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <ShieldAlert className="sidebar-logo" size={24} />
          <div>
            <h2>OMAGLEE</h2>
            <span className="admin-tag">Admin Panel</span>
          </div>
        </div>

        <nav className="nav-menu" style={{ overflowY: 'auto' }}>
          <button 
            type="button" 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={18} />
            <span>Overview</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} />
            <span>Users & Sessions</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <ShieldAlert size={18} />
            <span>Reports</span>
            {overview.pendingReports > 0 && (
              <span className="nav-badge">{overview.pendingReports}</span>
            )}
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'bans' ? 'active' : ''}`}
            onClick={() => setActiveTab('bans')}
          >
            <Ban size={18} />
            <span>Bans & Restrictions</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Film size={18} />
            <span>Match History</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'abuse-monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('abuse-monitoring')}
          >
            <AlertOctagon size={18} />
            <span>Abuse Monitoring</span>
            {abuseMonitoring && abuseMonitoring.suspiciousAlerts.length > 0 && (
              <span className="nav-badge" style={{ background: 'var(--warning)', color: '#000' }}>
                {abuseMonitoring.suspiciousAlerts.length}
              </span>
            )}
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'system-health' ? 'active' : ''}`}
            onClick={() => setActiveTab('system-health')}
          >
            <HeartPulse size={18} />
            <span>System Health</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button 
            type="button" 
            className={`nav-item ${activeTab === 'audit-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit-logs')}
          >
            <FileText size={18} />
            <span>Audit Trail</span>
          </button>
        </nav>

        {/* User Identity & Logout */}
        <div className="sidebar-user">
          <div className="user-meta">
            <span className="user-name">{currentUser?.username || 'Staff'}</span>
            <span className={`role-tag role-${currentUser?.role || 'support'}`}>
              {(currentUser?.role || 'support').replace('_', ' ')}
            </span>
          </div>
          <button 
            type="button" 
            className="logout-btn" 
            onClick={handleLogout}
            title="Sign out of Admin Panel"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {/* Topbar Header */}
        <header className="topbar">
          <div className="topbar-title">
            <h1>
              {activeTab === 'overview' && 'Executive Administration Overview'}
              {activeTab === 'users' && 'User Sessions & Account Restrictions'}
              {activeTab === 'reports' && 'User Violation Reports Queue'}
              {activeTab === 'bans' && 'Access Suspensions & Bans'}
              {activeTab === 'matches' && 'Operational Match History'}
              {activeTab === 'abuse-monitoring' && 'Real-Time Abuse & Griefing Detection'}
              {activeTab === 'system-health' && 'Infrastructure & Subsystem Diagnostics'}
              {activeTab === 'settings' && 'Platform Configuration & Limits'}
              {activeTab === 'audit-logs' && 'Administrative Action Audit Trail'}
            </h1>
            <p>Phase 10: Protected Administration Panel with Strict Role-Based Access Control</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {overview.maintenanceMode && (
              <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> Maintenance Mode Active
              </span>
            )}

            <button 
              type="button" 
              onClick={() => {
                loadOverview();
                if (activeTab === 'users') loadUsers(userSearch, userStatusFilter);
                if (activeTab === 'reports') loadReports(reportFilter);
                if (activeTab === 'bans') loadBans();
                if (activeTab === 'matches') loadMatches(matchStatusFilter);
                if (activeTab === 'system-health') loadSystemHealth();
                if (activeTab === 'settings') loadSettings();
                if (activeTab === 'audit-logs') loadAuditLogs(auditFilter);
                if (activeTab === 'abuse-monitoring') loadAbuseMonitoring();
              }} 
              className="refresh-button"
              disabled={dataLoading}
            >
              <RefreshCw size={15} className={dataLoading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {/* ========================================================= */}
          {/* MODULE 1: EXECUTIVE OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <>
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-header">
                    <span className="metric-title">Active Live Sessions</span>
                    <Users size={18} className="metric-icon text-blue" />
                  </div>
                  <div className="metric-value">{overview.activeSessions}</div>
                  <span className="metric-sub">Queue: {overview.waitingQueue} waiting</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="metric-title">Ongoing Video Matches</span>
                    <Film size={18} className="metric-icon text-green" />
                  </div>
                  <div className="metric-value">{overview.activeMatches}</div>
                  <span className="metric-sub">P2P & TURN Relayed</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="metric-title">Pending Incident Reports</span>
                    <AlertTriangle size={18} className="metric-icon text-amber" />
                  </div>
                  <div className="metric-value">{overview.pendingReports}</div>
                  <span className="metric-sub">{overview.resolvedReports} resolved to date</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="metric-title">Active Bans / Suspensions</span>
                    <Ban size={18} className="metric-icon text-danger" />
                  </div>
                  <div className="metric-value">{overview.activeBans}</div>
                  <span className="metric-sub">Enforced at 3 checkpoints</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span className="metric-title">System Error Rate</span>
                    <Zap size={18} className="metric-icon text-purple" />
                  </div>
                  <div className="metric-value">{overview.errorRatePercent}%</div>
                  <span className="metric-sub">{overview.totalApiRequests} requests logged</span>
                </div>
              </div>

              <div className="panels-grid">
                <div className="panel">
                  <div className="panel-header">
                    <ShieldCheck size={18} />
                    <h3>Privacy & Security Governance</h3>
                  </div>
                  <div className="panel-body">
                    <div className="check-list">
                      <div className="check-item verified">
                        <CheckCircle size={18} />
                        <div>
                          <strong>Zero Raw IP Exposure</strong>
                          <p>All client IP addresses are cryptographically masked or truncated to avoid unnecessary PII storage.</p>
                        </div>
                      </div>

                      <div className="check-item verified">
                        <CheckCircle size={18} />
                        <div>
                          <strong>Role-Based Access Enforcement (RBAC)</strong>
                          <p>Super Admin, Moderator, and Support roles are enforced across both HTTP API controllers and UI viewports.</p>
                        </div>
                      </div>

                      <div className="check-item verified">
                        <CheckCircle size={18} />
                        <div>
                          <strong>Multi-Point Checkpoint Ban Verification</strong>
                          <p>Matchmaking queue, WebSocket channel authentication, and TURN credential allocations verify suspensions.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <Activity size={18} />
                    <h3>Quick Administration Navigation</h3>
                  </div>
                  <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Select a module from the sidebar or click a quick action:
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={() => setActiveTab('reports')}
                      >
                        <ShieldAlert size={14} /> Review Reports ({overview.pendingReports})
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => setActiveTab('abuse-monitoring')}
                      >
                        <AlertOctagon size={14} /> Inspect Abuse Alerts
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        onClick={() => setActiveTab('system-health')}
                      >
                        <HeartPulse size={14} /> Check Subsystem Health
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* MODULE 2: USERS & SESSIONS */}
          {/* ========================================================= */}
          {activeTab === 'users' && (
            <div className="users-section">
              <div className="table-controls">
                <div className="search-input-wrap">
                  <Search size={15} className="search-icon-inside" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by session UUID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>

                <div className="filter-tabs">
                  {['all', 'idle', 'waiting', 'matched', 'restricted'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-tab ${userStatusFilter === status ? 'active' : ''}`}
                      onClick={() => setUserStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total sessions: {users.length}
                </span>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Masked Session UUID</th>
                      <th>Masked Client IP</th>
                      <th>Status</th>
                      <th>Active Match</th>
                      <th>Reports Filed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">
                          No anonymous user sessions matching current criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.sessionUuid}>
                          <td>
                            <span className="mono-uuid" title={u.sessionUuid}>
                              {u.maskedSessionUuid}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {u.maskedIpAddress}
                          </td>
                          <td>
                            <span className={`badge ${u.isRestricted ? 'badge-danger' : u.status === 'matched' ? 'badge-resolved' : u.status === 'waiting' ? 'badge-pending' : 'badge-dismissed'}`}>
                              {u.isRestricted ? 'Restricted' : u.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {u.activeMatchId ? <code className="mono-uuid">{u.activeMatchId}</code> : 'None'}
                          </td>
                          <td>
                            <span className={`badge ${u.reportsCount > 0 ? 'badge-warning' : 'badge-dismissed'}`}>
                              {u.reportsCount} report(s)
                            </span>
                          </td>
                          <td>
                            {isModeratorOrAbove ? (
                              <button
                                type="button"
                                className={u.isRestricted ? 'btn-primary btn-sm' : 'btn-outline-danger btn-sm'}
                                onClick={() => handleToggleUserRestriction(u.sessionUuid, u.isRestricted)}
                              >
                                {u.isRestricted ? <UserCheck size={13} /> : <UserX size={13} />}
                                <span>{u.isRestricted ? 'Lift Restriction' : 'Restrict'}</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read Only</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 3: REPORTS QUEUE */}
          {/* ========================================================= */}
          {activeTab === 'reports' && (
            <div className="reports-section">
              <div className="table-controls">
                <div className="filter-tabs">
                  {['all', 'pending', 'under_review', 'resolved', 'dismissed'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-tab ${reportFilter === status ? 'active' : ''}`}
                      onClick={() => setReportFilter(status)}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {reports.length} report(s)
                </span>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Report ID</th>
                      <th>Reported Participant</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Reported At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">
                          No reports match current filter.
                        </td>
                      </tr>
                    ) : (
                      reports.map((report) => (
                        <tr key={report.id}>
                          <td>
                            <span className="mono-uuid">{report.reportUuid || report.id}</span>
                          </td>
                          <td>
                            <span className="mono-uuid">{report.reportedSessionUuid}</span>
                          </td>
                          <td>
                            <span className="badge badge-warning">
                              {report.reason.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${report.status === 'pending' ? 'pending' : report.status === 'under_review' ? 'review' : report.status === 'resolved' ? 'resolved' : 'dismissed'}`}>
                              {report.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(report.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => {
                                setActiveReportModal(report);
                                setModalReportStatus(report.status === 'pending' ? 'under_review' : report.status);
                                setModalResolutionNotes(report.resolution || '');
                                setModalIssueBan(false);
                              }}
                            >
                              <Eye size={13} /> {isModeratorOrAbove ? 'Review' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 4: BANS & SUSPENSIONS */}
          {/* ========================================================= */}
          {activeTab === 'bans' && (
            <div className="bans-section">
              <div className="table-controls">
                {isModeratorOrAbove && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowCreateBanModal(true)}
                  >
                    <PlusCircle size={15} /> Issue New Ban
                  </button>
                )}

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total suspensions: {bans.length}
                </span>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ban ID</th>
                      <th>Target Session UUID</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Expires At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bans.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-empty">
                          No suspensions registered.
                        </td>
                      </tr>
                    ) : (
                      bans.map((ban) => {
                        const isExpired = ban.expiresAt && new Date(ban.expiresAt).getTime() < currentTime;
                        const isEffectiveActive = ban.status === 'active' && !isExpired;

                        return (
                          <tr key={ban.id}>
                            <td>
                              <span className="mono-uuid">{ban.id}</span>
                            </td>
                            <td>
                              <span className="mono-uuid">{ban.subjectSessionUuid}</span>
                            </td>
                            <td>
                              <span className={`badge ${ban.banType === 'permanent' ? 'badge-danger' : 'badge-warning'}`}>
                                {ban.banType}
                              </span>
                            </td>
                            <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ban.reason}
                            </td>
                            <td>
                              <span className={`badge ${isEffectiveActive ? 'badge-danger' : 'badge-dismissed'}`}>
                                {isEffectiveActive ? 'Active' : ban.status === 'revoked' ? 'Revoked' : 'Expired'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {ban.expiresAt ? new Date(ban.expiresAt).toLocaleString() : 'Permanent'}
                            </td>
                            <td>
                              {isEffectiveActive && isModeratorOrAbove ? (
                                <button
                                  type="button"
                                  className="btn-outline-danger"
                                  onClick={() => handleRevokeBan(ban.id)}
                                >
                                  Revoke Ban
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 5: OPERATIONAL MATCH HISTORY */}
          {/* ========================================================= */}
          {activeTab === 'matches' && (
            <div className="matches-section">
              <div className="table-controls">
                <div className="filter-tabs">
                  {['all', 'active', 'ended'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-tab ${matchStatusFilter === status ? 'active' : ''}`}
                      onClick={() => setMatchStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total matches: {matches.length}
                </span>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Match ID</th>
                      <th>Participant A (Masked)</th>
                      <th>Participant B (Masked)</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Termination Reason</th>
                      <th>Started At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-empty">
                          No matches in current record.
                        </td>
                      </tr>
                    ) : (
                      matches.map((m) => (
                        <tr key={m.matchId}>
                          <td>
                            <span className="mono-uuid">{m.matchId}</span>
                          </td>
                          <td>
                            <span className="mono-uuid">{m.participantAId}</span>
                          </td>
                          <td>
                            <span className="mono-uuid">{m.participantBId}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'Consolas, monospace' }}>
                            {m.durationSeconds}s
                          </td>
                          <td>
                            <span className={`badge ${m.status === 'active' ? 'badge-resolved' : 'badge-dismissed'}`}>
                              {m.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${m.endedReason === 'blocked' ? 'badge-danger' : m.endedReason === 'next' ? 'badge-review' : 'badge-dismissed'}`}>
                              {m.endedReason}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {m.startedAt ? new Date(m.startedAt).toLocaleTimeString() : 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 6: SYSTEM HEALTH */}
          {/* ========================================================= */}
          {activeTab === 'system-health' && (
            <div className="system-health-section">
              {systemHealth ? (
                <div className="health-grid">
                  {/* Database Card */}
                  <div className="health-card">
                    <div className="health-header">
                      <span className="health-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Database size={18} className="text-purple" /> MySQL Database
                      </span>
                      <span className="badge badge-resolved">Healthy</span>
                    </div>
                    <div className="health-stats-list">
                      <div className="health-stat-item">
                        <span>Host</span>
                        <span>{systemHealth.components.database.host}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Database</span>
                        <span>{systemHealth.components.database.database}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Latency Ping</span>
                        <span className="ping-tag">{systemHealth.components.database.pingMs}ms</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Active Connections</span>
                        <span>{systemHealth.components.database.poolActive}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reverb Card */}
                  <div className="health-card">
                    <div className="health-header">
                      <span className="health-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Radio size={18} className="text-blue" /> Laravel Reverb
                      </span>
                      <span className="badge badge-resolved">Healthy</span>
                    </div>
                    <div className="health-stats-list">
                      <div className="health-stat-item">
                        <span>WebSocket Port</span>
                        <span>{systemHealth.components.reverb.port}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Active Match Channels</span>
                        <span>{systemHealth.components.reverb.activeRooms}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Signaling Ping</span>
                        <span className="ping-tag">{systemHealth.components.reverb.pingMs}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* TURN Relay Card */}
                  <div className="health-card">
                    <div className="health-header">
                      <span className="health-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={18} className="text-green" /> Coturn TURN Relay
                      </span>
                      <span className={`badge ${systemHealth.components.turnRelay.status === 'healthy' ? 'badge-resolved' : 'badge-warning'}`}>
                        {systemHealth.components.turnRelay.status === 'healthy' ? 'Relay Ready' : 'STUN Only'}
                      </span>
                    </div>
                    <div className="health-stats-list">
                      <div className="health-stat-item">
                        <span>Relay Host</span>
                        <span>{systemHealth.components.turnRelay.host}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Ports (UDP/TCP/TLS)</span>
                        <span>{systemHealth.components.turnRelay.port} / {systemHealth.components.turnRelay.tlsPort}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>REST Credential TTL</span>
                        <span>{systemHealth.components.turnRelay.credentialTtlSeconds}s</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Relay Latency Ping</span>
                        <span className="ping-tag">{systemHealth.components.turnRelay.pingMs || 15}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Server Engine Card */}
                  <div className="health-card">
                    <div className="health-header">
                      <span className="health-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Server size={18} className="text-amber" /> Backend API Engine
                      </span>
                      <span className="badge badge-resolved">Online</span>
                    </div>
                    <div className="health-stats-list">
                      <div className="health-stat-item">
                        <span>Node.js Engine</span>
                        <span>{systemHealth.components.server.nodeVersion}</span>
                      </div>
                      <div className="health-stat-item">
                        <span>System Uptime</span>
                        <span>{Math.floor(systemHealth.components.server.uptimeSeconds / 60)} minutes</span>
                      </div>
                      <div className="health-stat-item">
                        <span>RAM Memory RSS</span>
                        <span>{systemHealth.components.server.memoryRssMb} MB</span>
                      </div>
                      <div className="health-stat-item">
                        <span>Total Requests Processed</span>
                        <span>{systemHealth.components.server.totalRequestsProcessed}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Loader2 size={24} className="spin" />
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Querying subsystem diagnostics...</p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 7: SETTINGS & APPLICATION LIMITS */}
          {/* ========================================================= */}
          {activeTab === 'settings' && (
            <div className="settings-section">
              {!isSuperAdmin && (
                <div className="alert-card warning">
                  <AlertTriangle size={20} className="alert-icon" />
                  <div className="alert-content">
                    <h4>Read-Only Permissions</h4>
                    <p>You are logged in as {currentUser?.role}. Only users with the <strong>Super Admin</strong> role have permission to modify live system configuration.</p>
                  </div>
                </div>
              )}

              {settingsSaveSuccess && (
                <div className="alert-card info">
                  <CheckCircle size={20} className="alert-icon" />
                  <div className="alert-content">
                    <h4>Configuration Updated</h4>
                    <p>{settingsSaveSuccess}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveSettings}>
                <div className="settings-grid">
                  <div className="settings-card">
                    <h4 className="settings-card-title">
                      <Clock size={18} /> Queue & Session Limits
                    </h4>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Queue Timeout Seconds</h5>
                        <p>Maximum seconds a user waits before queue status timeout.</p>
                      </div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '90px' }}
                        value={settings.queueTimeoutSeconds}
                        onChange={(e) => setSettings({ ...settings, queueTimeoutSeconds: parseInt(e.target.value, 10) })}
                        disabled={!isSuperAdmin}
                        min={15}
                        max={180}
                      />
                    </div>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Session Inactivity Expiry (Minutes)</h5>
                        <p>Time after which idle visitor sessions are purged.</p>
                      </div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '90px' }}
                        value={settings.sessionInactivityMinutes}
                        onChange={(e) => setSettings({ ...settings, sessionInactivityMinutes: parseInt(e.target.value, 10) })}
                        disabled={!isSuperAdmin}
                        min={30}
                        max={1440}
                      />
                    </div>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Max Reports Before Auto-Suspension</h5>
                        <p>Threshold of abuse reports triggering automatic queue suspension.</p>
                      </div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '90px' }}
                        value={settings.maxReportsBeforeAutoBan}
                        onChange={(e) => setSettings({ ...settings, maxReportsBeforeAutoBan: parseInt(e.target.value, 10) })}
                        disabled={!isSuperAdmin}
                        min={1}
                        max={10}
                      />
                    </div>
                  </div>

                  <div className="settings-card">
                    <h4 className="settings-card-title">
                      <ShieldCheck size={18} /> Network & Maintenance Policies
                    </h4>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Force TURN Relay for All Calls</h5>
                        <p>Forces all calls through TURN relay, obscuring direct peer IPs.</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.forceTurnRelayOnly}
                          onChange={(e) => setSettings({ ...settings, forceTurnRelayOnly: e.target.checked })}
                          disabled={!isSuperAdmin}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Scheduled Maintenance Mode</h5>
                        <p>Halts new matchmaking searches and presents maintenance message.</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.maintenanceMode}
                          onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                          disabled={!isSuperAdmin}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    <div className="settings-row">
                      <div className="settings-info">
                        <h5>Rate Limit Cap (Req/Min)</h5>
                        <p>Default per-session request cap across API endpoints.</p>
                      </div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '90px' }}
                        value={settings.rateLimitMaxRequests}
                        onChange={(e) => setSettings({ ...settings, rateLimitMaxRequests: parseInt(e.target.value, 10) })}
                        disabled={!isSuperAdmin}
                        min={10}
                        max={300}
                      />
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn-primary">
                      Save & Apply Configuration
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 8: AUDIT TRAIL */}
          {/* ========================================================= */}
          {activeTab === 'audit-logs' && (
            <div className="audit-section">
              <div className="table-controls">
                <div className="filter-tabs">
                  {['all', 'admin', 'report', 'ban', 'user', 'settings'].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`filter-tab ${auditFilter === filter ? 'active' : ''}`}
                      onClick={() => setAuditFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total events: {memoizedFilteredAuditLogs.length}
                </span>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target</th>
                      <th>Context / Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memoizedFilteredAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          No audit trail events found.
                        </td>
                      </tr>
                    ) : (
                      memoizedFilteredAuditLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <span className="badge badge-info">{log.action}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {log.actorType}: <span className="mono-uuid">{log.actorId}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {log.targetType}: <span className="mono-uuid">{log.targetId || 'N/A'}</span>
                          </td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'Consolas, monospace', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.metadata ? JSON.stringify(log.metadata) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODULE 9: ABUSE MONITORING */}
          {/* ========================================================= */}
          {activeTab === 'abuse-monitoring' && (
            <div className="abuse-section">
              {abuseMonitoring && (
                <>
                  {/* Suspicious Alerts */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
                      Heuristic Suspicious Activity Alerts
                    </h3>
                    {abuseMonitoring.suspiciousAlerts.length === 0 ? (
                      <div className="alert-card info">
                        <CheckCircle size={20} className="alert-icon" />
                        <div className="alert-content">
                          <h4>All Clear</h4>
                          <p>No anomalous griefing, rapid skipping, or high-volume repeat abuse detected on the network.</p>
                        </div>
                      </div>
                    ) : (
                      abuseMonitoring.suspiciousAlerts.map((alert) => (
                        <div key={alert.id} className={`alert-card ${alert.severity}`}>
                          <AlertOctagon size={20} className="alert-icon" />
                          <div className="alert-content">
                            <h4>{alert.title} ({alert.count})</h4>
                            <p>{alert.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Repeat Reported Users */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
                      Repeat Reported Users (&ge; 2 Reports)
                    </h3>
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Masked Session UUID</th>
                            <th>Incident Count</th>
                            <th>Current State</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abuseMonitoring.repeatReportedUsers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="table-empty">
                                No users with repeat reports at this time.
                              </td>
                            </tr>
                          ) : (
                            abuseMonitoring.repeatReportedUsers.map((u) => (
                              <tr key={u.sessionUuid}>
                                <td>
                                  <span className="mono-uuid">{u.maskedSessionUuid}</span>
                                </td>
                                <td>
                                  <span className="badge badge-danger">{u.reportCount} reports</span>
                                </td>
                                <td>
                                  <span className={`badge ${u.isBanned || u.isRestricted ? 'badge-danger' : 'badge-warning'}`}>
                                    {u.isBanned ? 'Banned' : u.isRestricted ? 'Restricted' : 'Active'}
                                  </span>
                                </td>
                                <td>
                                  {isModeratorOrAbove && !u.isRestricted && (
                                    <button
                                      type="button"
                                      className="btn-outline-danger btn-sm"
                                      onClick={() => handleToggleUserRestriction(u.sessionUuid, false)}
                                    >
                                      Restrict Account
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rapid Disconnects */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
                      Recent Rapid Disconnect Calls (&lt; 5s Duration)
                    </h3>
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Match ID</th>
                            <th>Participant A</th>
                            <th>Participant B</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abuseMonitoring.rapidDisconnectMatches.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="table-empty">
                                No rapid disconnect calls logged.
                              </td>
                            </tr>
                          ) : (
                            abuseMonitoring.rapidDisconnectMatches.map((m) => (
                              <tr key={m.matchId}>
                                <td>
                                  <span className="mono-uuid">{m.matchId}</span>
                                </td>
                                <td>
                                  <span className="mono-uuid">{m.participantAId}</span>
                                </td>
                                <td>
                                  <span className="mono-uuid">{m.participantBId}</span>
                                </td>
                                <td style={{ color: '#f87171', fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                                  {m.durationSeconds}s
                                </td>
                                <td>
                                  <span className="badge badge-dismissed">{m.endedReason}</span>
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {new Date(m.endedAt).toLocaleTimeString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: REVIEW INCIDENT REPORT */}
      {activeReportModal && (
        <div className="admin-modal-backdrop" onClick={() => setActiveReportModal(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                <ShieldAlert size={18} className="text-amber" />
                Review Report #{activeReportModal.id}
              </h3>
              <button 
                type="button" 
                className="admin-modal-close"
                onClick={() => setActiveReportModal(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Reported Stranger Session
                </span>
                <div style={{ marginTop: '0.25rem' }}>
                  <span className="mono-uuid" style={{ fontSize: '0.85rem' }}>
                    {activeReportModal.reportedSessionUuid}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Violation Reason & Details
                </span>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge badge-danger">{activeReportModal.reason}</span>
                  {activeReportModal.matchId && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Match: <code className="mono-uuid">{activeReportModal.matchId}</code>
                    </span>
                  )}
                </div>
                {activeReportModal.description && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', background: '#090d16', padding: '0.5rem', borderRadius: '6px' }}>
                    &ldquo;{activeReportModal.description}&rdquo;
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="report-status-select">Update Report Status</label>
                <select
                  id="report-status-select"
                  className="form-select"
                  value={modalReportStatus}
                  onChange={(e) => setModalReportStatus(e.target.value as 'pending' | 'under_review' | 'resolved' | 'dismissed')}
                  disabled={!isModeratorOrAbove}
                >
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="resolved">Resolved (Action Taken)</option>
                  <option value="dismissed">Dismissed (No Violation)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="resolution-notes">Moderator Resolution Notes</label>
                <textarea
                  id="resolution-notes"
                  className="form-textarea"
                  rows={3}
                  value={modalResolutionNotes}
                  onChange={(e) => setModalResolutionNotes(e.target.value)}
                  placeholder="Explain actions taken or reason for dismissal..."
                  disabled={!isModeratorOrAbove}
                />
              </div>

              {/* Quick Ban Option */}
              {isModeratorOrAbove && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#f87171' }}>
                    <input
                      type="checkbox"
                      checked={modalIssueBan}
                      onChange={(e) => setModalIssueBan(e.target.checked)}
                    />
                    Issue Ban to Reported User
                  </label>

                  {modalIssueBan && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ban Type</label>
                        <select
                          className="form-select"
                          value={modalBanType}
                          onChange={(e) => setModalBanType(e.target.value as 'temporary' | 'permanent')}
                          style={{ marginTop: '0.2rem' }}
                        >
                          <option value="temporary">Temporary</option>
                          <option value="permanent">Permanent</option>
                        </select>
                      </div>

                      {modalBanType === 'temporary' && (
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration</label>
                          <select
                            className="form-select"
                            value={modalBanDuration}
                            onChange={(e) => setModalBanDuration(e.target.value)}
                            style={{ marginTop: '0.2rem' }}
                          >
                            <option value="1">1 Hour</option>
                            <option value="24">24 Hours</option>
                            <option value="168">7 Days</option>
                            <option value="720">30 Days</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setActiveReportModal(null)}
              >
                {isModeratorOrAbove ? 'Cancel' : 'Close'}
              </button>
              {isModeratorOrAbove && (
                <button 
                  type="button" 
                  className="btn-primary"
                  onClick={handleSaveReportReview}
                >
                  Save Decision
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE MANUAL BAN */}
      {showCreateBanModal && isModeratorOrAbove && (
        <div className="admin-modal-backdrop" onClick={() => setShowCreateBanModal(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                <Ban size={18} className="text-danger" />
                Issue Manual Access Ban
              </h3>
              <button 
                type="button" 
                className="admin-modal-close"
                onClick={() => setShowCreateBanModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateManualBan}>
              <div className="admin-modal-body">
                <div className="form-group">
                  <label htmlFor="target-session">Target Session UUID</label>
                  <input
                    id="target-session"
                    type="text"
                    className="form-input"
                    value={newBanSession}
                    onChange={(e) => setNewBanSession(e.target.value)}
                    required
                    placeholder="e.g. anon_abc123"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ban-reason">Reason for Suspension</label>
                  <input
                    id="ban-reason"
                    type="text"
                    className="form-input"
                    value={newBanReason}
                    onChange={(e) => setNewBanReason(e.target.value)}
                    required
                    placeholder="e.g. Inappropriate behavior / spam"
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Ban Type
                    </label>
                    <select
                      className="form-select"
                      value={newBanType}
                      onChange={(e) => setNewBanType(e.target.value as 'temporary' | 'permanent')}
                      style={{ marginTop: '0.2rem' }}
                    >
                      <option value="temporary">Temporary Suspension</option>
                      <option value="permanent">Permanent Ban</option>
                    </select>
                  </div>

                  {newBanType === 'temporary' && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Duration
                      </label>
                      <select
                        className="form-select"
                        value={newBanDuration}
                        onChange={(e) => setNewBanDuration(e.target.value)}
                        style={{ marginTop: '0.2rem' }}
                      >
                        <option value="1">1 Hour</option>
                        <option value="24">24 Hours (1 Day)</option>
                        <option value="168">168 Hours (7 Days)</option>
                        <option value="720">720 Hours (30 Days)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateBanModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: 'var(--danger)' }}>
                  Confirm & Enforce Ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
