import styles from './ModalClose.module.css';

/** Top-right Close button for a dialog (FA4). The parent dialog must be `position: relative`. */
export function ModalClose({ onClick, disabled = false, size = 'admin' }: { onClick(): void; disabled?: boolean; size?: 'admin' | 'child' }) {
  return (
    <button type="button" aria-label="Close" data-size={size} disabled={disabled} onClick={onClick} className={`${styles.btn} ${styles[size]}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
