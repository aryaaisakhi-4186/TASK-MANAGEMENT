import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { RoleSelectorModal } from './components/auth/RoleSelectorModal';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { TaskMatrixGrid } from './components/tasks/TaskMatrixGrid';
import { TaskModal } from './components/tasks/TaskModal';
import { AlarmModal1030 } from './components/tasks/AlarmModal1030';
import { ClientMasterTable } from './components/clients/ClientMasterTable';
import { ClientPortalView } from './components/clients/ClientPortalView';
import { TeamMasterTable } from './components/team/TeamMasterTable';
import { DocumentVault } from './components/documents/DocumentVault';
import { ExtraWorkTracker } from './components/finance/ExtraWorkTracker';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { CACompliBot } from './components/ai/CACompliBot';
import { FirmSettingsModal } from './components/settings/FirmSettingsModal';
import { FirebaseSyncModal } from './components/settings/FirebaseSyncModal';
import { InstallPWAModal } from './components/common/InstallPWAModal';
import { HomePageLogin } from './components/auth/HomePageLogin';
import { TaskItem } from './types';
import { Smartphone } from 'lucide-react';

const MainPortal: React.FC = () => {
  const { currentRole, currentUser, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated || !currentUser) {
    return <HomePageLogin />;
  }
  const [activeTab, setActiveTab] = useState<string>(() => {
    return currentRole === 'CLIENT' ? 'client-portal' : 'dashboard';
  });
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null | 'NEW'>(null);

  useEffect(() => {
    if (currentRole === 'CLIENT') {
      setActiveTab('client-portal');
    } else if (activeTab === 'client-portal') {
      setActiveTab('dashboard');
    }
  }, [currentRole]);

  return (
    <div className="min-h-[100dvh] bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-800 transition-colors duration-200">
      
      {/* Top Corporate Navigation */}
      <Navbar onOpenRoleModal={() => setIsRoleModalOpen(true)} onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)} />

      {/* Guest Read-Only Demonstration Banner */}
      {currentRole === 'GUEST' && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 text-white px-4 py-2 flex items-center justify-between text-xs font-bold border-b border-purple-500/30 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span>👁️ Guest Demo Mode (Read-Only) — Viewing as: <strong>{currentUser?.name}</strong></span>
          </div>
          <button
            onClick={logout}
            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-bold shadow transition-all active:scale-95"
          >
            🔒 Switch to Admin / Staff Login
          </button>
        </div>
      )}

      {/* Mobile Install Quick Banner on Phones */}
      <div className="md:hidden bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2 flex items-center justify-between text-xs font-bold shadow-sm">
        <div className="flex items-center gap-2">
          <Smartphone size={16} />
          <span>Install TASK-VAANI on Phone</span>
        </div>
        <button
          onClick={() => setIsInstallModalOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-slate-950 text-white text-[11px] font-bold shadow"
        >
          Open Guide
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex w-full pb-20 md:pb-6">
        
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content Viewport */}
        <main className="flex-1 p-3.5 sm:p-4 md:p-6 lg:p-8 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              onOpenTaskModal={(task) => setSelectedTask(task)}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'tasks' && (
            <TaskMatrixGrid
              onOpenCreateTask={() => setSelectedTask('NEW')}
              onOpenEditTask={(task) => setSelectedTask(task)}
            />
          )}

          {activeTab === 'attendance' && <AuditLogViewer />}
          {activeTab === 'clients' && <ClientMasterTable />}

          {activeTab === 'client-portal' && <ClientPortalView />}

          {activeTab === 'team' && <TeamMasterTable />}

          {activeTab === 'documents' && <DocumentVault />}

          {activeTab === 'extra-work' && <ExtraWorkTracker />}

          {activeTab === 'audit' && <AuditLogViewer />}

          {activeTab === 'ai-bot' && <CACompliBot onNavigateTab={setActiveTab} />}

          {activeTab === 'settings' && <FirmSettingsModal />}
        </main>
      </div>

      {/* Mobile Native App Bottom Tab Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
      />

      {/* Modals */}
      <RoleSelectorModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />

      <InstallPWAModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {selectedTask && (
        <TaskModal
          isOpen={true}
          task={selectedTask === 'NEW' ? null : selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <AlarmModal1030 />

    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TaskProvider>
            <NotificationProvider>
              <MainPortal />
            </NotificationProvider>
          </TaskProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
