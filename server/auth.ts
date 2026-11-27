import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {NextFunction, Request, Response} from 'express';
import type {AdminUser, AuthStatusResponse} from '../src/types/admin';
import {
  getMissingSupabaseVars,
  getSupabaseAdmin,
  getSupabasePublic,
  isSupabaseConfigured,
} from './supabase';
import {isValidEmail} from './validation';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');

interface LocalOwnerCredential {
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface SignedSessionPayload {
  sub: string;
  role: 'owner';
  mode: 'supabase' | 'local';
  jti: string;
  exp: number;
  supabaseAccessToken?: string;
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminUser;
  sessionJti?: string;
}

// Keep session signing secret strictly in memory if SESSION_SECRET env is not set
const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || FALLBACK_SESSION_SECRET;
}

const revokedTokenJtis = new Set<string>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
}

function readLocalCredential(): LocalOwnerCredential | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LocalOwnerCredential;
    if (!parsed.email || !parsed.salt || !parsed.passwordHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCredential(record: LocalOwnerCredential): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), {mode: 0o600});
}

function hashPassword(password: string, saltHex?: string): {
  salt: string;
  hash: string;
} {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return {salt, hash: derived};
}

function verifyScryptPassword(
  password: string,
  salt: string,
  expectedHashHex: string
): boolean {
  const {hash} = hashPassword(password, salt);
  const actualBuf = Buffer.from(hash, 'hex');
  const expectedBuf = Buffer.from(expectedHashHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function signSessionToken(payload: SignedSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SignedSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedSessionPayload;
    if (
      !parsed.sub ||
      !parsed.jti ||
      !parsed.exp ||
      Date.now() > parsed.exp ||
      revokedTokenJtis.has(parsed.jti)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function getAuthStatus(req: Request): Promise<AuthStatusResponse> {
  const supabaseConfigured = isSupabaseConfigured();
  const missingVars = getMissingSupabaseVars();
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const localCred = readLocalCredential();
  const token = extractBearerToken(req);

  let authenticated = false;
  let user: AdminUser | null = null;

  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      authenticated = true;
      user = {
        email: verified.sub,
        role: 'owner',
        authMode: verified.mode,
      };
    }
  }

  return {
    mode: supabaseConfigured ? 'supabase' : 'local',
    supabaseConfigured,
    supabaseMissingVars: missingVars,
    requiresSetup: !supabaseConfigured && !envPasscode && !localCred,
    envPasscodeActive: Boolean(envPasscode),
    adminEmailHint:
      (process.env.ADMIN_EMAIL || '').trim() || localCred?.email || null,
    authenticated,
    user,
  };
}

export async function setupLocalOwner(
  email: string,
  password: string
): Promise<
  | {ok: true; token: string; user: AdminUser; expiresAt: number}
  | {ok: false; status: number; error: string}
> {
  if (isSupabaseConfigured()) {
    return {
      ok: false,
      status: 400,
      error:
        'Supabase Auth is configured. Please create your owner user in Supabase Auth rather than local setup.',
    };
  }
  if ((process.env.ADMIN_PASSCODE || '').trim()) {
    return {
      ok: false,
      status: 403,
      error: 'Admin access is managed by the server ADMIN_PASSCODE variable.',
    };
  }
  if (readLocalCredential()) {
    return {
      ok: false,
      status: 403,
      error: 'Owner account has already been claimed. Public registration is disabled.',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return {ok: false, status: 400, error: 'Please enter a valid owner email address.'};
  }
  if (password.length < 8) {
    return {
      ok: false,
      status: 400,
      error: 'Password must be at least 8 characters long.',
    };
  }

  const {salt, hash} = hashPassword(password);
  writeLocalCredential({
    email: normalizedEmail,
    salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  });

  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const token = signSessionToken({
    sub: normalizedEmail,
    role: 'owner',
    mode: 'local',
    jti: crypto.randomUUID(),
    exp,
  });

  return {
    ok: true,
    token,
    user: {email: normalizedEmail, role: 'owner', authMode: 'local'},
    expiresAt: exp,
  };
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<
  | {ok: true; token: string; user: AdminUser; expiresAt: number}
  | {ok: false; status: number; error: string}
> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return {ok: false, status: 400, error: 'Email and password are required.'};
  }

  // 1. Supabase Auth path when configured
  if (isSupabaseConfigured()) {
    const supabasePublic = getSupabasePublic();
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabasePublic || !supabaseAdmin) {
      return {ok: false, status: 500, error: 'Supabase client unavailable.'};
    }

    const {data, error} = await supabasePublic.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user || !data.session) {
      return {ok: false, status: 401, error: 'Invalid email or password.'};
    }

    // Single-owner authorization check
    const envAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (envAdminEmail && data.user.email?.toLowerCase() !== envAdminEmail) {
      return {
        ok: false,
        status: 403,
        error: 'This account is not authorized as the wedding website owner.',
      };
    }

    const {data: adminRow} = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (!adminRow) {
      if (envAdminEmail) {
        await supabaseAdmin.from('admin_users').upsert(
          {
            auth_user_id: data.user.id,
            email: normalizedEmail,
            role: 'owner',
          },
          {onConflict: 'email'}
        );
      } else {
        // Auto-authorize if this is the very first admin_users record when ADMIN_EMAIL isn't set
        const {count} = await supabaseAdmin
          .from('admin_users')
          .select('id', {count: 'exact', head: true});

        if ((count ?? 0) === 0) {
          await supabaseAdmin.from('admin_users').insert({
            auth_user_id: data.user.id,
            email: normalizedEmail,
            role: 'owner',
          });
        } else {
          return {
            ok: false,
            status: 403,
            error: 'Account is not listed in admin_users.',
          };
        }
      }
    }

    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const token = signSessionToken({
      sub: normalizedEmail,
      role: 'owner',
      mode: 'supabase',
      jti: crypto.randomUUID(),
      exp,
      supabaseAccessToken: data.session.access_token,
    });

    return {
      ok: true,
      token,
      user: {email: normalizedEmail, role: 'owner', authMode: 'supabase'},
      expiresAt: exp,
    };
  }

  // 2. Local server mode (ADMIN_PASSCODE env override or claimed owner scrypt hash)
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (envPasscode) {
    if (envEmail && normalizedEmail !== envEmail) {
      return {ok: false, status: 401, error: 'Invalid email or password.'};
    }
    const inputBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(envPasscode);
    if (
      inputBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(inputBuf, expectedBuf)
    ) {
      return {ok: false, status: 401, error: 'Invalid email or password.'};
    }

    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const token = signSessionToken({
      sub: normalizedEmail,
      role: 'owner',
      mode: 'local',
      jti: crypto.randomUUID(),
      exp,
    });
    return {
      ok: true,
      token,
      user: {email: normalizedEmail, role: 'owner', authMode: 'local'},
      expiresAt: exp,
    };
  }

  const localCred = readLocalCredential();
  if (!localCred) {
    return {
      ok: false,
      status: 409,
      error: 'Owner account not set up yet. Complete first-time owner setup first.',
    };
  }

  if (
    localCred.email.toLowerCase() !== normalizedEmail ||
    !verifyScryptPassword(password, localCred.salt, localCred.passwordHash)
  ) {
    return {ok: false, status: 401, error: 'Invalid email or password.'};
  }

  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const token = signSessionToken({
    sub: localCred.email,
    role: 'owner',
    mode: 'local',
    jti: crypto.randomUUID(),
    exp,
  });

  return {
    ok: true,
    token,
    user: {email: localCred.email, role: 'owner', authMode: 'local'},
    expiresAt: exp,
  };
}

export function logoutAdmin(req: Request): void {
  const token = extractBearerToken(req);
  if (!token) return;
  const verified = verifySessionToken(token);
  if (verified) {
    revokedTokenJtis.add(verified.jti);
  }
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ok: boolean; status: number; message: string}> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return {ok: false, status: 400, message: 'Please provide a valid email address.'};
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 501,
      message:
        'Verified email password reset requires Supabase Auth (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). Configure Supabase in environment variables to send reset emails.',
    };
  }

  const supabasePublic = getSupabasePublic();
  if (!supabasePublic) {
    return {ok: false, status: 500, message: 'Supabase Auth client unavailable.'};
  }

  const {error} = await supabasePublic.auth.resetPasswordForEmail(normalized, {
    redirectTo,
  });

  if (error) {
    return {ok: false, status: 400, message: error.message};
  }

  return {
    ok: true,
    status: 200,
    message:
      'If an owner account matches that email in Supabase Auth, a password reset link has been sent.',
  };
}

export async function verifyAdminRequest(req: Request): Promise<AdminUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const verified = verifySessionToken(token);
  if (!verified) return null;

  if (verified.mode === 'supabase' && isSupabaseConfigured() && verified.supabaseAccessToken) {
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const {data, error} = await supabaseAdmin.auth.getUser(verified.supabaseAccessToken);
      if (error || !data.user) {
        return null;
      }
    }
  }

  return {
    email: verified.sub,
    role: 'owner',
    authMode: verified.mode,
  };
}

export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({error: 'Authentication required.'});
    return;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({error: 'Session expired or invalid. Please sign in again.'});
    return;
  }

  if (verified.mode === 'supabase' && isSupabaseConfigured() && verified.supabaseAccessToken) {
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const {data, error} = await supabaseAdmin.auth.getUser(verified.supabaseAccessToken);
      if (error || !data.user) {
        res.status(401).json({error: 'Supabase session is no longer valid.'});
        return;
      }
    }
  }

  req.adminUser = {
    email: verified.sub,
    role: 'owner',
    authMode: verified.mode,
  };
  req.sessionJti = verified.jti;
  next();
}
