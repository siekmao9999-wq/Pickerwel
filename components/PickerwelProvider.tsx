'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from '@/lib/firebase';
import {
  ensureUserProfile,
  subscribeUserProfile,
  subscribeAllUsers,
  reviewUserRegistration,
  updateUserPreferences,
  subscribeUserWheels,
  subscribeUserHistory,
  createCloudWheel,
  updateCloudWheel,
  recordCloudSpinOutcome,
  deleteCloudWheel,
  deleteCloudSpinResult,
  seedStarterWheelsIfEmpty,
  clampEntries,
  clampTitle,
  sanitizeId,
  registerMemberWithPasscode,
  subscribePasscodeMemberStatus,
  subscribeAdminPasscodes,
  subscribeAllPasscodeMembers,
  createAdminPasscode,
  toggleAdminPasscodeActive,
  deleteAdminPasscode,
  updatePasscodeMemberStatus,
  updatePasscodeMemberDetails,
  deletePasscodeMember,
  BOOTSTRAP_ADMIN_EMAIL,
  isValidPasscodeFormat,
  DEFAULT_ADMIN_DISPLAY_NAME,
  subscribePublicAppConfig,
  updatePublicAppConfig,
  registerMemberInstantAutoCode,
  submitRegistrationRequest,
  subscribeRegistrationRequest,
  subscribeAllRegistrationRequests,
  approveRegistrationRequestWithCode,
  rejectRegistrationRequest,
  deleteRegistrationRequest,
  type AccountRole,
  type AccountStatus,
  type UserPreferences,
  type SavedWheel,
  type SpinResultRecord,
  type AdminPasscode,
  type PasscodeMember,
  type RegistrationRequest,
} from '@/lib/firestore-service';
import { QUICK_START_ENTRIES, WHEEL_TEMPLATES, type WheelTemplate } from '@/lib/templates';
import type { PaletteId } from '@/lib/palettes';
import type { Language } from '@/lib/i18n';
import { VALID_SPIN_SOUNDS, type SpinSoundId } from '@/lib/sound';

export type NavSection =
  | 'home'
  | 'wheels'
  | 'templates'
  | 'groups'
  | 'tasks'
  | 'forms'
  | 'games'
  | 'stopwatch'
  | 'history'
  | 'github'
  | 'settings'
  | 'admin';

export const NAV_ROUTES: Record<NavSection, string> = {
  home: '/',
  wheels: '/wheels',
  templates: '/templates',
  groups: '/groups',
  tasks: '/tasks',
  forms: '/forms',
  games: '/games',
  stopwatch: '/stopwatch',
  history: '/history',
  github: '/github',
  settings: '/settings',
  admin: '/admin',
};

function navFromPathname(pathname: string | null): NavSection {
  if (!pathname) return 'home';
  if (pathname.startsWith('/wheels')) return 'wheels';
  if (pathname.startsWith('/templates')) return 'templates';
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/forms')) return 'forms';
  if (pathname.startsWith('/games')) return 'games';
  if (pathname.startsWith('/stopwatch')) return 'stopwatch';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/github')) return 'github';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'home';
}

export interface LocalSettings {
  theme: 'light' | 'dark';
  language: Language;
  soundEnabled: boolean;
  spinSound: SpinSoundId;
  confettiEnabled: boolean;
  hapticsEnabled: boolean;
  spinDuration: number;
}

const DEFAULT_SETTINGS: LocalSettings = {
  theme: 'light',
  language: 'km',
  soundEnabled: true,
  spinSound: 'classic-tick',
  confettiEnabled: true,
  hapticsEnabled: true,
  spinDuration: 5,
};

const STORAGE_KEYS = {
  settings: 'pickerwel_settings_v1',
  localWheels: 'pickerwel_local_wheels_v1',
  localHistory: 'pickerwel_local_history_v1',
  activeWheelId: 'pickerwel_active_wheel_id_v1',
  passcodeSession: 'pickerwel_passcode_session_v1',
  appAdminName: 'pickerwel_admin_name_v1',
  pendingRegistration: 'pickerwel_pending_registration_v1',
};

export interface PasscodeSession {
  memberId: string;
  displayName: string;
  passcode: string;
  status: 'approved' | 'rejected';
  passcodeActive: boolean;
  adminNote?: string;
}

const STARTER_WHEEL_EPOCH_MS = 1700000000000;

function createStarterLocalWheels(): SavedWheel[] {
  const now = STARTER_WHEEL_EPOCH_MS;
  return [
    {
      id: 'quick_start_wheel',
      ownerId: 'local',
      title: 'កងវិលរហ័ស (Quick Start)',
      entries: [...QUICK_START_ENTRIES],
      paletteId: 'vibrant',
      spinCount: 0,
      lastWinner: '',
      createdAtMs: now,
      updatedAtMs: now,
    },
    ...WHEEL_TEMPLATES.slice(0, 3).map((t, idx) => ({
      id: `local_${t.id}`,
      ownerId: 'local',
      title: t.titleKm,
      entries: [...t.entries],
      paletteId: t.paletteId,
      spinCount: 0,
      lastWinner: '',
      createdAtMs: now - (idx + 1) * 1000,
      updatedAtMs: now - (idx + 1) * 1000,
    })),
  ];
}

interface PickerwelContextValue {
  user: User | null;
  userProfile: UserPreferences | null;
  passcodeSession: PasscodeSession | null;
  isSignedIn: boolean;
  isAccessBlocked: boolean;
  currentDisplayName: string;
  isApprovedCloudUser: boolean;
  allUsers: UserPreferences[];
  reviewUser: (
    targetUid: string,
    status: AccountStatus,
    role: AccountRole,
    assignedCode?: string,
    displayName?: string
  ) => Promise<void>;

  adminPasscodes: AdminPasscode[];
  passcodeMembers: PasscodeMember[];
  registrationRequests: RegistrationRequest[];
  pendingRegistration: RegistrationRequest | null;
  submitRegistration: (name: string, note: string) => Promise<RegistrationRequest>;
  clearPendingRegistration: () => void;
  activateApprovedRegistration: () => void;
  approveRegistrationWithCode: (request: RegistrationRequest, code: string) => Promise<string>;
  rejectRegistration: (requestId: string) => Promise<void>;
  removeRegistrationRequest: (requestId: string) => Promise<void>;
  createPasscode: (code: string, label: string) => Promise<void>;
  togglePasscode: (code: string, active: boolean) => Promise<void>;
  removePasscode: (code: string) => Promise<void>;
  reviewPasscodeMember: (memberId: string, status: 'approved' | 'rejected') => Promise<void>;
  updatePasscodeMember: (
    memberId: string,
    patch: {
      displayName?: string;
      passcode?: string;
      status?: 'approved' | 'rejected';
      adminNote?: string;
    }
  ) => Promise<void>;
  removePasscodeMember: (memberId: string) => Promise<void>;
  appAdminName: string;
  saveAppAdminName: (name: string) => Promise<void>;
  autoDropEnabled: boolean;
  defaultAutoCode: string;
  saveAutoDropConfig: (enabled: boolean, defaultCode: string) => Promise<void>;

  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  authModalOpen: boolean;
  prefillPasscode: string;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  registerInstantAutoCode: (name: string) => Promise<PasscodeMember>;
  registerWithPasscode: (name: string, passcode: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  markPendingNav: (nav: NavSection) => void;
  groupsSyncKey: number;
  bumpGroupsSyncKey: () => void;

  settings: LocalSettings;
  updateSettings: (patch: Partial<LocalSettings>) => void;

  wheels: SavedWheel[];
  activeWheel: SavedWheel;
  selectWheel: (wheelId: string) => void;
  updateActiveWheel: (patch: { title?: string; entries?: string[]; paletteId?: PaletteId }) => void;
  createNewWheel: (title?: string, entries?: string[], paletteId?: PaletteId) => Promise<string>;
  applyTemplate: (template: WheelTemplate) => Promise<void>;
  duplicateWheel: (wheel: SavedWheel) => Promise<void>;
  deleteWheel: (wheelId: string) => Promise<void>;

  history: SpinResultRecord[];
  logSpinOutcome: (params: {
    winner: string;
    winnerColor: string;
    removedAfterSpin: boolean;
    updatedEntries?: string[];
  }) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteHistoryItem: (resultId: string) => Promise<void>;

  saveStatus: 'saved' | 'saving';
}

const PickerwelContext = createContext<PickerwelContextValue | null>(null);

export function PickerwelProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserPreferences | null>(null);
  const [passcodeSession, setPasscodeSession] = useState<PasscodeSession | null>(null);
  const [allUsers, setAllUsers] = useState<UserPreferences[]>([]);
  const [adminPasscodes, setAdminPasscodes] = useState<AdminPasscode[]>([]);
  const [passcodeMembers, setPasscodeMembers] = useState<PasscodeMember[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [pendingRegistration, setPendingRegistration] = useState<RegistrationRequest | null>(null);
  const [appAdminName, setAppAdminName] = useState<string>(DEFAULT_ADMIN_DISPLAY_NAME);
  const [autoDropEnabled, setAutoDropEnabled] = useState<boolean>(true);
  const [defaultAutoCode, setDefaultAutoCode] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [prefillPasscode, setPrefillPasscode] = useState('');

  const pathname = usePathname();
  const router = useRouter();
  const [pendingNav, setPendingNav] = useState<{
    target: NavSection;
    fromPath: string | null;
  } | null>(null);

  const routeNav = useMemo(() => navFromPathname(pathname), [pathname]);
  const activeNav =
    pendingNav && pendingNav.fromPath === pathname ? pendingNav.target : routeNav;

  const markPendingNav = useCallback(
    (nav: NavSection) => {
      const target = NAV_ROUTES[nav] || '/';
      if (pathname !== target) {
        setPendingNav({ target: nav, fromPath: pathname });
      }
    },
    [pathname]
  );

  const setActiveNav = useCallback(
    (nav: NavSection) => {
      const target = NAV_ROUTES[nav] || '/';
      if (pathname !== target) {
        setPendingNav({ target: nav, fromPath: pathname });
        router.push(target);
      }
    },
    [pathname, router]
  );

  // Warm up core routes on idle so switching tabs feels instantaneous
  useEffect(() => {
    const coreRoutes = [
      '/',
      '/wheels',
      '/templates',
      '/groups',
      '/tasks',
      '/forms',
      '/games',
      '/stopwatch',
      '/history',
      '/settings',
    ];
    const timer = window.setTimeout(() => {
      for (const route of coreRoutes) {
        if (route !== pathname) {
          router.prefetch(route);
        }
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  const [groupsSyncKey, setGroupsSyncKey] = useState(0);
  const bumpGroupsSyncKey = useCallback(() => {
    setGroupsSyncKey((k) => k + 1);
  }, []);
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [localWheels, setLocalWheels] = useState<SavedWheel[]>(() => createStarterLocalWheels());
  const [cloudWheels, setCloudWheels] = useState<SavedWheel[]>([]);
  const [localHistory, setLocalHistory] = useState<SpinResultRecord[]>([]);
  const [cloudHistory, setCloudHistory] = useState<SpinResultRecord[]>([]);
  const [activeWheelId, setActiveWheelId] = useState<string>('quick_start_wheel');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [hydrated, setHydrated] = useState(false);

  const cloudWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register offline Service Worker, hydrate localStorage, and test Firestore connection
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration skipped:', err);
      });
    }

    testFirestoreConnection();

    queueMicrotask(() => {
      try {
        const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings) as Partial<LocalSettings>;
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            theme: parsed.theme === 'dark' ? 'dark' : 'light',
            language: parsed.language === 'en' ? 'en' : 'km',
            spinSound:
              parsed.spinSound && VALID_SPIN_SOUNDS.has(parsed.spinSound)
                ? parsed.spinSound
                : prev.spinSound,
          }));
        }

        const savedLocalWheels = localStorage.getItem(STORAGE_KEYS.localWheels);
        if (savedLocalWheels) {
          const parsed = JSON.parse(savedLocalWheels) as SavedWheel[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLocalWheels(parsed);
          }
        }

        const savedHistory = localStorage.getItem(STORAGE_KEYS.localHistory);
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory) as SpinResultRecord[];
          if (Array.isArray(parsed)) {
            setLocalHistory(parsed);
          }
        }

        const savedActiveId = localStorage.getItem(STORAGE_KEYS.activeWheelId);
        if (savedActiveId) {
          setActiveWheelId(savedActiveId);
        }

        const savedPasscodeSession = localStorage.getItem(STORAGE_KEYS.passcodeSession);
        if (savedPasscodeSession) {
          const parsedSession = JSON.parse(savedPasscodeSession) as Partial<PasscodeSession>;
          if (parsedSession.memberId && parsedSession.displayName && parsedSession.passcode) {
            setPasscodeSession({
              memberId: parsedSession.memberId,
              displayName: parsedSession.displayName,
              passcode: parsedSession.passcode,
              status: parsedSession.status === 'rejected' ? 'rejected' : 'approved',
              passcodeActive: parsedSession.passcodeActive !== false,
              adminNote:
                typeof parsedSession.adminNote === 'string' ? parsedSession.adminNote : '',
            });
          }
        }

        const savedAdminName = localStorage.getItem(STORAGE_KEYS.appAdminName);
        if (savedAdminName && savedAdminName.trim()) {
          setAppAdminName(savedAdminName.trim().slice(0, 80));
        }

        const savedPendingReg = localStorage.getItem(STORAGE_KEYS.pendingRegistration);
        if (savedPendingReg) {
          const parsedReg = JSON.parse(savedPendingReg) as Partial<RegistrationRequest>;
          if (parsedReg.id && parsedReg.displayName) {
            setPendingRegistration({
              id: parsedReg.id,
              displayName: parsedReg.displayName,
              note: parsedReg.note || '',
              status:
                parsedReg.status === 'approved' || parsedReg.status === 'rejected'
                  ? parsedReg.status
                  : 'pending',
              assignedCode: parsedReg.assignedCode || '',
              memberId: parsedReg.memberId || '',
              createdAtMs: Number(parsedReg.createdAtMs || STARTER_WHEEL_EPOCH_MS),
              updatedAtMs: Number(parsedReg.updatedAtMs || STARTER_WHEEL_EPOCH_MS),
              reviewedAtMs: Number(parsedReg.reviewedAtMs || STARTER_WHEEL_EPOCH_MS),
              reviewedBy: parsedReg.reviewedBy || '',
            });
          }
        }
      } catch {
        // Ignore storage parsing issues
      }
      setHydrated(true);
    });

    const unsubPublicConfig = subscribePublicAppConfig((config) => {
      setAppAdminName(config.adminName);
      setAutoDropEnabled(config.autoDropEnabled);
      setDefaultAutoCode(config.defaultPasscode);
      try {
        localStorage.setItem(STORAGE_KEYS.appAdminName, config.adminName);
      } catch {
        // Ignore quota errors
      }
    });

    return () => {
      unsubPublicConfig();
    };
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // Ignore quota errors
    }
  }, [settings, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.localWheels, JSON.stringify(localWheels));
    } catch {
      // Ignore quota errors
    }
  }, [localWheels, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.localHistory, JSON.stringify(localHistory));
    } catch {
      // Ignore quota errors
    }
  }, [localHistory, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.activeWheelId, activeWheelId);
    } catch {
      // Ignore quota errors
    }
  }, [activeWheelId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (passcodeSession) {
        localStorage.setItem(STORAGE_KEYS.passcodeSession, JSON.stringify(passcodeSession));
      } else {
        localStorage.removeItem(STORAGE_KEYS.passcodeSession);
      }
    } catch {
      // Ignore quota errors
    }
  }, [passcodeSession, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (pendingRegistration) {
        localStorage.setItem(
          STORAGE_KEYS.pendingRegistration,
          JSON.stringify(pendingRegistration)
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.pendingRegistration);
      }
    } catch {
      // Ignore quota errors
    }
  }, [pendingRegistration, hydrated]);

  // Listen to Firebase Auth & User Profile approval status
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        try {
          const profile = await ensureUserProfile(
            nextUser.uid,
            nextUser.displayName || nextUser.email?.split('@')[0] || 'Pickerwel User',
            nextUser.email || '',
            DEFAULT_SETTINGS
          );
          setUserProfile(profile);
          setSettings((prev) => ({
            ...prev,
            theme: profile.theme,
            language: profile.language,
            soundEnabled: profile.soundEnabled,
            confettiEnabled: profile.confettiEnabled,
            hapticsEnabled: profile.hapticsEnabled,
            spinDuration: profile.spinDuration,
          }));

          unsubProfile = subscribeUserProfile(nextUser.uid, (updatedProfile) => {
            setUserProfile(updatedProfile);
          });
        } catch (err) {
          console.error('Failed to initialize user profile:', err);
        }
      } else {
        setUserProfile(null);
        setAllUsers([]);
        setCloudWheels([]);
        setCloudHistory([]);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const isApprovedCloudUser = Boolean(user && userProfile?.status === 'approved');
  const isPrimaryAdmin = Boolean(
    user &&
      user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
      userProfile?.role === 'admin' &&
      userProfile?.status === 'approved'
  );
  const isAdmin = Boolean(user && userProfile?.role === 'admin' && userProfile?.status === 'approved');

  // Auto-open registration modal with pre-filled Admin Passcode when visiting /?code=XXXX
  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (user || passcodeSession) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rawCode = params.get('code')?.trim().toUpperCase() || '';
    if (rawCode && isValidPasscodeFormat(rawCode)) {
      queueMicrotask(() => {
        setPrefillPasscode(rawCode);
        setAuthModalOpen(true);
      });
      params.delete('code');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [hydrated, authReady, user, passcodeSession]);

  // Subscribe to Wheels & History ONLY when user is approved
  useEffect(() => {
    if (!user || !isApprovedCloudUser) {
      queueMicrotask(() => {
        setCloudWheels([]);
        setCloudHistory([]);
      });
      return;
    }

    seedStarterWheelsIfEmpty(user.uid).catch(() => {});

    const unsubWheels = subscribeUserWheels(user.uid, (fetched) => {
      setCloudWheels(fetched);
      setActiveWheelId((curr) => {
        if (fetched.some((w) => w.id === curr)) return curr;
        return fetched[0]?.id ?? curr;
      });
    });

    const unsubHistory = subscribeUserHistory(user.uid, (fetched) => {
      setCloudHistory(fetched);
    });

    return () => {
      unsubWheels();
      unsubHistory();
    };
  }, [user, isApprovedCloudUser]);

  // Watch passcode member & passcode validity in real time when signed in via Name + Passcode
  useEffect(() => {
    if (user || !passcodeSession?.memberId || !passcodeSession?.passcode) return;
    const unsub = subscribePasscodeMemberStatus(
      passcodeSession.memberId,
      passcodeSession.passcode,
      ({ status, passcodeActive, displayName, passcode, adminNote }) => {
        setPasscodeSession((prev) => {
          if (!prev) return null;
          const nextName = displayName || prev.displayName;
          const nextCode = passcode || prev.passcode;
          const nextNote = adminNote !== undefined ? adminNote : prev.adminNote || '';
          if (
            prev.status === status &&
            prev.passcodeActive === passcodeActive &&
            prev.displayName === nextName &&
            prev.passcode === nextCode &&
            (prev.adminNote || '') === nextNote
          ) {
            return prev;
          }
          return {
            ...prev,
            status,
            passcodeActive,
            displayName: nextName,
            passcode: nextCode,
            adminNote: nextNote,
          };
        });
      }
    );
    return () => unsub();
  }, [user, passcodeSession?.memberId, passcodeSession?.passcode]);

  // Watch the current device's pending registration request in real time for Admin-assigned Code
  useEffect(() => {
    if (user || passcodeSession || !pendingRegistration?.id) return;
    const unsub = subscribeRegistrationRequest(pendingRegistration.id, (updated) => {
      setPendingRegistration(updated);
    });
    return () => unsub();
  }, [user, passcodeSession, pendingRegistration?.id]);

  // Subscribe to all user registration requests, passcodes & passcode members when signed in as Admin
  useEffect(() => {
    if (!isAdmin) {
      queueMicrotask(() => {
        setAllUsers([]);
        setAdminPasscodes([]);
        setPasscodeMembers([]);
        setRegistrationRequests([]);
      });
      return;
    }
    const unsubAll = subscribeAllUsers((users) => {
      setAllUsers(users);
    });
    const unsubCodes = isPrimaryAdmin
      ? subscribeAdminPasscodes((codes) => {
          setAdminPasscodes(codes);
        })
      : () => {};
    if (!isPrimaryAdmin) {
      queueMicrotask(() => {
        setAdminPasscodes([]);
      });
    }
    const unsubMembers = subscribeAllPasscodeMembers((members) => {
      setPasscodeMembers(members);
    });
    const unsubRequests = subscribeAllRegistrationRequests((requests) => {
      setRegistrationRequests(requests);
    });
    return () => {
      unsubAll();
      unsubCodes();
      unsubMembers();
      unsubRequests();
    };
  }, [isAdmin, isPrimaryAdmin]);

  const wheels = isApprovedCloudUser && cloudWheels.length > 0 ? cloudWheels : localWheels;
  const history = isApprovedCloudUser ? cloudHistory : localHistory;

  const fallbackWheel: SavedWheel = localWheels[0] || createStarterLocalWheels()[0];
  const activeWheel =
    wheels.find((w) => w.id === activeWheelId) || wheels[0] || fallbackWheel;

  const openAuthModal = useCallback(() => {
    setAuthError(null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthError(null);
    setAuthModalOpen(false);
  }, []);

  const registerInstantAutoCode = useCallback(async (name: string) => {
    setAuthError(null);
    const member = await registerMemberInstantAutoCode(name);
    setPasscodeSession({
      memberId: member.id,
      displayName: member.displayName,
      passcode: member.passcode,
      status: member.status,
      passcodeActive: true,
    });
    setPendingRegistration(null);
    return member;
  }, []);

  const registerWithPasscode = useCallback(async (name: string, passcode: string) => {
    setAuthError(null);
    const member = await registerMemberWithPasscode(name, passcode);
    setPasscodeSession({
      memberId: member.id,
      displayName: member.displayName,
      passcode: member.passcode,
      status: member.status,
      passcodeActive: true,
    });
    setPendingRegistration(null);
  }, []);

  const submitRegistration = useCallback(async (name: string, note: string) => {
    setAuthError(null);
    const req = await submitRegistrationRequest(name, note);
    setPendingRegistration(req);
    return req;
  }, []);

  const clearPendingRegistration = useCallback(() => {
    setPendingRegistration(null);
  }, []);

  const activateApprovedRegistration = useCallback(() => {
    if (
      !pendingRegistration ||
      pendingRegistration.status !== 'approved' ||
      !pendingRegistration.assignedCode ||
      !pendingRegistration.memberId
    ) {
      return;
    }
    setPasscodeSession({
      memberId: pendingRegistration.memberId,
      displayName: pendingRegistration.displayName,
      passcode: pendingRegistration.assignedCode,
      status: 'approved',
      passcodeActive: true,
    });
    setPendingRegistration(null);
    setAuthModalOpen(false);
  }, [pendingRegistration]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setPasscodeSession(null);
      setAuthModalOpen(false);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        setAuthError('auth_popup_closed');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('auth_popup_blocked');
      } else {
        console.warn('Google sign-in failed:', code || err);
        setAuthError('auth_failed');
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setPasscodeSession(null);
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
      setActiveWheelId(localWheels[0]?.id || 'quick_start_wheel');
      if (activeNav === 'admin') setActiveNav('home');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }, [activeNav, localWheels, setActiveNav]);

  const reviewUser = useCallback(
    async (
      targetUid: string,
      status: AccountStatus,
      _role: AccountRole,
      assignedCode?: string,
      displayName?: string
    ) => {
      void _role;
      if (!user || !isPrimaryAdmin) return;
      await reviewUserRegistration(
        targetUid,
        status,
        'user',
        user.uid,
        assignedCode,
        displayName
      );
    },
    [isPrimaryAdmin, user]
  );

  const approveRegistrationWithCode = useCallback(
    async (request: RegistrationRequest, code: string) => {
      if (!user || !isPrimaryAdmin) return '';
      const result = await approveRegistrationRequestWithCode({
        request,
        rawCode: code,
        adminUid: user.uid,
      });
      return result.code;
    },
    [isPrimaryAdmin, user]
  );

  const rejectRegistration = useCallback(
    async (requestId: string) => {
      if (!user || !isPrimaryAdmin) return;
      await rejectRegistrationRequest(requestId, user.uid);
    },
    [isPrimaryAdmin, user]
  );

  const removeRegistrationRequest = useCallback(
    async (requestId: string) => {
      if (!user || !isPrimaryAdmin) return;
      await deleteRegistrationRequest(requestId);
    },
    [isPrimaryAdmin, user]
  );

  const createPasscode = useCallback(
    async (code: string, label: string) => {
      if (!user || !isPrimaryAdmin) return;
      await createAdminPasscode(user.uid, code, label);
    },
    [isPrimaryAdmin, user]
  );

  const togglePasscode = useCallback(
    async (code: string, active: boolean) => {
      if (!user || !isPrimaryAdmin) return;
      await toggleAdminPasscodeActive(code, active);
    },
    [isPrimaryAdmin, user]
  );

  const removePasscode = useCallback(
    async (code: string) => {
      if (!user || !isPrimaryAdmin) return;
      await deleteAdminPasscode(code);
    },
    [isPrimaryAdmin, user]
  );

  const reviewPasscodeMember = useCallback(
    async (memberId: string, status: 'approved' | 'rejected') => {
      if (!user || !isAdmin) return;
      await updatePasscodeMemberStatus(memberId, status);
    },
    [isAdmin, user]
  );

  const updatePasscodeMember = useCallback(
    async (
      memberId: string,
      patch: {
        displayName?: string;
        passcode?: string;
        status?: 'approved' | 'rejected';
        adminNote?: string;
      }
    ) => {
      if (!user || !isAdmin) return;
      await updatePasscodeMemberDetails(memberId, patch);
    },
    [isAdmin, user]
  );

  const removePasscodeMember = useCallback(
    async (memberId: string) => {
      if (!user || !isAdmin) return;
      await deletePasscodeMember(memberId);
    },
    [isAdmin, user]
  );

  const saveAppAdminName = useCallback(
    async (name: string) => {
      if (!user || !isAdmin) return;
      const saved = await updatePublicAppConfig({
        adminName: name,
        autoDropEnabled,
        defaultPasscode: defaultAutoCode,
      });
      setAppAdminName(saved.adminName);
      setAutoDropEnabled(saved.autoDropEnabled);
      setDefaultAutoCode(saved.defaultPasscode);
      try {
        localStorage.setItem(STORAGE_KEYS.appAdminName, saved.adminName);
      } catch {
        // Ignore quota errors
      }
    },
    [autoDropEnabled, defaultAutoCode, isAdmin, user]
  );

  const saveAutoDropConfig = useCallback(
    async (enabled: boolean, defaultCode: string) => {
      if (!user || !isAdmin) return;
      const saved = await updatePublicAppConfig({
        adminName: appAdminName,
        autoDropEnabled: enabled,
        defaultPasscode: defaultCode,
      });
      setAppAdminName(saved.adminName);
      setAutoDropEnabled(saved.autoDropEnabled);
      setDefaultAutoCode(saved.defaultPasscode);
    },
    [appAdminName, isAdmin, user]
  );

  const isSignedIn = Boolean(user || passcodeSession);
  const isAccessBlocked = Boolean(
    (user && userProfile && userProfile.role !== 'admin' && userProfile.status !== 'approved') ||
      (!user &&
        passcodeSession &&
        (passcodeSession.status === 'rejected' || !passcodeSession.passcodeActive))
  );
  const currentDisplayName =
    user?.displayName || user?.email?.split('@')[0] || passcodeSession?.displayName || '';

  const updateSettings = useCallback(
    (patch: Partial<LocalSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      if (user && isApprovedCloudUser) {
        const { spinSound: _localOnlySpinSound, ...cloudPatch } = patch;
        void _localOnlySpinSound;
        if (Object.keys(cloudPatch).length > 0) {
          updateUserPreferences(user.uid, cloudPatch).catch((err) =>
            console.error('Failed updating preferences:', err)
          );
        }
      }
    },
    [isApprovedCloudUser, user]
  );

  const selectWheel = useCallback((wheelId: string) => {
    setActiveWheelId(wheelId);
  }, []);

  const updateActiveWheel = useCallback(
    (patch: { title?: string; entries?: string[]; paletteId?: PaletteId }) => {
      const targetId = activeWheel.id;
      const now = Date.now();

      if (user && isApprovedCloudUser && cloudWheels.some((w) => w.id === targetId)) {
        setSaveStatus('saving');
        setCloudWheels((prev) =>
          prev.map((w) =>
            w.id === targetId
              ? {
                  ...w,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.entries !== undefined ? { entries: patch.entries } : {}),
                  ...(patch.paletteId !== undefined ? { paletteId: patch.paletteId } : {}),
                  updatedAtMs: now,
                }
              : w
          )
        );
        if (cloudWriteTimerRef.current) {
          clearTimeout(cloudWriteTimerRef.current);
        }
        cloudWriteTimerRef.current = setTimeout(() => {
          updateCloudWheel(user.uid, targetId, patch)
            .then(() => setSaveStatus('saved'))
            .catch((err) => {
              console.error('Cloud autosave error:', err);
              setSaveStatus('saved');
            });
        }, 450);
      } else {
        setLocalWheels((prev) =>
          prev.map((w) =>
            w.id === targetId
              ? {
                  ...w,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.entries !== undefined ? { entries: patch.entries } : {}),
                  ...(patch.paletteId !== undefined ? { paletteId: patch.paletteId } : {}),
                  updatedAtMs: now,
                }
              : w
          )
        );
      }
    },
    [activeWheel.id, cloudWheels, isApprovedCloudUser, user]
  );

  const createNewWheel = useCallback(
    async (
      title?: string,
      entries?: string[],
      paletteId: PaletteId = 'vibrant'
    ): Promise<string> => {
      const resolvedTitle = clampTitle(
        title || (settings.language === 'km' ? 'កងវិលថ្មី' : 'New Wheel')
      );
      const resolvedEntries =
        entries && entries.length > 0 ? clampEntries(entries) : [...QUICK_START_ENTRIES];

      if (user && isApprovedCloudUser) {
        const newId = await createCloudWheel(user.uid, {
          title: resolvedTitle,
          entries: resolvedEntries,
          paletteId,
        });
        setActiveWheelId(newId);
        return newId;
      }

      const id = sanitizeId(`local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      const now = Date.now();
      const newWheel: SavedWheel = {
        id,
        ownerId: 'local',
        title: resolvedTitle,
        entries: resolvedEntries,
        paletteId,
        spinCount: 0,
        lastWinner: '',
        createdAtMs: now,
        updatedAtMs: now,
      };
      setLocalWheels((prev) => [newWheel, ...prev]);
      setActiveWheelId(id);
      return id;
    },
    [isApprovedCloudUser, settings.language, user]
  );

  const applyTemplate = useCallback(
    async (template: WheelTemplate) => {
      const title = settings.language === 'km' ? template.titleKm : template.titleEn;
      await createNewWheel(title, template.entries, template.paletteId);
      setActiveNav('home');
    },
    [createNewWheel, setActiveNav, settings.language]
  );

  const duplicateWheel = useCallback(
    async (wheel: SavedWheel) => {
      const suffix = settings.language === 'km' ? ' (ចម្លង)' : ' (Copy)';
      await createNewWheel(`${wheel.title}${suffix}`, wheel.entries, wheel.paletteId);
    },
    [createNewWheel, settings.language]
  );

  const deleteWheel = useCallback(
    async (wheelId: string) => {
      if (user && isApprovedCloudUser) {
        await deleteCloudWheel(user.uid, wheelId);
      } else {
        setLocalWheels((prev) => {
          const filtered = prev.filter((w) => w.id !== wheelId);
          return filtered.length > 0 ? filtered : createStarterLocalWheels();
        });
      }
    },
    [isApprovedCloudUser, user]
  );

  const logSpinOutcome = useCallback(
    async (params: {
      winner: string;
      winnerColor: string;
      removedAfterSpin: boolean;
      updatedEntries?: string[];
    }) => {
      const now = Date.now();
      const nextSpinCount = (activeWheel.spinCount || 0) + 1;

      if (user && isApprovedCloudUser && cloudWheels.some((w) => w.id === activeWheel.id)) {
        await recordCloudSpinOutcome(user.uid, activeWheel.id, {
          wheelTitle: activeWheel.title,
          winner: params.winner,
          winnerColor: params.winnerColor,
          newSpinCount: nextSpinCount,
          updatedEntries: params.updatedEntries,
          removedAfterSpin: params.removedAfterSpin,
        });
      } else {
        setLocalWheels((prev) =>
          prev.map((w) =>
            w.id === activeWheel.id
              ? {
                  ...w,
                  spinCount: nextSpinCount,
                  lastWinner: params.winner,
                  entries: params.updatedEntries ?? w.entries,
                  updatedAtMs: now,
                }
              : w
          )
        );
        const record: SpinResultRecord = {
          id: `spin_${now}_${Math.random().toString(36).slice(2, 6)}`,
          ownerId: 'local',
          wheelId: activeWheel.id,
          wheelTitle: activeWheel.title,
          winner: params.winner,
          winnerColor: params.winnerColor,
          removedAfterSpin: params.removedAfterSpin,
          spunAtMs: now,
        };
        setLocalHistory((prev) => [record, ...prev].slice(0, 100));
      }
    },
    [activeWheel, cloudWheels, isApprovedCloudUser, user]
  );

  const deleteHistoryItem = useCallback(
    async (resultId: string) => {
      if (user && isApprovedCloudUser) {
        await deleteCloudSpinResult(user.uid, resultId);
      } else {
        setLocalHistory((prev) => prev.filter((r) => r.id !== resultId));
      }
    },
    [isApprovedCloudUser, user]
  );

  const clearHistory = useCallback(async () => {
    if (user && isApprovedCloudUser) {
      await Promise.all(cloudHistory.map((item) => deleteCloudSpinResult(user.uid, item.id)));
    } else {
      setLocalHistory([]);
    }
  }, [cloudHistory, isApprovedCloudUser, user]);

  const contextValue = useMemo<PickerwelContextValue>(
    () => ({
      user,
      userProfile,
      passcodeSession,
      isSignedIn,
      isAccessBlocked,
      currentDisplayName,
      isApprovedCloudUser,
      allUsers,
      reviewUser,
      adminPasscodes,
      passcodeMembers,
      registrationRequests,
      pendingRegistration,
      submitRegistration,
      clearPendingRegistration,
      activateApprovedRegistration,
      approveRegistrationWithCode,
      rejectRegistration,
      removeRegistrationRequest,
      createPasscode,
      togglePasscode,
      removePasscode,
      reviewPasscodeMember,
      updatePasscodeMember,
      removePasscodeMember,
      appAdminName,
      saveAppAdminName,
      autoDropEnabled,
      defaultAutoCode,
      saveAutoDropConfig,
      authReady,
      authLoading,
      authError,
      authModalOpen,
      prefillPasscode,
      openAuthModal,
      closeAuthModal,
      registerInstantAutoCode,
      registerWithPasscode,
      signInWithGoogle,
      signOut,
      activeNav,
      setActiveNav,
      markPendingNav,
      groupsSyncKey,
      bumpGroupsSyncKey,
      settings,
      updateSettings,
      wheels,
      activeWheel,
      selectWheel,
      updateActiveWheel,
      createNewWheel,
      applyTemplate,
      duplicateWheel,
      deleteWheel,
      history,
      logSpinOutcome,
      clearHistory,
      deleteHistoryItem,
      saveStatus,
    }),
    [
      user,
      userProfile,
      passcodeSession,
      isSignedIn,
      isAccessBlocked,
      currentDisplayName,
      isApprovedCloudUser,
      allUsers,
      reviewUser,
      adminPasscodes,
      passcodeMembers,
      registrationRequests,
      pendingRegistration,
      submitRegistration,
      clearPendingRegistration,
      activateApprovedRegistration,
      approveRegistrationWithCode,
      rejectRegistration,
      removeRegistrationRequest,
      createPasscode,
      togglePasscode,
      removePasscode,
      reviewPasscodeMember,
      updatePasscodeMember,
      removePasscodeMember,
      appAdminName,
      saveAppAdminName,
      autoDropEnabled,
      defaultAutoCode,
      saveAutoDropConfig,
      authReady,
      authLoading,
      authError,
      authModalOpen,
      prefillPasscode,
      openAuthModal,
      closeAuthModal,
      registerInstantAutoCode,
      registerWithPasscode,
      signInWithGoogle,
      signOut,
      activeNav,
      setActiveNav,
      markPendingNav,
      groupsSyncKey,
      bumpGroupsSyncKey,
      settings,
      updateSettings,
      wheels,
      activeWheel,
      selectWheel,
      updateActiveWheel,
      createNewWheel,
      applyTemplate,
      duplicateWheel,
      deleteWheel,
      history,
      logSpinOutcome,
      clearHistory,
      deleteHistoryItem,
      saveStatus,
    ]
  );

  return (
    <PickerwelContext.Provider value={contextValue}>
      {children}
    </PickerwelContext.Provider>
  );
}

export function usePickerwel(): PickerwelContextValue {
  const ctx = useContext(PickerwelContext);
  if (!ctx) {
    throw new Error('usePickerwel must be used inside PickerwelProvider');
  }
  return ctx;
}
