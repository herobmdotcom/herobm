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
    document.title = desiredTitle;
    
    // Hardened Client-Override: Next.js applies routing metadata asynchronously.
    // We enforce our manual client-side hook title over the default layout metadata.
    const observer = new MutationObserver(() => {
      if (document.title !== desiredTitle) {
        document.title = desiredTitle;
      }
    });

    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, { childList: true, characterData: true });
    } else {
      observer.observe(document.head, { childList: true, subtree: true });
    }

    // Fallback syncs
    const timeoutIds = [
      setTimeout(() => { document.title = desiredTitle; }, 50),
      setTimeout(() => { document.title = desiredTitle; }, 500)
    ];

    return () => {
      timeoutIds.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [title]);
}
