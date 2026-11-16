import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { PaletteId } from './palettes';
import type { Language } from './i18n';
import { WHEEL_TEMPLATES } from './templates';

export const BOOTSTRAP_ADMIN_EMAIL = 'siekmao9999@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type AccountRole = 'user' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface UserPreferences {
  uid: string;
  displayName: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  theme: 'light' | 'dark';
  language: Language;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  hapticsEnabled: boolean;
  spinDuration: number;
  createdAtMs: number;
  reviewedAtMs: number;
  reviewedBy: string;
}

export interface SavedWheel {
  id: string;
  ownerId: string;
  title: string;
  entries: string[];
  paletteId: PaletteId;
  spinCount: number;
  lastWinner: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SpinResultRecord {
  id: string;
  ownerId: string;
  wheelId: string;
  wheelTitle: string;
  winner: string;
  winnerColor: string;
  removedAfterSpin: boolean;
  spunAtMs: number;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)
    ? cleaned
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clampTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'Untitled Wheel';
  return trimmed.slice(0, 120);
}

export function clampEntries(entries: string[]): string[] {
  return entries
    .map((e) => e.trim().slice(0, 120))
    .filter((e) => e.length > 0)
    .slice(0, 200);
}

function toMillis(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

function mapUserDoc(uid: string, data: Record<string, unknown>): UserPreferences {
  const email = String(data.email || '').slice(0, 120);
  const isBootstrapAdmin = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
  return {
    uid,
    displayName: String(data.displayName || 'Pickerwel User').slice(0, 80),
    email,
    role: data.role === 'admin' || isBootstrapAdmin ? 'admin' : 'user',
    status:
      data.status === 'approved' || data.status === 'rejected'
        ? data.status
        : isBootstrapAdmin
        ? 'approved'
        : 'pending',
    theme: data.theme === 'dark' ? 'dark' : 'light',
    language: data.language === 'en' ? 'en' : 'km',
    soundEnabled: Boolean(data.soundEnabled),
    confettiEnabled: Boolean(data.confettiEnabled),
    hapticsEnabled: Boolean(data.hapticsEnabled),
    spinDuration: Math.min(10, Math.max(3, Number(data.spinDuration) || 5)),
    createdAtMs: toMillis(data.createdAt),
    reviewedAtMs: toMillis(data.reviewedAt),
    reviewedBy: String(data.reviewedBy || ''),
  };
}

export async function ensureUserProfile(
  uid: string,
  displayName: string,
  email: string,
  defaults: {
    theme: 'light' | 'dark';
    language: Language;
    soundEnabled: boolean;
    confettiEnabled: boolean;
    hapticsEnabled: boolean;
    spinDuration: number;
  }
): Promise<UserPreferences> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const safeEmail = (email || '').trim().slice(0, 120);
  const isBootstrapAdmin = safeEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const mapped = mapUserDoc(uid, snap.data());
      if (mapped.status === 'approved') {
        await seedStarterWheelsIfEmpty(uid);
      }
      return mapped;
    }

    const safeName = (displayName || safeEmail.split('@')[0] || 'Pickerwel User')
      .trim()
      .slice(0, 80);

    const payload = {
      uid,
      displayName: safeName,
      email: safeEmail,
      role: isBootstrapAdmin ? 'admin' : 'user',
      status: isBootstrapAdmin ? 'approved' : 'pending',
      theme: defaults.theme,
      language: defaults.language,
      soundEnabled: defaults.soundEnabled,
      confettiEnabled: defaults.confettiEnabled,
      hapticsEnabled: defaults.hapticsEnabled,
      spinDuration: Math.min(10, Math.max(3, defaults.spinDuration)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      reviewedBy: isBootstrapAdmin ? uid : '',
    };
    await setDoc(userRef, payload);

    if (isBootstrapAdmin) {
      await seedStarterWheelsIfEmpty(uid);
    }

    return {
      uid,
      displayName: safeName,
      email: safeEmail,
      role: isBootstrapAdmin ? 'admin' : 'user',
      status: isBootstrapAdmin ? 'approved' : 'pending',
      ...defaults,
      createdAtMs: Date.now(),
      reviewedAtMs: Date.now(),
      reviewedBy: isBootstrapAdmin ? uid : '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function seedStarterWheelsIfEmpty(uid: string): Promise<void> {
  const wheelsPath = `users/${uid}/wheels`;
  try {
    const existing = await getDocs(collection(db, 'users', uid, 'wheels'));
    if (!existing.empty) return;

    const starterIds = ['grade-7a', 'grade-12a', 'team-tasks'];
    for (const templateId of starterIds) {
      const tmpl = WHEEL_TEMPLATES.find((t) => t.id === templateId);
      if (tmpl) {
        const wheelId = sanitizeId(`starter_${tmpl.id}`);
        const wheelRef = doc(db, 'users', uid, 'wheels', wheelId);
        await setDoc(wheelRef, {
          id: wheelId,
          ownerId: uid,
          title: clampTitle(tmpl.titleKm),
          entries: clampEntries(tmpl.entries),
          paletteId: tmpl.paletteId,
          spinCount: 0,
          lastWinner: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wheelsPath);
  }
}

export function subscribeUserProfile(
  uid: string,
  onProfile: (profile: UserPreferences) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onProfile(mapUserDoc(uid, snap.data()));
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeAllUsers(
  onUsers: (users: UserPreferences[]) => void
): Unsubscribe {
  const path = 'users';
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => mapUserDoc(d.id, d.data()));
      onUsers(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function reviewUserRegistration(
  targetUid: string,
  status: AccountStatus,
  role: AccountRole,
  adminUid: string
): Promise<void> {
  const safeTargetUid = sanitizeId(targetUid);
  const path = `users/${safeTargetUid}`;
  try {
    await updateDoc(doc(db, 'users', safeTargetUid), {
      status,
      role,
      reviewedAt: serverTimestamp(),
      reviewedBy: sanitizeId(adminUid),
      updatedAt: serverTimestamp(),
    });

    if (role === 'admin' && status === 'approved') {
      await setDoc(doc(db, 'admins', safeTargetUid), {
        uid: safeTargetUid,
        createdAt: serverTimestamp(),
      });
    } else if (role !== 'admin' && safeTargetUid !== adminUid) {
      await deleteDoc(doc(db, 'admins', safeTargetUid)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPreferences(
  uid: string,
  prefs: Partial<
    Pick<
      UserPreferences,
      | 'displayName'
      | 'theme'
      | 'language'
      | 'soundEnabled'
      | 'confettiEnabled'
      | 'hapticsEnabled'
      | 'spinDuration'
    >
  >
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  try {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (prefs.displayName !== undefined) {
      updatePayload.displayName = prefs.displayName.trim().slice(0, 80) || 'Pickerwel User';
    }
    if (prefs.theme !== undefined) updatePayload.theme = prefs.theme;
    if (prefs.language !== undefined) updatePayload.language = prefs.language;
    if (prefs.soundEnabled !== undefined) updatePayload.soundEnabled = prefs.soundEnabled;
    if (prefs.confettiEnabled !== undefined) updatePayload.confettiEnabled = prefs.confettiEnabled;
    if (prefs.hapticsEnabled !== undefined) updatePayload.hapticsEnabled = prefs.hapticsEnabled;
    if (prefs.spinDuration !== undefined) {
      updatePayload.spinDuration = Math.min(10, Math.max(3, prefs.spinDuration));
    }
    await updateDoc(userRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export function subscribeUserWheels(
  uid: string,
  onData: (wheels: SavedWheel[]) => void
): Unsubscribe {
  const path = `users/${uid}/wheels`;
  const q = query(collection(db, 'users', uid, 'wheels'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const wheels: SavedWheel[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          title: String(data.title || 'Untitled Wheel'),
          entries: Array.isArray(data.entries) ? data.entries.map(String) : [],
          paletteId: (data.paletteId as PaletteId) || 'vibrant',
          spinCount: Number(data.spinCount || 0),
          lastWinner: String(data.lastWinner || ''),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      onData(wheels);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserHistory(
  uid: string,
  onData: (results: SpinResultRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/spinResults`;
  const q = query(
    collection(db, 'users', uid, 'spinResults'),
    orderBy('spunAt', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const results: SpinResultRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          wheelId: String(data.wheelId || ''),
          wheelTitle: String(data.wheelTitle || ''),
          winner: String(data.winner || ''),
          winnerColor: String(data.winnerColor || '#3B82F6'),
          removedAfterSpin: Boolean(data.removedAfterSpin),
          spunAtMs: toMillis(data.spunAt),
        };
      });
      onData(results);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCloudWheel(
  uid: string,
  wheel: {
    id?: string;
    title: string;
    entries: string[];
    paletteId: PaletteId;
  }
): Promise<string> {
  const id = sanitizeId(wheel.id || `wheel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/wheels/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'wheels', id), {
      id,
      ownerId: uid,
      title: clampTitle(wheel.title),
      entries: clampEntries(wheel.entries),
      paletteId: wheel.paletteId,
      spinCount: 0,
      lastWinner: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCloudWheel(
  uid: string,
  wheelId: string,
  patch: {
    title?: string;
    entries?: string[];
    paletteId?: PaletteId;
  }
): Promise<void> {
  const safeId = sanitizeId(wheelId);
  const path = `users/${uid}/wheels/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.title !== undefined) payload.title = clampTitle(patch.title);
    if (patch.entries !== undefined) payload.entries = clampEntries(patch.entries);
    if (patch.paletteId !== undefined) payload.paletteId = patch.paletteId;
    await updateDoc(doc(db, 'users', uid, 'wheels', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordCloudSpinOutcome(
  uid: string,
  wheelId: string,
  data: {
    wheelTitle: string;
    winner: string;
    winnerColor: string;
    newSpinCount: number;
    updatedEntries?: string[];
    removedAfterSpin: boolean;
  }
): Promise<void> {
  const safeWheelId = sanitizeId(wheelId);
  const wheelPath = `users/${uid}/wheels/${safeWheelId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      spinCount: Math.max(0, Math.floor(data.newSpinCount)),
      lastWinner: data.winner.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    };
    if (data.updatedEntries !== undefined) {
      updatePayload.entries = clampEntries(data.updatedEntries);
    }
    await updateDoc(doc(db, 'users', uid, 'wheels', safeWheelId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, wheelPath);
  }

  const resultId = sanitizeId(`spin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const resultPath = `users/${uid}/spinResults/${resultId}`;
  const safeColor = VALID_HEX_REGEX.test(data.winnerColor) ? data.winnerColor : '#3B82F6';
  try {
    await setDoc(doc(db, 'users', uid, 'spinResults', resultId), {
      id: resultId,
      ownerId: uid,
      wheelId: safeWheelId,
      wheelTitle: clampTitle(data.wheelTitle),
      winner: data.winner.trim().slice(0, 120) || 'Winner',
      winnerColor: safeColor,
      removedAfterSpin: data.removedAfterSpin,
      spunAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, resultPath);
  }
}

export async function deleteCloudWheel(uid: string, wheelId: string): Promise<void> {
  const safeId = sanitizeId(wheelId);
  const path = `users/${uid}/wheels/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'wheels', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteCloudSpinResult(uid: string, resultId: string): Promise<void> {
  const safeId = sanitizeId(resultId);
  const path = `users/${uid}/spinResults/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'spinResults', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
