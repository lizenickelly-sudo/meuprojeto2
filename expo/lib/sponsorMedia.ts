import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import type { SponsorVideo } from '@/types';

const SUPABASE_SPONSOR_VIDEO_BUCKET = (process.env.EXPO_PUBLIC_SUPABASE_SPONSOR_VIDEO_BUCKET || 'sponsor-videos').trim();

const MIME_EXTENSION_MAP: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
};

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
    if (/bucket/i.test(error.message)) {
      throw new Error(`Crie o bucket publico \"${SUPABASE_SPONSOR_VIDEO_BUCKET}\" no Supabase Storage para salvar videos`);
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
  };
}