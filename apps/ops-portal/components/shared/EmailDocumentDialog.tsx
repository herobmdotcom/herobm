'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from './Button';

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
  primaryFor?: string[];
}

export interface EmailDocumentDialogProps {
  isOpen: boolean;
  mode?: 'email' | 'print';
  orderId?: string;
  orderNumber?: string;
  customerReference?: string | null;
  customerId?: string;
  supplierId?: string;
  hookSlug: string;
  title?: string;
  defaultSubjectPrefix?: string;
  documentName?: string;
  targetId: string;
  contextSlug: string;
  onPreview: (customText?: string) => void | Promise<void>;
  onClose: () => void;
  onSuccess?: () => void;
  onPrint?: (customText?: string) => void | Promise<void>;
  onSend?: (params: {
    emailAddress: string;
    subject: string;
    body: string;
    hookSlug: string;
    customPdfText?: string;
    targetId: string;
    contextSlug: string;
  }) => Promise<void>;
}

const KNOWN_CUSTOM_TEXT_HOOKS = [
  'purchase-order',
  'sales-order-quote',
  'sales-order-confirmation',
  'pro-forma-invoice',
  'sales-invoice',
  'sales-return-credit',
  'purchase-return',
  'purchase-debit-note',
  'customer-statement',
  'customer-payment-receipt',
  'customer-overdue-notice',
  'supplier-remittance-advice',
  'shipping-docket',
  'shipping-label',
  'picking-slip',
];

export default function EmailDocumentDialog({
  isOpen,
  mode = 'email',
  orderId,
  orderNumber = '',
  customerReference,
  customerId,
  supplierId,
  hookSlug,
  title,
  defaultSubjectPrefix = '',
  documentName = 'Document',
  targetId,
  contextSlug,
  onPreview,
  onClose,
  onSuccess,
  onPrint,
  onSend,
}: EmailDocumentDialogProps) {
  const t = useTranslations('salesOrders');
  const tCommon = useTranslations('common');

  const isKnownCustomText = KNOWN_CUSTOM_TEXT_HOOKS.includes(hookSlug);
  const isPrintMode = mode === 'print';

  const [macros, setMacros] = useState<Macro[]>([]);
  const [pdfMacros, setPdfMacros] = useState<Macro[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [supportsCustomText, setSupportsCustomText] = useState<boolean>(isKnownCustomText || true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Form state
  const [selectedMacroId, setSelectedMacroId] = useState<string>('');
  const [selectedPdfMacroId, setSelectedPdfMacroId] = useState<string>('');
  const [customPdfText, setCustomPdfText] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [entityEmail, setEntityEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedMacroId('');
      setSelectedPdfMacroId('');
      setBodyText('');
      setCustomPdfText('');
      setSupportsCustomText(isKnownCustomText || true);

      const subjectSuffix = customerReference ? ` - ${customerReference}` : '';
      setSubject(
        defaultSubjectPrefix
          ? `${defaultSubjectPrefix}: ${orderNumber}${subjectSuffix}`
          : `${documentName}: ${orderNumber}${subjectSuffix}`,
      );
      setIsOtherSelected(false);

      // Load initial data
      const loaders: Promise<unknown>[] = [loadTemplateConfig(), loadMacros()];
      if (!isPrintMode && (customerId || supplierId)) {
        loaders.push(loadRecipient());
      }
      Promise.all(loaders).catch((err) => {
        toast.error(getErrorMessage(err) || 'Failed to load dialog data');
      });
    }
  }, [isOpen, customerId, supplierId, hookSlug, isPrintMode]);

  const loadTemplateConfig = async () => {
    try {
      const assignmentsRes = await api.pdfTemplatesControllerGetAssignments();
      const assignment = assignmentsRes.data.find(a => a.hookSlug === hookSlug);
      if (assignment?.reportId) {
        const reportRes = await api.pdfTemplatesControllerGetReport(assignment.reportId);
        const report = reportRes.data;
        if (report?.template) {
          const hasCustomText =
            report.template.includes('customPdfText') ||
            report.template.includes('quoteIntroText');
          setSupportsCustomText(hasCustomText);
        }
      }
    } catch (err) {
      // Keep default
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

  const loadRecipient = async () => {
    if (supplierId) {
      setLoading(true);
      try {
        const res = await api.suppliersControllerFindOne(supplierId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        const supplier = res.data as any;
        const trimmedEmail = (supplier?.emailAddress1 || '').trim();
        setEntityEmail(trimmedEmail);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        const supContacts = (supplier?.contacts || []).map((c: any) => ({
          ...c,
          email: c.email ? c.email.trim() : c.email
        })) as Contact[];
        setContacts(supContacts);

        // Determine default TO address:
        // - purchase-debit-note / supplier-remittance-advice: primary contact for billing, then sales
        // - purchase-return / purchase-order: primary contact for sales, then billing
        const billingContact = supContacts.find(c => c.primaryFor?.some(p => p.toLowerCase() === 'billing'));
        const salesContact = supContacts.find(c => c.primaryFor?.some(p => p.toLowerCase() === 'sales'));
        const primaryContact = (hookSlug === 'purchase-debit-note' || hookSlug === 'supplier-remittance-advice')
          ? (billingContact || salesContact)
          : (salesContact || billingContact);
        const firstContact = supContacts.find(c => !!c.email);

        if (primaryContact && primaryContact.email) {
          setToAddress(primaryContact.email);
        } else if (firstContact && firstContact.email) {
          setToAddress(firstContact.email);
        } else if (trimmedEmail) {
          setToAddress(trimmedEmail);
        }
      } catch (err: unknown) {
        toast.error('Failed to load supplier contacts: ' + getErrorMessage(err));
        reportError(err, 'EmailDocumentDialog.fetchSupplierContacts');
      } finally {
        setLoading(false);
      }
    } else if (customerId) {
      setLoading(true);
      try {
        const res = await api.customersControllerFindOne(customerId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        const customer = res.data as any;
        
        const trimmedCustomerEmail = (customer?.emailAddress1 || '').trim();
        setEntityEmail(trimmedCustomerEmail);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        const custContacts = (customer?.contacts || []).map((c: any) => ({
          ...c,
          email: c.email ? c.email.trim() : c.email
        })) as Contact[];
        setContacts(custContacts);
        
        // Determine default TO address:
        // - customer-statement: primary billing contact, then purchasing, then delivery
        // - shipping-docket: primary delivery contact, then purchasing, then billing
        // - others: primary purchasing contact, then billing, then delivery
        const billingContact = custContacts.find(c => c.primaryFor?.some(p => p.toLowerCase() === 'billing'));
        const deliveryContact = custContacts.find(c => c.primaryFor?.some(p => p.toLowerCase() === 'delivery'));
        const purchasingContact = custContacts.find(c => c.primaryFor?.some(p => p.toLowerCase() === 'purchasing'));
        
        const primaryContact = (
          hookSlug === 'customer-statement' ||
          hookSlug === 'customer-payment-receipt' ||
          hookSlug === 'customer-overdue-notice'
        )
          ? (billingContact || purchasingContact || deliveryContact)
          : hookSlug === 'shipping-docket' && deliveryContact
            ? deliveryContact
            : (purchasingContact || billingContact || deliveryContact);
        const firstContact = custContacts.find(c => !!c.email);
        
        if (primaryContact && primaryContact.email) {
          setToAddress(primaryContact.email);
        } else if (firstContact && firstContact.email) {
          setToAddress(firstContact.email);
        } else if (trimmedCustomerEmail) {
          setToAddress(trimmedCustomerEmail);
        }
      } catch (err: unknown) {
        toast.error('Failed to load customer contacts: ' + getErrorMessage(err));
        reportError(err, 'EmailDocumentDialog.fetchCustomerContacts');
        // Non-fatal, just leave TO blank
      } finally {
        setLoading(false);
      }
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

  const handlePrint = async () => {
    setPrinting(true);
    try {
      if (onPrint) {
        await onPrint(customPdfText);
      } else {
        await onPreview(customPdfText);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to generate PDF');
    } finally {
      setPrinting(false);
    }
  };

  const handleSend = async () => {
    const trimmedAddress = toAddress.trim();

    setSending(true);
    try {
      if (onSend) {
        await onSend({
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (
        contextSlug === 'customer-statement' ||
        hookSlug === 'customer-statement' ||
        contextSlug === 'customer-overdue-notice' ||
        hookSlug === 'customer-overdue-notice'
      ) {
        await api.customersControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (
        contextSlug === 'supplier-remittance-advice' ||
        hookSlug === 'supplier-remittance-advice' ||
        contextSlug === 'customer-payment-receipt' ||
        hookSlug === 'customer-payment-receipt'
      ) {
        await api.paymentsControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (contextSlug === 'purchase-debit-note' || hookSlug === 'purchase-debit-note') {
        await api.purchaseDebitNotesControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (contextSlug === 'purchase-return' || hookSlug === 'purchase-return') {
        await api.globalPurchaseReturnsControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (contextSlug === 'shipment' || hookSlug === 'shipping-docket') {
        await api.globalShipmentsControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else if (supplierId) {
        await api.purchaseOrdersControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      } else {
        await api.ordersControllerEmailDocument(orderId || targetId, {
          emailAddress: trimmedAddress,
          subject,
          body: bodyText,
          hookSlug,
          customPdfText,
          targetId,
          contextSlug,
        });
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to queue email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const resolvedTitle =
    title ||
    (isPrintMode
      ? `${tCommon('buttons.print')} ${documentName}`
      : `Email ${documentName}`);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={sending || printing}
          >
            {tCommon('cancel')}
          </Button>
          {isPrintMode ? (
            <Button
              type="submit"
              form="document-action-form"
              className="flex items-center gap-2"
              variant="primary"
              loading={printing}
            >
              {tCommon('buttons.printPdf')}
            </Button>
          ) : (
            <Button
              type="submit"
              form="document-action-form"
              className="flex items-center gap-2"
              variant="primary"
              loading={sending}
            >
              Send Email
            </Button>
          )}
        </div>
      }
    >
      <form
        id="document-action-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isPrintMode) {
            handlePrint();
          } else {
            handleSend();
          }
        }}
        className="flex flex-col gap-6 py-2"
      >
        {!isPrintMode && (
          <>
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
                        {c.firstName || c.lastName
                          ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
                          : tCommon('contact')} ({c.email})
                      </option>
                    ))}
                    {entityEmail && !contacts.some((c) => c.email === entityEmail) && (
                      <option value={entityEmail}>Company Email ({entityEmail})</option>
                    )}
                    <option value="OTHER">Other...</option>
                  </select>
                  {isOtherSelected && (
                    <input
                      type="email"
                      className="input w-full mt-2"
                      placeholder="Enter email address"
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      required
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
                required
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
                {macros.map((m) => (
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
                placeholder={
                  supplierId
                    ? 'Enter message for the supplier...'
                    : 'Enter message for the customer...'
                }
              />
            </div>
          </>
        )}

        {/* Document PDF Content */}
        <div className="flex flex-col gap-3">
          <label className="block text-sm font-medium mb-1 text-gray-700">
            {isPrintMode ? `${documentName} PDF Content` : `${documentName} PDF Attachment`}
          </label>

          {supportsCustomText && (
            <>
              <select
                className="input w-full"
                value={selectedPdfMacroId}
                onChange={handlePdfMacroChange}
              >
                <option value="">{t('placeholders.selectMacro')}</option>
                {pdfMacros.map((m) => (
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
            <Button
              type="button"
              onClick={() => onPreview(customPdfText)}
              className="text-sm text-[var(--accent)] hover:underline text-left"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- technical filename */}
              {documentName}{orderNumber ? `-${orderNumber}` : ''}.pdf
            </Button>
          </div>
        </div>
      </form>
    </SlideOver>
  );
}

export { EmailDocumentDialog as DocumentActionDialog };
