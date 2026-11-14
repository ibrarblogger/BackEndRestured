import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { env } from './env';
import { logger } from './logger';
import { isServerless } from './runtime';

export type StorageBucket = 'menu-images' | 'receipts' | 'avatars';

let supabaseAdminClient: SupabaseClient | null = null;

function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_SECRET_KEY &&
      !env.SUPABASE_URL.includes('placeholder') &&
      !env.SUPABASE_SECRET_KEY.includes('placeholder')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseStorageConfigured()) {
    return null;
  }
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(env.SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminClient;
}

/**
 * Uploads a file buffer to Supabase Storage (`menu-images`, `receipts`, `avatars`)
 * using the server-side SUPABASE_SECRET_KEY (`sb_secret_...`).
 * Automatically falls back to /tmp (serverless) or /uploads/<bucket>/ (local disk).
 */
export async function uploadFile(params: {
  bucket: StorageBucket;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  isPublic?: boolean;
}): Promise<{ url: string; storageProvider: 'supabase' | 'local' }> {
  const { bucket, fileName, buffer, mimeType, isPublic = true } = params;
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const client = getSupabaseClient();

  if (client) {
    const filePath = `${safeName}`;
    const { error } = await client.storage.from(bucket).upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      logger.warn(
        { bucket, err: error.message },
        'Supabase Storage upload failed; falling back to temporary disk storage'
      );
    } else {
      if (isPublic) {
        const { data } = client.storage.from(bucket).getPublicUrl(filePath);
        return { url: data.publicUrl, storageProvider: 'supabase' };
      } else {
        const { data, error: signErr } = await client.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
        if (!signErr && data?.signedUrl) {
          return { url: data.signedUrl, storageProvider: 'supabase' };
        }
      }
    }
  }

  // Fallback storage: On Vercel / serverless, filesystem is read-only except /tmp
  const uploadDir = isServerless
    ? path.join(os.tmpdir(), 'uploads', bucket)
    : path.join(process.cwd(), 'uploads', bucket);

  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, safeName);
    fs.writeFileSync(fullPath, buffer);
  } catch (fsErr: any) {
    logger.error({ err: fsErr?.message }, 'Failed to write fallback upload file to disk');
  }

  const localUrl = `${env.API_BASE_URL}/uploads/${bucket}/${safeName}`;
  return { url: localUrl, storageProvider: 'local' };
}
