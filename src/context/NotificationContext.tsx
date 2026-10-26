import React, { createContext, useContext, useState, useEffect } from 'react';
import { AudioService } from '../services/audioService';
import { useTasks } from './TaskContext';

interface NotificationContextType {
  isAlarmOpen: boolean;
  setIsAlarmOpen: (open: boolean) => void;
  triggerMorningAlarm: () => void;
  snoozeAlarm: (minutes: number) => void;
  dismissAlarm: () => void;
  bulkDismissAlarms: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAlarmOpen, setIsAlarmOpen] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const { settings } = useTasks();

  // Request native OS notification permission on first user interaction if not yet granted
  useEffect(() => {
    const handleFirstGesture = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  const triggerMorningAlarm = () => {
    if (settings.enableSoundChime) {
      AudioService.playMorningChime();
    }
    setIsAlarmOpen(true);

    // Native Web / OS notification (works even if minimized or user is on another screen/tab)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notifOptions: any = {
          body: "Daily Compliance Alert: Statutory due dates & priority client tasks require attention today.",
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          vibrate: [300, 100, 300, 100, 300],
          tag: 'statutory-1030-alarm',
          requireInteraction: true,
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification('⏰ 10:30 AM Statutory Deadline Reminder', notifOptions);
          });
        } else {
          new Notification('⏰ 10:30 AM Statutory Deadline Reminder', notifOptions);
        }
      } catch (err) {
        console.warn('System Notification error:', err);
      }
    }
  };

  const snoozeAlarm = (minutes: number) => {
    setIsAlarmOpen(false);
    setSnoozedUntil(Date.now() + minutes * 60 * 1000);
  };

  const dismissAlarm = () => {
    setIsAlarmOpen(false);
  };

  const bulkDismissAlarms = () => {
    setIsAlarmOpen(false);
  };

  // Clock tick listener for 10:30 AM alarm
  useEffect(() => {
    const interval = setInterval(() => {
      if (!settings.enableMorningAlarm) return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      // Check if snoozed timer expired
      if (snoozedUntil && Date.now() >= snoozedUntil) {
        setSnoozedUntil(null);
        triggerMorningAlarm();
        return;
      }

      // 10:30:00 AM check
      const [targetH, targetM] = (settings.morningAlarmTime || '10:30').split(':').map(Number);
      if (hours === targetH && minutes === targetM && seconds === 0) {
        triggerMorningAlarm();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings, snoozedUntil]);

  return (
    <NotificationContext.Provider value={{
      isAlarmOpen,
      setIsAlarmOpen,
      triggerMorningAlarm,
      snoozeAlarm,
      dismissAlarm,
      bulkDismissAlarms
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
