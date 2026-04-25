import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import type { SponsorVideo } from '@/types';

const SUPABASE_SPONSOR_VIDEO_BUCKET = (process.env.EXPO_PUBLIC_SUPABASE_SPONSOR_VIDEO_BUCKET || 'sponsor-videos').trim();
const MAX_PROMOTIONAL_VIDEO_BYTES = 50 * 1024 * 1024;
const STORAGE_READ_POLICY_NAME = 'Public can read sponsor videos';
const STORAGE_INSERT_POLICY_NAME = 'App can upload sponsor videos';
const STORAGE_POLICY_ROLES_SQL = 'anon, authenticated';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
};

const SUPPORTED_VIDEO_MIME_TYPES = Object.keys(MIME_EXTENSION_MAP);

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : '';
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'item';
}

function getFileExtension(fileName?: string, mimeType?: string, fileUri?: string): string {
  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const explicitName = fileName || fileUri || '';
  const parts = explicitName.split('.');
  const extension = parts.length > 1 ? parts[parts.length - 1]?.split('?')[0]?.trim().toLowerCase() : '';

  if (extension) {
    return extension;
  }

  return 'mp4';
}

function inferMimeType(fileName?: string, mimeType?: string, fileUri?: string): string {
  if (mimeType) {
    return mimeType;
  }

  const extension = getFileExtension(fileName, mimeType, fileUri);
  return `video/${extension}`;
}

function buildPublicPath(sponsorId: string, extension: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `sponsors/${sanitizePathSegment(sponsorId)}/${timestamp}-${randomSuffix}.${extension}`;
}

async function readUriAsArrayBuffer(fileUri: string): Promise<ArrayBuffer> {
  try {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', fileUri, true);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        if ((request.status >= 200 && request.status < 300) || request.status === 0) {
          resolve(request.response as ArrayBuffer);
          return;
        }
        reject(new Error(`Falha ao ler arquivo local (${request.status})`));
      };
      request.onerror = () => reject(new Error('Falha ao abrir o arquivo local selecionado'));
      request.send();
    });
  } catch {
    const response = await fetch(fileUri);
    if (!response.ok) {
      throw new Error('Nao foi possivel ler o video selecionado');
    }
    return response.arrayBuffer();
  }
}

export function getSponsorVideoBucketName(): string {
  return SUPABASE_SPONSOR_VIDEO_BUCKET;
}

export function getSponsorVideoStorageSetupInstructions(): string {
  return `Crie o bucket publico "${SUPABASE_SPONSOR_VIDEO_BUCKET}" no Supabase Storage e libere upload/leitura para os papeis anon e authenticated.`;
}

export function getSponsorVideoStorageSetupSql(): string {
  const bucketName = escapeSqlLiteral(SUPABASE_SPONSOR_VIDEO_BUCKET);
  const allowedMimeTypes = SUPPORTED_VIDEO_MIME_TYPES
    .map((mimeType) => `'${escapeSqlLiteral(mimeType)}'`)
    .join(', ');

  return `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('${bucketName}', '${bucketName}', true, ${MAX_PROMOTIONAL_VIDEO_BYTES}, array[${allowedMimeTypes}])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "${STORAGE_READ_POLICY_NAME}" on storage.objects;
create policy "${STORAGE_READ_POLICY_NAME}"
  on storage.objects
  for select
  to ${STORAGE_POLICY_ROLES_SQL}
  using (bucket_id = '${bucketName}');

drop policy if exists "${STORAGE_INSERT_POLICY_NAME}" on storage.objects;
create policy "${STORAGE_INSERT_POLICY_NAME}"
  on storage.objects
  for insert
  to ${STORAGE_POLICY_ROLES_SQL}
  with check (bucket_id = '${bucketName}');`;
}

export function isSponsorVideoBucketMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return /bucket\s+not\s+found/.test(message) || /bucket.*does not exist/.test(message);
}

export function isSponsorVideoStoragePolicyError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return /row-level security|violates row-level security policy|permission|not allowed|unauthorized/.test(message);
}

export function formatVideoDuration(durationSeconds?: number): string {
  if (!durationSeconds || durationSeconds <= 0) {
    return 'Duracao indisponivel';
  }

  const totalSeconds = Math.max(1, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export async function uploadSponsorPromotionalVideo({
  sponsorId,
  fileUri,
  fileName,
  mimeType,
  title,
  durationSeconds,
}: {
  sponsorId: string;
  fileUri: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  durationSeconds?: number;
}): Promise<SponsorVideo> {
  if (!hasSupabaseConfig) {
    throw new Error('Configure o Supabase antes de enviar videos promocionais');
  }

  if (!SUPABASE_SPONSOR_VIDEO_BUCKET) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_SPONSOR_VIDEO_BUCKET para salvar videos');
  }

  const extension = getFileExtension(fileName, mimeType, fileUri);
  const resolvedMimeType = inferMimeType(fileName, mimeType, fileUri);
  const storagePath = buildPublicPath(sponsorId, extension);
  const arrayBuffer = await readUriAsArrayBuffer(fileUri);

  const { error } = await supabase.storage.from(SUPABASE_SPONSOR_VIDEO_BUCKET).upload(storagePath, arrayBuffer, {
    contentType: resolvedMimeType,
    upsert: false,
  });

  if (error) {
    if (isSponsorVideoBucketMissingError(error)) {
      throw new Error(getSponsorVideoStorageSetupInstructions());
    }

    if (isSponsorVideoStoragePolicyError(error)) {
      throw new Error(`O bucket \"${SUPABASE_SPONSOR_VIDEO_BUCKET}\" existe, mas o app ainda nao tem permissao para enviar videos. Execute o SQL de setup do Storage no Supabase.`);
    }

    throw new Error(error.message || 'Falha ao enviar video para o Supabase');
  }

  const { data } = supabase.storage.from(SUPABASE_SPONSOR_VIDEO_BUCKET).getPublicUrl(storagePath);

  return {
    id: `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: data.publicUrl,
    storagePath,
    title: title?.trim() || fileName || 'Video promocional',
    fileName,
    mimeType: resolvedMimeType,
    durationSeconds,
    createdAt: new Date().toISOString(),
    likes: 0,
  };
}