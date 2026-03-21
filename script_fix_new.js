import { promises as fs } from 'fs';
import path from 'path';

export async function fixAccountsNew() {
  const filePath = path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'accounts', 'new', 'page.tsx');
  let content = await fs.readFile(filePath, 'utf-8');

  // We are completely replacing the return statement of `accounts/new`
  // We need to restore accountNumber, and fix the i18n placeholders.
  const newLayout = `
  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('accounts.buttons.createAccount')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('accounts.customerManagement')}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => router.push('/accounts')}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.saving') : t('accounts.buttons.createAccount')}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* General Info Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('accounts.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('accounts.columns.accountNumber')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.accountNumber}
                      onChange={(e) => updateField('accountNumber', e.target.value)}
                      placeholder="e.g. ACME-001"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.name')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.customerGroup')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.customerGroup}
                      onChange={(e) => updateField('customerGroup', e.target.value)}
                      placeholder="e.g. Wholesale"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.gstPosition')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.gstPosition}
                      onChange={(e) => updateField('gstPosition', e.target.value)}
                      placeholder="e.g. Standard"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.notesCardHeading')}
              </h3>
              <textarea
                className="input w-full"
                style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
                value={dto.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t('common.notesCardPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Primary Contact Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.columns.contact')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactName')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactName}
                    onChange={(e) => updateField('primaryContactName', e.target.value)}
                    placeholder="John Smith"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactEmail')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.primaryContactEmail}
                    onChange={(e) => updateField('primaryContactEmail', e.target.value)}
                    placeholder="john@acme.com"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.contactPhone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.primaryContactPhone}
                    onChange={(e) => updateField('primaryContactPhone', e.target.value)}
                    placeholder="+1 234 567 890"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Address Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.columns.address')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.email')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={dto.emailAddress1}
                    onChange={(e) => updateField('emailAddress1', e.target.value)}
                    placeholder="accounts@acme.com"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.phone')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.telephone1}
                    onChange={(e) => updateField('telephone1', e.target.value)}
                    placeholder="+1 234 567 890"
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    placeholder="123 Main St"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.city')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1City}
                    onChange={(e) => updateField('address1City', e.target.value)}
                    placeholder="City"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.state')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1StateOrProvince}
                    onChange={(e) => updateField('address1StateOrProvince', e.target.value)}
                    placeholder="State"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.postalCode')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1PostalCode}
                    onChange={(e) => updateField('address1PostalCode', e.target.value)}
                    placeholder="12345"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.country')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Country}
                    onChange={(e) => updateField('address1Country', e.target.value)}
                    placeholder="Country"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
`;

  const returnIndex = content.indexOf('return (');
  if (returnIndex !== -1) {
    content = content.substring(0, returnIndex) + newLayout + '\n}\n';
    await fs.writeFile(filePath, content, 'utf-8');
    console.log("Updated accounts/new/page.tsx with correct fields and placeholders!");
  }
}

export async function fixSuppliersNew() {
  const filePath = path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'suppliers', 'new', 'page.tsx');
  let content = await fs.readFile(filePath, 'utf-8');

  // We are completely replacing the return statement of `suppliers/new`
  const newLayout = `
  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('suppliers.buttons.createSupplier')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('suppliers.management')}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => router.push('/suppliers')}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.saving') : t('suppliers.buttons.createSupplier')}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* General Info Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('suppliers.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.vendorNumber')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.vendorNumber}
                      onChange={(e) => updateField('vendorNumber', e.target.value)}
                      placeholder={t('suppliers.placeholders.vendorNumber')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.name')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder={t('suppliers.placeholders.name')}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.currency')}
                    </label>
                    <select
                      className="input"
                      value={dto.currencyCode}
                      onChange={(e) => updateField('currencyCode', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.paymentTerms')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.paymentTerms}
                      onChange={(e) => updateField('paymentTerms', e.target.value)}
                      placeholder={t('suppliers.placeholders.paymentTerms')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.notesCardHeading')}
              </h3>
              <textarea
                className="input w-full"
                style={{ minHeight: 110, paddingTop: 12, resize: 'vertical' }}
                value={dto.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t('common.notesCardPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Contact Details Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.contactAddress')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.email')}
                    </label>
                    <input
                      type="email"
                      className="input"
                      value={dto.emailAddress1}
                      onChange={(e) => updateField('emailAddress1', e.target.value)}
                      placeholder={t('suppliers.placeholders.email')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.telephone')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.telephone1}
                      onChange={(e) => updateField('telephone1', e.target.value)}
                      placeholder={t('suppliers.placeholders.phone')}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.address')}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.address1Line1}
                    onChange={(e) => updateField('address1Line1', e.target.value)}
                    placeholder={t('suppliers.placeholders.address')}
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.city')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.address1City}
                      onChange={(e) => updateField('address1City', e.target.value)}
                      placeholder={t('suppliers.placeholders.city')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.country')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.address1Country}
                      onChange={(e) => updateField('address1Country', e.target.value)}
                      placeholder={t('suppliers.placeholders.country')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
`;

  const returnIndex = content.indexOf('return (');
  if (returnIndex !== -1) {
    content = content.substring(0, returnIndex) + newLayout + '\n}\n';
    await fs.writeFile(filePath, content, 'utf-8');
    console.log("Updated suppliers/new/page.tsx with correct fields and placeholders!");
  }
}

async function run() {
  await fixAccountsNew();
  await fixSuppliersNew();
}

run().catch(console.error);
