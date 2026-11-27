import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  Phase3AdminWishesResponse,
  WeddingWish,
  WishStatus,
} from '../../../types/phase3';
import {
  deleteAdminWishEntry,
  fetchAdminWishes,
  retryAdminEmailDelivery,
  saveAdminPhase3Settings,
  updateAdminWishEntry,
} from '../../../services/adminApi';
import {ConfirmDialog, SectionCard, ToggleSwitch} from '../AdminPrimitives';

interface WishesManagementSectionProps {
  token: string;
  onSessionExpired: () => void;
}

export function WishesManagementSection({
  token,
  onSessionExpired,
}: WishesManagementSectionProps) {
  const [data, setData] = useState<Phase3AdminWishesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WishStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Preview & Edit modals
  const [previewWish, setPreviewWish] = useState<WeddingWish | null>(null);
  const [editingWish, setEditingWish] = useState<WeddingWish | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WeddingWish | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Section & Moderation settings
  const [wishesEnabled, setWishesEnabled] = useState(true);
  const [wishesAutoApprove, setWishesAutoApprove] = useState(false);
  const [wishesHeadingEn, setWishesHeadingEn] = useState('');
  const [wishesHeadingMl, setWishesHeadingMl] = useState('');
  const [wishesSubtitleEn, setWishesSubtitleEn] = useState('');
  const [wishesSubtitleMl, setWishesSubtitleMl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Wishes Notification settings (Strictly separate from RSVP!)
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingNotify, setSavingNotify] = useState(false);
  const [notifyNotice, setNotifyNotice] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadWishes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminWishes(token);
      setData(res);
      setWishesEnabled(res.settings.wishesEnabled);
      setWishesAutoApprove(res.settings.wishesAutoApprove);
      setWishesHeadingEn(res.settings.wishesHeadingEn);
      setWishesHeadingMl(res.settings.wishesHeadingMl);
      setWishesSubtitleEn(res.settings.wishesSubtitleEn);
      setWishesSubtitleMl(res.settings.wishesSubtitleMl);
      setNotifyEnabled(res.settings.wishesNotifyEnabled);
      setNotifyEmail(res.settings.wishesNotifyEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load wishes.';
      if (msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('session')) {
        onSessionExpired();
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    void loadWishes();
  }, [loadWishes]);

  const recomputeCounts = (items: WeddingWish[]) => ({
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    published: items.filter((i) => i.status === 'approved' && i.isPublished).length,
  });

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (q && !item.guestName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data?.items, search, statusFilter]);

  const applyQuickAction = async (
    wish: WeddingWish,
    patch: {status?: WishStatus; isPublished?: boolean}
  ) => {
    setBusyId(wish.id);
    setError(null);
    try {
      const updated = await updateAdminWishEntry(token, wish.id, patch);
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((w) => (w.id === updated.id ? updated : w));
        return {...prev, items: nextItems, counts: recomputeCounts(nextItems)};
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update wish status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingWish) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateAdminWishEntry(token, editingWish.id, {
        guestName: editingWish.guestName,
        message: editingWish.message,
        emoji: editingWish.emoji,
        status: editingWish.status,
        isPublished: editingWish.isPublished,
      });
      setEditingWish(null);
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((w) => (w.id === updated.id ? updated : w));
        return {...prev, items: nextItems, counts: recomputeCounts(nextItems)};
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save wish edits.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminWishEntry(token, deleteTarget.id);
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((w) => w.id !== removedId);
        return {...prev, items: nextItems, counts: recomputeCounts(nextItems)};
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete wish.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveWishesSettings = async () => {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const updated = await saveAdminPhase3Settings(token, {
        wishesEnabled,
        wishesAutoApprove,
        wishesHeadingEn,
        wishesHeadingMl,
        wishesSubtitleEn,
        wishesSubtitleMl,
      });
      setData((prev) => (prev ? {...prev, settings: updated} : prev));
      setSettingsNotice('Wedding Wishes settings saved.');
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Unable to save wishes settings.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveNotifySettings = async () => {
    setSavingNotify(true);
    setNotifyError(null);
    setNotifyNotice(null);
    try {
      const updated = await saveAdminPhase3Settings(token, {
        wishesNotifyEnabled: notifyEnabled,
        wishesNotifyEmail: notifyEmail.trim(),
      });
      setData((prev) => (prev ? {...prev, settings: updated} : prev));
      setNotifyNotice('Wishes email notification settings saved.');
    } catch (err) {
      setNotifyError(
        err instanceof Error
          ? err.message
          : 'Unable to save wishes notification settings.'
      );
    } finally {
      setSavingNotify(false);
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    setRetryingId(deliveryId);
    setNotifyError(null);
    try {
      const updated = await retryAdminEmailDelivery(token, deliveryId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              deliveries: prev.deliveries.map((d) =>
                d.id === updated.id ? updated : d
              ),
            }
          : prev
      );
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data?.migrationRequired && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <div>
            <p className="font-semibold">Supabase Phase 3 Migration Required</p>
            <p className="mt-1">
              Run <code className="px-1.5 py-0.5 bg-amber-100 rounded">supabase/migrations/002_phase3_rsvp_wishes.sql</code> in your Supabase SQL Editor to store and moderate wedding wishes.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => void loadWishes()}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Wishes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {data?.counts.total ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Pending Review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700 tabular-nums">
            {data?.counts.pending ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Approved</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {data?.counts.approved ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Live on Wall</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700 tabular-nums">
            {data?.counts.published ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-slate-500 tabular-nums">
            {data?.counts.rejected ?? 0}
          </p>
        </div>
      </div>

      {/* Guest Wishes Moderation Queue */}
      <SectionCard
        title="Guest Wishes & Moderation"
        description="Pending and rejected wishes (including uploaded photos) remain strictly private until approved and published."
        actions={
          <button
            type="button"
            onClick={() => void loadWishes()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by guest name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
            {(data?.items.length || 0) === 0
              ? 'No wedding wishes have been received yet.'
              : 'No wishes match the selected status or search.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((wish) => {
              const busy = busyId === wish.id;
              return (
                <div
                  key={wish.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row gap-4 justify-between"
                >
                  <div className="flex gap-4 min-w-0 flex-1">
                    {wish.photoUrl && (
                      <img
                        src={wish.photoUrl}
                        alt={`Wish photo from ${wish.guestName}`}
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-sm font-semibold text-slate-900">
                          {wish.guestName} {wish.emoji}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={`font-medium ${
                            wish.status === 'approved'
                              ? 'text-emerald-700'
                              : wish.status === 'rejected'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {wish.status === 'approved'
                            ? wish.isPublished
                              ? 'Approved & Live'
                              : 'Approved (Hidden)'
                            : wish.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Review'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">
                          {new Date(wish.createdAt).toLocaleDateString('en-IN', {
                            dateStyle: 'medium',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {wish.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-col items-center md:items-end justify-start gap-1.5 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewWish(wish)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      {wish.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void applyQuickAction(wish, {
                              status: 'approved',
                              isPublished: true,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Publish</span>
                        </button>
                      )}

                      {wish.status === 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void applyQuickAction(wish, {
                              isPublished: !wish.isPublished,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          {wish.isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Hide from Wall</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Publish to Wall</span>
                            </>
                          )}
                        </button>
                      )}

                      {wish.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void applyQuickAction(wish, {
                              status: 'rejected',
                              isPublished: false,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Reject</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null);
                          setEditingWish({...wish});
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(wish)}
                        aria-label={`Delete wish from ${wish.guestName}`}
                        className="p-1.5 rounded-md border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Moderation & Section Settings */}
      <SectionCard
        title="Wishes Section & Moderation Policy"
        description="Control whether new guest wishes require manual approval (recommended) or publish automatically."
      >
        <div className="space-y-5">
          <ToggleSwitch
            checked={wishesEnabled}
            onChange={setWishesEnabled}
            label="Show Wedding Wishes Section on Public Website"
            description="Displays the wishes composer and approved Wishes Wall to guests."
          />

          <ToggleSwitch
            checked={wishesAutoApprove}
            onChange={setWishesAutoApprove}
            label="Automatic Approval & Publishing"
            description="When OFF (default), new guest wishes remain private until you approve and publish them."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Heading (English)
              </label>
              <input
                type="text"
                value={wishesHeadingEn}
                onChange={(e) => setWishesHeadingEn(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Heading (Malayalam)
              </label>
              <input
                type="text"
                lang="ml"
                value={wishesHeadingMl}
                onChange={(e) => setWishesHeadingMl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subtitle (English)
              </label>
              <input
                type="text"
                value={wishesSubtitleEn}
                onChange={(e) => setWishesSubtitleEn(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subtitle (Malayalam)
              </label>
              <input
                type="text"
                lang="ml"
                value={wishesSubtitleMl}
                onChange={(e) => setWishesSubtitleMl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs">
              {settingsError && (
                <span className="text-rose-600 font-medium">{settingsError}</span>
              )}
              {settingsNotice && (
                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {settingsNotice}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveWishesSettings}
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[38px]"
            >
              {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Wishes Settings</span>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Separate Wishes Email Notification Settings & Delivery Log */}
      <SectionCard
        title="Wedding Wishes Email Notifications (Resend)"
        description="Configure email alerts sent strictly when a guest submits a new wedding wish. Wishes are always preserved even if email delivery fails."
      >
        <div className="space-y-5">
          {!data?.emailConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <p className="font-semibold">Resend API Key Not Configured</p>
              <p className="mt-1">
                Set <code className="px-1 py-0.5 bg-amber-100 rounded">RESEND_API_KEY</code> and{' '}
                <code className="px-1 py-0.5 bg-amber-100 rounded">EMAIL_FROM</code> in server environment variables to deliver wish alerts.
              </p>
            </div>
          )}

          <ToggleSwitch
            checked={notifyEnabled}
            onChange={setNotifyEnabled}
            label="Send Email Alert on New Wedding Wish"
            description="Emails send with subject &quot;New Wedding Wish Received&quot; and link directly to this admin dashboard."
          />

          <div className="max-w-md">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Wishes Notification Recipient Email
            </label>
            <input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="owner@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {notifyError && (
                <span className="text-rose-600 font-medium">{notifyError}</span>
              )}
              {notifyNotice && (
                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {notifyNotice}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveNotifySettings}
              disabled={savingNotify}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[38px]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>
                {savingNotify ? 'Saving…' : 'Save Wishes Notification Settings'}
              </span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Wishes Notification Delivery Status
            </h3>
            {(data?.deliveries.length || 0) === 0 ? (
              <p className="text-xs text-slate-500">
                No wish notification emails have been attempted yet.
              </p>
            ) : (
              <div className="space-y-2">
                {data!.deliveries.map((del) => (
                  <div
                    key={del.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium text-slate-900">
                        {del.recipientEmail} ·{' '}
                        <span
                          className={
                            del.status === 'sent'
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }
                        >
                          {del.status === 'sent' ? 'Delivered' : 'Failed'}
                        </span>
                        <span className="text-slate-400 font-normal">
                          {' '}
                          (Attempts: {del.attempts})
                        </span>
                      </p>
                      <p className="text-slate-500">
                        {new Date(del.lastAttemptAt).toLocaleString('en-IN')}
                        {del.providerMessageId
                          ? ` · Provider ID: ${del.providerMessageId}`
                          : ''}
                      </p>
                      {del.errorMessage && (
                        <p className="text-rose-700">{del.errorMessage}</p>
                      )}
                    </div>
                    {del.status !== 'sent' && (
                      <button
                        type="button"
                        disabled={retryingId === del.id}
                        onClick={() => void handleRetryDelivery(del.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 font-medium hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            retryingId === del.id ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Retry Email</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Complete Card Preview Modal */}
      {previewWish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-[#FAF7F0] border border-[#2C221E]/20 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Complete Wish Card Preview ({previewWish.status})
              </span>
              <button
                type="button"
                onClick={() => setPreviewWish(null)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewWish.photoUrl && (
              <img
                src={previewWish.photoUrl}
                alt={`Uploaded wish photograph from ${previewWish.guestName}`}
                className="w-full max-h-72 object-cover"
              />
            )}
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#2C221E] leading-relaxed whitespace-pre-line">
                “{previewWish.message}”
              </p>
              <div className="pt-3 border-t border-[#2C221E]/10 flex items-center justify-between">
                <span className="font-display text-lg text-[#2C221E]">
                  {previewWish.guestName}
                </span>
                {previewWish.emoji && (
                  <span className="text-xl">{previewWish.emoji}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Wish Modal */}
      {editingWish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Edit Wedding Wish
              </h3>
              <button
                type="button"
                onClick={() => setEditingWish(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                {editError}
              </p>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guest Name
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={editingWish.guestName}
                  onChange={(e) =>
                    setEditingWish({...editingWish, guestName: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={editingWish.message}
                  onChange={(e) =>
                    setEditingWish({...editingWish, message: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingWish.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as WishStatus;
                      setEditingWish({
                        ...editingWish,
                        status: nextStatus,
                        isPublished:
                          nextStatus === 'approved' ? editingWish.isPublished : false,
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Public Visibility
                  </label>
                  <select
                    disabled={editingWish.status !== 'approved'}
                    value={editingWish.isPublished ? 'published' : 'hidden'}
                    onChange={(e) =>
                      setEditingWish({
                        ...editingWish,
                        isPublished: e.target.value === 'published',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="published">Published on Wall</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWish(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {editSaving ? 'Saving…' : 'Save Wish'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Wedding Wish?"
        message={`This will permanently delete the wish from "${deleteTarget?.guestName || ''}" and any attached photograph.`}
        confirmLabel="Delete Wish"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
