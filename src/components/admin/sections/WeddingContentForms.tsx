import {useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  CouplePersonProfile,
  FamilyMember,
  WeddingConfig,
  WeddingEvent,
} from '../../../types/wedding';
import type {MediaAsset} from '../../../types/admin';
import {
  ConfirmDialog,
  FileUploadButton,
  LocalizedInput,
  LocalizedTextarea,
  SaveActionBar,
  SectionCard,
  ToggleSwitch,
} from '../AdminPrimitives';

interface SectionSaveHandler {
  onSaveDraft: (
    nextConfig: WeddingConfig,
    sectionLabel: string,
    summary: string
  ) => Promise<void>;
}

/* ============================================================================
 * 1. WEDDING DETAILS EDITOR
 * ========================================================================== */
export function WeddingDetailsEditor({
  draftConfig,
  onSaveDraft,
}: {draftConfig: WeddingConfig} & SectionSaveHandler) {
  const [form, setForm] = useState<WeddingConfig>(() =>
    structuredClone(draftConfig)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (updater: (prev: WeddingConfig) => WeddingConfig) => {
    setForm((prev) => updater(prev));
    setDirty(true);
    setSavedNotice(null);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        form,
        'Wedding Details',
        'Updated couple nicknames, date, Muhurtham, venue, and invitation copy.'
      );
      setDirty(false);
      setSavedNotice('Wedding details saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Couple Names & Cover Invitation"
        description="Nicknames appear on the closed invitation cover; full names appear inside after opening."
      >
        <div className="space-y-5">
          <LocalizedInput
            label="Bride Nickname (Closed Card)"
            required
            value={form.couple.bride.nickname}
            onChange={(next) =>
              patch((p) => ({
                ...p,
                couple: {...p.couple, bride: {...p.couple.bride, nickname: next}},
              }))
            }
          />
          <LocalizedInput
            label="Groom Nickname (Closed Card)"
            required
            value={form.couple.groom.nickname}
            onChange={(next) =>
              patch((p) => ({
                ...p,
                couple: {...p.couple, groom: {...p.couple.groom, nickname: next}},
              }))
            }
          />
          <LocalizedInput
            label="Auspicious Invocation Line"
            value={form.invitation.blessing}
            onChange={(next) =>
              patch((p) => ({...p, invitation: {...p.invitation, blessing: next}}))
            }
          />
          <LocalizedTextarea
            label="Closed Card Invitation Phrase"
            required
            value={form.invitation.phrase}
            onChange={(next) =>
              patch((p) => ({...p, invitation: {...p.invitation, phrase: next}}))
            }
          />
          <LocalizedTextarea
            label="Hero Invitation Message"
            required
            value={form.hero.invitationMessage}
            onChange={(next) =>
              patch((p) => ({...p, hero: {...p.hero, invitationMessage: next}}))
            }
          />
          <LocalizedTextarea
            label="Optional Additional Wedding Information"
            value={form.hero.additionalInfo || {en: '', ml: ''}}
            onChange={(next) =>
              patch((p) => ({...p, hero: {...p.hero, additionalInfo: next}}))
            }
            rows={2}
          />
          <ToggleSwitch
            label="Mark Invitation Content as Sample Placeholder"
            description="Shows the placeholder notice in the footer until real wedding details are finalized."
            checked={form.meta.isPlaceholderData}
            onChange={(checked) =>
              patch((p) => ({
                ...p,
                meta: {...p.meta, isPlaceholderData: checked},
              }))
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Wedding Date, Muhurtham & Venue"
        description="Configure the ceremony date, IST countdown timestamp, venue address, and directions link."
      >
        <div className="space-y-5">
          <LocalizedInput
            label="Wedding Date (Display)"
            required
            value={form.dateAndTime.displayDate}
            onChange={(next) =>
              patch((p) => ({
                ...p,
                dateAndTime: {...p.dateAndTime, displayDate: next},
              }))
            }
          />
          <LocalizedInput
            label="Muhurtham Time Window"
            required
            value={form.dateAndTime.muhurthamWindow}
            onChange={(next) =>
              patch((p) => ({
                ...p,
                dateAndTime: {...p.dateAndTime, muhurthamWindow: next},
              }))
            }
          />
          <LocalizedInput
            label="Malayalam Calendar / Nakshatram (Optional)"
            value={form.dateAndTime.malayalamCalendarDate || {en: '', ml: ''}}
            onChange={(next) =>
              patch((p) => ({
                ...p,
                dateAndTime: {...p.dateAndTime, malayalamCalendarDate: next},
              }))
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Muhurtham Countdown ISO Timestamp *
              </label>
              <input
                type="text"
                value={form.dateAndTime.muhurthamIso}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    dateAndTime: {...p.dateAndTime, muhurthamIso: e.target.value},
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Calendar Event End ISO Timestamp
              </label>
              <input
                type="text"
                value={form.dateAndTime.calendarEndIso}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    dateAndTime: {...p.dateAndTime, calendarEndIso: e.target.value},
                  }))
                }
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <LocalizedInput
            label="Venue Name"
            required
            value={form.venue.name}
            onChange={(next) =>
              patch((p) => ({...p, venue: {...p.venue, name: next}}))
            }
          />
          <LocalizedInput
            label="Address Line 1"
            required
            value={form.venue.addressLine1}
            onChange={(next) =>
              patch((p) => ({...p, venue: {...p.venue, addressLine1: next}}))
            }
          />
          <LocalizedInput
            label="Address Line 2 (City, District, PIN)"
            value={form.venue.addressLine2}
            onChange={(next) =>
              patch((p) => ({...p, venue: {...p.venue, addressLine2: next}}))
            }
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Google Maps Directions URL
            </label>
            <input
              type="url"
              value={form.venue.googleMapsUrl}
              onChange={(e) =>
                patch((p) => ({
                  ...p,
                  venue: {...p.venue, googleMapsUrl: e.target.value},
                }))
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <LocalizedInput
            label="Directions / Travel Note (Optional)"
            value={form.venue.directionsHint || {en: '', ml: ''}}
            onChange={(next) =>
              patch((p) => ({...p, venue: {...p.venue, directionsHint: next}}))
            }
          />
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 2. BRIDE & GROOM PROFILE EDITOR (SEPARATE INSTANCES)
 * ========================================================================== */
export function CoupleProfileEditor({
  role,
  draftConfig,
  mediaLibrary,
  onUploadMedia,
  onSaveDraft,
}: {
  role: 'bride' | 'groom';
  draftConfig: WeddingConfig;
  mediaLibrary: MediaAsset[];
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [profile, setProfile] = useState<CouplePersonProfile>(() =>
    structuredClone(draftConfig.couple[role])
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (updater: (prev: CouplePersonProfile) => CouplePersonProfile) => {
    setProfile((prev) => updater(prev));
    setDirty(true);
    setSavedNotice(null);
    setError(null);
  };

  const photoAssets = mediaLibrary.filter((m) => m.type === 'photo');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const nextConfig: WeddingConfig = {
        ...draftConfig,
        couple: {
          ...draftConfig.couple,
          [role]: profile,
        },
      };
      await onSaveDraft(
        nextConfig,
        role === 'bride' ? 'Bride Profile' : 'Groom Profile',
        `Updated ${role} profile, portrait, and family lineage.`
      );
      setDirty(false);
      setSavedNotice(`${role === 'bride' ? 'Bride' : 'Groom'} profile saved to draft.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={role === 'bride' ? 'Bride Profile & Lineage' : 'Groom Profile & Lineage'}
        description="Manage full name, portrait photograph, parents, grandparents, and personal introduction separately."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="space-y-3">
              <img
                src={profile.portraitUrl}
                alt={profile.fullName.en}
                className="w-full h-64 object-cover object-top rounded-xl border border-slate-200 bg-slate-100"
              />
              <FileUploadButton
                accept="image/*"
                label="Upload New Portrait"
                onUpload={async (file) => {
                  const asset = await onUploadMedia(file);
                  patch((p) => ({...p, portraitUrl: asset.url}));
                }}
              />
              {photoAssets.length > 0 && (
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Or select from Media Library
                  </label>
                  <select
                    value={profile.portraitUrl}
                    onChange={(e) => patch((p) => ({...p, portraitUrl: e.target.value}))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value={profile.portraitUrl}>Current portrait</option>
                    {photoAssets.map((asset) => (
                      <option key={asset.id} value={asset.url}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-4">
              <LocalizedInput
                label="Full Name"
                required
                value={profile.fullName}
                onChange={(next) => patch((p) => ({...p, fullName: next}))}
              />
              <LocalizedInput
                label="Father's Name"
                value={profile.fatherName}
                onChange={(next) => patch((p) => ({...p, fatherName: next}))}
              />
              <LocalizedInput
                label="Mother's Name"
                value={profile.motherName}
                onChange={(next) => patch((p) => ({...p, motherName: next}))}
              />
            </div>
          </div>

          <LocalizedInput
            label="Paternal Grandparents"
            value={profile.paternalGrandparents}
            onChange={(next) => patch((p) => ({...p, paternalGrandparents: next}))}
          />
          <LocalizedInput
            label="Maternal Grandparents"
            value={profile.maternalGrandparents}
            onChange={(next) => patch((p) => ({...p, maternalGrandparents: next}))}
          />
          <LocalizedInput
            label="Ancestral Home / Hometown"
            value={profile.hometown}
            onChange={(next) => patch((p) => ({...p, hometown: next}))}
          />
          <LocalizedTextarea
            label="Personal Introduction"
            value={profile.personalIntro}
            onChange={(next) => patch((p) => ({...p, personalIntro: next}))}
          />
          <LocalizedInput
            label="Optional Additional Note"
            value={profile.additionalNote || {en: '', ml: ''}}
            onChange={(next) => patch((p) => ({...p, additionalNote: next}))}
          />
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />
    </div>
  );
}

/* ============================================================================
 * 3. FAMILY INFORMATION EDITOR
 * ========================================================================== */
export function FamilyInfoEditor({
  draftConfig,
  onSaveDraft,
}: {draftConfig: WeddingConfig} & SectionSaveHandler) {
  const [members, setMembers] = useState<FamilyMember[]>(() =>
    structuredClone(draftConfig.familyMembers || [])
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null);

  const updateMember = (id: string, updater: (m: FamilyMember) => FamilyMember) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
    setDirty(true);
    setSavedNotice(null);
  };

  const addMember = () => {
    const next: FamilyMember = {
      id: `fam-${Date.now()}`,
      side: 'bride',
      name: {en: '', ml: ''},
      relationship: {en: '', ml: ''},
      note: {en: '', ml: ''},
      order: members.length + 1,
      visible: true,
    };
    setMembers((prev) => [...prev, next]);
    setDirty(true);
  };

  const moveMember = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= members.length) return;
    const copy = [...members];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setMembers(copy.map((m, i) => ({...m, order: i + 1})));
    setDirty(true);
  };

  const handleSave = async () => {
    if (members.some((m) => !m.name.en.trim() || !m.relationship.en.trim())) {
      setError('Every family entry requires an English name and relationship.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {...draftConfig, familyMembers: members},
        'Family Information',
        `Saved ${members.length} family member entries.`
      );
      setDirty(false);
      setSavedNotice('Family directory saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Family Members & Relationships"
        description="Add, reorder, or hide family members shown in the Family Blessings section."
        actions={
          <button
            type="button"
            onClick={addMember}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Family Member</span>
          </button>
        }
      >
        {members.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl space-y-3">
            <p className="text-sm text-slate-600">No family members added yet.</p>
            <button
              type="button"
              onClick={addMember}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              Add First Family Member
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {members.map((member, index) => (
              <div
                key={member.id}
                className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 bg-slate-50/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      #{index + 1}
                    </span>
                    <select
                      value={member.side}
                      onChange={(e) =>
                        updateMember(member.id, (m) => ({
                          ...m,
                          side: e.target.value as 'bride' | 'groom',
                        }))
                      }
                      className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="bride">Bride&apos;s Family</option>
                      <option value="groom">Groom&apos;s Family</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveMember(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMember(index, 1)}
                      disabled={index === members.length - 1}
                      aria-label="Move down"
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateMember(member.id, (m) => ({...m, visible: !m.visible}))
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {member.visible ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(member)}
                      aria-label="Delete family member"
                      className="p-2 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <LocalizedInput
                  label="Member Name"
                  required
                  value={member.name}
                  onChange={(next) => updateMember(member.id, (m) => ({...m, name: next}))}
                />
                <LocalizedInput
                  label="Relationship"
                  required
                  value={member.relationship}
                  onChange={(next) =>
                    updateMember(member.id, (m) => ({...m, relationship: next}))
                  }
                />
                <LocalizedInput
                  label="Optional Note"
                  value={member.note || {en: '', ml: ''}}
                  onChange={(next) => updateMember(member.id, (m) => ({...m, note: next}))}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Family Entry?"
        message={`Are you sure you want to remove "${deleteTarget?.name.en || 'this entry'}" from the family list?`}
        confirmLabel="Remove Entry"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
            setDirty(true);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/* ============================================================================
 * 4. EVENTS & SCHEDULE EDITOR
 * ========================================================================== */
export function EventsScheduleEditor({
  draftConfig,
  onUploadMedia,
  onSaveDraft,
}: {
  draftConfig: WeddingConfig;
  onUploadMedia: (file: File) => Promise<MediaAsset>;
} & SectionSaveHandler) {
  const [events, setEvents] = useState<WeddingEvent[]>(() =>
    structuredClone(draftConfig.events)
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeddingEvent | null>(null);

  const updateEvent = (id: string, updater: (evt: WeddingEvent) => WeddingEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? updater(e) : e)));
    setDirty(true);
    setSavedNotice(null);
  };

  const addEvent = () => {
    setEvents((prev) => [
      ...prev,
      {
        id: `evt-${Date.now()}`,
        title: {en: '', ml: ''},
        dateLabel: draftConfig.dateAndTime.displayDate,
        timeRange: {en: '', ml: ''},
        venueName: draftConfig.venue.name,
        description: {en: '', ml: ''},
        order: prev.length + 1,
        visible: true,
      },
    ]);
    setDirty(true);
  };

  const moveEvent = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= events.length) return;
    const copy = [...events];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setEvents(copy.map((e, i) => ({...e, order: i + 1})));
    setDirty(true);
  };

  const handleSave = async () => {
    if (events.some((e) => !e.title.en.trim() || !e.timeRange.en.trim())) {
      setError('Every ceremony requires an English title and time range.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveDraft(
        {...draftConfig, events},
        'Events & Schedule',
        `Saved ${events.length} wedding events and display order.`
      );
      setDirty(false);
      setSavedNotice('Events & schedule saved to draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Ceremonies & Event Schedule"
        description="Add, reorder, toggle visibility, or attach optional ceremony images."
        actions={
          <button
            type="button"
            onClick={addEvent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Event</span>
          </button>
        }
      >
        <div className="space-y-5">
          {events.map((evt, index) => (
            <div
              key={evt.id}
              className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 bg-slate-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    #{index + 1}
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(evt.isMuhurtham)}
                      onChange={(e) =>
                        updateEvent(evt.id, (item) => ({
                          ...item,
                          isMuhurtham: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                    <span>Highlight as Muhurtham</span>
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moveEvent(index, -1)}
                    disabled={index === 0}
                    aria-label="Move event up"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveEvent(index, 1)}
                    disabled={index === events.length - 1}
                    aria-label="Move event down"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateEvent(evt.id, (item) => ({
                        ...item,
                        visible: item.visible === false,
                      }))
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {evt.visible !== false ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(evt)}
                    aria-label="Delete event"
                    className="p-2 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <LocalizedInput
                label="Ceremony Name"
                required
                value={evt.title}
                onChange={(next) => updateEvent(evt.id, (item) => ({...item, title: next}))}
              />
              <LocalizedInput
                label="Date"
                value={evt.dateLabel}
                onChange={(next) =>
                  updateEvent(evt.id, (item) => ({...item, dateLabel: next}))
                }
              />
              <LocalizedInput
                label="Start & End Time"
                required
                value={evt.timeRange}
                onChange={(next) =>
                  updateEvent(evt.id, (item) => ({...item, timeRange: next}))
                }
              />
              <LocalizedInput
                label="Venue"
                value={evt.venueName}
                onChange={(next) =>
                  updateEvent(evt.id, (item) => ({...item, venueName: next}))
                }
              />
              <LocalizedTextarea
                label="Description"
                value={evt.description || {en: '', ml: ''}}
                onChange={(next) =>
                  updateEvent(evt.id, (item) => ({...item, description: next}))
                }
                rows={2}
              />

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <FileUploadButton
                  accept="image/*"
                  label={evt.imageUrl ? 'Replace Optional Image' : 'Upload Optional Image'}
                  onUpload={async (file) => {
                    const asset = await onUploadMedia(file);
                    updateEvent(evt.id, (item) => ({...item, imageUrl: asset.url}));
                  }}
                />
                {evt.imageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      updateEvent(evt.id, (item) => ({...item, imageUrl: undefined}))
                    }
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SaveActionBar
        dirty={dirty}
        saving={saving}
        savedNotice={savedNotice}
        error={error}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Event?"
        message={`Remove "${deleteTarget?.title.en || 'this ceremony'}" from the event schedule?`}
        confirmLabel="Delete Event"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
            setDirty(true);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
