import { useEffect } from 'react';

export const useEscapeKey = (onClose?: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;

    // Lock body and root scroll to prevent any horizontal window shift or off-screen dragging
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverflow = document.documentElement.style.overflowX;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflowX = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.code === 'Escape') && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overflowX = originalHtmlOverflow;
    };
  }, [onClose, isActive]);
};
