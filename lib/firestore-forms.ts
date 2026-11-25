import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  handleFirestoreError,
  OperationType,
  sanitizeId,
  type AssignmentOwnerType,
} from './firestore-service';
import { getShareOrigin } from './share-origin';
import type {
  CustomForm,
  FormEmailMode,
  FormQuestion,
  FormQuestionType,
  FormResponseRecord,
  FormThemeId,
} from './forms-model';
import { generateResponseId } from './forms-model';

const VALID_EMAIL_MODES = new Set<FormEmailMode>(['none', 'optional', 'required']);

const VALID_THEMES = new Set<FormThemeId>([
  'purple',
  'indigo',
  'blue',
  'teal',
  'emerald',
  'rose',
  'amber',
]);

const VALID_Q_TYPES = new Set<FormQuestionType>([
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'short_answer',
  'paragraph',
  'linear_scale',
  'date',
  'time',
  'section',
]);

function toMillis(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'number') return val;
  return Date.now();
}

export function buildPublicFormUrl(formId: string, originOverride?: string): string {
  const safeId = sanitizeId(formId);
  const origin = originOverride !== undefined ? originOverride : getShareOrigin();
  return origin ? `${origin}/form/${safeId}` : `/form/${safeId}`;
}

function sanitizeQuestionsForCloud(questions: FormQuestion[]): Record<string, unknown>[] {
  return questions.slice(0, 50).map((q) => ({
    id: sanitizeId(q.id || `q_${Math.random().toString(36).slice(2, 8)}`),
    type: VALID_Q_TYPES.has(q.type) ? q.type : 'multiple_choice',
    title: (q.title || '').trim().slice(0, 240) || 'Question',
    description: (q.description || '').trim().slice(0, 500),
    required: Boolean(q.required),
    options: Array.isArray(q.options)
      ? q.options.map((o) => String(o).trim().slice(0, 140)).slice(0, 30)
      : [],
    hasOther: Boolean(q.hasOther),
    scaleMin: Number(q.scaleMin ?? 1),
    scaleMax: Number(q.scaleMax ?? 5),
    scaleMinLabel: (q.scaleMinLabel || '').trim().slice(0, 60),
    scaleMaxLabel: (q.scaleMaxLabel || '').trim().slice(0, 60),
    correctOption: (q.correctOption || '').trim().slice(0, 140),
    points: Math.max(0, Math.min(100, Number(q.points ?? 0))),
  }));
}

function parseCloudFormDoc(docId: string, data: Record<string, unknown>): CustomForm {
  const rawTheme = String(data.themeId || 'purple') as FormThemeId;
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const questions: FormQuestion[] = rawQuestions.slice(0, 50).map((item, idx) => {
    const q = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const rawType = String(q.type || 'multiple_choice') as FormQuestionType;
    return {
      id: String(q.id || `q_${idx}`),
      type: VALID_Q_TYPES.has(rawType) ? rawType : 'multiple_choice',
      title: String(q.title || 'Question').slice(0, 240),
      description: String(q.description || '').slice(0, 500),
      required: Boolean(q.required),
      options: Array.isArray(q.options)
        ? q.options.map((o) => String(o).slice(0, 140)).slice(0, 30)
        : [],
      hasOther: Boolean(q.hasOther),
      scaleMin: Number(q.scaleMin ?? 1),
      scaleMax: Number(q.scaleMax ?? 5),
      scaleMinLabel: String(q.scaleMinLabel || '').slice(0, 60),
      scaleMaxLabel: String(q.scaleMaxLabel || '').slice(0, 60),
      correctOption: String(q.correctOption || '').slice(0, 140),
      points: Number(q.points ?? 0),
    };
  });

  return {
    id: String(data.id || docId),
    title: String(data.title || 'Untitled Form').slice(0, 140),
    description: String(data.description || '').slice(0, 2000),
    themeId: VALID_THEMES.has(rawTheme) ? rawTheme : 'purple',
    starred: false,
    published: data.published !== false,
    questions,
    settings: {
      acceptingResponses: data.acceptingResponses !== false,
      isQuiz: Boolean(data.isQuiz),
      collectRespondentName: data.collectRespondentName !== false,
      emailMode: VALID_EMAIL_MODES.has(String(data.emailMode || 'none') as FormEmailMode)
        ? (String(data.emailMode) as FormEmailMode)
        : 'none',
      allowMultipleResponses: data.allowMultipleResponses !== false,
      shuffleQuestions: Boolean(data.shuffleQuestions),
      confirmationMessage: String(
        data.confirmationMessage || 'Your response has been recorded.'
      ).slice(0, 400),
    },
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
    ownerId: String(data.ownerId || ''),
    ownerType: data.ownerType === 'passcode' ? 'passcode' : 'google',
    ownerDisplayName: String(data.ownerDisplayName || 'Teacher').slice(0, 80),
    syncedToCloud: true,
  };
}

function parseCloudResponseDoc(
  docId: string,
  data: Record<string, unknown>
): FormResponseRecord {
  const answers: Record<string, string | string[]> = {};
  if (Array.isArray(data.answers)) {
    for (const item of data.answers) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const qid = String(entry.questionId || '');
      if (!qid) continue;
      if (Array.isArray(entry.values)) {
        answers[qid] = entry.values.map((v) => String(v));
      } else {
        answers[qid] = String(entry.answerText || '');
      }
    }
  }
  return {
    id: String(data.id || docId),
    formId: String(data.formId || ''),
    respondentName: String(data.respondentName || 'Anonymous').slice(0, 80),
    respondentEmail: String(data.respondentEmail || '').slice(0, 120),
    answers,
    score: Number(data.score ?? 0),
    maxScore: Number(data.maxScore ?? 0),
    submittedAtMs: toMillis(data.submittedAt),
    source: 'cloud',
  };
}

export async function publishFormToCloud(params: {
  form: CustomForm;
  ownerId: string;
  ownerType: AssignmentOwnerType;
  ownerDisplayName: string;
}): Promise<CustomForm> {
  const safeId = sanitizeId(params.form.id);
  const safeOwnerId = sanitizeId(params.ownerId);
  const safeOwnerName = params.ownerDisplayName.trim().slice(0, 80) || 'Teacher';
  const safeTitle = params.form.title.trim().slice(0, 140) || 'Untitled Form';
  const safeDesc = params.form.description.trim().slice(0, 2000);
  const safeTheme: FormThemeId = VALID_THEMES.has(params.form.themeId)
    ? params.form.themeId
    : 'purple';
  const safeQuestions = sanitizeQuestionsForCloud(params.form.questions);
  const path = `forms/${safeId}`;
  const docRef = doc(db, 'forms', safeId);

  try {
    const safeEmailMode: FormEmailMode = VALID_EMAIL_MODES.has(params.form.settings.emailMode)
      ? params.form.settings.emailMode
      : 'none';
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        title: safeTitle,
        description: safeDesc,
        themeId: safeTheme,
        questions: safeQuestions,
        acceptingResponses: Boolean(params.form.settings.acceptingResponses),
        isQuiz: Boolean(params.form.settings.isQuiz),
        collectRespondentName: Boolean(params.form.settings.collectRespondentName),
        emailMode: safeEmailMode,
        allowMultipleResponses: Boolean(params.form.settings.allowMultipleResponses),
        shuffleQuestions: Boolean(params.form.settings.shuffleQuestions),
        confirmationMessage: params.form.settings.confirmationMessage.trim().slice(0, 400),
        published: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id: safeId,
        ownerId: safeOwnerId,
        ownerType: params.ownerType,
        ownerDisplayName: safeOwnerName,
        title: safeTitle,
        description: safeDesc,
        themeId: safeTheme,
        questions: safeQuestions,
        acceptingResponses: Boolean(params.form.settings.acceptingResponses),
        isQuiz: Boolean(params.form.settings.isQuiz),
        collectRespondentName: Boolean(params.form.settings.collectRespondentName),
        emailMode: safeEmailMode,
        allowMultipleResponses: Boolean(params.form.settings.allowMultipleResponses),
        shuffleQuestions: Boolean(params.form.settings.shuffleQuestions),
        confirmationMessage: params.form.settings.confirmationMessage.trim().slice(0, 400),
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return {
      ...params.form,
      published: true,
      ownerId: safeOwnerId,
      ownerType: params.ownerType,
      ownerDisplayName: safeOwnerName,
      syncedToCloud: true,
      updatedAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getCloudForm(formId: string): Promise<CustomForm | null> {
  const safeId = sanitizeId(formId);
  if (!/^frm_[a-zA-Z0-9_\-]+$/.test(safeId) || safeId.length < 16) {
    return null;
  }
  const path = `forms/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'forms', safeId));
    if (!snap.exists()) return null;
    return parseCloudFormDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitCloudFormResponse(params: {
  responseId?: string;
  formId: string;
  ownerId: string;
  respondentName: string;
  respondentEmail?: string;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
}): Promise<FormResponseRecord> {
  const safeFormId = sanitizeId(params.formId);
  const safeOwnerId = sanitizeId(params.ownerId);
  const rawResponseId = params.responseId ? sanitizeId(params.responseId) : '';
  const responseId = rawResponseId && rawResponseId.length <= 128 ? rawResponseId : generateResponseId();
  const safeName = params.respondentName.trim().slice(0, 80);
  const safeEmail = (params.respondentEmail || '').trim().slice(0, 120);

  const answersList = Object.entries(params.answers)
    .slice(0, 50)
    .map(([questionId, val]) => {
      if (Array.isArray(val)) {
        const cleanVals = val.map((v) => String(v).trim().slice(0, 200)).slice(0, 30);
        return {
          questionId: sanitizeId(questionId),
          answerText: cleanVals.join(', ').slice(0, 1000),
          values: cleanVals,
        };
      }
      return {
        questionId: sanitizeId(questionId),
        answerText: String(val ?? '').trim().slice(0, 2000),
      };
    });

  const path = `forms/${safeFormId}/responses/${responseId}`;
  try {
    await setDoc(doc(db, 'forms', safeFormId, 'responses', responseId), {
      id: responseId,
      formId: safeFormId,
      ownerId: safeOwnerId,
      respondentName: safeName,
      respondentEmail: safeEmail,
      answers: answersList,
      score: Math.max(0, Math.min(10000, Number(params.score || 0))),
      maxScore: Math.max(0, Math.min(10000, Number(params.maxScore || 0))),
      submittedAt: serverTimestamp(),
    });
    return {
      id: responseId,
      formId: safeFormId,
      respondentName: safeName,
      respondentEmail: safeEmail,
      answers: params.answers,
      score: params.score,
      maxScore: params.maxScore,
      submittedAtMs: Date.now(),
      source: 'cloud',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeCloudFormResponses(
  formId: string,
  options: { isAdmin: boolean; ownerUid?: string },
  onData: (responses: FormResponseRecord[]) => void
): Unsubscribe {
  const safeId = sanitizeId(formId);
  const path = `forms/${safeId}/responses`;
  const subCol = collection(db, 'forms', safeId, 'responses');
  const q = options.isAdmin
    ? query(subCol, orderBy('submittedAt', 'desc'))
    : query(subCol, where('ownerId', '==', sanitizeId(options.ownerUid || '')));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => parseCloudResponseDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.submittedAtMs - a.submittedAtMs);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function deleteCloudFormResponse(
  formId: string,
  responseId: string
): Promise<void> {
  const safeFormId = sanitizeId(formId);
  const safeRespId = sanitizeId(responseId);
  const path = `forms/${safeFormId}/responses/${safeRespId}`;
  try {
    await deleteDoc(doc(db, 'forms', safeFormId, 'responses', safeRespId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAllCloudForms(
  onData: (forms: CustomForm[]) => void
): Unsubscribe {
  const path = 'forms';
  const q = query(collection(db, 'forms'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        parseCloudFormDoc(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateCloudFormAdminStatus(
  formId: string,
  patch: { published?: boolean; acceptingResponses?: boolean }
): Promise<void> {
  const safeId = sanitizeId(formId);
  const path = `forms/${safeId}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.published !== undefined) {
    updatePayload.published = Boolean(patch.published);
  }
  if (patch.acceptingResponses !== undefined) {
    updatePayload.acceptingResponses = Boolean(patch.acceptingResponses);
  }
  try {
    await updateDoc(doc(db, 'forms', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudForm(formId: string): Promise<void> {
  const safeId = sanitizeId(formId);
  const path = `forms/${safeId}`;
  try {
    await deleteDoc(doc(db, 'forms', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

