import { promises as fs } from 'fs';
import path from 'path';

export async function standardizeSuppliersNew() {
  const filePath = path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'suppliers', 'new', 'page.tsx');
  let content = await fs.readFile(filePath, 'utf-8');

  const newLayout = `
  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('suppliers.buttons.createSupplier')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('suppliers.createSubtitle')}
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
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.name')} *
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('suppliers.columns.registrationNumber')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.registrationNumber}
                      onChange={(e) => updateField('registrationNumber', e.target.value)}
                      placeholder={t('suppliers.placeholders.registrationNumber')}
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
                      value={dto.telephone1}
                      onChange={(e) => updateField('telephone1', e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('suppliers.columns.website')}
                  </label>
                  <input
                    type="url"
                    className="input"
                    value={dto.webSiteUrl}
                    onChange={(e) => updateField('webSiteUrl', e.target.value)}
                    placeholder="https://example.com"
                    disabled={submitting}
                  />
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
            {/* Address Card */}
            <div className="card">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('common.columns.address')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
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
    </Shell>
  );
`;

  const returnIndex = content.indexOf('return (');
  if (returnIndex !== -1) {
    content = content.substring(0, returnIndex) + newLayout + '\n}\n';
    await fs.writeFile(filePath, content, 'utf-8');
    console.log("Updated suppliers/new/page.tsx!");
  }
}

standardizeSuppliersNew().catch(console.error);
