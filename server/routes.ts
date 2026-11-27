import fs from 'fs';
import path from 'path';
import express, {type Express, type Request} from 'express';
import {
  getAuthStatus,
  loginAdmin,
  logoutAdmin,
  requestPasswordReset,
  requireAdminAuth,
  setupLocalOwner,
  verifyAdminRequest,
  type AuthenticatedRequest,
} from './auth';
import {
  deleteAdminRsvp,
  deleteAdminWish,
  generateRsvpCsv,
  getAdminRsvpDashboard,
  getAdminWishesDashboard,
  getPhase3PublicData,
  getProtectedWishPhoto,
  retryEmailDelivery,
  submitPublicRsvp,
  submitPublicWish,
  updateAdminPhase3Settings,
  updateAdminRsvp,
  updateAdminWish,
} from './phase3Store';
import {
  clearAllMediaAssets,
  discardUnpublishedDraft,
  deleteMediaAsset,
  getAdminDraftPayload,
  getAdminOverview,
  getPublicWeddingPayload,
  publishDraftToPublic,
  unpublishPublicSite,
  updateDraftConfig,
  uploadMediaAsset,
  UPLOADS_DIR,
} from './store';
import {
  approveAndPublishDriveMediaItem,
  browseGoogleDriveFolders,
  buildServerGoogleOAuthUrl,
  completeServerGoogleOAuthCallback,
  connectGoogleDriveWithToken,
  disconnectGoogleDrive,
  getDrivePreviewTokensForItems,
  getPhase4AdminDashboard,
  proxyDriveFileStream,
  removeCopiedDriveMediaAsset,
  removeDriveDiscoveryEntry,
  reorderDriveMediaItems,
  saveDriveFolderAssignments,
  syncConfiguredDriveFolders,
  unpublishDriveMediaItem,
  updateDriveMediaMetadata,
} from './driveStore';
import {
  checkSlidingRateLimit,
  verifyDrivePreviewToken,
  verifyWishPhotoToken,
} from './validation';

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getReqOrigin(req: Request): string {
  const proto =
    (typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0].trim()
      : req.protocol) || 'http';
  const host = req.get('host');
  return host ? `${proto}://${host}` : '';
}

export function registerApiRoutes(app: Express): void {
  // 1. Public Read Endpoint (returns ONLY published snapshot; never leaks draft or secrets)
  app.get('/api/public/wedding', async (_req, res) => {
    try {
      const payload = await getPublicWeddingPayload();
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load wedding site.',
      });
    }
  });

  // 1b. Phase 3 Public Data (RSVP config + approved/published wishes ONLY)
  app.get('/api/public/phase3', async (_req, res) => {
    try {
      const payload = await getPhase3PublicData();
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load RSVP and wishes information.',
      });
    }
  });

  // 1c. Public RSVP Submission (validated, rate-limited, honeypot-protected)
  app.post('/api/public/rsvp', async (req, res) => {
    try {
      // Honeypot & ultra-fast bot submission guard
      const honeypot = typeof req.body?.website === 'string' ? req.body.website.trim() : '';
      if (honeypot !== '') {
        res.status(400).json({error: 'Invalid submission detected.'});
        return;
      }

      const clientIp = getClientIp(req);
      if (!checkSlidingRateLimit('rsvp', clientIp, 10, 10 * 60 * 1000)) {
        res.status(429).json({
          error: 'Too many RSVP attempts from this connection. Please wait a few minutes and try again.',
        });
        return;
      }

      const result = await submitPublicRsvp({
        guestName: req.body?.guestName,
        attendance: req.body?.attendance,
        attendeeCount: req.body?.attendeeCount,
        message: req.body?.message,
        customFields: req.body?.customFields,
        clientSubmissionKey: req.body?.clientSubmissionKey,
        reqOrigin: getReqOrigin(req),
      });

      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to save your RSVP.',
      });
    }
  });

  // 1d. Public Wedding Wish Submission (requires preview confirmation, magic-byte photo check)
  app.post(
    '/api/public/wishes',
    express.json({limit: '8mb'}),
    async (req, res) => {
      try {
        const honeypot =
          typeof req.body?.website === 'string' ? req.body.website.trim() : '';
        if (honeypot !== '') {
          res.status(400).json({error: 'Invalid submission detected.'});
          return;
        }

        const clientIp = getClientIp(req);
        if (!checkSlidingRateLimit('wishes', clientIp, 8, 10 * 60 * 1000)) {
          res.status(429).json({
            error:
              'Too many wish submissions from this connection. Please wait a few minutes and try again.',
          });
          return;
        }

        const result = await submitPublicWish({
          guestName: req.body?.guestName,
          message: req.body?.message,
          emoji: req.body?.emoji,
          photoDataUrl: req.body?.photoDataUrl,
          previewConfirmed: req.body?.previewConfirmed,
          clientSubmissionKey: req.body?.clientSubmissionKey,
          reqOrigin: getReqOrigin(req),
        });

        res.status(result.duplicate ? 200 : 201).json(result);
      } catch (err) {
        res.status(400).json({
          error:
            err instanceof Error ? err.message : 'Unable to save your wedding wish.',
        });
      }
    }
  );

  // 1e. Protected Wish Photo Reader (pending/rejected/hidden photos strictly require admin auth or signed HMAC token)
  app.get('/api/wishes/:id/photo', async (req, res) => {
    try {
      const wishId = String(req.params.id || '');
      const accessToken =
        typeof req.query?.access === 'string' ? req.query.access : '';
      const adminUser = await verifyAdminRequest(req);
      const hasAdminAccess =
        Boolean(adminUser) || verifyWishPhotoToken(accessToken, wishId);

      const result = await getProtectedWishPhoto(wishId, hasAdminAccess);
      if (result.ok === false) {
        res
          .status(result.status)
          .json({
            error:
              result.status === 403
                ? 'This wish photograph is private until approved.'
                : 'Photograph not found.',
          });
        return;
      }

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Cache-Control',
        hasAdminAccess ? 'private, no-store' : 'public, max-age=300'
      );
      res.send(result.buffer);
    } catch {
      res.status(500).json({error: 'Unable to load photograph.'});
    }
  });

  // 2. Serve Uploaded Local Media Safely (strict path traversal confinement)
  app.get('/api/media/file/:filename', (req, res) => {
    const rawName = req.params.filename || '';
    const baseName = path.basename(rawName);
    const resolved = path.resolve(UPLOADS_DIR, baseName);

    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({error: 'Media file not found.'});
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolved);
  });

  // 3. Admin Authentication Endpoints (No public registration)
  app.get('/api/admin/auth/status', async (req, res) => {
    try {
      const status = await getAuthStatus(req);
      res.setHeader('Cache-Control', 'no-store');
      res.json(status);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to check auth status.',
      });
    }
  });

  app.post('/api/admin/auth/setup', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = await setupLocalOwner(email, password);
    if (result.ok === false) {
      res.status(result.status).json({error: result.error});
      return;
    }
    res.json({
      token: result.token,
      user: result.user,
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/admin/auth/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const result = await loginAdmin(email, password);
    if (result.ok === false) {
      res.status(result.status).json({error: result.error});
      return;
    }
    res.json({
      token: result.token,
      user: result.user,
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    logoutAdmin(req);
    res.json({ok: true});
  });

  app.post('/api/admin/auth/reset-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const redirectTo =
      typeof req.body?.redirectTo === 'string' ? req.body.redirectTo : undefined;
    const result = await requestPasswordReset(email, redirectTo);
    res.status(result.status).json({ok: result.ok, message: result.message});
  });

  // 4. Protected Admin CMS Routes (Bearer Token Required)
  app.get('/api/admin/overview', requireAdminAuth, async (_req, res) => {
    try {
      const overview = await getAdminOverview();
      res.json(overview);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load overview.',
      });
    }
  });

  app.get('/api/admin/draft', requireAdminAuth, async (_req, res) => {
    try {
      const payload = await getAdminDraftPayload();
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load draft content.',
      });
    }
  });

  app.put('/api/admin/draft', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.body?.draftConfig) {
        res.status(400).json({error: 'draftConfig payload is required.'});
        return;
      }
      const updated = await updateDraftConfig({
        draftConfig: req.body.draftConfig,
        setupState: req.body.setupState,
        actorEmail: req.adminUser?.email || 'owner',
        sectionLabel:
          typeof req.body.sectionLabel === 'string' ? req.body.sectionLabel : 'Content',
        summary:
          typeof req.body.summary === 'string'
            ? req.body.summary
            : 'Saved draft changes.',
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to save draft changes.',
      });
    }
  });

  app.post(
    '/api/admin/upload',
    requireAdminAuth,
    express.raw({
      type: ['image/*', 'video/*', 'audio/*'],
      limit: '25mb',
    }),
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!Buffer.isBuffer(req.body)) {
          res.status(400).json({error: 'Invalid binary upload payload.'});
          return;
        }
        const mimeType = String(req.headers['content-type'] || '');
        const rawNameHeader = req.headers['x-file-name'];
        const originalName =
          typeof rawNameHeader === 'string'
            ? decodeURIComponent(rawNameHeader)
            : 'upload';

        const asset = await uploadMediaAsset({
          buffer: req.body,
          originalName,
          mimeType,
          actorEmail: req.adminUser?.email || 'owner',
        });
        res.status(201).json({asset});
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Upload failed.',
        });
      }
    }
  );

  app.delete(
    '/api/admin/media',
    requireAdminAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const nextLibrary = await clearAllMediaAssets(
          req.adminUser?.email || 'owner'
        );
        res.json({mediaLibrary: nextLibrary});
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to clear media library.',
        });
      }
    }
  );

  app.delete(
    '/api/admin/media/:id',
    requireAdminAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const assetId = String(req.params.id || '');
        const nextLibrary = await deleteMediaAsset(
          assetId,
          req.adminUser?.email || 'owner'
        );
        res.json({mediaLibrary: nextLibrary});
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to delete media asset.',
        });
      }
    }
  );

  app.post(
    '/api/admin/publish',
    requireAdminAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await publishDraftToPublic(req.adminUser?.email || 'owner');
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Publish failed.',
        });
      }
    }
  );

  app.post(
    '/api/admin/unpublish',
    requireAdminAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await unpublishPublicSite(req.adminUser?.email || 'owner');
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unpublish failed.',
        });
      }
    }
  );

  app.post(
    '/api/admin/discard-draft',
    requireAdminAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await discardUnpublishedDraft(req.adminUser?.email || 'owner');
        res.json(result);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Discard draft failed.',
        });
      }
    }
  );

  // 5. Phase 3 Protected Admin Routes (RSVP, Wedding Wishes & Email Notifications)
  app.get('/api/admin/rsvps', requireAdminAuth, async (_req, res) => {
    try {
      const payload = await getAdminRsvpDashboard();
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load RSVP records.',
      });
    }
  });

  app.get('/api/admin/rsvps/export.csv', requireAdminAuth, async (_req, res) => {
    try {
      const csv = await generateRsvpCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="wedding-rsvps.csv"'
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(csv);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to export RSVPs.',
      });
    }
  });

  app.patch('/api/admin/rsvps/:id', requireAdminAuth, async (req, res) => {
    try {
      const entry = await updateAdminRsvp(String(req.params.id || ''), req.body || {});
      res.json({entry});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update RSVP.',
      });
    }
  });

  app.delete('/api/admin/rsvps/:id', requireAdminAuth, async (req, res) => {
    try {
      await deleteAdminRsvp(String(req.params.id || ''));
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to delete RSVP.',
      });
    }
  });

  app.get('/api/admin/wishes', requireAdminAuth, async (_req, res) => {
    try {
      const payload = await getAdminWishesDashboard();
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load wedding wishes.',
      });
    }
  });

  app.patch('/api/admin/wishes/:id', requireAdminAuth, async (req, res) => {
    try {
      const wish = await updateAdminWish(String(req.params.id || ''), req.body || {});
      res.json({wish});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update wedding wish.',
      });
    }
  });

  app.delete('/api/admin/wishes/:id', requireAdminAuth, async (req, res) => {
    try {
      await deleteAdminWish(String(req.params.id || ''));
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to delete wedding wish.',
      });
    }
  });

  app.put('/api/admin/phase3/settings', requireAdminAuth, async (req, res) => {
    try {
      const settings = await updateAdminPhase3Settings(req.body || {});
      res.json({settings});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update settings.',
      });
    }
  });

  app.post(
    '/api/admin/email-deliveries/:id/retry',
    requireAdminAuth,
    async (req, res) => {
      try {
        const delivery = await retryEmailDelivery(
          String(req.params.id || ''),
          getReqOrigin(req)
        );
        res.json({delivery});
      } catch (err) {
        res.status(400).json({
          error:
            err instanceof Error ? err.message : 'Failed to retry notification email.',
        });
      }
    }
  );

  // 6. Phase 4 Protected Admin Routes (Google Drive OAuth, Folder Config, Sync & Media Pipeline)
  app.get('/api/admin/drive', requireAdminAuth, async (_req, res) => {
    try {
      const dashboard = await getPhase4AdminDashboard();
      const previewUrls = await getDrivePreviewTokensForItems(
        dashboard.items.map((i) => i.driveFileId)
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json({...dashboard, previewUrls});
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to load Google Drive integration status.',
      });
    }
  });

  app.post('/api/admin/drive/connect-token', requireAdminAuth, async (req, res) => {
    try {
      const accessToken =
        typeof req.body?.accessToken === 'string' ? req.body.accessToken : '';
      const expiresInSeconds =
        typeof req.body?.expiresInSeconds === 'number'
          ? req.body.expiresInSeconds
          : undefined;
      const connection = await connectGoogleDriveWithToken({
        accessToken,
        expiresInSeconds,
        authMethod: 'firebase_oauth',
      });
      res.json({connection});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to verify and store Google Drive connection.',
      });
    }
  });

  app.post('/api/admin/drive/disconnect', requireAdminAuth, async (_req, res) => {
    try {
      const connection = await disconnectGoogleDrive();
      res.json({connection});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Failed to disconnect Google Drive.',
      });
    }
  });

  app.get('/api/admin/drive/oauth/url', requireAdminAuth, (req, res) => {
    try {
      const baseOrigin = (process.env.APP_URL || '').trim() || getReqOrigin(req);
      const redirectUri = `${baseOrigin.replace(/\/$/, '')}/api/admin/drive/oauth/callback`;
      const url = buildServerGoogleOAuthUrl(redirectUri);
      res.json({url, redirectUri});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Server Google OAuth client is not configured.',
      });
    }
  });

  app.get(
    ['/api/admin/drive/oauth/callback', '/api/admin/drive/oauth/callback/'],
    async (req, res) => {
      const code = typeof req.query?.code === 'string' ? req.query.code : '';
      const state = typeof req.query?.state === 'string' ? req.query.state : '';
      const oauthErr = typeof req.query?.error === 'string' ? req.query.error : '';

      const renderCallbackHtml = (ok: boolean, message: string) => {
        const payload = JSON.stringify({
          type: ok ? 'GOOGLE_DRIVE_OAUTH_SUCCESS' : 'GOOGLE_DRIVE_OAUTH_ERROR',
          message,
        });
        res
          .status(ok ? 200 : 400)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(`<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Google Drive Authorization</title></head>
  <body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center;color:#1e293b;">
    <p>${ok ? 'Google Drive connected successfully. You can close this window.' : 'Authorization failed. Returning to Admin...'}</p>
    <script>
      if (window.opener) {
        window.opener.postMessage(${payload}, window.location.origin);
      }
      setTimeout(function() { window.close(); }, 600);
    </script>
  </body>
</html>`);
      };

      if (oauthErr) {
        renderCallbackHtml(false, `Google authorization declined: ${oauthErr}`);
        return;
      }
      if (!code || !state) {
        renderCallbackHtml(false, 'Missing authorization code or state.');
        return;
      }

      try {
        const baseOrigin = (process.env.APP_URL || '').trim() || getReqOrigin(req);
        const redirectUri = `${baseOrigin.replace(/\/$/, '')}/api/admin/drive/oauth/callback`;
        await completeServerGoogleOAuthCallback({code, state, redirectUri});
        renderCallbackHtml(true, 'Connected Google Drive account.');
      } catch (err) {
        renderCallbackHtml(
          false,
          err instanceof Error ? err.message : 'OAuth callback failed.'
        );
      }
    }
  );

  app.get('/api/admin/drive/folders', requireAdminAuth, async (req, res) => {
    try {
      const parentId =
        typeof req.query?.parentId === 'string' ? req.query.parentId : undefined;
      const search =
        typeof req.query?.search === 'string' ? req.query.search : undefined;
      const folders = await browseGoogleDriveFolders({parentId, search});
      res.setHeader('Cache-Control', 'no-store');
      res.json({folders});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to browse Google Drive folders.',
      });
    }
  });

  app.put('/api/admin/drive/folders', requireAdminAuth, async (req, res) => {
    try {
      const folders = await saveDriveFolderAssignments(req.body?.folders || req.body || {});
      res.json({folders});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to save Google Drive folder configuration.',
      });
    }
  });

  app.post('/api/admin/drive/sync', requireAdminAuth, async (_req, res) => {
    try {
      const result = await syncConfiguredDriveFolders();
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Google Drive synchronization failed.',
      });
    }
  });

  app.get('/api/admin/drive/files/:driveFileId/preview', async (req, res) => {
    try {
      const driveFileId = String(req.params.driveFileId || '');
      const accessToken =
        typeof req.query?.access === 'string' ? req.query.access : '';
      const adminUser = await verifyAdminRequest(req);
      const allowed =
        Boolean(adminUser) || verifyDrivePreviewToken(accessToken, driveFileId);
      if (!allowed) {
        res.status(401).json({error: 'Admin preview authorization required.'});
        return;
      }

      const rangeHeader =
        typeof req.headers.range === 'string' ? req.headers.range : undefined;
      const stream = await proxyDriveFileStream(driveFileId, rangeHeader);
      res.status(stream.status);
      res.setHeader('Content-Type', stream.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      if (stream.contentRange) {
        res.setHeader('Content-Range', stream.contentRange);
      }
      if (stream.contentLength) {
        res.setHeader('Content-Length', stream.contentLength);
      }
      res.send(stream.buffer);
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Unable to preview Google Drive file.',
      });
    }
  });

  app.patch('/api/admin/drive/items/:id', requireAdminAuth, async (req, res) => {
    try {
      const item = await updateDriveMediaMetadata(
        String(req.params.id || ''),
        req.body || {}
      );
      res.json({item});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to update media item.',
      });
    }
  });

  app.put('/api/admin/drive/items/reorder', requireAdminAuth, async (req, res) => {
    try {
      const orderedIds = Array.isArray(req.body?.orderedIds)
        ? req.body.orderedIds.map((x: unknown) => String(x))
        : [];
      await reorderDriveMediaItems(orderedIds);
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to reorder media items.',
      });
    }
  });

  app.post('/api/admin/drive/items/:id/publish', requireAdminAuth, async (req, res) => {
    try {
      const item = await approveAndPublishDriveMediaItem(
        String(req.params.id || ''),
        req.body?.assignedSection
      );
      res.json({item});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to import and publish Drive media item.',
      });
    }
  });

  app.post('/api/admin/drive/items/:id/unpublish', requireAdminAuth, async (req, res) => {
    try {
      const item = await unpublishDriveMediaItem(String(req.params.id || ''));
      res.json({item});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to unpublish item.',
      });
    }
  });

  app.delete('/api/admin/drive/items/:id/storage', requireAdminAuth, async (req, res) => {
    try {
      const item = await removeCopiedDriveMediaAsset(String(req.params.id || ''));
      res.json({item});
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to remove copied storage asset.',
      });
    }
  });

  app.delete('/api/admin/drive/items/:id', requireAdminAuth, async (req, res) => {
    try {
      await removeDriveDiscoveryEntry(String(req.params.id || ''));
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to remove discovery entry.',
      });
    }
  });
}
