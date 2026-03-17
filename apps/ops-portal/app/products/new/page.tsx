'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { toast } from 'react-hot-toast';
import { apiMutate, EntityHeader } from '@/lib/api';

export default function NewProductPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
    productNumber: '',
    name: '',
    barcode: '',
    listPrice: '0',
    standardCost: '0',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const product = await apiMutate<any>('/api/products', 'POST', dto);
      toast.success('Product created successfully');
      router.push(`/products/${product.productId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.productNumber.trim() !== '' && dto.name.trim() !== '';

  return (
    <Shell>
      <EntityHeader
        title="Create New Product"
        subtitle="Catalog & Inventory Management"
        onBack={() => router.push('/products')}
        isSaving={submitting}
        isDirty={isValid}
        onSave={handleSubmit}
        saveLabel="✨ Create Product"
      />

      <div className="scroll-area" style={{ flex: 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* General Information Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              General Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Product Number (SKU) *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.productNumber}
                  onChange={(e) => updateField('productNumber', e.target.value)}
                  placeholder="e.g. PROD-001"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Widget Deluxe"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Barcode
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  placeholder="UPC / EAN"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Costs Card */}
          <div className="card">
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Pricing & Costs
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    List Price (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={dto.listPrice}
                    onChange={(e) => updateField('listPrice', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Standard Cost (EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={dto.standardCost}
                    onChange={(e) => updateField('standardCost', e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-base-200/50 border border-base-300">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Standard cost is used for margin calculations and inventory valuation. 
                  List price is the default selling price before customer discounts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="card mb-6">
          <h3
            className="text-sm font-semibold mb-4"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Internal & Warehouse Notes
          </h3>
          <textarea
            className="textarea h-32"
            value={dto.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Handling instructions, storage requirements, or product description..."
            disabled={submitting}
          />
        </div>
      </div>
    </Shell>
  );
}
