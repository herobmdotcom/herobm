'use client';

import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import Link from 'next/link';

export default function WebhooksApiPage() {
  const t = useTranslations('admin.developers.webhooksApi');
  useDocumentTitle(t('title'));
  const router = useRouter();

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('header.title')}
          subtitle={t('header.subtitle')}
          onBack={() => router.push('/admin/developers')}
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6 pb-12">
        <div className="card">
          <h3 className="section-heading mb-2">{t('configuration.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {t.rich('configuration.description', {
              a: (chunks) => <Link href="/admin/developers" className="text-[var(--accent)] hover:underline font-medium">{chunks}</Link>,
              i: (chunks) => <i>{chunks}</i>
            })}
          </p>
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('envelopeFormat.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-2">{t('envelopeFormat.description')}</p>
          <pre className="bg-[#f7f9fb] p-4 rounded-md border border-[var(--border)] text-xs font-mono overflow-x-auto text-[var(--brand-navy)] mt-2">
{`{
  "eventId": "uuid-v4",
  "eventType": "sales_order.created",
  "entityId": "uuid-of-the-order",
  "entityType": "sales_order",
  "timestamp": "2026-05-27T10:00:00Z",
  "payload": {
    "orderNumber": "SO-0001",
    "customerId": "uuid...",
    "lineCount": 3
  }
}`}
          </pre>
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('eventTypes.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {t.rich('eventTypes.description', {
              code: (chunks) => <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded text-[var(--brand-navy)]">{chunks}</code>
            })}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-[var(--border)] rounded-md p-4 bg-[#f7f9fb]">
              <h4 className="font-medium text-sm text-[var(--brand-navy)] mb-2">{t('eventTypes.lifecycle.title')}</h4>
              <p className="text-xs text-[var(--text-muted)] mb-3">{t('eventTypes.lifecycle.description')}</p>
              {/* eslint-disable i18next/no-literal-string */}
              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">created</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">updated</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">deleted</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">archived</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">unarchived</span>
              </div>
              {/* eslint-enable i18next/no-literal-string */}
            </div>

            <div className="border border-[var(--border)] rounded-md p-4 bg-[#f7f9fb]">
              <h4 className="font-medium text-sm text-[var(--brand-navy)] mb-2">{t('eventTypes.stateMachine.title')}</h4>
              <p className="text-xs text-[var(--text-muted)] mb-3">{t('eventTypes.stateMachine.description')}</p>
              {/* eslint-disable i18next/no-literal-string */}
              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">status_changed</span>
              </div>
              {/* eslint-enable i18next/no-literal-string */}
            </div>
            
            <div className="border border-[var(--border)] rounded-md p-4 bg-[#f7f9fb]">
              <h4 className="font-medium text-sm text-[var(--brand-navy)] mb-2">{t('eventTypes.business.title')}</h4>
              <p className="text-xs text-[var(--text-muted)] mb-3">{t('eventTypes.business.description')}</p>
              {/* eslint-disable i18next/no-literal-string */}
              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">processed</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">dispatched</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">submitted</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">allocated</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">cancelled</span>
                <span className="bg-white border border-[var(--border)] px-2 py-1 rounded text-xs font-mono text-[var(--text-secondary)] shadow-sm">posted</span>
              </div>
              {/* eslint-enable i18next/no-literal-string */}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('entityTypes.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {t.rich('entityTypes.description', {
              code: (chunks) => <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded text-[var(--brand-navy)]">{chunks}</code>
            })}
          </p>
          {/* eslint-disable i18next/no-literal-string */}
          <ul className="list-disc list-inside space-y-3 text-sm text-[var(--text-secondary)] ml-2">
            <li><strong className="text-[var(--text-primary)]">{t('entityTypes.sales')}</strong>: <code className="font-mono text-xs">sales_order</code>, <code className="font-mono text-xs">sales_invoice</code>, <code className="font-mono text-xs">sales_return</code></li>
            <li><strong className="text-[var(--text-primary)]">{t('entityTypes.procurement')}</strong>: <code className="font-mono text-xs">purchase_order</code>, <code className="font-mono text-xs">purchase_invoice</code>, <code className="font-mono text-xs">purchase_return</code></li>
            <li><strong className="text-[var(--text-primary)]">{t('entityTypes.masterData')}</strong>: <code className="font-mono text-xs">product</code>, <code className="font-mono text-xs">customer</code>, <code className="font-mono text-xs">supplier</code></li>
            <li><strong className="text-[var(--text-primary)]">{t('entityTypes.warehouse')}</strong>: <code className="font-mono text-xs">warehouse</code> (covers receipts, shipments, picking, and putaway), <code className="font-mono text-xs">transfer_order</code></li>
            <li><strong className="text-[var(--text-primary)]">Inventory Ledger</strong>: <code className="font-mono text-xs">inventory_ledger</code> (via <code className="font-mono text-xs">system</code> entity)</li>
            <li><strong className="text-[var(--text-primary)]">{t('entityTypes.financials')}</strong>: <code className="font-mono text-xs">payment</code>, <code className="font-mono text-xs">general_ledger</code> (via <code className="font-mono text-xs">system</code> entity)</li>
          </ul>
          {/* eslint-enable i18next/no-literal-string */}
        </div>

        <div className="card">
          <h3 className="section-heading mb-4">{t('matrix.title')}</h3>
          <div className="overflow-x-auto border border-[var(--border)] rounded-md">
            {/* eslint-disable i18next/no-literal-string */}
            <table className="table-lines">
              <thead className="bg-[#f7f9fb]">
                <tr>
                  <th className="w-1/3 border-b border-[var(--border)]">{t('matrix.entityType')}</th>
                  <th className="border-b border-[var(--border)]">{t('matrix.supportedEvents')}</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">sales_order</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, archived, unarchived, deleted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">sales_invoice</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, deleted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">sales_return</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, processed</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">purchase_order</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, archived, unarchived, deleted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">purchase_invoice</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, deleted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">purchase_return</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, processed</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">warehouse</td><td className="text-[var(--text-secondary)] font-mono text-xs">receipt_created, receipt_status_changed, shipment_created, shipment_status_changed, shipment_dispatched, pick_created, pick_cancelled, putaway_completed, stock_moved</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">transfer_order</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, status_changed, deleted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">inventory_ledger</td><td className="text-[var(--text-secondary)] font-mono text-xs">entry_posted</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">product</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, updated, deleted, archived, unarchived</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">customer</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, updated, archived, unarchived</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">supplier</td><td className="text-[var(--text-secondary)] font-mono text-xs">created, updated, archived, unarchived</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">payment</td><td className="text-[var(--text-secondary)] font-mono text-xs">submitted, allocated, cancelled</td></tr>
                <tr><td className="font-mono font-medium text-xs text-[var(--brand-navy)]">general_ledger</td><td className="text-[var(--text-secondary)] font-mono text-xs">entry_posted</td></tr>
              </tbody>
            </table>
            {/* eslint-enable i18next/no-literal-string */}
          </div>
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('stateChangeReference.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {t.rich('stateChangeReference.description', {
              code: (chunks) => <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded text-[var(--brand-navy)]">{chunks}</code>
            })}
          </p>
          {/* eslint-disable i18next/no-literal-string */}
          <ul className="list-disc list-inside space-y-3 text-sm text-[var(--text-secondary)] ml-2">
            <li><strong className="text-[var(--text-primary)]">Sales Order (<code className="font-mono text-xs">sales_order</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">quoted</code>, <code className="font-mono text-xs">confirmed</code>, <code className="font-mono text-xs">picking</code>, <code className="font-mono text-xs">shipped</code>, <code className="font-mono text-xs">invoiced</code>, <code className="font-mono text-xs">cancelled</code>, <code className="font-mono text-xs">archived</code>, <code className="font-mono text-xs">legacy</code></li>
            <li><strong className="text-[var(--text-primary)]">Sales Invoice (<code className="font-mono text-xs">sales_invoice</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">invoiced</code>, <code className="font-mono text-xs">partially_paid</code>, <code className="font-mono text-xs">paid</code>, <code className="font-mono text-xs">cancelled</code>, <code className="font-mono text-xs">archived</code>, <code className="font-mono text-xs">legacy</code></li>
            <li><strong className="text-[var(--text-primary)]">Sales Return (<code className="font-mono text-xs">sales_return</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">confirmed</code>, <code className="font-mono text-xs">partially_received</code>, <code className="font-mono text-xs">received</code>, <code className="font-mono text-xs">processed</code>, <code className="font-mono text-xs">cancelled</code></li>
            <li><strong className="text-[var(--text-primary)]">Purchase Order (<code className="font-mono text-xs">purchase_order</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">ordered</code>, <code className="font-mono text-xs">partially_received</code>, <code className="font-mono text-xs">received</code>, <code className="font-mono text-xs">invoiced</code>, <code className="font-mono text-xs">closed_short</code>, <code className="font-mono text-xs">cancelled</code>, <code className="font-mono text-xs">archived</code>, <code className="font-mono text-xs">legacy</code></li>
            <li><strong className="text-[var(--text-primary)]">Purchase Invoice (<code className="font-mono text-xs">purchase_invoice</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">invoiced</code>, <code className="font-mono text-xs">partially_paid</code>, <code className="font-mono text-xs">paid</code>, <code className="font-mono text-xs">cancelled</code>, <code className="font-mono text-xs">archived</code>, <code className="font-mono text-xs">legacy</code></li>
            <li><strong className="text-[var(--text-primary)]">Purchase Return (<code className="font-mono text-xs">purchase_return</code>)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">staged</code>, <code className="font-mono text-xs">shipped</code>, <code className="font-mono text-xs">cancelled</code></li>
            <li><strong className="text-[var(--text-primary)]">Transfer Order (<code className="font-mono text-xs">transfer_order</code>)</strong>: <code className="font-mono text-xs">confirmed</code>, <code className="font-mono text-xs">picking</code>, <code className="font-mono text-xs">shipped</code>, <code className="font-mono text-xs">received</code>, <code className="font-mono text-xs">cancelled</code></li>
            <li><strong className="text-[var(--text-primary)]">Warehouse Receipt (<code className="font-mono text-xs">warehouse</code> - receipt)</strong>: <code className="font-mono text-xs">received</code>, <code className="font-mono text-xs">cancelled</code></li>
            <li><strong className="text-[var(--text-primary)]">Warehouse Shipment (<code className="font-mono text-xs">warehouse</code> - shipment)</strong>: <code className="font-mono text-xs">draft</code>, <code className="font-mono text-xs">dispatched</code>, <code className="font-mono text-xs">shipped</code>, <code className="font-mono text-xs">cancelled</code></li>
          </ul>
          {/* eslint-enable i18next/no-literal-string */}
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('securityVerification.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            {t.rich('securityVerification.description', {
              code: (chunks) => <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded text-[var(--brand-navy)]">{chunks}</code>
            })}
          </p>
        </div>

        <div className="card">
          <h3 className="section-heading mb-2">{t('consumingSdk.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-2">{t('consumingSdk.description')}</p>
          <pre className="bg-[#f7f9fb] p-4 rounded-md border border-[var(--border)] text-xs font-mono overflow-x-auto text-[var(--brand-navy)] mt-2">
{`import express from 'express';
import { HeroBM } from '@modbm/sdk/server';

app.events.on('sales_order.created', async (event) => {
  console.log(\`Order created: \${event.entityId}\`);
  console.log(\`Order Payload:\`, event.payload);
});

// 3. Mount the automated webhook receiver middleware
// CRITICAL: You must use express.raw so the SDK receives raw bytes for verification
const server = express();
server.use('/webhook', express.raw({ type: 'application/json' }), app.webhooks.expressMiddleware());

server.listen(3000, () => console.log('HeroBM Webhook Receiver started!'));`}
          </pre>
        </div>

      </div>
    </DetailsLayout>
  );
}
