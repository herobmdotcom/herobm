'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';

interface Macro {
  macroId: string;
  name: string;
  macroType: string;
  content: string;
}

interface Contact {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  isPrimary?: boolean;
}

interface EmailDocumentDialogProps {
  isOpen: boolean;
  orderId: string;
  orderNumber: string;
  customerReference?: string | null;
  customerId?: string;
  hookSlug: string;
  title: string;
  defaultSubjectPrefix: string;
  documentName: string;
  onPreview: (pdfText: string) => void;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmailDocumentDialog({ isOpen, orderId, orderNumber, customerReference, customerId, hookSlug, title, defaultSubjectPrefix, documentName, onPreview, onClose, onSuccess }: EmailDocumentDialogProps) {
  const t = useTranslations('salesOrders');
  const tCommon = useTranslations('common');

  const [macros, setMacros] = useState<Macro[]>([]);
  const [pdfMacros, setPdfMacros] = useState<Macro[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Form state
  const [selectedMacroId, setSelectedMacroId] = useState<string>('');
  const [selectedPdfMacroId, setSelectedPdfMacroId] = useState<string>('');
  const [customPdfText, setCustomPdfText] = useState('');
  const [supportsCustomText, setSupportsCustomText] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [customerEmail1, setCustomerEmail1] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedMacroId('');
      setSelectedPdfMacroId('');
      setBodyText('');
      setCustomPdfText('');
      setSupportsCustomText(false);
      
      const subjectSuffix = customerReference ? ` - ${customerReference}` : '';
      setSubject(`${defaultSubjectPrefix}: ${orderNumber}${subjectSuffix}`);
      setIsOtherSelected(false);
      
      // Load initial data
      Promise.all([
        loadTemplateConfig(),
        loadMacros(),
        loadCustomer(),
      ]).catch(err => {
        setError(getErrorMessage(err) || 'Failed to load dialog data');
      });
    }
  }, [isOpen, customerId]);

  const loadTemplateConfig = async () => {
    try {
      const assignmentsRes = await api.pdfTemplatesControllerGetAssignments();
      const assignment = assignmentsRes.data.find(a => a.hookSlug === hookSlug);
      if (assignment?.reportId) {
        const reportRes = await api.pdfTemplatesControllerGetReport(assignment.reportId);
        const report = reportRes.data;
        if (report?.template?.includes('customPdfText')) {
          setSupportsCustomText(true);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  const loadMacros = async () => {
    const [hookRes, generalRes] = await Promise.all([
      api.macrosControllerFindAll({ macroType: hookSlug }),
      api.macrosControllerFindAll({ macroType: 'general' }),
    ]);
    const hookMacros = hookRes.data.filter((m: Macro) => m.macroType === hookSlug) as Macro[];
    const generalMacros = generalRes.data.filter((m: Macro) => m.macroType === 'general') as Macro[];
    const combinedMacros = [...hookMacros, ...generalMacros];
    setMacros(combinedMacros);
    setPdfMacros(combinedMacros);
  };

  const loadCustomer = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await api.accountsControllerFindOne(customerId);
      const customer = res.data as { emailAddress1?: string; contacts?: Contact[] };
      
      const trimmedCustomerEmail = (customer.emailAddress1 || '').trim();
      setCustomerEmail1(trimmedCustomerEmail);
      
      const custContacts = (customer.contacts || []).map(c => ({
        ...c,
        email: c.email ? c.email.trim() : c.email
      })) as Contact[];
      setContacts(custContacts);
      
      // Determine default TO address
      const primaryContact = custContacts.find(c => c.isPrimary);
      const firstContact = custContacts[0];
      
      if (primaryContact && primaryContact.email) {
        setToAddress(primaryContact.email);
      } else if (firstContact && firstContact.email) {
        setToAddress(firstContact.email);
      } else if (trimmedCustomerEmail) {
        setToAddress(trimmedCustomerEmail);
      }
    } catch (err: unknown) {
      reportError(err);
      // Non-fatal, just leave TO blank
    } finally {
      setLoading(false);
    }
  };

  const handleMacroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const macro = macros.find(m => m.macroId === id);
    if (macro) {
      setBodyText(prev => prev ? `${prev}\n\n${macro.content}` : macro.content);
    }
    setSelectedMacroId('');
  };

  const handlePdfMacroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const macro = pdfMacros.find(m => m.macroId === id);
    if (macro) {
      setCustomPdfText(prev => prev ? `${prev}\n\n${macro.content}` : macro.content);
    }
    setSelectedPdfMacroId('');
  };

  const handleSend = async () => {
    const trimmedAddress = toAddress.trim();
    if (!trimmedAddress) {
      setError('Please provide a recipient email address.');
      return;
    }
    if (!subject) {
      setError('Please provide a subject.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await api.ordersControllerEmailDocument(orderId, {
        emailAddress: trimmedAddress,
        subject,
        body: bodyText,
        hookSlug,
        customPdfText,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to queue email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={sending}
          >
            {tCommon('cancel')}
          </button>
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={handleSend}
            disabled={sending}
          >
            {sending && (
              <>
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              </>
            )}
            Send Email
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 py-2">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* To Address */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              To
            </label>
            {loading ? (
              <div className="text-sm text-gray-500">{tCommon('loading')}</div>
            ) : (
              <>
                <select
                  className="input w-full"
                  value={isOtherSelected ? 'OTHER' : toAddress}
                  onChange={(e) => {
                    if (e.target.value === 'OTHER') {
                      setIsOtherSelected(true);
                      setToAddress('');
                    } else {
                      setIsOtherSelected(false);
                      setToAddress(e.target.value);
                    }
                  }}
                >
                  <option value="">{tCommon('select')}...</option>
                  {contacts.map((c, i) => c.email && (
                    <option key={i} value={c.email}>
                      {c.firstName || c.lastName ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : tCommon('contact')} ({c.email})
                    </option>
                  ))}
                  {customerEmail1 && !contacts.some(c => c.email === customerEmail1) && (
                    <option value={customerEmail1}>Company Email ({customerEmail1})</option>
                  )}
                  <option value="OTHER">Other...</option>
                </select>
                {isOtherSelected && (
                  <input
                    type="email"
                    className="input w-full mt-2"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder="Enter email address"
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Subject
            </label>
            <input 
              type="text" 
              className="input w-full" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              placeholder="Quote for Order"
            />
          </div>

          {/* Email Body */}
          <div className="flex flex-col gap-3">
            <label className="block text-sm font-medium mb-1 text-gray-700">Email Content</label>
            <select
              className="input w-full"
              value={selectedMacroId}
              onChange={handleMacroChange}
            >
              <option value="">{t('placeholders.selectMacro')}</option>
              {macros.map(m => (
                <option key={m.macroId} value={m.macroId}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea
              className="input w-full font-sans text-sm"
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Enter message for the customer..."
            />
          </div>

          {/* Document PDF Content */}
          <div className="flex flex-col gap-3">
            <label className="block text-sm font-medium mb-1 text-gray-700">{documentName} PDF Attachment</label>
            
            {supportsCustomText && (
              <>
                <select
                  className="input w-full"
                  value={selectedPdfMacroId}
                  onChange={handlePdfMacroChange}
                >
                  <option value="">{t('placeholders.selectMacro')}</option>
                  {pdfMacros.map(m => (
                    <option key={m.macroId} value={m.macroId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <textarea
                  className="input w-full font-sans text-sm"
                  rows={6}
                  value={customPdfText}
                  onChange={(e) => setCustomPdfText(e.target.value)}
                  placeholder={`Enter text to display on the ${documentName} PDF...`}
                />
              </>
            )}

            {/* Attachment Preview */}
            <div className="flex items-center gap-2 mt-1">
              <span className="material-symbols-outlined text-gray-500 text-[18px]">attach_file</span>
              <button
                type="button"
                onClick={() => onPreview(customPdfText)}
                className="text-sm text-[var(--accent)] hover:underline text-left"
              >
                {/* eslint-disable-next-line i18next/no-literal-string -- technical filename */}
                {documentName}-{orderNumber}.pdf
              </button>
            </div>
          </div>
        </div>
    </SlideOver>
  );
}
