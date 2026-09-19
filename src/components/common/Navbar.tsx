import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { useTasks } from '../../context/TaskContext';
import { Bell, ShieldCheck, Sun, Moon, LogOut, Sparkles, Scale, Coffee, Utensils, Play, Power, Flame, Cloud } from 'lucide-react';
import { AnalogClock } from './AnalogClock';

export const Navbar: React.FC<{ onOpenRoleModal: () => void; onOpenFirebaseModal?: () => void }> = ({ onOpenRoleModal, onOpenFirebaseModal }) => {
  const { currentUser, currentRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { triggerMorningAlarm } = useNotification();
  const { 
    officeStatus, 
    officeLoginTime, 
    lunchStartTime, 
    totalLunchMinutesToday, 
    loginOffice, 
    logoffOffice, 
    startLunchBreak, 
    endLunchBreak 
  } = useTasks();

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'ADMIN':
        return <span className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Admin</span>;
      case 'TEAM':
        return <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Team Member</span>;
      case 'CLIENT':
        return <span className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Client View</span>;
      case 'GUEST':
      default:
        return <span className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Guest Mode</span>;
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-800/80 px-4 lg:px-8 py-3 transition-colors shadow-sm">
      <div className="w-full flex items-center justify-between gap-4">
        
        {/* Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white shadow-md shadow-amber-500/30 border border-amber-400">
            <Scale className="text-white" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-wider text-slate-900 dark:text-white font-serif">TASK-VAANI</span>
              
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide font-medium">Statutory Compliance Hub</p>
          </div>
        </div>

        {/* Center Shift Status & Lunch Break Push Button Widget */}
        {currentRole !== 'CLIENT' && (
          <div className="flex items-center gap-2">
            {officeStatus === 'LOGGED_OFF' && (
              <button
                onClick={() => loginOffice(currentUser?.id || 'admin', currentUser?.name || 'Staff')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <Power size={13} />
                <span>🟢 Office Login (Shift IN)</span>
              </button>
            )}

            {officeStatus === 'LOGGED_IN' && (
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="hidden sm:inline font-mono">Shift IN:</span>
                  <span className="font-mono">
                    {officeLoginTime ? new Date(officeLoginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                  </span>
                </div>

                {/* Lunch Break Push Button (ON) */}
                <button
                  onClick={() => startLunchBreak(currentUser?.id || 'admin', currentUser?.name || 'Staff')}
                  title="Turn ON Lunch Break"
                  className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border border-amber-400"
                >
                  <Utensils size={13} />
                  <span>🍽️ Lunch Break [PUSH ON]</span>
                </button>

                {/* Office Log Off Button */}
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to Log-Off from Office shift for the day? Your net working hours and shift report will be recorded.')) {
                      logoffOffice(currentUser?.id || 'admin', currentUser?.name || 'Staff');
                    }
                  }}
                  title="Office Shift Log-Off"
                  className="px-2.5 py-1 rounded-xl hover:bg-red-500/20 text-red-600 hover:text-red-700 dark:text-red-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Power size={12} />
                  <span className="hidden sm:inline">Log-off</span>
                </button>
              </div>
            )}

            {officeStatus === 'ON_LUNCH_BREAK' && (
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-amber-500/15 border border-amber-500/40">
                <div className="px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span>🍽️ ON LUNCH BREAK</span>
                  <span className="font-mono text-[10px]">
                    (Since {lunchStartTime ? new Date(lunchStartTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now'})
                  </span>
                </div>

                {/* Resume Work / End Lunch Break Push Button (OFF) */}
                <button
                  onClick={() => endLunchBreak(currentUser?.id || 'admin', currentUser?.name || 'Staff')}
                  title="Turn OFF Lunch Break & Resume Work"
                  className="px-3.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Play size={13} />
                  <span>▶ Break OFF (Resume Work)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Center Clock Widget */}
        <div className="hidden xl:flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-2xl shadow-sm">
          <AnalogClock size={38} />
          <div className="text-left">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Alarm 10:30 AM</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Daily Chime</p>
          </div>
        </div>

        {/* Right Action Icons & User Status */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Firebase Cloud Sync Button */}
          {onOpenFirebaseModal && (
            <button
              onClick={onOpenFirebaseModal}
              title="Firebase Real-Time Cloud Sync & Online Database"
              className="p-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-slate-950 transition-all hover:scale-105 shadow-sm flex items-center gap-1 text-xs font-bold"
            >
              <Flame size={18} className="text-orange-500 group-hover:text-white" />
              <span className="hidden lg:inline">Cloud Sync</span>
            </button>
          )}

          {/* Test 10:30 AM Alarm Chime */}
          <button
            onClick={triggerMorningAlarm}
            title="Test 10:30 AM Statutory Alarm & Chime"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition-all hover:scale-105 shadow-sm"
          >
            <Bell size={18} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title="Toggle Day Light / Dark / High-Contrast Theme"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            {theme === 'light' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-amber-400" />}
          </button>

          {/* Role Switcher Button */}
          <button
            onClick={onOpenRoleModal}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/50 text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-white transition-all text-xs font-semibold shadow-sm"
          >
            <ShieldCheck size={16} className="text-amber-500" />
            <span>Switch Role</span>
            {getRoleBadge()}
          </button>

          {/* Current User Pill */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="User" className="w-full h-full rounded-full object-cover" />
              ) : (
                currentUser?.name.charAt(0) || 'U'
              )}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{currentUser?.designation || currentRole}</p>
            </div>
            <button
              onClick={logout}
              title="Logout session"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
