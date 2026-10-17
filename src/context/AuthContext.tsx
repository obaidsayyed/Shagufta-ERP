import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffProfile, StaffRole } from '../types/database';
import { api } from '../lib/api';
import { mockDb } from '../lib/mockDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentStaff: StaffProfile | null;
  role: StaffRole | null;
  isAuthenticated: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfileAndName: (displayName: string, staffId: string) => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<void>;
  refreshStaff: () => Promise<void>;
  availableStaffList: StaffProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [availableStaffList, setAvailableStaffList] = useState<StaffProfile[]>([]);

  const refreshStaff = async () => {
    try {
      const list = await api.getAllStaffProfiles();
      setAvailableStaffList(list);

      if (currentStaff) {
        const updated = list.find((s) => s.id === currentStaff.id);
        if (!updated || !updated.is_active) {
          setCurrentStaff(null);
          localStorage.removeItem('hotel_erp_active_staff_id');
        } else {
          setCurrentStaff(updated);
        }
      }
    } catch {
      // Ignore if table empty
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (api.isLiveSupabase() && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await api.getCurrentStaffProfile(session.user.id);
          if (profile && profile.is_active) {
            setCurrentStaff(profile);
            localStorage.setItem('hotel_erp_active_staff_id', profile.staff_id);
          }
        }
      } else {
        // In local/mock mode: only restore if an active session was previously saved
        const savedStaffId = localStorage.getItem('hotel_erp_active_staff_id');
        if (savedStaffId) {
          const all = mockDb.getStaffProfiles();
          const match = all.find((s) => s.staff_id.toLowerCase() === savedStaffId.toLowerCase() && s.is_active);
          if (match) {
            setCurrentStaff(match);
          }
        }
      }
      await refreshStaff();
    };

    initAuth();

    const unsubscribe = mockDb.subscribe((event) => {
      if (event === 'STAFF_UPDATED') {
        refreshStaff();
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanId = identifier.trim();
    if (!cleanId || !pass) {
      return { success: false, error: 'Please enter both username and password' };
    }

    if (api.isLiveSupabase() && supabase) {
      // Normalize username to email if no @ present
      const emailToUse = cleanId.includes('@') ? cleanId.toLowerCase() : `${cleanId.toLowerCase()}@hotel.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: pass,
      });

      if (error || !data.user) {
        return { success: false, error: error?.message || 'Invalid username or password' };
      }

      const profile = await api.getCurrentStaffProfile(data.user.id);
      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        return { success: false, error: 'Staff account is disabled or unlinked. Contact Counter Admin.' };
      }

      setCurrentStaff(profile);
      localStorage.setItem('hotel_erp_active_staff_id', profile.staff_id);
      return { success: true };
    }

    // Mock environment login
    const all = mockDb.getStaffProfiles();
    const match = all.find(
      (s) => (s.staff_id.toLowerCase() === cleanId.toLowerCase() || s.display_name.toLowerCase() === cleanId.toLowerCase())
    );

    if (match) {
      if (!match.is_active) {
        return { success: false, error: 'Staff account is disabled.' };
      }
      setCurrentStaff(match);
      localStorage.setItem('hotel_erp_active_staff_id', match.staff_id);
      return { success: true };
    }

    // Support Admin123 default in mock mode
    if (cleanId.toLowerCase() === 'admin123' && pass === 'Admin@123') {
      let admin = all.find((s) => s.role === 'admin' && s.is_active);
      if (!admin) {
        admin = mockDb.createStaffProfile({
          staff_id: 'Admin123',
          display_name: 'Administrator',
          role: 'admin',
          caller_admin_id: 'SYSTEM',
        });
      }
      setCurrentStaff(admin);
      localStorage.setItem('hotel_erp_active_staff_id', admin.staff_id);
      return { success: true };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  const updateProfileAndName = async (displayName: string, staffId: string): Promise<void> => {
    if (!currentStaff) return;
    const res = await api.updateSelfProfile({
      display_name: displayName,
      staff_id: staffId,
      auth_user_id: currentStaff.auth_user_id,
    });

    setCurrentStaff({
      ...currentStaff,
      display_name: res.display_name,
      staff_id: res.staff_id,
    });
    localStorage.setItem('hotel_erp_active_staff_id', res.staff_id);
    await refreshStaff();
  };

  const updateUserPassword = async (newPassword: string): Promise<void> => {
    await api.updatePassword(newPassword);
  };

  const logout = () => {
    setCurrentStaff(null);
    localStorage.removeItem('hotel_erp_active_staff_id');
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentStaff,
        role: currentStaff?.role || null,
        isAuthenticated: !!currentStaff && currentStaff.is_active,
        login,
        logout,
        updateProfileAndName,
        updateUserPassword,
        refreshStaff,
        availableStaffList,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
