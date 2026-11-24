'use client';

import React, { use } from 'react';
import { PublicFormView } from '@/components/forms/PublicFormView';

export default function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = use(params);
  return <PublicFormView formId={formId} />;
}
