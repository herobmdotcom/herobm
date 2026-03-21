import { promises as fs } from 'fs';
import path from 'path';

export async function standardizeAccountsView() {
  const filePath = path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'accounts', '[id]', 'page.tsx');
  let content = await fs.readFile(filePath, 'utf-8');

  // Find all cards
  const basicInfoStart = content.indexOf('{/* Basic Info Card */}');
  const primaryContactStart = content.indexOf('{/* Primary Contact Card */}');
  const addressStart = content.indexOf('{/* Address & Contact Card */}');
  const notesStart = content.indexOf('{/* Notes Card */}');
  const recordDetailsStart = content.indexOf('{/* Record Details Card */}');
  const pricingStart = content.indexOf('{/* Pricing & Currency Card */}');
  
  // Find the end of Pricing & Currency Card (where the wrapper divs close)
  // Look for the end of the scroll-area div
  const scrollAreaEnd = content.indexOf('</form>', pricingStart); // Wait, page is wrapped in form?
  const parentClose = content.lastIndexOf('</div>\n    </Shell>'); // Approx

  if (basicInfoStart === -1 || primaryContactStart === -1 || addressStart === -1 || notesStart === -1 || recordDetailsStart === -1 || pricingStart === -1) {
    console.error("Could not find one of the cards");
    return;
  }

  // Extract each card's content
  const basicInfoCard = content.substring(basicInfoStart, primaryContactStart).trim();
  const primaryContactCard = content.substring(primaryContactStart, addressStart).trim();
  const addressCard = content.substring(addressStart, notesStart).trim();
  const notesCard = content.substring(notesStart, recordDetailsStart).trim();
  const recordDetailsCard = content.substring(recordDetailsStart, pricingStart).trim();
  
  // For pricing card, we need to extract up to the closing divs before </Shell>
  // Let's find the closing div of the pricing card
  const pricingSlice = content.substring(pricingStart);
  // The card ends at the matching </div>.
  // We can just rely on the fact that the outer flex container ends before </Shell>
  
  // Actually, a simpler replace:
  // The layout starts at:
  // <div className="space-y-6 mb-8">
  const layoutStartStr = '<div className="space-y-6 mb-8">';
  const layoutStart = content.indexOf(layoutStartStr);

  const prefix = content.substring(0, layoutStart);
  
  // Find where the vertical stack ends.
  // In the original file:
  //       <div className="scroll-area" style={{ flex: 1 }}>
  //         <div className="space-y-6 mb-8">
  //             {/* Basic Info Card */} ...
  //             {/* Pricing Card */} ...
  //         </div>
  //       </div>
  //     </Shell>
  //   );
  const suffixIndex = content.lastIndexOf('</div>\n      </div>\n    </Shell>');

  if (layoutStart === -1 || suffixIndex === -1) {
    console.error("Could not find start/end of layout container.");
    return;
  }

  const suffix = content.substring(suffixIndex);

  // Extract Pricing Card properly
  // We know pricing card starts at pricingStart and ends right before suffixIndex
  const pricingCard = content.substring(pricingStart, suffixIndex).trim();

  // Reconstruct with 2 columns
  const newLayout = \`
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mb-8">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            \${basicInfoCard}
            \${notesCard}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            \${primaryContactCard}
            \${addressCard}
            \${pricingCard}
            \${recordDetailsCard}
          </div>
\`;

  const finalContent = prefix + newLayout + suffix;

  await fs.writeFile(filePath, finalContent, 'utf-8');
  console.log("Updated accounts/[id]/page.tsx!");
}

standardizeAccountsView().catch(console.error);
