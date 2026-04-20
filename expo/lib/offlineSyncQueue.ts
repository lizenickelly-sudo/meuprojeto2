import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertUser as dbUpsertUser } from '@/services/database';
import type { UserProfile } from '@/types';

type SyncTaskKind = 'user_critical_state';

type UserCriticalPayload = {
  email: string;
  profile: UserProfile;
  balance: number;
  points: number;
};

type SyncTask = {
  id: string;
  kind: SyncTaskKind;
  domain: 'user';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  payload: UserCriticalPayload;
};

const STORAGE_KEY = 'cashboxpix_sync_queue_v1';
const MAX_ATTEMPTS = 12;

let flushInFlight: Promise<void> | null = null;

async function loadQueue(): Promise<SyncTask[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyncTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log('[SyncQueue] Failed parsing queue:', error);
    return [];
  }
}

async function saveQueue(queue: SyncTask[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function makeTask(payload: UserCriticalPayload): SyncTask {
  const now = new Date().toISOString();
  return {
    id: `sync_user_${payload.email}_${Date.now()}`,
    kind: 'user_critical_state',
    domain: 'user',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    payload,
  };
}

export async function scheduleUserCriticalSync(payload: UserCriticalPayload): Promise<void> {
  const email = payload.email.trim().toLowerCase();
  if (!email) return;

  const queue = await loadQueue();
  const nextPayload: UserCriticalPayload = {
    ...payload,
    email,
  };

  const existingIndex = queue.findIndex(
    (task) => task.kind === 'user_critical_state' && task.payload.email === email,
  );

  if (existingIndex >= 0) {
    queue[existingIndex] = {
      ...queue[existingIndex],
      payload: nextPayload,
      updatedAt: new Date().toISOString(),
    };
  } else {
    queue.push(makeTask(nextPayload));
  }

  await saveQueue(queue);
}

async function executeTask(task: SyncTask): Promise<boolean> {
  if (task.kind === 'user_critical_state') {
    const ok = await dbUpsertUser(task.payload.profile, task.payload.balance, task.payload.points);
    return Boolean(ok);
  }

  return true;
}

export async function flushSyncQueue(): Promise<void> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    const pending: SyncTask[] = [];

    for (const task of queue) {
      try {
        const ok = await executeTask(task);
        if (!ok) {
          const attempts = task.attempts + 1;
          if (attempts < MAX_ATTEMPTS) {
            pending.push({
              ...task,
              attempts,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        const attempts = task.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          pending.push({
            ...task,
            attempts,
            updatedAt: new Date().toISOString(),
          });
        }
        console.log('[SyncQueue] Task execution failed:', task.kind, error);
      }
    }

    await saveQueue(pending);
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

export async function getSyncQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}
