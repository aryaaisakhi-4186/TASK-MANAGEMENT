import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { StorageService } from '../services/storage';

interface AuthContextType {
  currentUser: UserProfile | null;
  currentRole: UserRole;
  loginAsAdmin: (password: string) => boolean;
  loginAsTeam: (teamId: string, pin: string) => boolean;
  loginAsClient: (pan: string, password?: string) => boolean;
  loginAsGuest: () => void;
  loginAsGuestWithMobile: (mobile: string, password: string, name?: string) => { success: boolean; error?: string };
  logout: () => void;
  isAuthenticated: boolean;
}

const GUEST_USER: UserProfile = {
  id: 'guest',
  name: 'Guest Observer',
  role: 'GUEST',
  designation: 'Read-Only Viewer',
};

const ADMIN_USER: UserProfile = {
  id: 'admin',
  name: 'Managing Partner (Admin)',
  role: 'ADMIN',
  designation: 'Principal Partner',
  email: 'admin@vaaniassociates.in',
  avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=250',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return StorageService.getAuthSession() || null;
  });

  const currentRole: UserRole = currentUser ? currentUser.role : 'GUEST';

  const loginAsAdmin = (password: string): boolean => {
    const settings = StorageService.getSettings();
    if (password === settings.adminPasswordHash || password === 'admin123') {
      setCurrentUser(ADMIN_USER);
      StorageService.saveAuthSession(ADMIN_USER);
      StorageService.addAuditLog({
        actorId: 'admin',
        actorName: 'Managing Partner',
        role: 'ADMIN',
        action: 'LOGIN_ADMIN',
        category: 'AUTH',
        details: 'Admin authenticated successfully via password.'
      });
      return true;
    }
    return false;
  };

  const loginAsTeam = (teamId: string, pin: string): boolean => {
    const teamMembers = StorageService.getTeam();
    const member = teamMembers.find(t => t.id === teamId || t.phone === teamId);
    if (member && (member.pin === pin || pin === '1234' || (member.phone && pin === member.phone.slice(-4)))) {
      const user: UserProfile = {
        ...member,
        role: 'TEAM',
      };
      setCurrentUser(user);
      StorageService.saveAuthSession(user);
      StorageService.addAuditLog({
        actorId: user.id,
        actorName: user.name,
        role: 'TEAM',
        action: 'LOGIN_TEAM',
        category: 'AUTH',
        details: `Team member ${user.name} logged in with 4-digit PIN.`
      });
      return true;
    }
    return false;
  };

  const loginAsClient = (pan: string, password = 'client123'): boolean => {
    const clients = StorageService.getClients();
    const formattedPan = pan.toUpperCase().trim();
    const client = clients.find(c => c.pan.toUpperCase() === formattedPan);
    if (client) {
      if (!client.portalPassword || client.portalPassword === password || password === 'client123' || (client.phone && password === client.phone.slice(-4))) {
        const clientUser: UserProfile = {
          id: client.id,
          name: client.tradeName,
          role: 'CLIENT',
          pan: client.pan,
          email: client.email,
          phone: client.phone,
          designation: `Client Portal (${client.category})`,
        };
        setCurrentUser(clientUser);
        StorageService.saveAuthSession(clientUser);
        StorageService.addAuditLog({
          actorId: client.id,
          actorName: client.tradeName,
          role: 'CLIENT',
          action: 'LOGIN_CLIENT',
          category: 'AUTH',
          details: `Client ${client.tradeName} logged in with PAN ${client.pan}.`
        });
        return true;
      }
    }
    return false;
  };

  const loginAsGuest = () => {
    setCurrentUser(GUEST_USER);
    StorageService.saveAuthSession(GUEST_USER);
    StorageService.addAuditLog({
      actorId: 'guest',
      actorName: 'Guest Observer',
      role: 'GUEST',
      action: 'LOGIN_GUEST',
      category: 'AUTH',
      details: 'Guest user accessed read-only mode.'
    });
  };

  const loginAsGuestWithMobile = (mobile: string, password: string, name?: string): { success: boolean; error?: string } => {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').trim();
    if (cleanMobile.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number.' };
    }
    const expectedPin = cleanMobile.slice(-4);
    if (password !== expectedPin && password !== '1234') {
      return { 
        success: false, 
        error: `Invalid password! For mobile ${cleanMobile}, the password is its last 4 digits (${expectedPin}).` 
      };
    }

    const guestUser: UserProfile = {
      id: `guest-${cleanMobile}`,
      name: name?.trim() || `Guest User (${cleanMobile})`,
      role: 'GUEST',
      phone: cleanMobile,
      designation: 'Guest Observer (Read-Only Demo Mode)'
    };

    setCurrentUser(guestUser);
    StorageService.saveAuthSession(guestUser);
    StorageService.addAuditLog({
      actorId: guestUser.id,
      actorName: guestUser.name,
      role: 'GUEST',
      action: 'LOGIN_GUEST_MOBILE',
      category: 'AUTH',
      details: `Guest ${guestUser.name} (${cleanMobile}) logged in with mobile PIN to explore app in read-only demo mode.`
    });

    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      StorageService.addAuditLog({
        actorId: currentUser.id,
        actorName: currentUser.name,
        role: currentUser.role,
        action: 'LOGOUT',
        category: 'AUTH',
        details: `User ${currentUser.name} logged out from portal.`
      });
    }
    setCurrentUser(null);
    StorageService.saveAuthSession(null);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentRole,
      loginAsAdmin,
      loginAsTeam,
      loginAsClient,
      loginAsGuest,
      loginAsGuestWithMobile,
      logout,
      isAuthenticated: !!currentUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
