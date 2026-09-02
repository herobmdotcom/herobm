import { useEffect } from 'react';

/**
 * Updates the document title on the client side.
 * Automatically appends the default suffix " | herobm".
 *
 * @param title The dynamic title segment to display in the browser tab.
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const desiredTitle = title ? `${title} | herobm` : 'herobm';
    
    if (document.title !== desiredTitle) {
      document.title = desiredTitle;
    }
    
    // Instead of MutationObserver which can cause infinite layout loops with Next.js's Head manager,
    // we use a simple interval to enforce the title for a few seconds during hydration.
    let ticks = 0;
    const interval = setInterval(() => {
      if (document.title !== desiredTitle) {
        document.title = desiredTitle;
      }
      ticks++;
      if (ticks > 10) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [title]);
}
