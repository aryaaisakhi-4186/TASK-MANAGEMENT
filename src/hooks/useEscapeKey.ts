import { useEffect } from 'react';

export const useEscapeKey = (onClose?: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive || !onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, isActive]);
};
