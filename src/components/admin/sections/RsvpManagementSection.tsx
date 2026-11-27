import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  Check,
  Download,
  Edit3,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Phase3AdminRsvpResponse,
  RsvpAttendance,
  RsvpCustomField,
  RsvpCustomFieldType,
  RsvpEntry,
} from '../../../types/phase3';
import {
  deleteAdminRsvpEntry,
  downloadAdminRsvpCsv,
  fetchAdminRsvps,
  retryAdminEmailDelivery,
  saveAdminPhase3Settings,
  updateAdminRsvpEntry,
} from '../../../services/adminApi';
import {ConfirmDialog, SectionCard, ToggleSwitch} from '../AdminPrimitives';

interface RsvpManagementSectionProps {
  token: string;
  onSessionExpired: () => void;
}

export function RsvpManagementSection({
  token,
  onSessionExpired,
}: RsvpManagementSectionProps) {
  const [data, setData] = useState<Phase3AdminRsvpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Export
  const [search, setSearch] = useState('');
  const [filterAttendance, setFilterAttendance] = useState<'all' | RsvpAttendance>(
    'all'
  );
  const [exporting, setExporting] = useState(false);

  // Detail / Edit modal
  const [editingEntry, setEditingEntry] = useState<RsvpEntry | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<RsvpEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form Settings draft
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [rsvpHeadingEn, setRsvpHeadingEn] = useState('');
  const [rsvpHeadingMl, setRsvpHeadingMl] = useState('');
  const [rsvpSubtitleEn, setRsvpSubtitleEn] = useState('');
  const [rsvpSubtitleMl, setRsvpSubtitleMl] = useState('');
  const [allowAttendeeCount, setAllowAttendeeCount] = useState(true);
  const [maxAttendees, setMaxAttendees] = useState(10);
  const [customFields, setCustomFields] = useState<RsvpCustomField[]>([]);
  const [savingFormConfig, setSavingFormConfig] = useState(false);
  const [formConfigNotice, setFormConfigNotice] = useState<string | null>(null);
  const [formConfigError, setFormConfigError] = useState<string | null>(null);

  // Notification Settings draft (Separate from Wishes!)
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingNotify, setSavingNotify] = useState(false);
  const [notifyNotice, setNotifyNotice] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadRsvps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminRsvps(token);
      setData(res);
      setRsvpEnabled(res.settings.rsvpEnabled);
      setRsvpHeadingEn(res.settings.rsvpHeadingEn);
      setRsvpHeadingMl(res.settings.rsvpHeadingMl);
      setRsvpSubtitleEn(res.settings.rsvpSubtitleEn);
      setRsvpSubtitleMl(res.settings.rsvpSubtitleMl);
      setAllowAttendeeCount(res.settings.rsvpAllowAttendeeCount);
      setMaxAttendees(res.settings.rsvpMaxAttendees);
      setCustomFields(res.settings.rsvpCustomFields);
      setNotifyEnabled(res.settings.rsvpNotifyEnabled);
      setNotifyEmail(res.settings.rsvpNotifyEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load RSVPs.';
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
    void loadRsvps();
  }, [loadRsvps]);

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filterAttendance !== 'all' && item.attendance !== filterAttendance) {
        return false;
      }
      if (q && !item.guestName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data?.items, search, filterAttendance]);

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadAdminRsvpCsv(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateAdminRsvpEntry(token, editingEntry.id, {
        guestName: editingEntry.guestName,
        attendance: editingEntry.attendance,
        attendeeCount: editingEntry.attendeeCount,
        message: editingEntry.message,
        adminNote: editingEntry.adminNote,
      });
      setEditingEntry(null);
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((i) => (i.id === updated.id ? updated : i));
        const attending = nextItems.filter((i) => i.attendance === 'attending');
        return {
          ...prev,
          items: nextItems,
          metrics: {
            total: nextItems.length,
            attending: attending.length,
            notAttending: nextItems.length - attending.length,
            totalConfirmedAttendees: attending.reduce(
              (acc, i) => acc + Math.max(0, i.attendeeCount),
              0
            ),
          },
        };
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save RSVP entry.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminRsvpEntry(token, deleteTarget.id);
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      setData((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((i) => i.id !== removedId);
        const attending = nextItems.filter((i) => i.attendance === 'attending');
        return {
          ...prev,
          items: nextItems,
          metrics: {
            total: nextItems.length,
            attending: attending.length,
            notAttending: nextItems.length - attending.length,
            totalConfirmedAttendees: attending.reduce(
              (acc, i) => acc + Math.max(0, i.attendeeCount),
              0
            ),
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete RSVP.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCustomField = () => {
    const id = `field_${Date.now().toString(36)}`;
    setCustomFields((prev) => [
      ...prev,
      {
        id,
        labelEn: 'Dietary Preference',
        labelMl: 'ഭക്ഷണ മുൻഗണന',
        type: 'text',
        required: false,
        enabled: true,
        options: [],
      },
    ]);
  };

  const handleSaveFormConfig = async () => {
    setSavingFormConfig(true);
    setFormConfigError(null);
    setFormConfigNotice(null);
    try {
      const updated = await saveAdminPhase3Settings(token, {
        rsvpEnabled,
        rsvpHeadingEn,
        rsvpHeadingMl,
        rsvpSubtitleEn,
        rsvpSubtitleMl,
        rsvpAllowAttendeeCount: allowAttendeeCount,
        rsvpMaxAttendees: maxAttendees,
        rsvpCustomFields: customFields,
      });
      setData((prev) => (prev ? {...prev, settings: updated} : prev));
      setFormConfigNotice('RSVP form settings saved.');
    } catch (err) {
      setFormConfigError(
        err instanceof Error ? err.message : 'Unable to save RSVP form settings.'
      );
    } finally {
      setSavingFormConfig(false);
    }
  };

  const handleSaveNotifySettings = async () => {
    setSavingNotify(true);
    setNotifyError(null);
    setNotifyNotice(null);
    try {
      const updated = await saveAdminPhase3Settings(token, {
        rsvpNotifyEnabled: notifyEnabled,
        rsvpNotifyEmail: notifyEmail.trim(),
      });
      setData((prev) => (prev ? {...prev, settings: updated} : prev));
      setNotifyNotice('RSVP email notification settings saved.');
    } catch (err) {
      setNotifyError(
        err instanceof Error
          ? err.message
          : 'Unable to save RSVP notification settings.'
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
      setNotifyError(
        err instanceof Error ? err.message : 'Retry failed.'
      );
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
              Run <code className="px-1.5 py-0.5 bg-amber-100 rounded">supabase/migrations/002_phase3_rsvp_wishes.sql</code> in your Supabase SQL Editor to enable RSVP and Wedding Wishes storage.
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
            onClick={() => void loadRsvps()}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Responses</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {data?.metrics.total ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Attending</p>
          <p className="mt-1.5 text-2xl font-semibold text-emerald-700 tabular-nums">
            {data?.metrics.attending ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Unable to Attend</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-700 tabular-nums">
            {data?.metrics.notAttending ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-slate-500">Confirmed Attendees</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">
            {data?.metrics.totalConfirmedAttendees ?? 0}
          </p>
        </div>
      </div>

      {/* Submissions Table */}
      <SectionCard
        title="Guest RSVP Submissions"
        description="Private guest responses stored in the database. Only authenticated site owners can view or export these records."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRsvps()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || (data?.items.length || 0) === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[38px]"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Export CSV</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by guest name…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            />
          </div>
          <select
            value={filterAttendance}
            onChange={(e) =>
              setFilterAttendance(e.target.value as 'all' | RsvpAttendance)
            }
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:border-slate-900 focus:outline-none"
          >
            <option value="all">All Responses</option>
            <option value="attending">Attending Only</option>
            <option value="not_attending">Unable to Attend</option>
          </select>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
            {(data?.items.length || 0) === 0
              ? 'No RSVPs have been submitted yet.'
              : 'No RSVPs match your current search or filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4 font-semibold">Guest</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Guests</th>
                  <th className="py-2.5 px-3 font-semibold">Message</th>
                  <th className="py-2.5 px-3 font-semibold">Submitted</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredItems.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {entry.guestName}
                      {Object.keys(entry.customFields || {}).length > 0 && (
                        <p className="text-[11px] font-normal text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {Object.entries(entry.customFields)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            entry.attendance === 'attending'
                              ? 'bg-emerald-600'
                              : 'bg-slate-400'
                          }`}
                        />
                        {entry.attendance === 'attending'
                          ? 'Attending'
                          : 'Unable to attend'}
                      </span>
                    </td>
                    <td className="py-3 px-3 tabular-nums text-slate-700">
                      {entry.attendance === 'attending' ? entry.attendeeCount : '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-[240px]">
                      <p className="truncate">{entry.message || '—'}</p>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditError(null);
                            setEditingEntry({...entry});
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(entry)}
                          aria-label={`Delete RSVP from ${entry.guestName}`}
                          className="p-1.5 rounded-md border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* RSVP Form Configuration */}
      <SectionCard
        title="RSVP Form Configuration"
        description="Customize the public RSVP section heading, attendee count limit, and additional guest questions."
      >
        <div className="space-y-5">
          <ToggleSwitch
            checked={rsvpEnabled}
            onChange={setRsvpEnabled}
            label="Show RSVP Section on Public Website"
            description="When disabled, the RSVP form is hidden from guests."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Heading (English)
              </label>
              <input
                type="text"
                value={rsvpHeadingEn}
                onChange={(e) => setRsvpHeadingEn(e.target.value)}
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
                value={rsvpHeadingMl}
                onChange={(e) => setRsvpHeadingMl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subtitle (English)
              </label>
              <input
                type="text"
                value={rsvpSubtitleEn}
                onChange={(e) => setRsvpSubtitleEn(e.target.value)}
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
                value={rsvpSubtitleMl}
                onChange={(e) => setRsvpSubtitleMl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <ToggleSwitch
              checked={allowAttendeeCount}
              onChange={setAllowAttendeeCount}
              label="Ask for Number of Attendees"
              description="Allows attending guests to choose how many people are coming with them."
            />

            {allowAttendeeCount && (
              <div className="max-w-xs">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Maximum Guests per RSVP (1–30)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxAttendees}
                  onChange={(e) =>
                    setMaxAttendees(
                      Math.min(30, Math.max(1, Number(e.target.value) || 1))
                    )
                  }
                  className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                />
              </div>
            )}
          </div>

          {/* Configurable Additional Custom Fields */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Additional RSVP Questions
                </p>
                <p className="text-xs text-slate-500">
                  Optional fields such as meal preference, accommodation, or arrival date.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {customFields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Field #{index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.enabled}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((f) =>
                              f.id === field.id
                                ? {...f, enabled: e.target.checked}
                                : f
                            )
                          )
                        }
                      />
                      Enabled
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((f) =>
                              f.id === field.id
                                ? {...f, required: e.target.checked}
                                : f
                            )
                          )
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields((prev) =>
                          prev.filter((f) => f.id !== field.id)
                        )
                      }
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Label (English)
                    </label>
                    <input
                      type="text"
                      value={field.labelEn}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id ? {...f, labelEn: e.target.value} : f
                          )
                        )
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Label (Malayalam)
                    </label>
                    <input
                      type="text"
                      lang="ml"
                      value={field.labelMl}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id ? {...f, labelMl: e.target.value} : f
                          )
                        )
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Input Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id
                              ? {...f, type: e.target.value as RsvpCustomFieldType}
                              : f
                          )
                        )
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="select">Dropdown Options</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                </div>

                {field.type === 'select' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Dropdown Choices (comma separated)
                    </label>
                    <input
                      type="text"
                      value={(field.options || []).join(', ')}
                      onChange={(e) =>
                        setCustomFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id
                              ? {
                                  ...f,
                                  options: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : f
                          )
                        )
                      }
                      placeholder="Sadhya Lunch, Morning Reception, Both"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs">
              {formConfigError && (
                <span className="text-rose-600 font-medium">{formConfigError}</span>
              )}
              {formConfigNotice && (
                <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {formConfigNotice}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveFormConfig}
              disabled={savingFormConfig}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[38px]"
            >
              {savingFormConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save RSVP Form Settings</span>
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Separate RSVP Email Notification Settings & Delivery Log */}
      <SectionCard
        title="RSVP Email Notifications (Resend)"
        description="Configure email alerts sent strictly when a guest submits a new RSVP. RSVPs are always preserved even if email delivery fails."
      >
        <div className="space-y-5">
          {!data?.emailConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <p className="font-semibold">Resend API Key Not Configured</p>
              <p className="mt-1">
                Set <code className="px-1 py-0.5 bg-amber-100 rounded">RESEND_API_KEY</code> and{' '}
                <code className="px-1 py-0.5 bg-amber-100 rounded">EMAIL_FROM</code> in server environment variables to send real notification emails. You can still save recipient settings now.
              </p>
            </div>
          )}

          <ToggleSwitch
            checked={notifyEnabled}
            onChange={setNotifyEnabled}
            label="Send Email Alert on New RSVP"
            description={
              data?.emailFrom
                ? `Emails will send from ${data.emailFrom} with subject "New Wedding RSVP Received".`
                : 'Emails send with subject "New Wedding RSVP Received" once Resend is configured.'
            }
          />

          <div className="max-w-md">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              RSVP Notification Recipient Email
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
              <span>{savingNotify ? 'Saving…' : 'Save RSVP Notification Settings'}</span>
            </button>
          </div>

          {/* Delivery Audit Log */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              RSVP Notification Delivery Status
            </h3>
            {(data?.deliveries.length || 0) === 0 ? (
              <p className="text-xs text-slate-500">
                No RSVP notification emails have been attempted yet.
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

      {/* Edit / Detail Modal */}
      {editingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                RSVP Submission Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
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
                  value={editingEntry.guestName}
                  onChange={(e) =>
                    setEditingEntry({...editingEntry, guestName: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Attendance
                  </label>
                  <select
                    value={editingEntry.attendance}
                    onChange={(e) => {
                      const nextAtt = e.target.value as RsvpAttendance;
                      setEditingEntry({
                        ...editingEntry,
                        attendance: nextAtt,
                        attendeeCount:
                          nextAtt === 'not_attending'
                            ? 0
                            : Math.max(1, editingEntry.attendeeCount),
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="attending">Attending</option>
                    <option value="not_attending">Unable to attend</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Attendee Count
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    disabled={editingEntry.attendance === 'not_attending'}
                    value={editingEntry.attendeeCount}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        attendeeCount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Guest Message
                </label>
                <textarea
                  rows={3}
                  value={editingEntry.message}
                  onChange={(e) =>
                    setEditingEntry({...editingEntry, message: e.target.value})
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              {Object.keys(editingEntry.customFields || {}).length > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-700">Additional Fields</p>
                  {Object.entries(editingEntry.customFields).map(([k, v]) => (
                    <p key={k} className="text-slate-600">
                      <span className="font-medium text-slate-800">{k}:</span> {v}
                    </p>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Private Owner Note
                </label>
                <input
                  type="text"
                  value={editingEntry.adminNote}
                  onChange={(e) =>
                    setEditingEntry({...editingEntry, adminNote: e.target.value})
                  }
                  placeholder="Internal seating or welcome note"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={handleSaveEntry}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete RSVP Submission?"
        message={`This will permanently remove the RSVP from "${deleteTarget?.guestName || ''}". This action cannot be undone.`}
        confirmLabel="Delete RSVP"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteEntry}
      />
    </div>
  );
}
