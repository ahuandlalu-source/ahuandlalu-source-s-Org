import {useCallback, useEffect, useState} from 'react';
import {AlertCircle, Loader2, RefreshCw} from 'lucide-react';
import {weddingConfig as defaultConfig} from './config/weddingConfig';
import type {
  AdminDraftPayload,
  AdminUser,
  AuthStatusResponse,
  PublicWeddingPayload,
} from './types/admin';
import {
  fetchAdminDraft,
  fetchAuthStatus,
  fetchPublicWedding,
  logoutAdminAccount,
} from './services/adminApi';
import {PublicWeddingSite} from './components/PublicWeddingSite';
import {AdminAuthView} from './components/admin/AdminAuthView';
import {AdminDashboard} from './components/admin/AdminDashboard';

type AppRoute = 'public' | 'admin' | 'preview';

function resolveRoute(pathname: string): AppRoute {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return 'admin';
  }
  if (pathname === '/preview' || pathname.startsWith('/preview/')) {
    return 'preview';
  }
  return 'public';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    resolveRoute(window.location.pathname)
  );

  // Auth bearer token stays strictly in React memory (never persisted in localStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AdminUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [publicPayload, setPublicPayload] = useState<PublicWeddingPayload | null>(
    null
  );
  const [publicError, setPublicError] = useState<string | null>(null);
  const [draftPayload, setDraftPayload] = useState<AdminDraftPayload | null>(null);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(resolveRoute(path));
    window.scrollTo({top: 0, behavior: 'auto'});
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadPublicSite = useCallback(async () => {
    setPublicError(null);
    try {
      const payload = await fetchPublicWedding();
      setPublicPayload(payload);
    } catch (err) {
      setPublicError(
        err instanceof Error ? err.message : 'Could not load wedding invitation.'
      );
    }
  }, []);

  const loadAuthState = useCallback(async () => {
    setAuthLoading(true);
    try {
      const status = await fetchAuthStatus(authToken);
      setAuthStatus(status);
      if (status.authenticated && status.user) {
        setAuthUser(status.user);
      } else {
        setAuthToken(null);
        setAuthUser(null);
        setDraftPayload(null);
      }
    } finally {
      setAuthLoading(false);
    }
  }, [authToken]);

  // Fetch public site whenever entering public route
  useEffect(() => {
    if (route === 'public') {
      void loadPublicSite();
    }
  }, [route, loadPublicSite]);

  // Verify auth session whenever entering admin or preview routes
  useEffect(() => {
    if (route === 'admin' || route === 'preview') {
      void loadAuthState();
    }
  }, [route, loadAuthState]);

  // Ensure draft is loaded if navigating directly to /preview while authenticated
  useEffect(() => {
    if (route === 'preview' && authToken && !draftPayload) {
      void fetchAdminDraft(authToken)
        .then(setDraftPayload)
        .catch(() => navigate('/admin'));
    }
  }, [route, authToken, draftPayload, navigate]);

  const handleAuthenticated = useCallback(
    (token: string, user: AdminUser) => {
      setAuthToken(token);
      setAuthUser(user);
      setAuthStatus((prev) =>
        prev
          ? {...prev, requiresSetup: false, authenticated: true, user}
          : prev
      );
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await logoutAdminAccount(authToken);
    setAuthToken(null);
    setAuthUser(null);
    setDraftPayload(null);
    await loadAuthState();
  }, [authToken, loadAuthState]);

  const handleSessionExpired = useCallback(() => {
    setAuthToken(null);
    setAuthUser(null);
    setDraftPayload(null);
    void loadAuthState();
  }, [loadAuthState]);

  if (route === 'preview') {
    if (!authToken || !authUser) {
      return (
        <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full text-center space-y-4">
            <p className="text-sm font-medium text-slate-900">
              Admin authentication required to preview unpublished drafts.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
            >
              Go to Admin Sign In
            </button>
          </div>
        </div>
      );
    }

    if (!draftPayload) {
      return (
        <div className="min-h-dvh bg-[#FAF7F0] flex items-center justify-center p-6 text-[#5E4C45]">
          <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading draft preview" />
        </div>
      );
    }

    return (
      <PublicWeddingSite
        config={draftPayload.draftConfig}
        publicationStatus="published"
        isPreviewMode
        onNavigate={navigate}
      />
    );
  }

  if (route === 'admin') {
    if (authToken && authUser) {
      return (
        <AdminDashboard
          token={authToken}
          user={authUser}
          onDraftSynced={setDraftPayload}
          onOpenPreview={() => navigate('/preview')}
          onOpenPublic={() => navigate('/')}
          onLogout={handleLogout}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (authLoading || !authStatus) {
      return (
        <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-6 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" aria-label="Checking admin session" />
        </div>
      );
    }

    return (
      <AdminAuthView
        authStatus={authStatus}
        onAuthenticated={handleAuthenticated}
        onNavigatePublic={() => navigate('/')}
      />
    );
  }

  // Public Wedding Website Route ('/')
  if (publicError && !publicPayload) {
    return (
      <main className="min-h-dvh bg-[#FAF7F0] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[#F4EFE6] kasavu-frame p-8 space-y-4">
          <AlertCircle className="w-7 h-7 text-[#8C5E58] mx-auto" />
          <p className="text-sm text-[#2C221E]">{publicError}</p>
          <button
            type="button"
            onClick={() => void loadPublicSite()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#B68D40] text-xs font-medium text-[#2C221E] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </main>
    );
  }

  if (!publicPayload) {
    return (
      <div className="min-h-dvh bg-[#FAF7F0] flex items-center justify-center p-6 text-[#B68D40]">
        <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading invitation" />
      </div>
    );
  }

  return (
    <PublicWeddingSite
      config={publicPayload.config || defaultConfig}
      publicationStatus={publicPayload.publicationStatus}
      onNavigate={navigate}
    />
  );
}
