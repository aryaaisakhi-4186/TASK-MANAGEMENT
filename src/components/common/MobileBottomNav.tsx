import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, CalendarCheck2, Clock, FolderKanban, Bot, MoreHorizontal, FileText } from 'lucide-react';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { InstallPWAModal } from './InstallPWAModal';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenRoleModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, setActiveTab, onOpenRoleModal }) => {
  const { currentRole } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);

  const navItems = currentRole === 'CLIENT' 
    ? [
        { id: 'client-portal', label: 'Compliance', icon: FileText },
        { id: 'documents', label: 'Docs Vault', icon: FolderKanban },
        { id: 'ai-bot', label: 'AI Bot', icon: Bot },
        { id: 'more', label: 'More', icon: MoreHorizontal },
      ]
    : [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'tasks', label: 'Tasks', icon: CalendarCheck2 },
        { id: 'documents', label: 'Docs', icon: FolderKanban },
        { id: 'audit', label: 'History', icon: FileText },
        { id: 'ai-bot', label: 'AI Bot', icon: Bot },
        { id: 'more', label: 'More', icon: MoreHorizontal },
      ];

  const handleTabClick = (id: string) => {
    if (id === 'more') {
      setIsMoreOpen(true);
    } else {
      setActiveTab(id);
    }
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-1 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all relative select-none touch-manipulation active:scale-90 ${
                  isActive 
                    ? 'text-amber-600 dark:text-amber-400 font-bold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1 w-6 h-1 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
                )}
                <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer */}
      <MobileMoreDrawer
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRoleModal={onOpenRoleModal}
        onOpenInstallModal={() => setIsInstallOpen(true)}
      />

      {/* Install App Guide Modal */}
      <InstallPWAModal
        isOpen={isInstallOpen}
        onClose={() => setIsInstallOpen(false)}
      />
    </>
  );
};
