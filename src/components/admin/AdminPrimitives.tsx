import {useRef, useState, type ReactNode} from 'react';
import {AlertTriangle, Check, Loader2, Save, Upload} from 'lucide-react';
import type {LocalizedText} from '../../types/wedding';

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({
  label,
  required,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <label className="text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600 ml-1">*</span>}
      </label>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
}

export function LocalizedInput({
  label,
  value,
  onChange,
  required,
  placeholderEn,
  placeholderMl,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  required?: boolean;
  placeholderEn?: string;
  placeholderMl?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="block text-[11px] text-slate-400 mb-1">English</span>
          <input
            type="text"
            value={value.en}
            onChange={(e) => onChange({...value, en: e.target.value})}
            placeholder={placeholderEn}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div>
          <span className="block text-[11px] text-slate-400 mb-1">
            Malayalam (മലയാളം)
          </span>
          <input
            type="text"
            lang="ml"
            value={value.ml}
            onChange={(e) => onChange({...value, ml: e.target.value})}
            placeholder={placeholderMl}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export function LocalizedTextarea({
  label,
  value,
  onChange,
  required,
  rows = 3,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="block text-[11px] text-slate-400 mb-1">English</span>
          <textarea
            rows={rows}
            value={value.en}
            onChange={(e) => onChange({...value, en: e.target.value})}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none resize-y"
          />
        </div>
        <div>
          <span className="block text-[11px] text-slate-400 mb-1">
            Malayalam (മലയാളം)
          </span>
          <textarea
            rows={rows}
            lang="ml"
            value={value.ml}
            onChange={(e) => onChange({...value, ml: e.target.value})}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none resize-y"
          />
        </div>
      </div>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function SaveActionBar({
  dirty,
  saving,
  savedNotice,
  error,
  onSave,
  label = 'Save Draft Changes',
}: {
  dirty: boolean;
  saving: boolean;
  savedNotice: string | null;
  error: string | null;
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="sticky bottom-3 z-20 mt-6 bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
      <div className="text-xs flex items-center gap-2">
        {error ? (
          <span className="text-rose-600 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </span>
        ) : savedNotice ? (
          <span className="text-emerald-700 font-medium flex items-center gap-1.5">
            <Check className="w-4 h-4 shrink-0" />
            {savedNotice} Use Preview Draft or Publish Live in the top bar.
          </span>
        ) : dirty ? (
          <span className="text-amber-700 font-medium">
            Unsaved changes in this section — click Save Draft Changes first
          </span>
        ) : (
          <span className="text-slate-500">
            All edits saved to draft (click Publish Live to update the public site)
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap min-h-[40px]"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{saving ? 'Saving…' : label}</span>
      </button>
    </div>
  );
}

export function FileUploadButton({
  accept,
  label,
  onUpload,
}: {
  accept: string;
  label: string;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium transition-colors cursor-pointer min-h-[38px] whitespace-nowrap"
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{uploading ? 'Uploading…' : label}</span>
      </button>
    </>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl">
        <h3
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-xs font-medium text-white cursor-pointer min-h-[40px] ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
