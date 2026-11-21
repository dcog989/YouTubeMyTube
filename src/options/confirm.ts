import { byId } from '../shared/ui';

let pending: ((ok: boolean) => void) | null = null;

// window.confirm() is drawn by the browser and cannot be themed, so destructive
// confirmations use this page's own dialog and colours.
export function confirmAction(message: string): Promise<boolean> {
  byId('confirm-message').textContent = message;
  const dialog = byId<HTMLDialogElement>('confirm-dialog');
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    pending = resolve;
  });
}

export function wireConfirm(): void {
  const dialog = byId<HTMLDialogElement>('confirm-dialog');
  byId('confirm-accept').addEventListener('click', () => dialog.close('accept'));
  byId('confirm-cancel').addEventListener('click', () => dialog.close('cancel'));
  dialog.addEventListener('close', () => {
    const resolve = pending;
    pending = null;
    // Escape and the cancel button leave returnValue unset.
    resolve?.(dialog.returnValue === 'accept');
  });
}
