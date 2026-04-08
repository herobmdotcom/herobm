import re

with open("apps/ops-portal/app/purchase-orders/new/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Imports and ReportError
text = text.replace("import { useState, useRef, useCallback } from 'react';", "import { useState, useEffect, useRef, useCallback } from 'react';")
text = text.replace("import { apiFetch, apiMutate } from '@/lib/api';", "import { apiFetch, apiMutate, reportError } from '@/lib/api';")

# 2. GstCategory and LineItem
category = """
interface GstCategory {
  gstCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}
"""
text = text.replace("interface Supplier", category + "\ninterface Supplier")

line_item = "unitOfMeasure: string;\n  discountPercentage: string;\n  gstCategoryId: string | null;\n"
text = text.replace("unitOfMeasure: string;\n}", line_item + "}")

empty_line = "unitOfMeasure: 'EA',\n    discountPercentage: '0',\n    gstCategoryId: null,\n"
text = text.replace("unitOfMeasure: 'EA',\n  };", empty_line + "  };")

# 3. addLineFromProduct and addBlankLine
text = text.replace("unitOfMeasure: 'EA',\n      },", "unitOfMeasure: 'EA',\n      discountPercentage: '0',\n      gstCategoryId: null,\n      },")

# 4. State for GST categories
state_code = """
  const [gstCategories, setGstCategories] = useState<GstCategory[]>([]);

  useEffect(() => {
    apiFetch<GstCategory[]>('/api/gst-categories')
      .then(setGstCategories)
      .catch((err) => reportError(err, 'NewPurchaseOrderPage'));
  }, []);
"""
text = text.replace("const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);", "const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);\n" + state_code)

# 5. Amounts and Totals
amounts_code = """
  const computeTax = (line: LineItem) => {
    const cat = gstCategories.find(c => c.gstCategoryId === line.gstCategoryId);
    if (!cat) {
      const defaultCat = gstCategories.find(c => c.isDefault);
      if (!defaultCat) return 0;
      return computeLinePrice({
        quantity: parseFloat(line.quantity) || 0,
        pricePerUnit: parseFloat(line.pricePerUnit) || 0,
        discountPercentage: parseFloat(line.discountPercentage) || 0,
        taxRate: parseFloat(defaultCat.rate) || 0,
      }).tax;
    }
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
      taxRate: parseFloat(cat.rate) || 0,
    }).tax;
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
    }).amount;
  };
"""
text = re.sub(r"  const computeAmount = \(line: LineItem\).*?\}\.amount;\n  \};\n", amounts_code, text, flags=re.DOTALL)

mapped_lines = """
  const mappedLines = lines.map(l => ({
    amount: computeAmount(l),
    tax: computeTax(l)
  }));
"""
text = text.replace("  const mappedLines = lines.map(l => ({\n    amount: computeAmount(l),\n    tax: 0\n  }));", mapped_lines)

# 6. handleSubmit mapping
submit_mapping = """            pricePerUnit: l.pricePerUnit,
            unitOfMeasure: l.unitOfMeasure,
            discountPercentage: l.discountPercentage,
            gstCategoryId: l.gstCategoryId,
          })),"""
text = text.replace("            pricePerUnit: l.pricePerUnit,\n            unitOfMeasure: l.unitOfMeasure,\n          })),", submit_mapping)

with open("apps/ops-portal/app/purchase-orders/new/page.tsx", "w", encoding="utf-8") as f:
    f.write(text)
