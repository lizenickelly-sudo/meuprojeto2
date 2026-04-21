import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const SUPABASE_ADMIN_IMAGE_BUCKET = (process.env.EXPO_PUBLIC_SUPABASE_ADMIN_IMAGE_BUCKET || 'admin-images').trim();
const MAX_ADMIN_IMAGE_BYTES = 10 * 1024 * 1024;
const STORAGE_READ_POLICY_NAME = 'Public can read admin images';
const STORAGE_INSERT_POLICY_NAME = 'App can upload admin images';
const STORAGE_POLICY_ROLES_SQL = 'anon, authenticated';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const SUPPORTED_IMAGE_MIME_TYPES = Object.keys(MIME_EXTENSION_MAP);

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

  if (extension === 'jpeg') return 'jpg';
  if (extension) return extension;
  return 'jpg';
}

function inferMimeType(fileName?: string, mimeType?: string, fileUri?: string): string {
  if (mimeType && SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType)) {
    return mimeType;
  }

  const extension = getFileExtension(fileName, mimeType, fileUri);
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function buildPublicPath(folder: string, itemId: string, extension: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${sanitizePathSegment(folder)}/${sanitizePathSegment(itemId)}/${timestamp}-${randomSuffix}.${extension}`;
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
      throw new Error('Nao foi possivel ler a imagem selecionada');
    }
    return response.arrayBuffer();
  }
}

export function getAdminImageBucketName(): string {
  return SUPABASE_ADMIN_IMAGE_BUCKET;
}

export function getAdminImageStorageSetupInstructions(): string {
  return `Crie o bucket publico "${SUPABASE_ADMIN_IMAGE_BUCKET}" no Supabase Storage e libere upload/leitura para os papeis anon e authenticated.`;
}

export function getAdminImageStorageSetupSql(): string {
  const bucketName = escapeSqlLiteral(SUPABASE_ADMIN_IMAGE_BUCKET);
  const allowedMimeTypes = SUPPORTED_IMAGE_MIME_TYPES
    .map((mimeType) => `'${escapeSqlLiteral(mimeType)}'`)
    .join(', ');

  return `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('${bucketName}', '${bucketName}', true, ${MAX_ADMIN_IMAGE_BYTES}, array[${allowedMimeTypes}])
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

export function isAdminImageBucketMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return /bucket\s+not\s+found/.test(message) || /bucket.*does not exist/.test(message) || /crie o bucket publico/.test(message);
}

export function isAdminImageStoragePolicyError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return /row-level security|violates row-level security policy|permission|not allowed|unauthorized|nao tem permissao para enviar imagens|execute o sql de setup do storage/.test(message);
}

export async function uploadAdminImage({
  folder,
  itemId,
  fileUri,
  fileName,
  mimeType,
}: {
  folder: string;
  itemId: string;
  fileUri: string;
  fileName?: string;
  mimeType?: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  if (!hasSupabaseConfig) {
    throw new Error('Configure o Supabase antes de enviar imagens do painel admin');
  }

  if (!SUPABASE_ADMIN_IMAGE_BUCKET) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_ADMIN_IMAGE_BUCKET para salvar imagens do painel admin');
  }

  const extension = getFileExtension(fileName, mimeType, fileUri);
  const resolvedMimeType = inferMimeType(fileName, mimeType, fileUri);
  const storagePath = buildPublicPath(folder, itemId, extension);
  const arrayBuffer = await readUriAsArrayBuffer(fileUri);

  const { error } = await supabase.storage.from(SUPABASE_ADMIN_IMAGE_BUCKET).upload(storagePath, arrayBuffer, {
    contentType: resolvedMimeType,
    upsert: false,
  });

  if (error) {
    if (isAdminImageBucketMissingError(error)) {
      throw new Error(getAdminImageStorageSetupInstructions());
    }

    if (isAdminImageStoragePolicyError(error)) {
      throw new Error(`O bucket "${SUPABASE_ADMIN_IMAGE_BUCKET}" existe, mas o app ainda nao tem permissao para enviar imagens. Execute o SQL de setup do Storage no Supabase.`);
    }

    throw new Error(error.message || 'Falha ao enviar imagem para o Supabase');
  }

  const { data } = supabase.storage.from(SUPABASE_ADMIN_IMAGE_BUCKET).getPublicUrl(storagePath);

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}