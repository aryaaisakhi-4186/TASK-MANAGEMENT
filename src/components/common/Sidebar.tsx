import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  CalendarCheck2, 
  Users, 
  UserCheck, 
  FolderKanban, 
  FileText, 
  IndianRupee, 
  History, 
  Bot, 
  Settings,
  Clock,
  Sparkles,
  Phone,
  MessageCircle,
  Mail
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentRole } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TEAM', 'GUEST'] },
    { id: 'tasks', label: 'Task Matrix', icon: CalendarCheck2, roles: ['ADMIN', 'TEAM', 'GUEST'] },
    { id: 'clients', label: 'Clients Master', icon: Users, roles: ['ADMIN', 'GUEST'] },
    { id: 'client-portal', label: 'My Compliance Portal', icon: FileText, roles: ['CLIENT'] },
    { id: 'team', label: 'Team Directory', icon: UserCheck, roles: ['ADMIN'] },
    { id: 'documents', label: 'Document Vault', icon: FolderKanban, roles: ['ADMIN', 'TEAM', 'CLIENT', 'GUEST'] },
    { id: 'extra-work', label: 'Extra Work Tracker', icon: IndianRupee, roles: ['ADMIN', 'TEAM'] },
    { id: 'audit', label: 'History & Audit Log', icon: History, roles: ['ADMIN', 'TEAM', 'GUEST'] },
    { id: 'ai-bot', label: 'CA CompliBot AI', icon: Bot, roles: ['ADMIN', 'TEAM', 'CLIENT', 'GUEST'] },
    { id: 'settings', label: 'Firm Settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(currentRole));

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white/70 dark:bg-slate-950/60 backdrop-blur-xl border-r border-slate-200/90 dark:border-slate-800/80 min-h-[calc(100vh-65px)] p-4 transition-all">
      <div className="mb-4 px-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Operations Navigation</p>
      </div>

      <nav className="flex-1 space-y-1.5">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive 
                  ? 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/40 shadow-sm font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/80'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'} />
              <span>{item.label}</span>
              {item.id === 'ai-bot' && (
                <span className="ml-auto flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-400 px-1.5 py-0.2 rounded font-bold">
                  <Sparkles size={10} /> AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Contact Us Support Box */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 px-2 space-y-2">
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Phone size={13} className="text-amber-600 dark:text-amber-400" />
              <span>Contact Us</span>
            </span>
            <span className="text-[9px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">Support</span>
          </div>

          <div className="space-y-1">
            <a
              href="tel:+918982147763"
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-amber-600 font-mono font-bold text-[10px] transition-colors"
            >
              <Phone size={11} className="text-amber-500 shrink-0" />
              <span>+91-8982147763</span>
            </a>

            <a
              href="https://wa.me/918982147763?text=Namaste%20TASK-VAANI%20Support"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:underline font-bold text-[10px] transition-colors"
            >
              <MessageCircle size={11} className="text-emerald-500 shrink-0" />
              <span>WhatsApp Direct Chat</span>
            </a>

            <a
              href="mailto:arya.taskmanagement@gmail.com"
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-amber-500 text-[10px] truncate transition-colors"
              title="arya.taskmanagement@gmail.com"
            >
              <Mail size={11} className="text-amber-500 shrink-0" />
              <span className="truncate">arya.taskmanagement@gmail.com</span>
            </a>
          </div>
        </div>

        <div className="px-1 text-[10px] text-slate-500">
          <p className="font-semibold text-slate-600 dark:text-slate-400">TASK-VAANI Enterprise</p>
          <p>Statutory Compliance Hub</p>
        </div>
      </div>
    </aside>
  );
};
