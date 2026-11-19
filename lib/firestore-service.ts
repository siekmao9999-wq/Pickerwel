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
  where,
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
import { getShareOrigin } from './share-origin';

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

/* ============================================================================
 * EMAIL-LESS PASSCODE REGISTRATION & ADMIN PASSCODE MANAGEMENT
 * ========================================================================== */

export interface AdminPasscode {
  code: string;
  label: string;
  active: boolean;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PasscodeMember {
  id: string;
  displayName: string;
  passcode: string;
  status: 'approved' | 'rejected';
  createdAtMs: number;
  updatedAtMs: number;
}

const VALID_PASSCODE_REGEX = /^[A-Z0-9_-]{4,32}$/;

export function normalizePasscode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

export function isValidPasscodeFormat(raw: string): boolean {
  const normalized = raw.trim().toUpperCase();
  return VALID_PASSCODE_REGEX.test(normalized);
}

export function generateRandomPasscode(prefix = 'PW'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}

function generateMemberId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  return `pm_${Date.now()}_${rand}`.slice(0, 64);
}

export async function createAdminPasscode(
  adminUid: string,
  rawCode: string,
  label: string
): Promise<AdminPasscode> {
  const code = normalizePasscode(rawCode);
  if (!VALID_PASSCODE_REGEX.test(code)) {
    throw new Error('INVALID_PASSCODE_FORMAT');
  }
  const safeLabel = label.trim().slice(0, 80);
  const path = `passcodes/${code}`;
  const ref = doc(db, 'passcodes', code);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error('PASSCODE_EXISTS');
    }
    await setDoc(ref, {
      code,
      label: safeLabel,
      active: true,
      createdBy: sanitizeId(adminUid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = Date.now();
    return {
      code,
      label: safeLabel,
      active: true,
      createdBy: sanitizeId(adminUid),
      createdAtMs: now,
      updatedAtMs: now,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'PASSCODE_EXISTS' || error.message === 'INVALID_PASSCODE_FORMAT')
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleAdminPasscodeActive(
  code: string,
  active: boolean
): Promise<void> {
  const safeCode = normalizePasscode(code);
  const path = `passcodes/${safeCode}`;
  try {
    await updateDoc(doc(db, 'passcodes', safeCode), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAdminPasscode(code: string): Promise<void> {
  const safeCode = normalizePasscode(code);
  const path = `passcodes/${safeCode}`;
  try {
    await deleteDoc(doc(db, 'passcodes', safeCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAdminPasscodes(
  onData: (passcodes: AdminPasscode[]) => void
): Unsubscribe {
  const path = 'passcodes';
  const q = query(collection(db, 'passcodes'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AdminPasscode[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          code: String(data.code || d.id),
          label: String(data.label || ''),
          active: Boolean(data.active),
          createdBy: String(data.createdBy || ''),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function registerMemberWithPasscode(
  rawName: string,
  rawPasscode: string
): Promise<PasscodeMember> {
  const displayName = rawName.trim().slice(0, 80);
  if (!displayName) {
    throw new Error('NAME_REQUIRED');
  }

  const normalized = rawPasscode.trim().toUpperCase();
  if (!VALID_PASSCODE_REGEX.test(normalized)) {
    throw new Error('PASSCODE_INVALID');
  }

  const passcodePath = `passcodes/${normalized}`;
  let passcodeSnap;
  try {
    passcodeSnap = await getDoc(doc(db, 'passcodes', normalized));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, passcodePath);
  }

  if (!passcodeSnap.exists()) {
    throw new Error('PASSCODE_INVALID');
  }

  const passcodeData = passcodeSnap.data();
  if (passcodeData.active !== true) {
    throw new Error('PASSCODE_DISABLED');
  }

  const memberId = generateMemberId();
  const memberPath = `passcodeMembers/${memberId}`;
  try {
    await setDoc(doc(db, 'passcodeMembers', memberId), {
      id: memberId,
      displayName,
      passcode: normalized,
      status: 'approved',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = Date.now();
    return {
      id: memberId,
      displayName,
      passcode: normalized,
      status: 'approved',
      createdAtMs: now,
      updatedAtMs: now,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, memberPath);
  }
}

export function subscribePasscodeMemberStatus(
  memberId: string,
  passcode: string,
  onUpdate: (state: { status: 'approved' | 'rejected'; passcodeActive: boolean }) => void
): Unsubscribe {
  const safeId = sanitizeId(memberId);
  const safeCode = normalizePasscode(passcode);

  let latestMemberStatus: 'approved' | 'rejected' = 'approved';
  let latestPasscodeActive = true;

  const emit = () => {
    onUpdate({ status: latestMemberStatus, passcodeActive: latestPasscodeActive });
  };

  const unsubMember = onSnapshot(
    doc(db, 'passcodeMembers', safeId),
    (snap) => {
      if (!snap.exists()) {
        if (!snap.metadata.fromCache) {
          latestMemberStatus = 'rejected';
        }
      } else {
        latestMemberStatus = snap.data().status === 'rejected' ? 'rejected' : 'approved';
      }
      emit();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `passcodeMembers/${safeId}`);
    }
  );

  const unsubCode = onSnapshot(
    doc(db, 'passcodes', safeCode),
    (snap) => {
      if (!snap.exists()) {
        if (!snap.metadata.fromCache) {
          latestPasscodeActive = false;
        }
      } else {
        latestPasscodeActive = snap.data().active === true;
      }
      emit();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `passcodes/${safeCode}`);
    }
  );

  return () => {
    unsubMember();
    unsubCode();
  };
}

export function subscribeAllPasscodeMembers(
  onData: (members: PasscodeMember[]) => void
): Unsubscribe {
  const path = 'passcodeMembers';
  const q = query(collection(db, 'passcodeMembers'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PasscodeMember[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          displayName: String(data.displayName || 'Pickerwel User'),
          passcode: String(data.passcode || ''),
          status: data.status === 'rejected' ? 'rejected' : 'approved',
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updatePasscodeMemberStatus(
  memberId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const safeId = sanitizeId(memberId);
  const path = `passcodeMembers/${safeId}`;
  try {
    await updateDoc(doc(db, 'passcodeMembers', safeId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePasscodeMember(memberId: string): Promise<void> {
  const safeId = sanitizeId(memberId);
  const path = `passcodeMembers/${safeId}`;
  try {
    await deleteDoc(doc(db, 'passcodeMembers', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const DEFAULT_ADMIN_DISPLAY_NAME = 'Siek Mao';

export function subscribePublicAppConfig(
  onUpdate: (adminName: string) => void
): Unsubscribe {
  const path = 'appConfig/public';
  return onSnapshot(
    doc(db, 'appConfig', 'public'),
    (snap) => {
      if (snap.exists()) {
        const name = String(snap.data().adminName || '').trim().slice(0, 80);
        if (name) {
          onUpdate(name);
          return;
        }
      }
      onUpdate(DEFAULT_ADMIN_DISPLAY_NAME);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updatePublicAdminName(rawName: string): Promise<string> {
  const adminName = rawName.trim().slice(0, 80) || DEFAULT_ADMIN_DISPLAY_NAME;
  const path = 'appConfig/public';
  try {
    await setDoc(doc(db, 'appConfig', 'public'), {
      adminName,
      updatedAt: serverTimestamp(),
    });
    return adminName;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// Per-User Student Practice Assignments (Unique Link & QR-Code, Owner-Isolated)
// ============================================================================

export type AssignmentOwnerType = 'google' | 'passcode';

export interface StudentAssignment {
  id: string;
  ownerId: string;
  ownerType: AssignmentOwnerType;
  ownerDisplayName: string;
  title: string;
  instructions: string;
  entries: string[];
  paletteId: PaletteId;
  allowWheelSpin: boolean;
  active: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface StudentSubmission {
  id: string;
  assignmentId: string;
  ownerId: string;
  studentName: string;
  groupLabel: string;
  drawnItem: string;
  answerText: string;
  status: 'submitted' | 'reviewed';
  submittedAtMs: number;
}

function randomToken(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      out += chars[bytes[i] % chars.length];
    }
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateAssignmentId(): string {
  return `asgn_${Date.now().toString(36)}_${randomToken(16)}`;
}

export function generateSubmissionId(): string {
  return `sub_${Date.now().toString(36)}_${randomToken(12)}`;
}

export function buildStudentTaskUrl(
  assignmentId: string,
  originOverride?: string
): string {
  const safeId = sanitizeId(assignmentId);
  const origin =
    originOverride !== undefined ? originOverride : getShareOrigin();
  if (origin) {
    return `${origin}/task/${safeId}`;
  }
  return `/task/${safeId}`;
}

function parseAssignmentDoc(
  docId: string,
  data: Record<string, unknown>
): StudentAssignment {
  return {
    id: String(data.id || docId),
    ownerId: String(data.ownerId || ''),
    ownerType: data.ownerType === 'passcode' ? 'passcode' : 'google',
    ownerDisplayName: String(data.ownerDisplayName || 'Teacher').slice(0, 80),
    title: String(data.title || 'Student Practice').slice(0, 120),
    instructions: String(data.instructions || '').slice(0, 2000),
    entries: Array.isArray(data.entries)
      ? data.entries.map((v) => String(v).slice(0, 120)).slice(0, 200)
      : [],
    paletteId: (['vibrant', 'classroom', 'sunset', 'ocean'].includes(String(data.paletteId))
      ? String(data.paletteId)
      : 'vibrant') as PaletteId,
    allowWheelSpin: data.allowWheelSpin !== false,
    active: data.active !== false,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

function parseSubmissionDoc(
  docId: string,
  data: Record<string, unknown>
): StudentSubmission {
  return {
    id: String(data.id || docId),
    assignmentId: String(data.assignmentId || ''),
    ownerId: String(data.ownerId || ''),
    studentName: String(data.studentName || 'Student').slice(0, 80),
    groupLabel: String(data.groupLabel || '').slice(0, 60),
    drawnItem: String(data.drawnItem || '').slice(0, 120),
    answerText: String(data.answerText || '').slice(0, 2000),
    status: data.status === 'reviewed' ? 'reviewed' : 'submitted',
    submittedAtMs: toMillis(data.submittedAt),
  };
}

export async function createStudentAssignment(input: {
  ownerId: string;
  ownerType: AssignmentOwnerType;
  ownerDisplayName: string;
  title: string;
  instructions: string;
  entries: string[];
  paletteId: PaletteId;
  allowWheelSpin: boolean;
}): Promise<StudentAssignment> {
  const assignmentId = generateAssignmentId();
  const safeOwnerId = sanitizeId(input.ownerId);
  const safeOwnerName = input.ownerDisplayName.trim().slice(0, 80) || 'Teacher';
  const safeTitle = clampTitle(input.title);
  const safeInstructions = input.instructions.trim().slice(0, 2000);
  const safeEntries = clampEntries(input.entries);
  const path = `assignments/${assignmentId}`;

  try {
    await setDoc(doc(db, 'assignments', assignmentId), {
      id: assignmentId,
      ownerId: safeOwnerId,
      ownerType: input.ownerType,
      ownerDisplayName: safeOwnerName,
      title: safeTitle,
      instructions: safeInstructions,
      entries: safeEntries,
      paletteId: input.paletteId,
      allowWheelSpin: Boolean(input.allowWheelSpin),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = Date.now();
    return {
      id: assignmentId,
      ownerId: safeOwnerId,
      ownerType: input.ownerType,
      ownerDisplayName: safeOwnerName,
      title: safeTitle,
      instructions: safeInstructions,
      entries: safeEntries,
      paletteId: input.paletteId,
      allowWheelSpin: Boolean(input.allowWheelSpin),
      active: true,
      createdAtMs: now,
      updatedAtMs: now,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStudentAssignment(
  assignmentId: string,
  updates: Partial<{
    title: string;
    instructions: string;
    entries: string[];
    paletteId: PaletteId;
    allowWheelSpin: boolean;
    active: boolean;
  }>
): Promise<void> {
  const safeId = sanitizeId(assignmentId);
  const path = `assignments/${safeId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.title === 'string') payload.title = clampTitle(updates.title);
  if (typeof updates.instructions === 'string') {
    payload.instructions = updates.instructions.trim().slice(0, 2000);
  }
  if (Array.isArray(updates.entries)) payload.entries = clampEntries(updates.entries);
  if (updates.paletteId) payload.paletteId = updates.paletteId;
  if (typeof updates.allowWheelSpin === 'boolean') {
    payload.allowWheelSpin = updates.allowWheelSpin;
  }
  if (typeof updates.active === 'boolean') payload.active = updates.active;

  try {
    await updateDoc(doc(db, 'assignments', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudentAssignment(assignmentId: string): Promise<void> {
  const safeId = sanitizeId(assignmentId);
  const path = `assignments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'assignments', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getStudentAssignment(
  assignmentId: string
): Promise<StudentAssignment | null> {
  const safeId = sanitizeId(assignmentId);
  if (!/^asgn_[a-zA-Z0-9_\-]+$/.test(safeId) || safeId.length < 16) {
    return null;
  }
  const path = `assignments/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'assignments', safeId));
    if (!snap.exists()) return null;
    return parseAssignmentDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserAssignments(
  ownerUid: string,
  onData: (assignments: StudentAssignment[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(ownerUid);
  const path = 'assignments';
  // Query without orderBy to avoid requiring a composite Firestore index; sort client-side.
  const q = query(collection(db, 'assignments'), where('ownerId', '==', safeUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => parseAssignmentDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllAssignments(
  onData: (assignments: StudentAssignment[]) => void
): Unsubscribe {
  const path = 'assignments';
  const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        parseAssignmentDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function submitStudentWork(
  assignmentId: string,
  ownerId: string,
  input: {
    studentName: string;
    groupLabel?: string;
    drawnItem?: string;
    answerText: string;
  }
): Promise<StudentSubmission> {
  const safeAssignmentId = sanitizeId(assignmentId);
  const safeOwnerId = sanitizeId(ownerId);
  const submissionId = generateSubmissionId();
  const safeStudentName = input.studentName.trim().slice(0, 80);
  const safeGroupLabel = (input.groupLabel || '').trim().slice(0, 60);
  const safeDrawnItem = (input.drawnItem || '').trim().slice(0, 120);
  const safeAnswerText = input.answerText.trim().slice(0, 2000);
  const path = `assignments/${safeAssignmentId}/submissions/${submissionId}`;

  try {
    await setDoc(doc(db, 'assignments', safeAssignmentId, 'submissions', submissionId), {
      id: submissionId,
      assignmentId: safeAssignmentId,
      ownerId: safeOwnerId,
      studentName: safeStudentName,
      groupLabel: safeGroupLabel,
      drawnItem: safeDrawnItem,
      answerText: safeAnswerText,
      status: 'submitted',
      submittedAt: serverTimestamp(),
    });
    return {
      id: submissionId,
      assignmentId: safeAssignmentId,
      ownerId: safeOwnerId,
      studentName: safeStudentName,
      groupLabel: safeGroupLabel,
      drawnItem: safeDrawnItem,
      answerText: safeAnswerText,
      status: 'submitted',
      submittedAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAssignmentSubmissions(
  assignmentId: string,
  options: { isAdmin: boolean; ownerUid?: string },
  onData: (submissions: StudentSubmission[]) => void
): Unsubscribe {
  const safeId = sanitizeId(assignmentId);
  const path = `assignments/${safeId}/submissions`;
  const subCol = collection(db, 'assignments', safeId, 'submissions');
  const q = options.isAdmin
    ? query(subCol, orderBy('submittedAt', 'desc'))
    : query(subCol, where('ownerId', '==', sanitizeId(options.ownerUid || '')));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => parseSubmissionDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.submittedAtMs - a.submittedAtMs);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateSubmissionStatus(
  assignmentId: string,
  submissionId: string,
  status: 'submitted' | 'reviewed'
): Promise<void> {
  const safeAssignmentId = sanitizeId(assignmentId);
  const safeSubId = sanitizeId(submissionId);
  const path = `assignments/${safeAssignmentId}/submissions/${safeSubId}`;
  try {
    await updateDoc(doc(db, 'assignments', safeAssignmentId, 'submissions', safeSubId), {
      status,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSubmission(
  assignmentId: string,
  submissionId: string
): Promise<void> {
  const safeAssignmentId = sanitizeId(assignmentId);
  const safeSubId = sanitizeId(submissionId);
  const path = `assignments/${safeAssignmentId}/submissions/${safeSubId}`;
  try {
    await deleteDoc(doc(db, 'assignments', safeAssignmentId, 'submissions', safeSubId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}



