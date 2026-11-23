const PRINT_ROOT_ID = 'doctrack-print-root';
const PRINT_BODY_CLASS = 'printing-routing-slip';

/**
 * Isolates a single routing slip DOM element into a top-level print container so
 * `window.print()` prints ONLY the professional QR slip (never sidebars, forms, or modals).
 */
export function printRoutingSlipElement(slipElement: HTMLElement | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!slipElement) {
    window.print?.();
    return;
  }

  const existingRoot = document.getElementById(PRINT_ROOT_ID);
  if (existingRoot) {
    existingRoot.remove();
  }

  const printRoot = document.createElement('div');
  printRoot.id = PRINT_ROOT_ID;
  const clonedSlip = slipElement.cloneNode(true) as HTMLElement;
  clonedSlip.classList.add('qr-print-slip-isolated');
  printRoot.appendChild(clonedSlip);
  document.body.appendChild(printRoot);
  document.body.classList.add(PRINT_BODY_CLASS);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener('afterprint', cleanup);
    document.body.classList.remove(PRINT_BODY_CLASS);
    const node = document.getElementById(PRINT_ROOT_ID);
    if (node) {
      node.remove();
    }
  };

  window.addEventListener('afterprint', cleanup);

  try {
    window.print?.();
  } finally {
    // Clean up after print dialogs close (or immediately in synchronous/test environments)
    window.setTimeout(cleanup, 300);
  }
}
