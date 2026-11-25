'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  FileText,
  Folder,
  Star,
  Palette,
  Eye,
  Undo2,
  Redo2,
  Link2,
  PlusCircle,
  FileInput,
  Type,
  Image as ImageIcon,
  Rows2,
  Copy,
  Trash2,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  Circle,
  Square,
  ListOrdered,
  AlignLeft,
  AlignJustify,
  SlidersHorizontal,
  Calendar,
  Clock,
  GripHorizontal,
  QrCode,
  Download,
  ExternalLink,
  Award,
  Plus,
  Sparkles,
  Mail,
  WifiOff,
  Play,
  Upload,
  FileDown,
  FileSpreadsheet,
  Sigma,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import { usePickerwel } from '@/components/PickerwelProvider';
import {
  FORM_THEMES,
  FORM_TEMPLATES,
  createDefaultQuestion,
  createStarterForm,
  loadLocalForms,
  saveLocalForms,
  loadLocalFormResponses,
  saveLocalFormResponse,
  deleteLocalFormResponse,
  clearLocalFormResponses,
  generateFormId,
  generateQuestionId,
  duplicateCustomForm,
  encodeOfflineFormPayload,
  exportOfflineFormPackageJson,
  parseOfflineFormPackageJson,
  type CustomForm,
  type FormEmailMode,
  type FormQuestion,
  type FormQuestionType,
  type FormResponseRecord,
  type FormThemeId,
} from '@/lib/forms-model';
import {
  exportFormToExcelXlsx,
  exportFormToWordDocx,
  importFormFromExcelFile,
  importFormFromWordFile,
} from '@/lib/form-office-io';
import {
  buildPublicFormUrl,
  deleteCloudFormResponse,
  publishFormToCloud,
  subscribeCloudFormResponses,
} from '@/lib/firestore-forms';
import {
  cacheCloudFormSnapshot,
  clearPendingSyncQueue,
  enqueueUnsyncedLocalResponses,
  flushPendingSyncQueue,
  submitFormResponseResilient,
  subscribePendingSync,
} from '@/lib/form-sync-queue';
import { useFormPendingSync } from '@/hooks/useFormPendingSync';
import { FormFiller } from './FormFiller';
import { FormResponsesView } from './FormResponsesView';
import { StemFormulaEditorModal } from './StemFormulaEditorModal';
import { PendingSyncQueueModal } from './PendingSyncQueueModal';
import { MathText, hasExplicitMathSyntax } from '@/components/MathText';

type BuilderTab = 'questions' | 'responses' | 'settings';

type FormulaTarget =
  | { kind: 'form_title' }
  | { kind: 'form_desc' }
  | { kind: 'q_title'; qId: string }
  | { kind: 'q_desc'; qId: string }
  | { kind: 'q_option'; qId: string; optIdx: number };

function QuestionTypeIcon({
  type,
  className,
}: {
  type: FormQuestionType;
  className?: string;
}) {
  switch (type) {
    case 'multiple_choice':
      return <Circle className={className} />;
    case 'checkboxes':
      return <Square className={className} />;
    case 'dropdown':
      return <ListOrdered className={className} />;
    case 'short_answer':
      return <AlignLeft className={className} />;
    case 'paragraph':
      return <AlignJustify className={className} />;
    case 'linear_scale':
      return <SlidersHorizontal className={className} />;
    case 'date':
      return <Calendar className={className} />;
    case 'time':
      return <Clock className={className} />;
    case 'section':
      return <Rows2 className={className} />;
  }
}

export function GoogleFormBuilderView() {
  const {
    user,
    userProfile,
    passcodeSession,
    isApprovedCloudUser,
    currentDisplayName,
    openAuthModal,
    settings,
    activeWheel,
  } = usePickerwel();

  const lang = settings.language;
  const km = lang === 'km';
  const isAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );

  const [forms, setForms] = useState<CustomForm[]>(() => [
    createStarterForm('km', { deterministic: true }),
  ]);
  const [activeFormId, setActiveFormId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  const [activeTab, setActiveTab] = useState<BuilderTab>('questions');
  const [focusedCardId, setFocusedCardId] = useState<string>('q_starter_month');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [offlineFillOpen, setOfflineFillOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareMode, setShareMode] = useState<'offline' | 'online'>('offline');
  const [wheelImportToast, setWheelImportToast] = useState<string | null>(null);
  const [formulaTarget, setFormulaTarget] = useState<FormulaTarget | null>(null);
  const [editingMathFieldKey, setEditingMathFieldKey] = useState<string | null>(null);
  const [syncQueueOpen, setSyncQueueOpen] = useState(false);

  // Undo / Redo history for active form
  const [undoStack, setUndoStack] = useState<CustomForm[]>([]);
  const [redoStack, setRedoStack] = useState<CustomForm[]>([]);

  // Local + Cloud responses
  const [localResponses, setLocalResponses] = useState<FormResponseRecord[]>([]);
  const [cloudResponses, setCloudResponses] = useState<FormResponseRecord[]>([]);

  // Publish / Share state
  const [publishing, setPublishing] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [officeBusy, setOfficeBusy] = useState<'excel' | 'word' | 'import' | null>(null);

  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const imageUploadTargetQId = useRef<string | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const officeImportRef = useRef<HTMLInputElement | null>(null);

  // Hydrate saved forms from localStorage
  useEffect(() => {
    queueMicrotask(() => {
      const stored = loadLocalForms();
      if (stored.length > 0) {
        setForms(stored);
        setActiveFormId(stored[0].id);
        setFocusedCardId(stored[0].questions[0]?.id || 'header');
      } else {
        const starter = createStarterForm(lang);
        setForms([starter]);
        setActiveFormId(starter.id);
        setFocusedCardId(starter.questions[0]?.id || 'header');
      }
      setHydrated(true);
    });
  }, [lang]);

  // Persist forms to localStorage whenever modified after hydration
  useEffect(() => {
    if (!hydrated) return;
    saveLocalForms(forms);
  }, [forms, hydrated]);

  const activeForm = useMemo(
    () => forms.find((f) => f.id === activeFormId) || forms[0],
    [activeFormId, forms]
  );

  // Load local responses when active form changes or sync queue updates
  useEffect(() => {
    if (!hydrated || !activeForm?.id) return;
    const refreshLocal = () => {
      setLocalResponses(loadLocalFormResponses(activeForm.id));
    };
    queueMicrotask(refreshLocal);
    const unsub = subscribePendingSync(refreshLocal);
    return () => unsub();
  }, [activeForm?.id, hydrated]);

  // Pending Sync queue state for active form + global queue
  const {
    items: activeFormPendingItems,
    allItems: allPendingSyncItems,
    totalCount: activeFormPendingCount,
    isOnline,
    isSyncing,
    syncNow: syncActiveFormQueue,
    retryItem: retryPendingItem,
    removeItem: removePendingItem,
    clearQueue: clearActiveFormQueue,
  } = useFormPendingSync({ formId: activeForm?.id });

  const unsyncedLocalCount = useMemo(() => {
    const queuedIds = new Set(activeFormPendingItems.map((i) => i.id));
    return localResponses.filter(
      (r) => r.source !== 'cloud' && r.syncStatus !== 'synced' && !queuedIds.has(r.id)
    ).length;
  }, [activeFormPendingItems, localResponses]);

  // Subscribe to cloud responses when active form is synced & user has read permission
  useEffect(() => {
    if (!activeForm?.syncedToCloud || !activeForm.id) {
      queueMicrotask(() => setCloudResponses([]));
      return;
    }
    const canReadCloud =
      isAdmin || (Boolean(user) && isApprovedCloudUser && activeForm.ownerId === user?.uid);
    if (!canReadCloud) {
      queueMicrotask(() => setCloudResponses([]));
      return;
    }
    const unsub = subscribeCloudFormResponses(
      activeForm.id,
      { isAdmin, ownerUid: user?.uid },
      (items) => setCloudResponses(items)
    );
    return () => unsub();
  }, [activeForm?.id, activeForm?.ownerId, activeForm?.syncedToCloud, isAdmin, isApprovedCloudUser, user]);

  // Combine cloud + local responses without duplicates
  const allResponses = useMemo(() => {
    const seen = new Set<string>();
    const merged: FormResponseRecord[] = [];
    for (const r of [...cloudResponses, ...localResponses]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      merged.push(r);
    }
    return merged.sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  }, [cloudResponses, localResponses]);

  const theme = FORM_THEMES[activeForm?.themeId || 'purple'] || FORM_THEMES.purple;
  const publicUrl = useMemo(
    () => (activeForm ? buildPublicFormUrl(activeForm.id) : ''),
    [activeForm]
  );

  const offlineShareUrl = useMemo(() => {
    if (!activeForm || !publicUrl) return '';
    const encoded = encodeOfflineFormPayload(activeForm);
    return encoded ? `${publicUrl}#offline=${encoded}` : publicUrl;
  }, [activeForm, publicUrl]);

  const activeShareUrl = shareMode === 'offline' ? offlineShareUrl : publicUrl;

  // Generate QR code when Share modal is open
  useEffect(() => {
    if (!shareModalOpen || !activeShareUrl) return;
    let active = true;
    QRCode.toDataURL(activeShareUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [activeShareUrl, shareModalOpen]);

  const currentActiveFormId = activeForm.id;

  const mutateActiveForm = useCallback(
    (updater: (prev: CustomForm) => CustomForm, pushUndo = true) => {
      setForms((prevForms) =>
        prevForms.map((f) => {
          if (f.id !== currentActiveFormId) return f;
          if (pushUndo) {
            setUndoStack((s) => [...s.slice(-24), f]);
            setRedoStack([]);
          }
          return { ...updater(f), updatedAtMs: Date.now() };
        })
      );
    },
    [currentActiveFormId]
  );

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s.slice(-24), activeForm]);
    setForms((prev) => prev.map((f) => (f.id === activeForm.id ? prevSnapshot : f)));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s.slice(-24), activeForm]);
    setForms((prev) => prev.map((f) => (f.id === activeForm.id ? nextSnapshot : f)));
  };

  const handleAddQuestion = (type: FormQuestionType = 'multiple_choice') => {
    const newQ = createDefaultQuestion(type, lang);
    mutateActiveForm((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === focusedCardId);
      const nextQuestions = [...prev.questions];
      if (idx >= 0) {
        nextQuestions.splice(idx + 1, 0, newQ);
      } else {
        nextQuestions.push(newQ);
      }
      return { ...prev, questions: nextQuestions };
    });
    setFocusedCardId(newQ.id);
    setActiveTab('questions');
  };

  const handleImportWheelAsOptions = () => {
    const entries = activeWheel.entries.filter((e) => e.trim()).slice(0, 30);
    if (entries.length < 2) {
      setWheelImportToast(
        km
          ? 'កងវិលបច្ចុប្បន្នត្រូវមានធាតុយ៉ាងតិច ២ ដើម្បីនាំចូល'
          : 'Active wheel needs at least 2 entries to import'
      );
      window.setTimeout(() => setWheelImportToast(null), 2600);
      return;
    }
    const newQ: FormQuestion = {
      id: generateQuestionId(),
      type: 'multiple_choice',
      title: activeWheel.title || (km ? 'ជ្រើសរើសពីកងវិល' : 'Choose from Wheel'),
      required: true,
      options: entries,
      hasOther: false,
      points: 1,
    };
    mutateActiveForm((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    setFocusedCardId(newQ.id);
    setWheelImportToast(
      km
        ? `បាននាំចូល ${entries.length} ជម្រើសពីកងវិល!`
        : `Imported ${entries.length} options from active wheel!`
    );
    window.setTimeout(() => setWheelImportToast(null), 2600);
  };

  const updateQuestion = (qId: string, patch: Partial<FormQuestion>) => {
    mutateActiveForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));
  };

  const handleChangeQuestionType = (q: FormQuestion, nextType: FormQuestionType) => {
    const needsOptions =
      nextType === 'multiple_choice' ||
      nextType === 'checkboxes' ||
      nextType === 'dropdown';
    updateQuestion(q.id, {
      type: nextType,
      options:
        needsOptions && q.options.length === 0
          ? [km ? 'ជម្រើសទី ១' : 'Option 1', km ? 'ជម្រើសទី ២' : 'Option 2']
          : q.options,
      scaleMin: nextType === 'linear_scale' ? q.scaleMin ?? 1 : q.scaleMin,
      scaleMax: nextType === 'linear_scale' ? q.scaleMax ?? 5 : q.scaleMax,
    });
  };

  const handleDuplicateQuestion = (q: FormQuestion) => {
    const clone: FormQuestion = {
      ...q,
      id: generateQuestionId(),
      options: [...q.options],
    };
    mutateActiveForm((prev) => {
      const idx = prev.questions.findIndex((item) => item.id === q.id);
      const next = [...prev.questions];
      next.splice(idx + 1, 0, clone);
      return { ...prev, questions: next };
    });
    setFocusedCardId(clone.id);
  };

  const handleDeleteQuestion = (qId: string) => {
    mutateActiveForm((prev) => {
      const next = prev.questions.filter((q) => q.id !== qId);
      return {
        ...prev,
        questions: next.length > 0 ? next : [createDefaultQuestion('multiple_choice', lang)],
      };
    });
  };

  const handleMoveQuestion = (qId: string, direction: -1 | 1) => {
    mutateActiveForm((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === qId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.questions.length) return prev;
      const next = [...prev.questions];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...prev, questions: next };
    });
  };

  const handleTriggerImageUpload = (qId: string) => {
    imageUploadTargetQId.current = qId;
    imageUploadRef.current?.click();
  };

  const handleImageFilePicked = (files: FileList | null) => {
    const file = files?.[0];
    const targetQId = imageUploadTargetQId.current;
    if (!file || !targetQId || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        updateQuestion(targetQId, { imageUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
    if (imageUploadRef.current) imageUploadRef.current.value = '';
  };

  const handlePublish = async () => {
    setPublishNotice(null);
    const canCloudPublish =
      (Boolean(user) && (isApprovedCloudUser || isAdmin)) ||
      Boolean(
        passcodeSession &&
          passcodeSession.status === 'approved' &&
          passcodeSession.passcodeActive
      );

    if (!canCloudPublish) {
      // Mark published locally and show share modal with sign-in hint for cross-device cloud link
      mutateActiveForm((prev) => ({ ...prev, published: true }), false);
      setPublishNotice(
        km
          ? 'បានរក្សាទុក និងបើកប្រើ Offline លើឧបករណ៍នេះ! ចុះឈ្មោះ ឬចូលគណនីដើម្បីចែករំលែក Link & QR ឆ្លងទូរស័ព្ទ។'
          : 'Published locally for offline use on this device! Sign in / register to publish a live cross-device Link & QR.'
      );
      setShareModalOpen(true);
      return;
    }

    setPublishing(true);
    try {
      const ownerId = user ? user.uid : passcodeSession!.memberId;
      const ownerType = user ? 'google' : 'passcode';
      const synced = await publishFormToCloud({
        form: activeForm,
        ownerId,
        ownerType,
        ownerDisplayName: currentDisplayName || 'Teacher',
      });
      cacheCloudFormSnapshot(synced);
      setForms((prev) => prev.map((f) => (f.id === activeForm.id ? synced : f)));

      // Automatically queue and push any previously cached offline responses for this form
      const currentLocals = loadLocalFormResponses(synced.id);
      const queuedLocals = enqueueUnsyncedLocalResponses(synced, currentLocals);
      let pushedCount = 0;
      if (queuedLocals.length > 0 || activeFormPendingCount > 0) {
        const syncRes = await flushPendingSyncQueue({ formId: synced.id });
        pushedCount = syncRes.synced;
        setLocalResponses(loadLocalFormResponses(synced.id));
      }

      setPublishNotice(
        pushedCount > 0
          ? km
            ? `បានបោះពុម្ពផ្សាយ និងបញ្ជូនចម្លើយ Offline ចំនួន ${pushedCount} ទៅ Cloud ដោយស្វ័យប្រវត្តិ!`
            : `Published live and auto-synced ${pushedCount} cached offline submission${pushedCount === 1 ? '' : 's'} to cloud!`
          : km
            ? 'បានបោះពុម្ពផ្សាយជោគជ័យ! អ្នកចូលរួមអាចស្គែន QR ឬបើក Link ដោយមិនបាច់មាន Email។'
            : 'Published live! Respondents can scan the QR or open the link with zero email login.'
      );
      setShareModalOpen(true);
    } catch {
      setPublishNotice(
        km
          ? 'មិនអាចភ្ជាប់ Cloud បានទេ — ទម្រង់នៅតែរក្សាទុក Offline លើឧបករណ៍នេះ។'
          : 'Could not sync to cloud right now — your form remains saved offline on this device.'
      );
      setShareModalOpen(true);
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!activeShareUrl) return;
    try {
      await navigator.clipboard.writeText(activeShareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = activeShareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const handleExportOfflineJson = () => {
    const json = exportOfflineFormPackageJson(activeForm, allResponses);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeForm.title || 'form').replace(/[^\w\u1780-\u17FF-]+/g, '_')}_offline_form.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportOfflineJson = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseOfflineFormPackageJson(String(reader.result || ''));
      if (!parsed) {
        setWheelImportToast(
          km ? 'ឯកសារ .json មិនត្រឹមត្រូវទេ!' : 'Invalid offline form .json file!'
        );
        window.setTimeout(() => setWheelImportToast(null), 3200);
        return;
      }
      setForms((prev) => [parsed.form, ...prev.filter((f) => f.id !== parsed.form.id)]);
      setActiveFormId(parsed.form.id);
      setFocusedCardId(parsed.form.questions[0]?.id || 'header');
      if (parsed.responses.length > 0) {
        for (const r of parsed.responses) {
          saveLocalFormResponse(r);
        }
        setLocalResponses(loadLocalFormResponses(parsed.form.id));
      }
      setLibraryOpen(false);
      setShareModalOpen(false);
      setWheelImportToast(
        km
          ? `បាននាំចូលទម្រង់ Offline "${parsed.form.title}" ដោយជោគជ័យ!`
          : `Imported offline form "${parsed.form.title}"!`
      );
      window.setTimeout(() => setWheelImportToast(null), 3200);
    };
    reader.readAsText(file);
    if (jsonImportRef.current) jsonImportRef.current.value = '';
  };

  const handleExportExcel = async () => {
    setOfficeBusy('excel');
    try {
      await exportFormToExcelXlsx(activeForm, allResponses, lang);
      setWheelImportToast(
        km
          ? `បានទាញយកទិន្នន័យ Form ទាំងអស់ជា Excel (.xlsx) រួចរាល់!`
          : `Exported all form data to Excel (.xlsx)!`
      );
      window.setTimeout(() => setWheelImportToast(null), 2800);
    } finally {
      setOfficeBusy(null);
    }
  };

  const handleExportWord = async () => {
    setOfficeBusy('word');
    try {
      await exportFormToWordDocx(activeForm, allResponses, lang);
      setWheelImportToast(
        km
          ? `បានទាញយកទិន្នន័យ Form ទាំងអស់ជា Word (.docx) រួចរាល់!`
          : `Exported all form data to Word (.docx)!`
      );
      window.setTimeout(() => setWheelImportToast(null), 2800);
    } finally {
      setOfficeBusy(null);
    }
  };

  const handleImportOfficeFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setOfficeBusy('import');
    try {
      const newFormId = generateFormId();
      const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
      const parsed = isExcel
        ? await importFormFromExcelFile(file, newFormId)
        : await importFormFromWordFile(file);

      if (!parsed || parsed.questions.length === 0) {
        setWheelImportToast(
          km
            ? 'រកមិនឃើញសំណួរនៅក្នុងឯកសារ Excel/Word នេះទេ។'
            : 'No readable questions found in that Excel/Word file.'
        );
        window.setTimeout(() => setWheelImportToast(null), 3500);
        return;
      }

      const now = Date.now();
      const importedForm: CustomForm = {
        id: newFormId,
        title: parsed.title,
        description: km
          ? `បាននាំចូលពីឯកសារ ${file.name}`
          : `Imported from ${file.name}`,
        themeId: activeForm.themeId || 'purple',
        starred: false,
        published: false,
        questions: parsed.questions,
        settings: {
          acceptingResponses: true,
          isQuiz: parsed.questions.some((q) => Boolean(q.correctOption)),
          collectRespondentName: true,
          emailMode: parsed.emailMode || 'none',
          allowMultipleResponses: true,
          shuffleQuestions: false,
          confirmationMessage: km
            ? 'សូមអរគុណ! ចម្លើយរបស់អ្នកត្រូវបានរក្សាទុកដោយជោគជ័យ។'
            : 'Thank you! Your response has been recorded.',
        },
        createdAtMs: now,
        updatedAtMs: now,
      };

      setForms((prev) => [importedForm, ...prev]);
      setActiveFormId(importedForm.id);
      setFocusedCardId(importedForm.questions[0]?.id || 'header');
      setUndoStack([]);
      setRedoStack([]);

      if (parsed.responses.length > 0) {
        for (const r of parsed.responses) {
          saveLocalFormResponse(r);
        }
        setLocalResponses(loadLocalFormResponses(importedForm.id));
      } else {
        setLocalResponses([]);
      }

      setLibraryOpen(false);
      setActiveTab('questions');
      setWheelImportToast(
        km
          ? `បាននាំចូល ${parsed.questions.length} សំណួរ${parsed.responses.length > 0 ? ` និង ${parsed.responses.length} ចម្លើយ` : ''} ពី ${file.name}!`
          : `Imported ${parsed.questions.length} questions${parsed.responses.length > 0 ? ` & ${parsed.responses.length} responses` : ''} from ${file.name}!`
      );
      window.setTimeout(() => setWheelImportToast(null), 3500);
    } catch {
      setWheelImportToast(
        km
          ? 'មិនអាចអានឯកសារនេះបានទេ។ សូមប្រើឯកសារ .xlsx, .csv ឬ .docx ត្រឹមត្រូវ។'
          : 'Could not read that file. Please upload a valid .xlsx, .csv, or .docx file.'
      );
      window.setTimeout(() => setWheelImportToast(null), 3500);
    } finally {
      setOfficeBusy(null);
      if (officeImportRef.current) officeImportRef.current.value = '';
    }
  };

  const handleCreateFromTemplate = (templateId: string) => {
    const preset = FORM_TEMPLATES.find((p) => p.id === templateId) || FORM_TEMPLATES[0];
    const created = preset.build(lang);
    setForms((prev) => [created, ...prev]);
    setActiveFormId(created.id);
    setFocusedCardId(created.questions[0]?.id || 'header');
    setUndoStack([]);
    setRedoStack([]);
    setActiveTab('questions');
    setLibraryOpen(false);
  };

  const handleDuplicateForm = (form: CustomForm) => {
    const copy = duplicateCustomForm(form, km ? 'ចម្លង' : 'Copy');
    setForms((prev) => [copy, ...prev]);
    setActiveFormId(copy.id);
    setLibraryOpen(false);
  };

  const handleDeleteForm = (formId: string) => {
    setForms((prev) => {
      const next = prev.filter((f) => f.id !== formId);
      if (next.length === 0) {
        const fresh = createStarterForm(lang);
        setActiveFormId(fresh.id);
        return [fresh];
      }
      if (activeFormId === formId) {
        setActiveFormId(next[0].id);
      }
      return next;
    });
  };

  const questionTypes: { id: FormQuestionType; labelEn: string; labelKm: string }[] = [
    { id: 'multiple_choice', labelEn: 'Multiple choice', labelKm: 'ពហុជម្រើស (Multiple choice)' },
    { id: 'checkboxes', labelEn: 'Checkboxes', labelKm: 'ជ្រើសច្រើន (Checkboxes)' },
    { id: 'dropdown', labelEn: 'Dropdown', labelKm: 'បញ្ជីទម្លាក់ (Dropdown)' },
    { id: 'short_answer', labelEn: 'Short answer', labelKm: 'ចម្លើយខ្លី (Short answer)' },
    { id: 'paragraph', labelEn: 'Paragraph', labelKm: 'កថាខណ្ឌវែង (Paragraph)' },
    { id: 'linear_scale', labelEn: 'Linear scale', labelKm: 'មាត្រដ្ឋានពិន្ទុ (1–5)' },
    { id: 'date', labelEn: 'Date', labelKm: 'កាលបរិច្ឆេទ (Date)' },
    { id: 'time', labelEn: 'Time', labelKm: 'ម៉ោង (Time)' },
  ];

  if (!activeForm) return null;

  if (previewOpen || offlineFillOpen) {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
        <FormFiller
          form={activeForm}
          language={lang}
          isPreview={previewOpen}
          isOfflineMode={offlineFillOpen}
          offlineSavedCount={localResponses.length}
          isOnline={isOnline}
          pendingSyncCount={activeFormPendingCount}
          isSyncing={isSyncing}
          onSyncNow={() => void syncActiveFormQueue(true)}
          onOpenSyncQueue={() => setSyncQueueOpen(true)}
          onExitPreview={() => {
            setPreviewOpen(false);
            setOfflineFillOpen(false);
          }}
          onSubmitResponse={async (payload) => {
            const outcome = await submitFormResponseResilient({
              form: activeForm,
              respondentName: payload.respondentName,
              respondentEmail: payload.respondentEmail,
              answers: payload.answers,
              score: payload.score,
              maxScore: payload.maxScore,
              preferOfflineQueue: offlineFillOpen,
            });
            setLocalResponses(loadLocalFormResponses(activeForm.id));
            return { syncMode: outcome.mode };
          }}
        />

        <PendingSyncQueueModal
          open={syncQueueOpen}
          language={lang}
          accentColor={theme.primary}
          items={activeFormPendingItems}
          isOnline={isOnline}
          isSyncing={isSyncing}
          scopedTitle={activeForm.title}
          onClose={() => setSyncQueueOpen(false)}
          onSyncNow={() => syncActiveFormQueue(true)}
          onRetryItem={retryPendingItem}
          onRemoveItem={removePendingItem}
          onClearAll={clearActiveFormQueue}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Hidden File Input for Question Images */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleImageFilePicked(e.target.files)}
        className="hidden"
      />
      {/* Hidden File Input for Offline JSON Import */}
      <input
        ref={jsonImportRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => handleImportOfflineJson(e.target.files)}
        className="hidden"
      />
      {/* Hidden File Input for Excel / Word Import */}
      <input
        ref={officeImportRef}
        type="file"
        accept=".xlsx,.xls,.csv,.docx,.txt"
        onChange={(e) => handleImportOfficeFile(e.target.files)}
        className="hidden"
      />

      {/* TOP GOOGLE FORMS HEADER BAR */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="px-3 sm:px-5 pt-2.5 pb-1.5 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Form Icon, Inline Title, Folder, Star, Auto-save */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              title={km ? 'ទម្រង់ទាំងអស់របស់ខ្ញុំ' : 'My Forms'}
              className="w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
              style={{ backgroundColor: theme.primary }}
            >
              <FileText className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={activeForm.title}
              maxLength={140}
              onChange={(e) =>
                mutateActiveForm((prev) => ({ ...prev, title: e.target.value }), false)
              }
              aria-label={km ? 'ចំណងជើងទម្រង់' : 'Form title'}
              className="min-w-[140px] max-w-[260px] sm:max-w-[340px] flex-1 bg-transparent text-base font-semibold text-slate-900 dark:text-white px-1.5 py-1 rounded-md hover:bg-slate-100/70 dark:hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-purple-500/40 truncate"
            />

            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              title={km ? 'ទម្រង់ដែលបានរក្សាទុក & គំរូ' : 'Saved Forms & Templates'}
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Folder className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                mutateActiveForm((prev) => ({ ...prev, starred: !prev.starred }), false)
              }
              title={km ? 'ដាក់ផ្កាយ' : 'Star form'}
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Star
                className={`w-4 h-4 ${
                  activeForm.starred
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-400'
                }`}
              />
            </button>

            <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap ml-1">
              {activeForm.syncedToCloud
                ? km
                  ? 'បានរក្សាទុកលើ Cloud'
                  : 'All changes saved'
                : km
                  ? 'រក្សាទុកដោយស្វ័យប្រវត្តិ (Offline)'
                  : 'All changes saved offline'}
            </span>
          </div>

          {/* Right Toolbar Icons & Publish CTA */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemePickerOpen((v) => !v)}
                title={km ? 'ប្តូរពណ៌ទម្រង់' : 'Customize theme'}
                className={`min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  themePickerOpen
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Palette className="w-4.5 h-4.5" />
              </button>

              {themePickerOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {km ? 'ពណ៌ទម្រង់ (Theme)' : 'Form Theme Color'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setThemePickerOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {(Object.keys(FORM_THEMES) as FormThemeId[]).map((tid) => {
                      const spec = FORM_THEMES[tid];
                      const selected = activeForm.themeId === tid;
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => {
                            mutateActiveForm((prev) => ({ ...prev, themeId: tid }), false);
                          }}
                          title={km ? spec.nameKm : spec.nameEn}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                            selected
                              ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: spec.primary }}
                        >
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              title={km ? 'មើលជាមុន / សាកល្បងឆ្លើយ' : 'Preview'}
              className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Eye className="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={km ? 'ត្រឡប់ក្រោយ (Undo)' : 'Undo'}
              className="hidden sm:flex min-h-[38px] min-w-[38px] rounded-full items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title={km ? 'ធ្វើម្តងទៀត (Redo)' : 'Redo'}
              className="hidden sm:flex min-h-[38px] min-w-[38px] rounded-full items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShareMode(activeForm.syncedToCloud ? 'online' : 'offline');
                setShareModalOpen(true);
              }}
              title={km ? 'ចែករំលែក Offline / Online Link & QR' : 'Share Offline / Online Link & QR'}
              className="min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Link2 className="w-4.5 h-4.5" />
            </button>

            {(allPendingSyncItems.length > 0 || isSyncing) && (
              <button
                type="button"
                onClick={() => setSyncQueueOpen(true)}
                title={km ? 'បញ្ជីរង់ចាំបញ្ជូនទៅ Cloud (Pending Sync)' : 'Pending Sync Queue'}
                className="min-h-[38px] px-2.5 sm:px-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span className="hidden md:inline">
                  {km ? 'Pending Sync' : 'Pending Sync'}
                </span>
                <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/80 text-[11px]">
                  {allPendingSyncItems.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOfflineFillOpen(true)}
              title={km ? 'បំពេញទម្រង់ផ្ទាល់ Offline' : 'Fill Form Offline'}
              className="hidden sm:inline-flex min-h-[38px] px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold items-center gap-1.5 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{km ? 'ប្រើ Offline' : 'Offline Fill'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShareMode('online');
                handlePublish();
              }}
              disabled={publishing}
              className="min-h-[38px] px-4 sm:px-5 rounded-lg text-white text-xs sm:text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: theme.primary }}
            >
              {publishing
                ? km
                  ? 'កំពុងផ្សាយ...'
                  : 'Publishing...'
                : km
                  ? 'Publish'
                  : 'Publish'}
            </button>
          </div>
        </div>

        {/* CENTERED SUB-TABS: Questions | Responses | Settings */}
        <div className="flex items-center justify-center gap-6 sm:gap-9 px-3">
          {(
            [
              { id: 'questions' as const, labelKm: 'សំណួរ (Questions)', labelEn: 'Questions' },
              {
                id: 'responses' as const,
                labelKm: 'ចម្លើយ (Responses)',
                labelEn: 'Responses',
                count: allResponses.length,
              },
              { id: 'settings' as const, labelKm: 'ការកំណត់ (Settings)', labelEn: 'Settings' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-2.5 text-xs sm:text-sm font-semibold border-b-[3px] transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                style={
                  active
                    ? { borderColor: theme.primary, color: theme.primary }
                    : undefined
                }
              >
                <span>{km ? tab.labelKm : tab.labelEn}</span>
                {'count' in tab && tab.count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* MAIN TINTED CANVAS (Google Forms Soft Lavender / Theme Tint) */}
      <main
        className="flex-1 overflow-y-auto px-3 sm:px-5 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-12 transition-colors dark:!bg-slate-950"
        style={{ backgroundColor: theme.softBgLight }}
      >
        {wheelImportToast && (
          <div className="max-w-[760px] mx-auto mb-3 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-medium flex items-center gap-2 shadow-md">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{wheelImportToast}</span>
          </div>
        )}

        {/* TAB 1: QUESTIONS BUILDER */}
        {activeTab === 'questions' && (
          <div className="max-w-[830px] mx-auto flex items-start justify-center gap-3.5">
            {/* Form Cards Column */}
            <div className="flex-1 max-w-[760px] min-w-0 space-y-3.5">
              {/* FORM HEADER CARD */}
              <div
                onClick={() => setFocusedCardId('header')}
                className={`rounded-xl bg-white dark:bg-slate-900 border shadow-sm overflow-hidden transition-shadow ${
                  focusedCardId === 'header'
                    ? 'border-blue-400/90 dark:border-blue-500/80 ring-2 ring-blue-500/20'
                    : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                <div
                  className="h-2.5 w-full"
                  style={{ backgroundColor: theme.primary }}
                />
                <div className="p-5 sm:p-6 space-y-2.5">
                  {hasExplicitMathSyntax(activeForm.title) &&
                  editingMathFieldKey !== 'form_title' ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (focusedCardId === 'header') {
                          e.stopPropagation();
                          setEditingMathFieldKey('form_title');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setFocusedCardId('header');
                          setEditingMathFieldKey('form_title');
                        }
                      }}
                      title={km ? 'ចុចដើម្បីកែប្រែ' : 'Click to edit'}
                      className="w-full font-display text-xl sm:text-[28px] font-normal text-slate-900 dark:text-white border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 pb-1 leading-snug cursor-text overflow-x-auto"
                    >
                      <MathText text={activeForm.title} explicitOnly />
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows={1}
                        autoFocus={editingMathFieldKey === 'form_title'}
                        value={activeForm.title}
                        maxLength={220}
                        onBlur={() =>
                          setEditingMathFieldKey((cur) =>
                            cur === 'form_title' ? null : cur
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setEditingMathFieldKey(null);
                          }
                        }}
                        onChange={(e) =>
                          mutateActiveForm(
                            (prev) => ({ ...prev, title: e.target.value.replace(/\n/g, ' ') }),
                            false
                          )
                        }
                        placeholder={km ? 'ចំណងជើងទម្រង់...' : 'Form title'}
                        className="w-full bg-transparent font-display text-xl sm:text-[28px] font-normal text-slate-900 dark:text-white border-b border-transparent focus:border-[#673AB7] focus:outline-none pb-1 resize-none leading-snug"
                      />
                      {editingMathFieldKey === 'form_title' &&
                        hasExplicitMathSyntax(activeForm.title) && (
                          <div className="rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 px-3 py-1.5 text-base font-semibold text-slate-900 dark:text-white overflow-x-auto">
                            <MathText text={activeForm.title} explicitOnly />
                          </div>
                        )}
                    </>
                  )}
                  {hasExplicitMathSyntax(activeForm.description) &&
                  editingMathFieldKey !== 'form_desc' ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (focusedCardId === 'header') {
                          e.stopPropagation();
                          setEditingMathFieldKey('form_desc');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setFocusedCardId('header');
                          setEditingMathFieldKey('form_desc');
                        }
                      }}
                      title={km ? 'ចុចដើម្បីកែប្រែ' : 'Click to edit'}
                      className="w-full text-sm text-slate-600 dark:text-slate-300 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 pb-1 cursor-text overflow-x-auto"
                    >
                      <MathText text={activeForm.description} explicitOnly />
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        autoFocus={editingMathFieldKey === 'form_desc'}
                        value={activeForm.description}
                        maxLength={2000}
                        onBlur={() =>
                          setEditingMathFieldKey((cur) =>
                            cur === 'form_desc' ? null : cur
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setEditingMathFieldKey(null);
                          }
                        }}
                        onChange={(e) =>
                          mutateActiveForm(
                            (prev) => ({ ...prev, description: e.target.value }),
                            false
                          )
                        }
                        placeholder={km ? 'ការពិពណ៌នាទម្រង់' : 'Form description'}
                        className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-300 border-b border-transparent focus:border-[#673AB7] focus:outline-none pb-1"
                      />
                      {editingMathFieldKey === 'form_desc' &&
                        hasExplicitMathSyntax(activeForm.description) && (
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 overflow-x-auto">
                            <MathText text={activeForm.description} explicitOnly />
                          </div>
                        )}
                    </>
                  )}

                  {/* QUICK OFFLINE + EMAIL MODE BAR (Use Email / Without Email) */}
                  <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{km ? 'Email៖' : 'Email:'}</span>
                      </span>
                      {(
                        [
                          { id: 'none' as FormEmailMode, labelKm: 'អត់ប្រើ Email', labelEn: 'No Email' },
                          { id: 'optional' as FormEmailMode, labelKm: 'Email ស្រេចចិត្ត', labelEn: 'Optional' },
                          { id: 'required' as FormEmailMode, labelKm: 'ប្រើ Email (ចាំបាច់)', labelEn: 'Require Email' },
                        ] as const
                      ).map((opt) => {
                        const selected = (activeForm.settings.emailMode || 'none') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              mutateActiveForm((prev) => ({
                                ...prev,
                                settings: { ...prev.settings, emailMode: opt.id },
                              }));
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                              selected
                                ? 'text-white border-transparent shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            style={selected ? { backgroundColor: theme.primary } : undefined}
                          >
                            {km ? opt.labelKm : opt.labelEn}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                        <WifiOff className="w-3 h-3" />
                        <span>Offline</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOfflineFillOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold inline-flex items-center gap-1 hover:opacity-90 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{km ? 'បំពេញផ្ទាល់ Offline' : 'Fill Offline'}</span>
                      </button>
                    </div>
                  </div>

                  {/* EXCEL & WORD EXPORT / IMPORT STRIP */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {km ? 'ទាញចេញ / នាំចូលទិន្នន័យ Form៖' : 'Form Office Export / Import:'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={officeBusy !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportExcel();
                        }}
                        className="px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 disabled:opacity-60 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>
                          {officeBusy === 'excel'
                            ? '...'
                            : km
                              ? 'ទាញជា Excel (.xlsx)'
                              : 'Excel (.xlsx)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={officeBusy !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportWord();
                        }}
                        className="px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 disabled:opacity-60 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {officeBusy === 'word'
                            ? '...'
                            : km
                              ? 'ទាញជា Word (.docx)'
                              : 'Word (.docx)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={officeBusy !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          officeImportRef.current?.click();
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {officeBusy === 'import'
                            ? '...'
                            : km
                              ? 'នាំចូល Excel / Word'
                              : 'Import Excel / Word'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const focusedQ = activeForm.questions.find(
                            (item) => item.id === focusedCardId
                          );
                          if (focusedQ) {
                            setFormulaTarget({ kind: 'q_title', qId: focusedQ.id });
                          } else {
                            setFormulaTarget({ kind: 'form_title' });
                          }
                        }}
                        title={
                          km
                            ? 'បើកកម្មវិធីសរសេររូបមន្ត គណិតវិទ្យា រូបវិទ្យា គីមីវិទ្យា គ្រប់ទម្រង់'
                            : 'Open Math, Physics & Chemistry Formula Studio'
                        }
                        className="px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 cursor-pointer"
                      >
                        <Sigma className="w-3.5 h-3.5" />
                        <span>
                          {km ? 'MathType គណិត•រូប•គីមី' : 'MathType Studio'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Live Email Preview Strip inside Header Card when Email is Enabled */}
                  {(activeForm.settings.emailMode || 'none') !== 'none' && (
                    <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
                        <span className="truncate">
                          {activeForm.settings.emailMode === 'required'
                            ? km
                              ? 'ប្រអប់អ៊ីមែល (Email) * — តម្រូវឱ្យអ្នកឆ្លើយបំពេញ'
                              : 'Email field * — Respondents must enter a valid email'
                            : km
                              ? 'ប្រអប់អ៊ីមែល (Email) — ស្រេចចិត្ត (អាចទុកទទេបាន)'
                              : 'Email field — Optional for respondents'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          mutateActiveForm((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, emailMode: 'none' },
                          }));
                        }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer whitespace-nowrap"
                      >
                        {km ? 'បិទ Email' : 'Disable'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* QUESTION CARDS */}
              {activeForm.questions.map((q, qIdx) => {
                const isFocused = focusedCardId === q.id;
                const isChoiceType =
                  q.type === 'multiple_choice' ||
                  q.type === 'checkboxes' ||
                  q.type === 'dropdown';

                return (
                  <div
                    key={q.id}
                    onClick={() => setFocusedCardId(q.id)}
                    className={`rounded-xl bg-white dark:bg-slate-900 border shadow-sm transition-all ${
                      isFocused
                        ? 'border-blue-500/80 dark:border-blue-400/80 ring-2 ring-blue-500/15 shadow-md'
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Section top bar if section type */}
                    {q.type === 'section' && (
                      <div
                        className="px-5 py-1.5 rounded-t-xl text-[11px] font-semibold text-white uppercase tracking-wide"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {km ? 'ផ្នែក (Section)' : 'Section Header'}
                      </div>
                    )}

                    {/* Top Center Grip Handle & Quick Reorder */}
                    <div className="pt-2 px-4 flex items-center justify-between">
                      <div className="w-12" />
                      <GripHorizontal className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={qIdx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(q.id, -1);
                          }}
                          title={km ? 'រំកិលឡើងលើ' : 'Move up'}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={qIdx === activeForm.questions.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(q.id, 1);
                          }}
                          title={km ? 'រំកិលចុះក្រោម' : 'Move down'}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="px-5 sm:px-6 pb-5 pt-2">
                      {/* Question Title Row + STEM Formula Button + Image Button + Question Type Dropdown */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {hasExplicitMathSyntax(q.title) &&
                        editingMathFieldKey !== `q_title:${q.id}` ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              if (isFocused) {
                                e.stopPropagation();
                                setEditingMathFieldKey(`q_title:${q.id}`);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setFocusedCardId(q.id);
                                setEditingMathFieldKey(`q_title:${q.id}`);
                              }
                            }}
                            title={km ? 'ចុចដើម្បីកែប្រែ' : 'Click to edit'}
                            className={`flex-1 min-w-0 text-[15px] font-medium text-slate-900 dark:text-white transition-colors cursor-text overflow-x-auto ${
                              isFocused
                                ? 'bg-slate-50 dark:bg-slate-800/80 px-3.5 py-3 rounded-t-md border-b-2 border-slate-300 dark:border-slate-600 hover:border-[#673AB7]'
                                : 'bg-transparent py-1.5 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                            }`}
                          >
                            <MathText text={q.title} explicitOnly />
                          </div>
                        ) : (
                          <input
                            type="text"
                            autoFocus={editingMathFieldKey === `q_title:${q.id}`}
                            value={q.title}
                            maxLength={600}
                            onBlur={() =>
                              setEditingMathFieldKey((cur) =>
                                cur === `q_title:${q.id}` ? null : cur
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setEditingMathFieldKey(null);
                              }
                            }}
                            onChange={(e) =>
                              updateQuestion(q.id, { title: e.target.value })
                            }
                            placeholder={
                              q.type === 'section'
                                ? km
                                  ? 'ចំណងជើងផ្នែក'
                                  : 'Section title'
                                : km
                                  ? 'សំណួរ (អាចបញ្ចូលរូបមន្តគណិត រូប គីមី)'
                                  : 'Question (supports Math, Physics & Chemistry formulas)'
                            }
                            className={`flex-1 min-w-0 text-[15px] font-medium text-slate-900 dark:text-white focus:outline-none transition-colors ${
                              isFocused
                                ? 'bg-slate-50 dark:bg-slate-800/80 px-3.5 py-3 rounded-t-md border-b-2 border-slate-300 dark:border-slate-600 focus:border-[#673AB7]'
                                : 'bg-transparent py-1.5 border-b border-transparent'
                            }`}
                          />
                        )}

                        {isFocused && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormulaTarget({ kind: 'q_title', qId: q.id });
                              }}
                              title={
                                km
                                  ? 'សរសេររូបមន្ត គណិតវិទ្យា រូបវិទ្យា គីមីវិទ្យា (fx)'
                                  : 'Insert Math, Physics or Chemistry formula (fx)'
                              }
                              className="min-h-[42px] px-2.5 rounded-lg border border-purple-200 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/40 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                            >
                              <Sigma className="w-4 h-4" />
                              <span>MathType</span>
                            </button>

                            {q.type !== 'section' && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTriggerImageUpload(q.id);
                                  }}
                                  title={km ? 'ភ្ជាប់រូបភាពសំណួរ' : 'Add image to question'}
                                  className="min-h-[42px] min-w-[42px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <ImageIcon className="w-5 h-5" />
                                </button>

                                <div className="relative flex items-center">
                                  <span className="pointer-events-none absolute left-3 text-slate-500 dark:text-slate-400">
                                    <QuestionTypeIcon type={q.type} className="w-4 h-4" />
                                  </span>
                                  <select
                                    value={q.type}
                                    onChange={(e) =>
                                      handleChangeQuestionType(
                                        q,
                                        e.target.value as FormQuestionType
                                      )
                                    }
                                    aria-label={km ? 'ប្រភេទសំណួរ' : 'Question type'}
                                    className="h-[42px] pl-9 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer"
                                  >
                                    {questionTypes.map((qt) => (
                                      <option key={qt.id} value={qt.id}>
                                        {km ? qt.labelKm : qt.labelEn}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Live KaTeX Preview only while actively editing raw math syntax */}
                      {editingMathFieldKey === `q_title:${q.id}` &&
                        hasExplicitMathSyntax(q.title) && (
                          <div className="mt-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 px-3.5 py-2 text-[15px] text-slate-900 dark:text-white leading-relaxed overflow-x-auto">
                            <MathText text={q.title} explicitOnly />
                          </div>
                        )}

                      {q.type === 'section' && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            {q.description &&
                            hasExplicitMathSyntax(q.description) &&
                            editingMathFieldKey !== `q_desc:${q.id}` ? (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  if (isFocused) {
                                    e.stopPropagation();
                                    setEditingMathFieldKey(`q_desc:${q.id}`);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setFocusedCardId(q.id);
                                    setEditingMathFieldKey(`q_desc:${q.id}`);
                                  }
                                }}
                                title={km ? 'ចុចដើម្បីកែប្រែ' : 'Click to edit'}
                                className="flex-1 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 hover:border-[#673AB7] py-1 cursor-text overflow-x-auto"
                              >
                                <MathText text={q.description} explicitOnly />
                              </div>
                            ) : (
                              <input
                                type="text"
                                autoFocus={editingMathFieldKey === `q_desc:${q.id}`}
                                value={q.description || ''}
                                onBlur={() =>
                                  setEditingMathFieldKey((cur) =>
                                    cur === `q_desc:${q.id}` ? null : cur
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setEditingMathFieldKey(null);
                                  }
                                }}
                                onChange={(e) =>
                                  updateQuestion(q.id, { description: e.target.value })
                                }
                                placeholder={km ? 'ការពិពណ៌នាផ្នែក (ស្រេចចិត្ត)' : 'Description (optional)'}
                                className="flex-1 bg-transparent text-sm text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1"
                              />
                            )}
                            {isFocused && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormulaTarget({ kind: 'q_desc', qId: q.id });
                                }}
                                title={km ? 'បញ្ចូលរូបមន្តក្នុងការពិពណ៌នា' : 'Insert formula into description'}
                                className="px-2 py-1 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Sigma className="w-3.5 h-3.5" />
                                <span>fx</span>
                              </button>
                            )}
                          </div>
                          {editingMathFieldKey === `q_desc:${q.id}` &&
                            q.description &&
                            hasExplicitMathSyntax(q.description) && (
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 overflow-x-auto">
                                <MathText text={q.description} explicitOnly />
                              </div>
                            )}
                        </div>
                      )}

                      {/* Attached Image Preview */}
                      {q.imageUrl && (
                        <div className="mt-3 relative inline-block max-w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={q.imageUrl}
                            alt={q.title}
                            className="max-h-56 object-contain bg-slate-50 dark:bg-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuestion(q.id, { imageUrl: undefined })}
                            aria-label="Remove image"
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/75 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* CHOICE OPTIONS EDITOR (Multiple choice, Checkboxes, Dropdown) */}
                      {isChoiceType && (
                        <div className="mt-4 space-y-2.5">
                          {q.options.map((opt, optIdx) => {
                            const optFieldKey = `q_opt:${q.id}:${optIdx}`;
                            const optHasMath = hasExplicitMathSyntax(opt);
                            const isEditingOptMath = editingMathFieldKey === optFieldKey;
                            return (
                              <div key={`${q.id}_opt_${optIdx}`} className="space-y-1">
                                <div className="flex items-center gap-3 group">
                                  {q.type === 'multiple_choice' && (
                                    <Circle className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                                  )}
                                  {q.type === 'checkboxes' && (
                                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                                  )}
                                  {q.type === 'dropdown' && (
                                    <span className="w-5 text-xs font-mono tabular-nums text-slate-400 shrink-0">
                                      {optIdx + 1}.
                                    </span>
                                  )}

                                  {optHasMath && !isEditingOptMath ? (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        if (isFocused) {
                                          e.stopPropagation();
                                          setEditingMathFieldKey(optFieldKey);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setFocusedCardId(q.id);
                                          setEditingMathFieldKey(optFieldKey);
                                        }
                                      }}
                                      title={km ? 'ចុចដើម្បីកែប្រែ' : 'Click to edit'}
                                      className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-100 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 py-1.5 cursor-text overflow-x-auto"
                                    >
                                      <MathText text={opt} explicitOnly />
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      autoFocus={isEditingOptMath}
                                      value={opt}
                                      maxLength={320}
                                      onBlur={() =>
                                        setEditingMathFieldKey((cur) =>
                                          cur === optFieldKey ? null : cur
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          setEditingMathFieldKey(null);
                                        }
                                      }}
                                      onChange={(e) => {
                                        const nextOpts = [...q.options];
                                        nextOpts[optIdx] = e.target.value;
                                        updateQuestion(q.id, { options: nextOpts });
                                      }}
                                      placeholder={`${km ? 'ជម្រើសទី' : 'Option'} ${optIdx + 1}`}
                                      className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1.5"
                                    />
                                  )}

                                  {isFocused && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFormulaTarget({
                                          kind: 'q_option',
                                          qId: q.id,
                                          optIdx,
                                        });
                                      }}
                                      title={km ? 'បញ្ចូលរូបមន្តក្នុងជម្រើសនេះ (fx)' : 'Insert STEM formula in option'}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer shrink-0"
                                    >
                                      <Sigma className="w-4 h-4" />
                                    </button>
                                  )}

                                  {activeForm.settings.isQuiz &&
                                    q.type !== 'checkboxes' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuestion(q.id, {
                                            correctOption:
                                              q.correctOption === opt ? '' : opt,
                                          })
                                        }
                                        title={km ? 'កំណត់ជាចម្លើយត្រឹមត្រូវ' : 'Mark as correct answer'}
                                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                                          q.correctOption === opt
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        {q.correctOption === opt && (
                                          <span>{km ? 'ត្រូវ' : 'Key'}</span>
                                        )}
                                      </button>
                                    )}

                                  {isFocused && q.options.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextOpts = q.options.filter(
                                          (_, i) => i !== optIdx
                                        );
                                        updateQuestion(q.id, { options: nextOpts });
                                      }}
                                      aria-label="Remove option"
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                {isEditingOptMath && optHasMath && (
                                  <div className="ml-7 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 overflow-x-auto">
                                    <MathText text={opt} explicitOnly />
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {q.hasOther && (
                            <div className="flex items-center gap-3">
                              {q.type === 'multiple_choice' ? (
                                <Circle className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                              ) : (
                                <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                              )}
                              <span className="flex-1 text-sm text-slate-400 border-b border-dotted border-slate-300 dark:border-slate-700 py-1">
                                {km ? 'ផ្សេងៗ...' : 'Other...'}
                              </span>
                              {isFocused && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(q.id, { hasOther: false })
                                  }
                                  aria-label="Remove Other option"
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* "Add option or add 'Other'" row matching Google Forms screenshot */}
                          {isFocused && (
                            <div className="flex items-center gap-3 pt-1">
                              {q.type === 'multiple_choice' && (
                                <Circle className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                              )}
                              {q.type === 'checkboxes' && (
                                <Square className="w-4.5 h-4.5 text-slate-300 shrink-0" />
                              )}
                              {q.type === 'dropdown' && (
                                <span className="w-5 text-xs font-mono text-slate-300 shrink-0">
                                  {q.options.length + 1}.
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(q.id, {
                                      options: [
                                        ...q.options,
                                        `${km ? 'ជម្រើសទី' : 'Option'} ${q.options.length + 1}`,
                                      ],
                                    })
                                  }
                                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:underline cursor-pointer"
                                >
                                  {km ? 'បន្ថែមជម្រើស' : 'Add option'}
                                </button>
                                {q.type !== 'dropdown' && !q.hasOther && (
                                  <>
                                    <span className="text-slate-400">
                                      {km ? 'ឬ' : 'or'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuestion(q.id, { hasOther: true })
                                      }
                                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                    >
                                      {km ? 'បន្ថែម "ផ្សេងៗ"' : 'add "Other"'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SHORT ANSWER / PARAGRAPH PREVIEW */}
                      {q.type === 'short_answer' && (
                        <div className="mt-4 w-2/3 border-b border-dotted border-slate-300 dark:border-slate-700 pb-1.5 text-sm text-slate-400">
                          {km ? 'អត្ថបទចម្លើយខ្លី' : 'Short answer text'}
                        </div>
                      )}
                      {q.type === 'paragraph' && (
                        <div className="mt-4 w-5/6 border-b border-dotted border-slate-300 dark:border-slate-700 pb-1.5 text-sm text-slate-400">
                          {km ? 'អត្ថបទចម្លើយវែង' : 'Long answer text'}
                        </div>
                      )}

                      {/* LINEAR SCALE CONFIG */}
                      {q.type === 'linear_scale' && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <select
                              value={q.scaleMin ?? 1}
                              onChange={(e) =>
                                updateQuestion(q.id, { scaleMin: Number(e.target.value) })
                              }
                              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                            >
                              <option value={0}>0</option>
                              <option value={1}>1</option>
                            </select>
                            <span className="text-xs text-slate-500">
                              {km ? 'ដល់' : 'to'}
                            </span>
                            <select
                              value={q.scaleMax ?? 5}
                              onChange={(e) =>
                                updateQuestion(q.id, { scaleMax: Number(e.target.value) })
                              }
                              className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                            >
                              {[3, 4, 5, 7, 10].map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={q.scaleMinLabel || ''}
                              onChange={(e) =>
                                updateQuestion(q.id, { scaleMinLabel: e.target.value })
                              }
                              placeholder={km ? 'ស្លាកអប្បបរមា (ស្រេចចិត្ត)' : 'Min label (optional)'}
                              className="bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1 text-xs text-slate-700 dark:text-slate-200"
                            />
                            <input
                              type="text"
                              value={q.scaleMaxLabel || ''}
                              onChange={(e) =>
                                updateQuestion(q.id, { scaleMaxLabel: e.target.value })
                              }
                              placeholder={km ? 'ស្លាកអតិបរមា (ស្រេចចិត្ត)' : 'Max label (optional)'}
                              className="bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-[#673AB7] focus:outline-none py-1 text-xs text-slate-700 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      )}

                      {/* DATE / TIME PREVIEW */}
                      {q.type === 'date' && (
                        <div className="mt-4 inline-flex items-center gap-2 border-b border-dotted border-slate-300 dark:border-slate-700 pb-1 text-sm text-slate-400">
                          <span>{km ? 'ថ្ងៃ / ខែ / ឆ្នាំ' : 'Month, day, year'}</span>
                          <Calendar className="w-4 h-4" />
                        </div>
                      )}
                      {q.type === 'time' && (
                        <div className="mt-4 inline-flex items-center gap-2 border-b border-dotted border-slate-300 dark:border-slate-700 pb-1 text-sm text-slate-400">
                          <span>{km ? 'ម៉ោង' : 'Time'}</span>
                          <Clock className="w-4 h-4" />
                        </div>
                      )}

                      {/* CARD FOOTER: Quiz Points, Duplicate, Delete, Required Switch */}
                      {isFocused && (
                        <div className="mt-5 pt-3.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            {activeForm.settings.isQuiz && q.type !== 'section' && (
                              <div className="flex items-center gap-2 text-xs">
                                <Award className="w-4 h-4 text-indigo-500" />
                                <span className="text-slate-600 dark:text-slate-300">
                                  {km ? 'ពិន្ទុ៖' : 'Points:'}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={q.points ?? 1}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      points: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-14 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs tabular-nums text-slate-900 dark:text-white"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateQuestion(q);
                              }}
                              title={km ? 'ចម្លងសំណួរ (Duplicate)' : 'Duplicate'}
                              className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Copy className="w-4.5 h-4.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteQuestion(q.id);
                              }}
                              title={km ? 'លុបសំណួរ (Delete)' : 'Delete'}
                              className="min-h-[36px] min-w-[36px] rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>

                            {q.type !== 'section' && (
                              <>
                                <span
                                  className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1.5"
                                  aria-hidden="true"
                                />
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                                  <span>{km ? 'ចាំបាច់ (Required)' : 'Required'}</span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={q.required}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateQuestion(q.id, { required: !q.required });
                                    }}
                                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                      q.required
                                        ? ''
                                        : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                    style={
                                      q.required
                                        ? { backgroundColor: theme.primary }
                                        : undefined
                                    }
                                  >
                                    <span
                                      className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                                        q.required ? 'translate-x-4.5' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Mobile / Narrow Inline Quick Add Bar (Non-overlapping) */}
              <div className="lg:hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-2 flex flex-wrap items-center justify-around gap-1">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('multiple_choice')}
                  className="min-h-[40px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <PlusCircle className="w-4.5 h-4.5" style={{ color: theme.primary }} />
                  <span>{km ? 'បន្ថែមសំណួរ' : 'Add Question'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const focusedQ = activeForm.questions.find(
                      (item) => item.id === focusedCardId
                    );
                    if (focusedQ) {
                      setFormulaTarget({ kind: 'q_title', qId: focusedQ.id });
                    } else {
                      const q = createDefaultQuestion('short_answer', lang);
                      mutateActiveForm((prev) => ({
                        ...prev,
                        questions: [...prev.questions, q],
                      }));
                      setFocusedCardId(q.id);
                      setFormulaTarget({ kind: 'q_title', qId: q.id });
                    }
                  }}
                  title={km ? 'សរសេររូបមន្ត គណិត•រូប•គីមី' : 'Math • Physics • Chem Formula'}
                  className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer"
                >
                  <Sigma className="w-4 h-4" />
                  <span>MathType</span>
                </button>
                <button
                  type="button"
                  onClick={handleImportWheelAsOptions}
                  title={km ? 'នាំចូលពីកងវិល' : 'Import from Wheel'}
                  className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileInput className="w-4 h-4" />
                  <span>{km ? 'ពីកងវិល' : 'Wheel'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('section')}
                  title={km ? 'បន្ថែមផ្នែក' : 'Add Section'}
                  className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Rows2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('short_answer')}
                  title={km ? 'ចម្លើយខ្លី' : 'Short Answer'}
                  className="min-h-[40px] px-2.5 rounded-xl flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Type className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FLOATING RIGHT VERTICAL ACTION DOCK (Desktop — Matching Screenshot) */}
            <aside className="hidden lg:flex flex-col gap-2 sticky top-5 shrink-0">
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md p-1.5 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('multiple_choice')}
                  title={km ? 'បន្ថែមសំណួរថ្មី (Add question)' : 'Add question'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <PlusCircle className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleImportWheelAsOptions}
                  title={
                    km
                      ? 'នាំចូលបញ្ជីពីកងវិលបច្ចុប្បន្នជាសំណួរ'
                      : 'Import entries from active Picker Wheel'
                  }
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileInput className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('short_answer')}
                  title={km ? 'បន្ថែមសំណួរចម្លើយខ្លី (Add text)' : 'Add short answer'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Type className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = createDefaultQuestion('multiple_choice', lang);
                    mutateActiveForm((prev) => ({
                      ...prev,
                      questions: [...prev.questions, q],
                    }));
                    setFocusedCardId(q.id);
                    window.setTimeout(() => handleTriggerImageUpload(q.id), 60);
                  }}
                  title={km ? 'បន្ថែមសំណួរមានរូបភាព (Add image)' : 'Add image question'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const focusedQ = activeForm.questions.find(
                      (item) => item.id === focusedCardId
                    );
                    if (focusedQ) {
                      setFormulaTarget({ kind: 'q_title', qId: focusedQ.id });
                    } else {
                      const q = createDefaultQuestion('short_answer', lang);
                      mutateActiveForm((prev) => ({
                        ...prev,
                        questions: [...prev.questions, q],
                      }));
                      setFocusedCardId(q.id);
                      setFormulaTarget({ kind: 'q_title', qId: q.id });
                    }
                  }}
                  title={
                    km
                      ? 'បើកកម្មវិធីសរសេររូបមន្ត គណិតវិទ្យា រូបវិទ្យា គីមីវិទ្យា (fx)'
                      : 'Math, Physics & Chemistry Formula Studio (fx)'
                  }
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer"
                >
                  <Sigma className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAddQuestion('section')}
                  title={km ? 'បន្ថែមផ្នែកថ្មី (Add section)' : 'Add section'}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Rows2 className="w-5 h-5" />
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* TAB 2: RESPONSES ANALYTICS */}
        {activeTab === 'responses' && (
          <FormResponsesView
            form={activeForm}
            responses={allResponses}
            language={lang}
            pendingSyncCount={activeFormPendingCount}
            unsyncedLocalCount={unsyncedLocalCount}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSyncNow={() => void syncActiveFormQueue(true)}
            onPushLocalToCloud={() => {
              enqueueUnsyncedLocalResponses(activeForm, localResponses);
              setLocalResponses(loadLocalFormResponses(activeForm.id));
              if (isOnline) {
                void flushPendingSyncQueue({ formId: activeForm.id });
              }
            }}
            onOpenSyncQueue={() => setSyncQueueOpen(true)}
            onToggleAccepting={(accepting) =>
              mutateActiveForm((prev) => ({
                ...prev,
                settings: { ...prev.settings, acceptingResponses: accepting },
              }))
            }
            onDeleteResponse={async (resp) => {
              if (resp.source === 'cloud') {
                await deleteCloudFormResponse(activeForm.id, resp.id).catch(() => {});
              } else {
                deleteLocalFormResponse(resp.id);
                removePendingItem(resp.id);
                setLocalResponses((prev) => prev.filter((r) => r.id !== resp.id));
              }
            }}
            onClearLocalResponses={() => {
              clearLocalFormResponses(activeForm.id);
              clearActiveFormQueue();
              setLocalResponses([]);
            }}
          />
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-[760px] mx-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
            <div className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {km ? 'ការកំណត់ទម្រង់ (Form Settings)' : 'Form Settings'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {km
                  ? 'កំណត់ការប្រើ Offline, ប្រើ Email ឬ អត់ប្រើ Email, មុខងារ Quiz និងសារបញ្ជាក់។'
                  : 'Configure offline mode, email collection, quiz auto-grading, and confirmation messages.'}
              </p>
            </div>

            {/* EMAIL MODE SETTING (Use Email / Without Email) */}
            <div className="p-5 sm:px-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Mail className="w-4 h-4" style={{ color: theme.primary }} />
                    <span>
                      {km
                        ? 'ការប្រមូលអ៊ីមែល (ប្រើ Email / អត់ប្រើ Email)'
                        : 'Email Collection (With or Without Email)'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {km
                      ? 'ជ្រើសរើសថាតើអ្នកឆ្លើយត្រូវបញ្ចូលអ៊ីមែល ឬអាចឆ្លើយដោយមិនបាច់មានអ៊ីមែល (ដំណើរការទាំង Offline និង Online)។'
                      : 'Choose whether respondents submit without email, with optional email, or with a required email (works offline & online).'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'none' as FormEmailMode,
                      titleKm: 'អត់ប្រើ Email',
                      titleEn: 'No Email',
                      descKm: 'ឆ្លើយបានភ្លាមៗ មិនសួរអ៊ីមែល',
                      descEn: 'Do not ask for email',
                    },
                    {
                      id: 'optional' as FormEmailMode,
                      titleKm: 'ប្រើ Email (ស្រេចចិត្ត)',
                      titleEn: 'Optional Email',
                      descKm: 'មានប្រអប់ Email អាចបំពេញ ឬរំលង',
                      descEn: 'Respondents may leave blank',
                    },
                    {
                      id: 'required' as FormEmailMode,
                      titleKm: 'ប្រើ Email (ចាំបាច់)',
                      titleEn: 'Require Email',
                      descKm: 'ត្រូវបំពេញ Email ត្រឹមត្រូវទើបផ្ញើបាន',
                      descEn: 'Valid email required to submit',
                    },
                  ] as const
                ).map((mode) => {
                  const selected = (activeForm.settings.emailMode || 'none') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        mutateActiveForm((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, emailMode: mode.id },
                        }))
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-transparent text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                      style={selected ? { backgroundColor: theme.primary } : undefined}
                    >
                      <p className="text-xs font-bold">{km ? mode.titleKm : mode.titleEn}</p>
                      <p
                        className={`mt-0.5 text-[11px] ${
                          selected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {km ? mode.descKm : mode.descEn}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {[
              {
                key: 'isQuiz' as const,
                titleKm: 'បើកមុខងារតេស្តគិតពិន្ទុស្វ័យប្រវត្តិ (Make this a quiz)',
                titleEn: 'Make this a quiz',
                descKm: 'កំណត់ចម្លើយត្រឹមត្រូវ និងពិន្ទុលើសំណួរនីមួយៗ ដើម្បីគណនាពិន្ទុភ្លាមៗ។',
                descEn: 'Assign point values and answer keys for automatic grading.',
              },
              {
                key: 'acceptingResponses' as const,
                titleKm: 'បើកទទួលចម្លើយ (Accepting responses)',
                titleEn: 'Accepting responses',
                descKm: 'អនុញ្ញាតឱ្យអ្នកចូលរួមបំពេញ និងផ្ញើចម្លើយតាម Offline ឬ Link/QR។',
                descEn: 'Allow respondents to submit new answers offline or via link.',
              },
              {
                key: 'collectRespondentName' as const,
                titleKm: 'សួរឈ្មោះអ្នកឆ្លើយ (Collect respondent name)',
                titleEn: 'Collect respondent name',
                descKm: 'បង្ហាញប្រអប់បញ្ចូលឈ្មោះនៅផ្នែកខាងលើនៃទម្រង់សម្រាប់សិស្ស ឬសមាជិក។',
                descEn: 'Show a required name field at the top of the form.',
              },
              {
                key: 'allowMultipleResponses' as const,
                titleKm: 'អនុញ្ញាតឱ្យឆ្លើយម្តងទៀត (Allow multiple responses)',
                titleEn: 'Allow multiple responses',
                descKm: 'បង្ហាញប៊ូតុងផ្ញើចម្លើយសម្រាប់អ្នកបន្ទាប់ ក្រោយពេលបញ្ជូនចម្លើយរួច។',
                descEn: 'Show a button to submit another response after finishing.',
              },
              {
                key: 'shuffleQuestions' as const,
                titleKm: 'ច្របល់លំដាប់សំណួរ (Shuffle question order)',
                titleEn: 'Shuffle question order',
                descKm: 'ប្តូរលំដាប់សំណួរដោយស្វ័យប្រវត្តិនៅពេលបង្ហាញដល់អ្នកឆ្លើយ។',
                descEn: 'Randomize question display order for respondents.',
              },
            ].map((row) => {
              const checked = Boolean(activeForm.settings[row.key]);
              return (
                <div
                  key={row.key}
                  className="p-5 sm:px-6 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {km ? row.titleKm : row.titleEn}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {km ? row.descKm : row.descEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() =>
                      mutateActiveForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, [row.key]: !checked },
                      }))
                    }
                    className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                      checked ? '' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={checked ? { backgroundColor: theme.primary } : undefined}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}

            <div className="p-5 sm:px-6 space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                {km ? 'សារបញ្ជាក់ក្រោយផ្ញើចម្លើយ (Confirmation message)' : 'Confirmation message'}
              </label>
              <input
                type="text"
                maxLength={400}
                value={activeForm.settings.confirmationMessage}
                onChange={(e) =>
                  mutateActiveForm(
                    (prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        confirmationMessage: e.target.value,
                      },
                    }),
                    false
                  )
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            {/* EXCEL & WORD EXPORT / IMPORT */}
            <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {km
                      ? 'ទាញចេញ & នាំចូលទិន្នន័យជា Excel (.xlsx) និង Word (.docx)'
                      : 'Export & Import Form Data (Excel .xlsx & Word .docx)'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {km
                    ? 'ទាញយកសំណួរ ស្ថិតិសង្ខេប និងចម្លើយទាំងអស់ទៅជា Excel ឬ Word ដើម្បីកែសម្រួល និងបោះពុម្ព (ដំណើរការ ១០០% Offline)។'
                    : 'Export all questions, summary analytics, and responses into native Excel or Word files — or import questions from Excel/Word offline.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={officeBusy !== null}
                  onClick={handleExportExcel}
                  className="min-h-[38px] px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{km ? 'ទាញជា Excel' : 'Export Excel'}</span>
                </button>
                <button
                  type="button"
                  disabled={officeBusy !== null}
                  onClick={handleExportWord}
                  className="min-h-[38px] px-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{km ? 'ទាញជា Word' : 'Export Word'}</span>
                </button>
                <button
                  type="button"
                  disabled={officeBusy !== null}
                  onClick={() => officeImportRef.current?.click()}
                  className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{km ? 'នាំចូល Excel/Word' : 'Import Office'}</span>
                </button>
              </div>
            </div>

            {/* OFFLINE PORTABLE BACKUP & IMPORT */}
            <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <WifiOff className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{km ? 'រក្សាទុក & នាំចូលឯកសារ Offline (.json)' : 'Offline File Backup & Import (.json)'}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {km
                    ? 'រក្សាទុកទម្រង់ និងចម្លើយទាំងអស់ជាឯកសារ .json ដើម្បីបើកប្រើលើកុំព្យូទ័រ ឬទូរស័ព្ទផ្សេងដោយគ្មានអ៊ីនធឺណិត។'
                    : 'Export or import your form & offline responses as a portable .json file without internet.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportOfflineJson}
                  className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{km ? 'ទាញយក .json' : 'Export .json'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => jsonImportRef.current?.click()}
                  className="min-h-[38px] px-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-xs font-semibold text-purple-700 dark:text-purple-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{km ? 'នាំចូល .json' : 'Import .json'}</span>
                </button>
              </div>
            </div>

            {/* PENDING SYNC QUEUE (OFFLINE -> CLOUD AUTO-SYNC) */}
            <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {km
                      ? 'បញ្ជីរង់ចាំបញ្ជូនទៅ Cloud (Pending Sync Queue)'
                      : 'Pending Sync Queue (Auto-Push on Reconnect)'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {km
                    ? `ចម្លើយ Offline ដែលបានរក្សាទុកក្នុងឧបករណ៍នឹងបញ្ជូនឡើង Cloud ដោយស្វ័យប្រវត្តិពេលភ្ជាប់អ៊ីនធឺណិតវិញ (${allPendingSyncItems.length} កំពុងរង់ចាំ)។`
                    : `Locally cached offline submissions automatically upload to the cloud once internet reconnects (${allPendingSyncItems.length} queued).`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSyncQueueOpen(true)}
                  className="min-h-[38px] px-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>
                    {km
                      ? `បើកបញ្ជី Pending Sync (${allPendingSyncItems.length})`
                      : `Manage Queue (${allPendingSyncItems.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SAVED FORMS & TEMPLATES DRAWER MODAL */}
      {libraryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLibraryOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[88dvh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {km ? 'ទម្រង់របស់ខ្ញុំ & គំរូស្រាប់ (Forms & Templates)' : 'My Forms & Templates'}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={officeBusy !== null}
                  onClick={() => officeImportRef.current?.click()}
                  className="min-h-[34px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{km ? 'នាំចូល Excel / Word' : 'Import Excel / Word'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => jsonImportRef.current?.click()}
                  className="min-h-[34px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{km ? 'នាំចូល .json' : 'Import .json'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryOpen(false)}
                  className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Start a New Form Templates */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {km ? 'បង្កើតទម្រង់ថ្មីពីគំរូ' : 'Start a new form'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FORM_TEMPLATES.map((preset) => {
                    const spec = FORM_THEMES[preset.themeId];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleCreateFromTemplate(preset.id)}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 bg-slate-50/70 dark:bg-slate-800/50 text-left flex items-start gap-3 transition-colors cursor-pointer"
                      >
                        <span
                          className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: spec.primary }}
                        >
                          <Plus className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {km ? preset.nameKm : preset.nameEn}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {km ? preset.descKm : preset.descEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Saved Forms List */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {km ? `ទម្រង់ដែលបានរក្សាទុក (${forms.length})` : `Recent forms (${forms.length})`}
                </p>
                <div className="space-y-2">
                  {forms.map((f) => {
                    const spec = FORM_THEMES[f.themeId] || FORM_THEMES.purple;
                    const isCurrent = f.id === activeForm.id;
                    return (
                      <div
                        key={f.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'border-purple-400 bg-purple-50/60 dark:bg-purple-950/30'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFormId(f.id);
                            setFocusedCardId(f.questions[0]?.id || 'header');
                            setUndoStack([]);
                            setRedoStack([]);
                            setLibraryOpen(false);
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <span
                            className="w-9 h-9 rounded-lg text-white flex items-center justify-center shrink-0"
                            style={{ backgroundColor: spec.primary }}
                          >
                            <FileText className="w-4.5 h-4.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {f.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {f.questions.length} {km ? 'សំណួរ' : 'questions'}
                              {f.syncedToCloud ? ' · Cloud Published' : ' · Offline'}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDuplicateForm(f)}
                            title={km ? 'ចម្លងទម្រង់' : 'Duplicate form'}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteForm(f.id)}
                            title={km ? 'លុបទម្រង់' : 'Delete form'}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH & OFFLINE / ONLINE SHARE LINK + QR MODAL */}
      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShareModalOpen(false);
          }}
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="h-2.5 w-full" style={{ backgroundColor: theme.primary }} />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" style={{ color: theme.primary }} />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {km ? 'ប្រើ Offline & ចែករំលែក (Link / QR)' : 'Offline Mode & Share (Link / QR)'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Offline vs Online Mode Switch */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setShareMode('offline')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    shareMode === 'offline'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <WifiOff className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{km ? 'ប្រើ Offline' : 'Offline Mode'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode('online')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    shareMode === 'online'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                  <span>{km ? 'Online (Cloud)' : 'Online Cloud'}</span>
                </button>
              </div>

              {/* Quick Email Mode Status & Switch */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                  <Mail className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                  <span>
                    {(activeForm.settings.emailMode || 'none') === 'none'
                      ? km
                        ? 'អត់ប្រើ Email'
                        : 'Without Email'
                      : activeForm.settings.emailMode === 'optional'
                        ? km
                          ? 'ប្រើ Email (ស្រេចចិត្ត)'
                          : 'Optional Email'
                        : km
                          ? 'ប្រើ Email (ចាំបាច់)'
                          : 'Require Email'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    mutateActiveForm((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        emailMode:
                          (prev.settings.emailMode || 'none') === 'none'
                            ? 'required'
                            : prev.settings.emailMode === 'required'
                              ? 'optional'
                              : 'none',
                      },
                    }))
                  }
                  className="text-[11px] font-semibold underline cursor-pointer"
                  style={{ color: theme.primary }}
                >
                  {km ? 'ប្តូររបៀប Email' : 'Switch Email Mode'}
                </button>
              </div>

              {shareMode === 'offline' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShareModalOpen(false);
                      setOfflineFillOpen(true);
                    }}
                    className="w-full min-h-[44px] px-4 rounded-xl text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:opacity-95 cursor-pointer"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {km
                        ? 'បើកបំពេញផ្ទាល់លើឧបករណ៍នេះ (Offline Kiosk)'
                        : 'Start Offline Fill on This Device (Kiosk)'}
                    </span>
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {km
                      ? 'ដំណើរការ ១០០% ដោយគ្មានអ៊ីនធឺណិត និងមិនបាច់ចូលគណនី — រាល់ចម្លើយនឹងរក្សាទុកក្នុងផ្ទាំង ចម្លើយ (Responses) ហើយអាចទាញយកជា CSV ឬ .json បានភ្លាមៗ។'
                      : 'Works 100% offline with zero sign-in — every response saves directly into the Responses tab for charts & CSV export.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExportOfflineJson}
                      className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>{km ? 'ទាញយក .json' : 'Export .json'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonImportRef.current?.click()}
                      className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{km ? 'នាំចូល .json' : 'Import .json'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {publishNotice && (
                    <p className="text-xs rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-3.5 py-2.5 text-purple-800 dark:text-purple-200 leading-relaxed">
                      {publishNotice}
                    </p>
                  )}

                  {!activeForm.syncedToCloud && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                      <span>
                        {km
                          ? 'ចុច Publish ក្រោយចូលគណនី ដើម្បីឱ្យឧបករណ៍ផ្សេងស្គែន QR ផ្ញើចម្លើយមក Cloud។'
                          : 'Sign in & click Publish so other phones can scan & submit live.'}
                      </span>
                      {!user && !passcodeSession && (
                        <button
                          type="button"
                          onClick={() => {
                            setShareModalOpen(false);
                            openAuthModal();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold whitespace-nowrap cursor-pointer"
                        >
                          {km ? 'ចូលគណនី' : 'Sign In'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {qrDataUrl && (
                <div className="flex flex-col items-center gap-2 py-1">
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="Form QR Code"
                      className="w-44 h-44"
                    />
                  </div>
                  <a
                    href={qrDataUrl}
                    download={`${(activeForm.title || 'form').replace(/[^\w]+/g, '_')}_qr.png`}
                    className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                    style={{ color: theme.primary }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{km ? 'ទាញយករូប QR (PNG)' : 'Download QR PNG'}</span>
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeShareUrl}
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="min-h-[40px] px-3.5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  style={{ backgroundColor: theme.primary }}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{km ? 'បាន Copy!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href={activeShareUrl || `/form/${activeForm.id}`}
                  className="text-xs font-semibold inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{km ? 'បើកទំព័រឆ្លើយផ្ទាល់' : 'Open respondent page'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="min-h-[36px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {km ? 'បិទ' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BUILT-IN MATH • PHYSICS • CHEMISTRY FORMULA STUDIO MODAL */}
      <StemFormulaEditorModal
        open={formulaTarget !== null}
        language={lang}
        accentColor={theme.primary}
        targetLabel={
          !formulaTarget
            ? undefined
            : formulaTarget.kind === 'form_title'
              ? km
                ? 'ចំណងជើងទម្រង់'
                : 'Form Title'
              : formulaTarget.kind === 'form_desc'
                ? km
                  ? 'ការពិពណ៌នាទម្រង់'
                  : 'Form Description'
                : formulaTarget.kind === 'q_option'
                  ? km
                    ? `ជម្រើសទី ${formulaTarget.optIdx + 1}`
                    : `Option ${formulaTarget.optIdx + 1}`
                  : formulaTarget.kind === 'q_desc'
                    ? km
                      ? 'ការពិពណ៌នាផ្នែក'
                      : 'Section Description'
                    : km
                      ? 'អត្ថបទសំណួរ'
                      : 'Question Text'
        }
        onClose={() => setFormulaTarget(null)}
        onInsert={(formattedFormula) => {
          if (!formulaTarget) return;
          setEditingMathFieldKey(null);
          const appendFormula = (prev: string) =>
            prev.trim() ? `${prev} ${formattedFormula}` : formattedFormula;

          if (formulaTarget.kind === 'form_title') {
            mutateActiveForm((prev) => ({
              ...prev,
              title: appendFormula(prev.title),
            }));
            return;
          }
          if (formulaTarget.kind === 'form_desc') {
            mutateActiveForm((prev) => ({
              ...prev,
              description: appendFormula(prev.description),
            }));
            return;
          }
          if (formulaTarget.kind === 'q_title') {
            mutateActiveForm((prev) => ({
              ...prev,
              questions: prev.questions.map((item) =>
                item.id === formulaTarget.qId
                  ? { ...item, title: appendFormula(item.title) }
                  : item
              ),
            }));
            return;
          }
          if (formulaTarget.kind === 'q_desc') {
            mutateActiveForm((prev) => ({
              ...prev,
              questions: prev.questions.map((item) =>
                item.id === formulaTarget.qId
                  ? { ...item, description: appendFormula(item.description || '') }
                  : item
              ),
            }));
            return;
          }
          if (formulaTarget.kind === 'q_option') {
            mutateActiveForm((prev) => ({
              ...prev,
              questions: prev.questions.map((item) => {
                if (item.id !== formulaTarget.qId) return item;
                const nextOpts = [...item.options];
                const existing = nextOpts[formulaTarget.optIdx] || '';
                const isDefaultPlaceholder =
                  /^(ជម្រើសទី|Option)\s+\d+$/i.test(existing.trim());
                nextOpts[formulaTarget.optIdx] = isDefaultPlaceholder
                  ? formattedFormula
                  : appendFormula(existing);
                return { ...item, options: nextOpts };
              }),
            }));
          }
        }}
      />

      {/* PENDING SYNC QUEUE MODAL */}
      <PendingSyncQueueModal
        open={syncQueueOpen}
        language={lang}
        accentColor={theme.primary}
        items={allPendingSyncItems}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onClose={() => setSyncQueueOpen(false)}
        onSyncNow={() => flushPendingSyncQueue({ includeFailed: true })}
        onRetryItem={retryPendingItem}
        onRemoveItem={removePendingItem}
        onClearAll={() => clearPendingSyncQueue()}
      />
    </div>
  );
}
