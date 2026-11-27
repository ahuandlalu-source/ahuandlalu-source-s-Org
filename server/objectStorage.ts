import fs from 'fs';
import path from 'path';
import {DeleteObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import type {ObjectStorageInfo, ObjectStorageProvider} from '../src/types/phase4';
import {getSupabaseAdmin, isSupabaseConfigured} from './supabase';
import {UPLOADS_DIR} from './store';

function getR2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || '').trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');

  const configured = Boolean(
    accountId && accessKeyId && secretAccessKey && bucket && publicUrl
  );
  return {configured, accountId, accessKeyId, secretAccessKey, bucket, publicUrl};
}

let cachedR2Client: S3Client | null = null;
function getR2Client(): S3Client | null {
  const cfg = getR2Config();
  if (!cfg.configured) return null;
  if (!cachedR2Client) {
    cachedR2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return cachedR2Client;
}

export function getObjectStorageInfo(): ObjectStorageInfo {
  const r2 = getR2Config();
  const supa = isSupabaseConfigured();

  if (r2.configured) {
    return {
      provider: 'r2',
      label: `Cloudflare R2 (${r2.bucket})`,
      r2Configured: true,
      supabaseStorageConfigured: supa,
      notes: `Published media copies directly to Cloudflare R2 and serves via ${r2.publicUrl}.`,
    };
  }
  if (supa) {
    return {
      provider: 'supabase',
      label: 'Supabase Storage CDN (wedding-media)',
      r2Configured: false,
      supabaseStorageConfigured: true,
      notes:
        'Published media copies to your Supabase Storage CDN bucket ("wedding-media"). Add R2_* environment variables if you prefer Cloudflare R2 for very large video files.',
    };
  }
  return {
    provider: 'local',
    label: 'Local Server Storage (data/uploads)',
    r2Configured: false,
    supabaseStorageConfigured: false,
    notes:
      'Neither Cloudflare R2 nor Supabase Storage is configured. Published media copies to local server disk.',
  };
}

export async function uploadDriveMediaToObjectStorage(params: {
  driveFileId: string;
  extension: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{
  provider: ObjectStorageProvider;
  storageKey: string;
  publicUrl: string;
}> {
  const safeId = params.driveFileId.replace(/[^a-zA-Z0-9_-]/g, '');
  const storageKey = `drive-published/${safeId}${params.extension}`;

  // 1. Cloudflare R2 (preferred when configured)
  const r2 = getR2Config();
  const r2Client = getR2Client();
  if (r2.configured && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: storageKey,
        Body: params.buffer,
        ContentType: params.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          'drive-file-id': safeId,
        },
      })
    );
    return {
      provider: 'r2',
      storageKey,
      publicUrl: `${r2.publicUrl}/${storageKey}`,
    };
  }

  // 2. Supabase Storage CDN
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const {error} = await supabase.storage
      .from('wedding-media')
      .upload(storageKey, params.buffer, {
        contentType: params.mimeType,
        cacheControl: '31536000',
        upsert: true, // Idempotent retry without duplicate objects
      });

    if (error) {
      throw new Error(
        `Supabase Storage upload failed (${error.message}). For large videos over 50 MB, configure Cloudflare R2.`
      );
    }

    const {data} = supabase.storage.from('wedding-media').getPublicUrl(storageKey);
    return {
      provider: 'supabase',
      storageKey,
      publicUrl: data.publicUrl,
    };
  }

  // 3. Local Server Storage fallback
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, {recursive: true});
  }
  const fileName = `drive-${safeId}${params.extension}`;
  const fullPath = path.resolve(UPLOADS_DIR, fileName);
  if (!fullPath.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid local storage path.');
  }
  fs.writeFileSync(fullPath, params.buffer);
  return {
    provider: 'local',
    storageKey: fileName,
    publicUrl: `/api/media/file/${encodeURIComponent(fileName)}`,
  };
}

export async function deleteDriveMediaFromObjectStorage(
  provider: ObjectStorageProvider | null,
  storageKey: string | null
): Promise<void> {
  if (!provider || !storageKey) return;

  if (provider === 'r2') {
    const r2 = getR2Config();
    const r2Client = getR2Client();
    if (!r2.configured || !r2Client) {
      throw new Error('Cloudflare R2 credentials are missing; cannot remove R2 object.');
    }
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: r2.bucket,
        Key: storageKey,
      })
    );
    return;
  }

  if (provider === 'supabase') {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase Storage unavailable.');
    }
    const {error} = await supabase.storage.from('wedding-media').remove([storageKey]);
    if (error) {
      throw new Error(`Failed to remove object from Supabase Storage: ${error.message}`);
    }
    return;
  }

  if (provider === 'local') {
    const baseName = path.basename(storageKey);
    const resolved = path.resolve(UPLOADS_DIR, baseName);
    if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }
}
