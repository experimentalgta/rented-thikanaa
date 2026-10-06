import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  Eye,
  Trash2,
  ExternalLink,
  Lock,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Edit,
  UserCheck,
  UserX,
  MessageSquare,
  Megaphone,
  Settings,
  Clock,
  ArrowLeft,
  Phone,
  Mail,
  Check,
  AlertCircle,
  Sparkles,
  MapPin,
  ChevronRight,
  TrendingUp,
  FileText,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Property,
  Report,
  AdminPlatformStats,
  AdminUserRecord,
  AdminAnnouncement,
  AdminAuditLog,
  PlatformSettings,
  AccountType,
} from '../types';
import { adminRepository } from '../services/adminRepository';
import { serverAuth } from '../services/serverAuth';
import { Button } from '../components/common/Button';

interface AdminDashboardProps {
  onSelectProperty: (property: Property) => void;
  onNavigateHome?: () => void;
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'listings'
  | 'reports'
  | 'chats'
  | 'broadcasts'
  | 'logs'
  | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSelectProperty,
  onNavigateHome,
}) => {
  const { currentUser, isSuperAdmin, signInWithGoogle } = useAuth();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Loading & Authorization states
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data states
  const [stats, setStats] = useState<AdminPlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    adminRepository.getPlatformSettings()
  );

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'students' | 'owners' | 'admins' | 'blocked'>('all');

  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<'all' | 'available' | 'rented' | 'unverified' | 'verified'>('all');
  const [listingCityFilter, setListingCityFilter] = useState<string>('all');

  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // Modals state
  const [viewingUser, setViewingUser] = useState<AdminUserRecord | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRent, setEditRent] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<Property['availability_status']>('available');

  // Destructive Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Broadcast creation form
  const [isNewBroadcastOpen, setIsNewBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<AdminAnnouncement['type']>('info');
  const [broadcastAudience, setBroadcastAudience] = useState<AdminAnnouncement['target_audience']>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const authorized = await serverAuth.verifySuperAdminAuthorization(
        currentUser?.id,
        currentUser?.email
      );
      setIsAuthorized(authorized);

      if (authorized && currentUser?.id) {
        // Parallel data fetch
        const [
          statsData,
          usersData,
          propsData,
          reportsData,
          chatsData,
        ] = await Promise.all([
          adminRepository.getPlatformStats(currentUser.id),
          adminRepository.getAllUsers(currentUser.id),
          adminRepository.getAllListings(currentUser.id),
          adminRepository.getReports(currentUser.id),
          adminRepository.getModerationConversations(currentUser.id),
        ]);

        setStats(statsData);
        setUsers(usersData);
        setProperties(propsData);
        setReports(reportsData);
        setConversations(chatsData);
        setAnnouncements(adminRepository.getAnnouncements());
        setAuditLogs(adminRepository.getAuditLogs());
        setPlatformSettings(adminRepository.getPlatformSettings());
      }
    } catch (e) {
      console.error('[AdminDashboard] Failed to load data:', e);
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, [currentUser?.id, currentUser?.email]);

  // =========================================================================
  // ACTIONS HANDLERS
  // =========================================================================

  // User Actions
  const handleToggleUserBlock = (user: AdminUserRecord) => {
    const isBlocking = !user.is_blocked;
    setConfirmDialog({
      isOpen: true,
      title: isBlocking ? `Suspend & Ban User ${user.full_name}?` : `Reinstate User ${user.full_name}?`,
      message: isBlocking
        ? `This user (${user.email}) will immediately be blocked from logging in, creating listings, and sending messages.`
        : `This will restore account access and permit the user to use the platform normally.`,
      actionLabel: isBlocking ? 'Yes, Ban Account' : 'Yes, Reinstate',
      variant: isBlocking ? 'danger' : 'warning',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await adminRepository.updateUserStatus(
            user.id,
            { is_blocked: isBlocking },
            currentUser?.id,
            currentUser?.full_name
          );
          showToast(`User ${user.full_name} has been ${isBlocking ? 'suspended' : 'reinstated'}.`);
          await loadAllAdminData();
        } catch (err: any) {
          alert(`Error: ${err.message}`);
        } finally {
          setActionLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleToggleUserVerify = async (user: AdminUserRecord) => {
    const isVerifying = !user.is_verified;
    setActionLoading(true);
    try {
      await adminRepository.updateUserStatus(
        user.id,
        { is_verified: isVerifying },
        currentUser?.id,
        currentUser?.full_name
      );
      showToast(`User ${user.full_name} verification status updated.`);
      await loadAllAdminData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserRole = (user: AdminUserRecord) => {
    const newRole: AccountType = user.account_type === 'super_admin' ? 'user' : 'super_admin';
    setConfirmDialog({
      isOpen: true,
      title: newRole === 'super_admin' ? `Promote ${user.full_name} to Super Admin?` : `Demote ${user.full_name} to Regular User?`,
      message: newRole === 'super_admin'
        ? `Granting Super Admin permissions allows this user to verify listings, ban members, and edit platform data.`
        : `Demoting this user will revoke all administrative moderation access immediately.`,
      actionLabel: newRole === 'super_admin' ? 'Promote to Admin' : 'Revoke Admin Access',
      variant: 'warning',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await adminRepository.updateUserStatus(
            user.id,
            { account_type: newRole },
            currentUser?.id,
            currentUser?.full_name
          );
          showToast(`Role for ${user.full_name} updated to ${newRole}.`);
          await loadAllAdminData();
        } catch (err: any) {
          alert(`Error: ${err.message}`);
        } finally {
          setActionLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // Listing Actions
  const handleVerifyProperty = async (prop: Property) => {
    setActionLoading(true);
    try {
      await adminRepository.verifyListing(prop.id, prop.title, currentUser?.id, currentUser?.full_name);
      showToast(`Verified: "${prop.title}" received Platform Verified badge.`);
      await loadAllAdminData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnverifyProperty = async (prop: Property) => {
    setActionLoading(true);
    try {
      await adminRepository.unverifyListing(prop.id, prop.title, currentUser?.id, currentUser?.full_name);
      showToast(`Verification badge removed from "${prop.title}".`);
      await loadAllAdminData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePropertyStatus = async (prop: Property, status: Property['availability_status']) => {
    setActionLoading(true);
    try {
      await adminRepository.updateListing(
        prop.id,
        { availability_status: status },
        currentUser?.id,
        currentUser?.full_name
      );
      showToast(`Listing status updated to ${status}.`);
      await loadAllAdminData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProperty = (prop: Property) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Listing: "${prop.title}"?`,
      message: `This will permanently remove this room listing from the database and search results. This action cannot be undone.`,
      actionLabel: 'Yes, Delete Listing',
      variant: 'danger',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await adminRepository.deleteListing(prop.id, prop.title, currentUser?.id, currentUser?.full_name);
          showToast(`Listing "${prop.title}" permanently deleted.`);
          await loadAllAdminData();
        } catch (err: any) {
          alert(`Error: ${err.message}`);
        } finally {
          setActionLoading(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleSaveListingEdit = async () => {
    if (!editingProperty) return;
    setActionLoading(true);
    try {
      await adminRepository.updateListing(
        editingProperty.id,
        {
          title: editTitle,
          rent: editRent,
          availability_status: editStatus,
        },
        currentUser?.id,
        currentUser?.full_name
      );
      showToast(`Listing "${editTitle}" successfully updated.`);
      setEditingProperty(null);
      await loadAllAdminData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Report Actions
  const handleReportAction = async (report: Report, status: Report['status']) => {
    setActionLoading(true);
    try {
      await adminRepository.updateReportStatus(
        report.id,
        status,
        status === 'action_taken' ? 'Delisted & resolved by Super Admin' : 'Dismissed upon review',
        currentUser?.id,
        currentUser?.full_name
      );
      showToast(`Report updated to "${status}".`);
      await loadAllAdminData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Broadcast Actions
  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setActionLoading(true);
    try {
      await adminRepository.saveAnnouncement(
        {
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          type: broadcastType,
          target_audience: broadcastAudience,
          is_active: true,
          author_name: currentUser?.full_name || 'Super Admin',
        },
        currentUser?.id,
        currentUser?.full_name
      );
      showToast('Announcement broadcasted to active platform stream.');
      setBroadcastTitle('');
      setBroadcastMessage('');
      setIsNewBroadcastOpen(false);
      setAnnouncements(adminRepository.getAnnouncements());
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    await adminRepository.deleteAnnouncement(id, currentUser?.id, currentUser?.full_name);
    setAnnouncements(adminRepository.getAnnouncements());
    showToast('Broadcast removed.');
  };

  const handleToggleBroadcast = async (id: string, active: boolean) => {
    await adminRepository.toggleAnnouncement(id, active, currentUser?.id);
    setAnnouncements(adminRepository.getAnnouncements());
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await adminRepository.savePlatformSettings(platformSettings, currentUser?.id, currentUser?.full_name);
      showToast('Platform settings saved successfully.');
      setAuditLogs(adminRepository.getAuditLogs());
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // FILTERED DATA VIEWS
  // =========================================================================

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase().trim();
      const matchQ =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone_number && u.phone_number.includes(q)) ||
        (u.college && u.college.toLowerCase().includes(q));

      if (!matchQ) return false;

      if (userRoleFilter === 'students') return u.student_profile !== undefined;
      if (userRoleFilter === 'owners') return (u.listings_count || 0) > 0;
      if (userRoleFilter === 'admins') return u.account_type === 'super_admin';
      if (userRoleFilter === 'blocked') return u.is_blocked;
      return true;
    });
  }, [users, userSearch, userRoleFilter]);

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const q = listingSearch.toLowerCase().trim();
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        p.owner_name.toLowerCase().includes(q);

      if (!matchQ) return false;

      if (listingCityFilter !== 'all' && (p.city || '').toLowerCase() !== listingCityFilter.toLowerCase()) {
        return false;
      }

      if (listingStatusFilter === 'available') return p.availability_status === 'available';
      if (listingStatusFilter === 'rented') return p.availability_status === 'rented';
      if (listingStatusFilter === 'verified') return p.is_verified;
      if (listingStatusFilter === 'unverified') return !p.is_verified;

      return true;
    });
  }, [properties, listingSearch, listingStatusFilter, listingCityFilter]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      if (p.city) set.add(p.city.trim());
    });
    return Array.from(set);
  }, [properties]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportStatusFilter === 'pending') return r.status === 'pending';
      if (reportStatusFilter === 'resolved') return r.status !== 'pending';
      return true;
    });
  }, [reports, reportStatusFilter]);

  // =========================================================================
  // GUARD SCREEN: LOADING & 403 ACCESS DENIED
  // =========================================================================

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="font-bold text-slate-900 text-lg">Verifying Administrative Privileges</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Strictly confirming cryptographic identity and server-side Supabase Super Admin authorization...
        </p>
      </div>
    );
  }

  // Not authenticated or not an authorized Super Admin
  if (isAuthorized === false) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              Super Admin Gate
            </span>
            <h1 className="text-2xl font-black text-[#101828] font-heading mt-3">
              Restricted Area
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This portal is reserved exclusively for the authorized platform administrators of Rented Thikanaa.
            </p>
          </div>

          {currentUser ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">Signed in as:</p>
              <p className="text-slate-600 font-mono text-[11px] truncate">{currentUser.email}</p>
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                ⚠️ This account does not possess Super Admin permissions.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600" /> Authentication Required
              </p>
              <p className="text-[11px] text-amber-800">
                Please sign in with your authorized Google Super Admin account (<span className="font-mono">ujjwalmaurya2@gmail.com</span>).
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={() => signInWithGoogle()}
              className="w-full py-3 px-4 rounded-xl bg-[#101828] hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
              <span>Sign In with Google Super Admin</span>
            </button>

            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-full py-2.5 px-4 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
              >
                ← Return to Public Website
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUPER ADMIN MAIN DASHBOARD
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#101828] text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-[#F59E0B] shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Admin Top Header Banner */}
      <header className="bg-[#101828] text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Back to Rentit"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-[#F59E0B] border border-amber-500/30 flex items-center justify-center font-black text-sm">
                R
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-sm sm:text-base font-heading tracking-tight">
                    Rentit Super Admin
                  </h1>
                  <span className="text-[9px] uppercase font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full tracking-wider">
                    PROD
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Trust &amp; Safety • User Governance • Content Moderation
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Supabase status indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase Connected</span>
            </div>

            {/* Admin identity pill */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[140px]">
                {currentUser?.full_name || 'Ujjwal Maurya'}
              </span>
            </div>

            <button
              onClick={() => loadAllAdminData()}
              disabled={actionLoading}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Platform Data"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Sub-Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none flex gap-1 border-t border-slate-800/60 pt-1 pb-1.5">
          {[
            { id: 'overview', label: 'Dashboard', icon: TrendingUp },
            { id: 'users', label: `Users (${users.length})`, icon: Users },
            { id: 'listings', label: `Listings (${properties.length})`, icon: Building2 },
            { id: 'reports', label: `Reports (${reports.filter((r) => r.status === 'pending').length})`, icon: AlertTriangle, badge: reports.filter((r) => r.status === 'pending').length },
            { id: 'chats', label: 'Moderation Chats', icon: MessageSquare },
            { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
            { id: 'logs', label: 'Audit Logs', icon: Clock },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* =========================================================================
            TAB 1: OVERVIEW DASHBOARD
        ========================================================================= */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Users
                </span>
                <span className="text-2xl font-black text-slate-900 font-heading">
                  {stats.totalUsers}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-semibold">
                  {stats.verifiedUsers} Verified
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Listings
                </span>
                <span className="text-2xl font-black text-slate-900 font-heading">
                  {stats.totalProperties}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-semibold">
                  {stats.verifiedProperties} Verified
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Available Rooms
                </span>
                <span className="text-2xl font-black text-emerald-700 font-heading">
                  {stats.availableProperties}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {stats.rentedProperties} Marked Rented
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Student Roommates
                </span>
                <span className="text-2xl font-black text-indigo-700 font-heading">
                  {stats.activeRoommates}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Profiles Online
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pending Reports
                </span>
                <span className={`text-2xl font-black font-heading ${
                  stats.pendingReports > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {stats.pendingReports}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {stats.resolvedReports} Resolved
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Covered Cities
                </span>
                <span className="text-2xl font-black text-amber-700 font-heading">
                  {stats.totalCities}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {stats.activeLocalities} Localities
                </span>
              </div>
            </div>

            {/* Quick Actions & Moderation Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Unverified Listings Quick Review */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 font-heading">
                      Listings Awaiting Moderation
                    </h3>
                    <p className="text-xs text-slate-500">
                      Unverified accommodations requiring physical or phone authenticity review.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('listings');
                      setListingStatusFilter('unverified');
                    }}
                    className="text-xs font-bold text-amber-800 hover:text-amber-900 cursor-pointer"
                  >
                    View All ({properties.filter((p) => !p.is_verified).length}) →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {properties.filter((p) => !p.is_verified).slice(0, 5).map((prop) => (
                    <div key={prop.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={prop.images[0]?.url || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{prop.title}</h4>
                          <p className="text-[11px] text-slate-500">
                            {prop.locality} • ₹{prop.rent.toLocaleString('en-IN')}/mo • Lister: {prop.owner_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onSelectProperty(prop)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          Inspect
                        </button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleVerifyProperty(prop)}
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Verify
                        </Button>
                      </div>
                    </div>
                  ))}

                  {properties.filter((p) => !p.is_verified).length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                      All current listings have been reviewed and verified!
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Platform Audit Feed & Quick Broadcast */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 font-heading flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Recent Administrative Logs</span>
                  </h3>

                  <div className="space-y-3">
                    {auditLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate max-w-[150px]">
                            {log.target_title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{log.details}</p>
                        <p className="text-[9px] text-amber-800 font-medium pt-0.5">by {log.admin_name}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTab('logs')}
                    className="w-full text-center text-xs font-bold text-slate-600 hover:text-slate-900 pt-2 block cursor-pointer"
                  >
                    View Complete Audit Trail →
                  </button>
                </div>

                {/* System Controls Mini-Widget */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                      Instant Platform Action
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Broadcast urgent alerts or admissions notices to all students and property owners.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('broadcasts');
                      setIsNewBroadcastOpen(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    + Publish Global Announcement
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USER MANAGEMENT
        ========================================================================= */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  User Directory &amp; Permissions
                </h2>
                <p className="text-xs text-slate-500">
                  Inspect student profiles, lister identities, and manage suspensions or role elevations.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name, email, phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
              {[
                { id: 'all', label: `All Users (${users.length})` },
                { id: 'students', label: `Students (${users.filter((u) => u.student_profile).length})` },
                { id: 'owners', label: `Property Owners (${users.filter((u) => (u.listings_count || 0) > 0).length})` },
                { id: 'admins', label: `Super Admins (${users.filter((u) => u.account_type === 'super_admin').length})` },
                { id: 'blocked', label: `Suspended (${users.filter((u) => u.is_blocked).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setUserRoleFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    userRoleFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">User</th>
                    <th className="py-3 px-3">Account Type</th>
                    <th className="py-3 px-3">Listings</th>
                    <th className="py-3 px-3">Verification</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 font-heading">
                              {user.full_name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{user.full_name}</p>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {user.account_type === 'super_admin' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] uppercase border border-amber-300">
                            Super Admin
                          </span>
                        ) : user.student_profile ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                            Student
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            Member
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-700">
                        {user.listings_count || 0}
                      </td>

                      <td className="py-3.5 px-3">
                        {user.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Unverified</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        {user.is_blocked ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                            Suspended
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingUser(user)}
                            className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                            title="View Profile Details"
                          >
                            Details
                          </button>

                          <button
                            onClick={() => handleToggleUserVerify(user)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              user.is_verified
                                ? 'border-slate-200 text-slate-500 hover:bg-slate-100'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={user.is_verified ? 'Revoke Verification' : 'Issue Verified Badge'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {user.account_type !== 'super_admin' && (
                            <button
                              onClick={() => handleToggleUserBlock(user)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                user.is_blocked
                                  ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              }`}
                              title={user.is_blocked ? 'Reinstate User' : 'Suspend & Ban User'}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleUserRole(user)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 text-slate-500 hover:text-amber-800 transition-colors cursor-pointer"
                            title={user.account_type === 'super_admin' ? 'Demote from Admin' : 'Promote to Admin'}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No users match the search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: LISTINGS & CONTENT MANAGEMENT
        ========================================================================= */}
        {activeTab === 'listings' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  Accommodations &amp; Listing Inventory
                </h2>
                <p className="text-xs text-slate-500">
                  Audit room listings, verify amenities, modify rent pricing, and manage availability states.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search title, locality, owner..."
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Filter controls row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: `All (${properties.length})` },
                  { id: 'available', label: `Available (${properties.filter((p) => p.availability_status === 'available').length})` },
                  { id: 'rented', label: `Rented (${properties.filter((p) => p.availability_status === 'rented').length})` },
                  { id: 'verified', label: `Verified (${properties.filter((p) => p.is_verified).length})` },
                  { id: 'unverified', label: `Unverified (${properties.filter((p) => !p.is_verified).length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setListingStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      listingStatusFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* City filter dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-semibold">City:</span>
                <select
                  value={listingCityFilter}
                  onChange={(e) => setListingCityFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                >
                  <option value="all">All Cities</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="space-y-2">
                    <div className="relative">
                      <img
                        src={prop.images[0]?.url || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'}
                        alt=""
                        className="w-full h-36 rounded-xl object-cover border border-slate-200"
                      />
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          prop.availability_status === 'available'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-200'
                        }`}>
                          {prop.availability_status}
                        </span>
                        {prop.is_verified && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      <span className="absolute bottom-2 right-2 bg-slate-950/80 text-white font-black text-xs px-2 py-0.5 rounded-md">
                        ₹{prop.rent.toLocaleString('en-IN')}/mo
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{prop.title}</h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{prop.locality}, {prop.city}</span>
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Lister: <strong className="text-slate-800">{prop.owner_name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1 text-xs">
                    <button
                      onClick={() => onSelectProperty(prop)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-slate-700 font-semibold text-[11px] cursor-pointer"
                    >
                      View Live
                    </button>

                    <div className="flex items-center gap-1">
                      {prop.is_verified ? (
                        <button
                          onClick={() => handleUnverifyProperty(prop)}
                          className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] cursor-pointer"
                          title="Remove Verified Badge"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerifyProperty(prop)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Verify
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingProperty(prop);
                          setEditTitle(prop.title);
                          setEditRent(prop.rent);
                          setEditStatus(prop.availability_status);
                        }}
                        className="p-1 rounded-lg border border-slate-200 hover:bg-white text-slate-600 cursor-pointer"
                        title="Edit Listing Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteProperty(prop)}
                        className="p-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete Listing"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredProperties.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-slate-500">
                  No accommodations found matching criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: REPORTS & TRUST SAFETY
        ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  Flagged Content &amp; Safety Complaints
                </h2>
                <p className="text-xs text-slate-500">
                  Process abuse flags submitted by students and landlords regarding fake listings, harassment, or pricing fraud.
                </p>
              </div>

              <div className="flex gap-1.5">
                {[
                  { id: 'all', label: `All (${reports.length})` },
                  { id: 'pending', label: `Pending (${reports.filter((r) => r.status === 'pending').length})` },
                  { id: 'resolved', label: `Resolved (${reports.filter((r) => r.status !== 'pending').length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setReportStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      reportStatusFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3.5">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                        {report.reason.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-xs text-slate-900">
                        Target: {report.reported_entity_name} ({report.reported_entity_type})
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400">
                      Reported by {report.reporter_name} • {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {report.notes && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                      <strong className="text-slate-900 block text-[11px] mb-0.5">Reporter Statement:</strong>
                      "{report.notes}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Status:</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        report.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : report.status === 'action_taken'
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {report.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReportAction(report, 'dismissed')}
                        >
                          Dismiss Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleReportAction(report, 'action_taken')}
                        >
                          Take Action / Delist
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredReports.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  No safety complaints in this queue.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: CHAT & CONVERSATION MODERATION
        ========================================================================= */}
        {activeTab === 'chats' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Peer-to-Peer Chat Stream Audit
              </h2>
              <p className="text-xs text-slate-500">
                Oversight of active negotiation threads. Privacy safeguards mask sensitive credentials while tracking safety.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {conversations.map((conv) => (
                <div key={conv.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {conv.participant_a_name} ↔ {conv.participant_b_name}
                      </span>
                      <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                        {conv.property_title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 italic">
                      "{conv.last_message}"
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 shrink-0">
                    {conv.last_message_time}
                  </div>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No chat conversations on record yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: BROADCASTS & ANNOUNCEMENTS
        ========================================================================= */}
        {activeTab === 'broadcasts' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading">
                  Platform Broadcast Announcements
                </h2>
                <p className="text-xs text-slate-500">
                  Publish banners and alerts visible to students, landlords, or all site visitors.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewBroadcastOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                New Announcement
              </Button>
            </div>

            {/* New Broadcast Modal / Form */}
            {isNewBroadcastOpen && (
              <form onSubmit={handleCreateBroadcast} className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-amber-950 uppercase tracking-wider">
                    Create New Platform Broadcast
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsNewBroadcastOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Allahabad University Entrance Exam PGs Live!"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Message Content</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Enter announcement details shown to users..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Alert Type</label>
                      <select
                        value={broadcastType}
                        onChange={(e) => setBroadcastType(e.target.value as any)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl font-medium"
                      >
                        <option value="info">Information (Blue)</option>
                        <option value="promo">Feature / Promo (Amber)</option>
                        <option value="warning">Safety Warning (Orange)</option>
                        <option value="emergency">Emergency / Alert (Red)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Audience</label>
                      <select
                        value={broadcastAudience}
                        onChange={(e) => setBroadcastAudience(e.target.value as any)}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl font-medium"
                      >
                        <option value="all">All Visitors</option>
                        <option value="students">Students Only</option>
                        <option value="owners">Landlords / Hosts Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="submit" variant="primary" size="sm">
                    Publish Broadcast
                  </Button>
                </div>
              </form>
            )}

            {/* Broadcasts List */}
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        ann.type === 'emergency'
                          ? 'bg-rose-500 text-white'
                          : ann.type === 'warning'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-indigo-600 text-white'
                      }`}>
                        {ann.type}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900">{ann.title}</h4>
                      <span className="text-[10px] text-slate-400">
                        Target: <strong className="capitalize">{ann.target_audience}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{ann.message}</p>
                    <p className="text-[10px] text-slate-400">
                      Published {new Date(ann.created_at).toLocaleDateString()} by {ann.author_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleBroadcast(ann.id, !ann.is_active)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                        ann.is_active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      {ann.is_active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() => handleDeleteBroadcast(ann.id)}
                      className="p-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 7: AUDIT LOGS
        ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Security &amp; Administrative Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Permanent immutable record of verification badges, delistings, user bans, and settings modifications.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 font-mono">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <strong className="text-xs text-slate-900">{log.target_title}</strong>
                      <span className="text-[10px] text-slate-400">({log.target_type})</span>
                    </div>
                    <p className="text-xs text-slate-600">{log.details}</p>
                    <p className="text-[10px] text-slate-400">Moderator: {log.admin_name}</p>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}

              {auditLogs.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500">
                  No logged actions yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 8: PLATFORM SETTINGS
        ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Platform Configuration &amp; Safety Policies
              </h2>
              <p className="text-xs text-slate-500">
                System support phone numbers, emergency contact protocols, and moderation defaults.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5 max-w-2xl">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Platform Brand Name</label>
                  <input
                    type="text"
                    value={platformSettings.platform_name}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, platform_name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Helpline Phone</label>
                    <input
                      type="text"
                      value={platformSettings.support_phone}
                      onChange={(e) => setPlatformSettings({ ...platformSettings, support_phone: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">Emergency WhatsApp Number</label>
                    <input
                      type="text"
                      value={platformSettings.emergency_whatsapp}
                      onChange={(e) => setPlatformSettings({ ...platformSettings, emergency_whatsapp: e.target.value })}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Trust &amp; Safety Email</label>
                  <input
                    type="email"
                    value={platformSettings.support_email}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, support_email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="pt-2 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformSettings.require_phone_for_chat}
                      onChange={(e) => setPlatformSettings({ ...platformSettings, require_phone_for_chat: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Require Verified Phone Before Chatting</span>
                      <span className="text-[11px] text-slate-500">Blocks unverified users from spamming accommodation listers.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platformSettings.maintenance_mode}
                      onChange={(e) => setPlatformSettings({ ...platformSettings, maintenance_mode: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">System Maintenance Mode</span>
                      <span className="text-[11px] text-slate-500">Displays platform maintenance banner to non-admin visitors.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary">
                  Save Platform Settings
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL 1: VIEW USER DETAILS MODAL
      ========================================================================= */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 font-heading">
                User Profile Details
              </h3>
              <button
                onClick={() => setViewingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                {viewingUser.avatar_url ? (
                  <img src={viewingUser.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-sm font-heading">
                    {viewingUser.full_name.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{viewingUser.full_name}</h4>
                  <p className="text-slate-500 font-mono text-[11px]">{viewingUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-semibold">Account Role:</span>
                  <span className="font-bold text-slate-800 capitalize">{viewingUser.account_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Phone:</span>
                  <span className="font-bold text-slate-800">{viewingUser.phone_number || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Properties Listed:</span>
                  <span className="font-bold text-slate-800">{viewingUser.listings_count || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Joined Date:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(viewingUser.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {viewingUser.student_profile && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1 text-[11px]">
                  <span className="font-bold text-indigo-950 block">Student Profile Info:</span>
                  <p className="text-slate-700"><strong>College:</strong> {viewingUser.student_profile.college}</p>
                  <p className="text-slate-700"><strong>Target Move-in:</strong> {viewingUser.student_profile.target_move_in}</p>
                  <p className="text-slate-700"><strong>Budget:</strong> ₹{viewingUser.student_profile.budget_min} - ₹{viewingUser.student_profile.budget_max}/mo</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setViewingUser(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: QUICK EDIT LISTING MODAL
      ========================================================================= */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 font-heading">
                Edit Listing
              </h3>
              <button
                onClick={() => setEditingProperty(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Listing Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Monthly Rent (₹)</label>
                <input
                  type="number"
                  value={editRent}
                  onChange={(e) => setEditRent(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Availability Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="available">Available</option>
                  <option value="limited">Limited Vacancies</option>
                  <option value="rented">Fully Rented</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setEditingProperty(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveListingEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DESTRUCTIVE CONFIRMATION DIALOG
      ========================================================================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-slate-900 text-base font-heading">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Button
                variant={confirmDialog.variant === 'danger' ? 'danger' : 'primary'}
                size="sm"
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.actionLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
