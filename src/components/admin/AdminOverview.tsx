import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Database,
  Eye,
  Film,
  Image as ImageIcon,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type {AdminOverviewData, AdminSectionId} from '../../types/admin';
import {SectionCard} from './AdminPrimitives';

interface AdminOverviewProps {
  overview: AdminOverviewData | null;
  loading: boolean;
  onNavigateSection: (section: AdminSectionId) => void;
  onOpenPreview: () => void;
}

export function AdminOverview({
  overview,
  loading,
  onNavigateSection,
  onOpenPreview,
}: AdminOverviewProps) {
  if (loading || !overview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse p-5"
            />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Honest Supabase / Storage Status Banner */}
      <div
        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          overview.backendStatus.supabaseConfigured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-semibold">
              {overview.backendStatus.supabaseConfigured
                ? 'Supabase Connected (Database, Auth & Storage)'
                : 'Supabase Credentials Required — Using Server Local Persistence'}
            </p>
            <p className="opacity-85 leading-relaxed">
              {overview.backendStatus.storageDescription}
            </p>
            {!overview.backendStatus.supabaseConfigured && (
              <p className="font-mono text-[11px] opacity-90">
                Missing: {overview.backendStatus.supabaseMissingVars.join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {overview.publication.hasUnpublishedChanges && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm text-blue-950">
          <div>
            <p className="font-semibold">Unpublished Draft Changes Saved</p>
            <p className="opacity-85 mt-0.5">
              Your public website (`/`) still shows the previous published version until you publish your draft.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPreview}
              className="px-3.5 py-2 rounded-lg border border-blue-300 bg-white text-xs font-medium text-blue-900 hover:bg-blue-100 cursor-pointer"
            >
              Preview Draft
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('publish-settings')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
            >
              Go to Publish Settings
            </button>
          </div>
        </div>
      )}

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Publication Status</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {overview.publication.status === 'published' ? 'Published' : 'Unpublished'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {overview.publication.hasUnpublishedChanges
              ? 'Draft has unpublished edits'
              : 'Live site matches saved draft'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Wedding Date</span>
            <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 truncate">
            {overview.weddingDate}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">{overview.coupleTitle}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Content Completion</p>
          <p className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">
            {overview.completionPercent}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-slate-900 transition-all duration-300"
              style={{width: `${overview.completionPercent}%`}}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {overview.completedChecklistCount} of {overview.totalChecklistCount} sections ready
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Published Media</p>
          <div className="mt-2 flex items-baseline gap-4 text-slate-900">
            <span className="inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums">
              <ImageIcon className="w-4 h-4 text-slate-400" aria-hidden="true" />
              {overview.publishedPhotosCount}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums">
              <Film className="w-4 h-4 text-slate-400" aria-hidden="true" />
              {overview.publishedVideosCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Draft: {overview.draftPhotosCount} photos · {overview.draftVideosCount} videos
          </p>
        </div>
      </div>

      {/* Guided Setup Banner */}
      <SectionCard
        title="Guided First-Time Setup"
        description={
          overview.setupState.completed
            ? 'Initial guided setup has been completed. You can revisit any step anytime.'
            : `Step ${overview.setupState.currentStep} of 13 · Save progress anytime without publishing prematurely.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[38px]"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preview Draft</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('setup-wizard')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 cursor-pointer min-h-[38px]"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {overview.setupState.completed ? 'Revisit Setup Wizard' : 'Continue Setup Wizard'}
              </span>
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <span>
            Status:{' '}
            <strong className="text-slate-900">
              {overview.setupState.completed ? 'Completed' : 'In Progress'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Visible Ceremonies: <strong className="text-slate-900">{overview.visibleEventsCount}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Family Entries: <strong className="text-slate-900">{overview.familyMembersCount}</strong>
          </span>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sections Needing Information */}
        <SectionCard
          title="Sections Still Needing Information"
          description="Items still using Phase 1 sample placeholders or awaiting customization."
        >
          {overview.sectionsNeedingInfo.length === 0 ? (
            <div className="flex items-center gap-2.5 text-sm text-emerald-700 py-4">
              <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>All core wedding sections have been customized.</span>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overview.sectionsNeedingInfo.map((item) => (
                <li
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateSection(item.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer py-1.5 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50"
                  >
                    <span>Edit</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Real Recent Activity Log */}
        <SectionCard
          title="Recent Saved Activity"
          description="Actual edits, uploads, and publish actions recorded by the server."
        >
          {overview.recentActivity.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 space-y-2">
              <AlertCircle className="w-5 h-5 text-slate-400 mx-auto" aria-hidden="true" />
              <p>No edits recorded yet. Updates will appear here as you save drafts or upload media.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overview.recentActivity.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-900">
                      {entry.section} · {entry.action}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{entry.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Phase 3 Architecture Readiness (Explicitly Deferred) */}
      <SectionCard
        title="Upcoming Modules (Prepared for Phase 3)"
        description="Schema and service boundaries are prepared; these features are intentionally not active in Phase 2."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {name: 'RSVP Management', note: 'Guest responses & headcount'},
            {name: 'Wedding Wishes', note: 'Moderated guestbook blessings'},
            {name: 'Email Notifications', note: 'Resend alerts & confirmations'},
            {name: 'Google Drive Integration', note: 'OAuth photo/video import'},
          ].map((item) => (
            <div
              key={item.name}
              className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>{item.name}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{item.note}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
