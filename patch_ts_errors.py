import re

with open("apps/ops-portal/app/purchase-orders/[id]/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Fix salesOrderLineId -> purchaseOrderLineId
code = code.replace("salesOrderLineId", "purchaseOrderLineId")

# Remove duplicate useTranslations import
match = re.search(r"import \{ useTranslations \} from 'next-intl';\n\nfunction GstLabel", code)
if match:
    code = code.replace(match.group(0), "function GstLabel")

with open("apps/ops-portal/app/purchase-orders/[id]/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)

with open("apps/ops-portal/app/purchase-orders/new/page.tsx", "r", encoding="utf-8") as f:
    code2 = f.read()

code2 = code2.replace("import { apiFetch, apiMutate } from '@/lib/api';", "import { apiFetch, apiMutate, reportError } from '@/lib/api';")

with open("apps/ops-portal/app/purchase-orders/new/page.tsx", "w", encoding="utf-8") as f:
    f.write(code2)

