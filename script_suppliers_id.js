import { promises as fs } from 'fs';
import path from 'path';

export async function standardizeSuppliersView() {
  const filePath = path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'suppliers', '[id]', 'page.tsx');
  let content = await fs.readFile(filePath, 'utf-8');

  // Find all cards
  const basicInfoStart = content.indexOf('{/* Basic Info Card */}');
  const contactLocationStart = content.indexOf('{/* Contact & Location Card */}');
  const notesStart = content.indexOf('{/* Notes Card */}');
  const recordDetailsStart = content.indexOf('{/* Record Details Card */}');
  const financialsStart = content.indexOf('{/* Financials Card */}');

  if (basicInfoStart === -1 || contactLocationStart === -1 || notesStart === -1 || recordDetailsStart === -1 || financialsStart === -1) {
    console.error("Could not find one of the cards in suppliers/[id]");
    return;
  }

  // Extract each card's content
  const basicInfoCard = content.substring(basicInfoStart, contactLocationStart).trim();
  const contactLocationCard = content.substring(contactLocationStart, notesStart).trim();
  const notesCard = content.substring(notesStart, recordDetailsStart).trim();
  const recordDetailsCard = content.substring(recordDetailsStart, financialsStart).trim();
  
  const layoutStartStr = '<div className="space-y-6 mb-8">';
  const layoutStart = content.indexOf(layoutStartStr);
  const prefix = content.substring(0, layoutStart);
  
  const suffixIndex = content.lastIndexOf('</div>\n      </div>\n    </Shell>');
  const suffix = content.substring(suffixIndex);

  const financialsCard = content.substring(financialsStart, suffixIndex).trim();

  // Reconstruct with 2 columns
  const newLayout = `
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-8">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            ${basicInfoCard}
            ${notesCard}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            ${contactLocationCard}
            ${financialsCard}
            ${recordDetailsCard}
          </div>
`;

  const finalContent = prefix + newLayout + suffix;

  await fs.writeFile(filePath, finalContent, 'utf-8');
  console.log("Updated suppliers/[id]/page.tsx!");
}

standardizeSuppliersView().catch(console.error);
