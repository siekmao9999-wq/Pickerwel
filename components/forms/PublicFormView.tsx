'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { usePickerwel } from '@/components/PickerwelProvider';
import {
  decodeOfflineFormPayload,
  FORM_THEMES,
  loadLocalForms,
  type CustomForm,
} from '@/lib/forms-model';
import { getCloudForm } from '@/lib/firestore-forms';
import {
  cacheCloudFormSnapshot,
  getCachedCloudForm,
  submitFormResponseResilient,
} from '@/lib/form-sync-queue';
import { useFormPendingSync } from '@/hooks/useFormPendingSync';
import { FormFiller } from './FormFiller';
import { PendingSyncQueueModal } from './PendingSyncQueueModal';

export function PublicFormView({ formId }: { formId: string }) {
  const { settings } = usePickerwel();
  const lang = settings.language;
  const km = lang === 'km';

  const [form, setForm] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);

  const {
    items: formPendingItems,
    totalCount: formPendingCount,
    isOnline,
    isSyncing,
    syncNow,
    retryItem,
    removeItem,
    clearQueue,
  } = useFormPendingSync({ formId });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      // 1. Check offline hash payload first if explicitly opened via Offline QR/Link
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#offline=')) {
        const encoded = window.location.hash.slice('#offline='.length);
        const decoded = decodeOfflineFormPayload(encoded);
        if (active && decoded) {
          if (decoded.syncedToCloud && decoded.ownerId) {
            cacheCloudFormSnapshot(decoded);
          }
          setForm(decoded);
          setLoading(false);
          return;
        }
      }

      // 2. Try Cloud Firestore if online (with cache update on success)
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const cloud = await getCloudForm(formId);
          if (active && cloud) {
            cacheCloudFormSnapshot(cloud);
            setForm(cloud);
            setLoading(false);
            return;
          }
        } catch {
          // Fallback to cached cloud snapshot or local forms below
        }
      }

      if (!active) return;

      // 3. Fallback to cached Cloud Form snapshot for offline reloads
      const cachedCloud = getCachedCloudForm(formId);
      if (cachedCloud) {
        setForm(cachedCloud);
        setLoading(false);
        return;
      }

      // 4. Fallback to local Offline forms on this device
      const localMatch = loadLocalForms().find((f) => f.id === formId) || null;
      setForm(localMatch);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [formId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[660px] space-y-4">
          <div className="h-32 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
          <div className="h-44 rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {km ? 'រកមិនឃើញទម្រង់នេះទេ' : 'Form Not Found'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {km
              ? 'សូមពិនិត្យមើលលីង ឬស្គែន QR-Code ពីអ្នកបង្កើតទម្រង់ម្តងទៀត។'
              : 'Please double-check the link or ask the creator to Publish the form first.'}
          </p>
          <Link
            href="/forms"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-xl bg-[#673AB7] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{km ? 'ត្រឡប់ទៅ Forms' : 'Back to Forms'}</span>
          </Link>
        </div>
      </div>
    );
  }

  const theme = FORM_THEMES[form.themeId] || FORM_THEMES.purple;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <FormFiller
        form={form}
        language={lang}
        isOnline={isOnline}
        pendingSyncCount={formPendingCount}
        isSyncing={isSyncing}
        submitting={submitting}
        onSyncNow={() => void syncNow(true)}
        onOpenSyncQueue={() => setQueueModalOpen(true)}
        onSubmitResponse={async (payload) => {
          setSubmitting(true);
          try {
            const outcome = await submitFormResponseResilient({
              form,
              respondentName: payload.respondentName,
              respondentEmail: payload.respondentEmail,
              answers: payload.answers,
              score: payload.score,
              maxScore: payload.maxScore,
            });
            return { syncMode: outcome.mode };
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <PendingSyncQueueModal
        open={queueModalOpen}
        language={lang}
        accentColor={theme.primary}
        items={formPendingItems}
        isOnline={isOnline}
        isSyncing={isSyncing}
        scopedTitle={form.title}
        onClose={() => setQueueModalOpen(false)}
        onSyncNow={() => syncNow(true)}
        onRetryItem={retryItem}
        onRemoveItem={removeItem}
        onClearAll={clearQueue}
      />
    </div>
  );
}
