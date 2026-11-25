import Modal from './Modal';

interface Props {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger = red confirm button (deletes); primary = normal button (warnings). */
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', busy, onConfirm, onCancel }: Props) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width="max-w-md"
      onSubmit={onConfirm}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </button>
          <button type="submit" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-700">{message}</div>
    </Modal>
  );
}
