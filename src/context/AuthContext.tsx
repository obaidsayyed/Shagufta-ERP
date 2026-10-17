import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffProfile, StaffRole } from '../types/database';
import { api } from '../lib/api';
import { mockDb } from '../lib/mockDatabase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentStaff: StaffProfile | null;
  role: StaffRole | null;
  isAuthenticated: boolean;
  loginAsStaff: (staffId: string) => Promise<boolean>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshStaff: () => Promise<void>;
  availableStaffList: StaffProfile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [availableStaffList, setAvailableStaffList] = useState<StaffProfile[]>([]);

  const refreshStaff = async () => {
    const list = await api.getAllStaffProfiles();
    setAvailableStaffList(list);

    // If current staff got disabled, immediately force logout
    if (currentStaff) {
      const updated = list.find((s) => s.id === currentStaff.id);
      if (!updated || !updated.is_active) {
        setCurrentStaff(null);
        localStorage.removeItem('hotel_erp_active_staff_id');
      } else {
        setCurrentStaff(updated);
      }
    }
  };

  useEffect(() => {
    refreshStaff();

    // Check if staff was previously selected in localStorage
    const savedStaffId = localStorage.getItem('hotel_erp_active_staff_id');
    if (savedStaffId) {
      const all = mockDb.getStaffProfiles();
      const match = all.find((s) => s.staff_id === savedStaffId && s.is_active);
      if (match) {
        setCurrentStaff(match);
      }
    } else {
      // Default initial staff for development ease
      const all = mockDb.getStaffProfiles();
      const admin = all.find((s) => s.role === 'admin' && s.is_active);
      if (admin) {
        setCurrentStaff(admin);
        localStorage.setItem('hotel_erp_active_staff_id', admin.staff_id);
      }
    }

    // Subscribe to staff updates
    const unsubscribe = mockDb.subscribe((event) => {
      if (event === 'STAFF_UPDATED') {
        refreshStaff();
      }
    });

    return () => unsubscribe();
  }, []);

  const loginAsStaff = async (staffId: string): Promise<boolean> => {
    const all = await api.getAllStaffProfiles();
    const target = all.find((s) => s.staff_id.toUpperCase() === staffId.trim().toUpperCase());

    if (!target) {
      throw new Error(`Staff ID "${staffId}" not found.`);
    }

    if (!target.is_active) {
      throw new Error(`Staff account "${target.display_name}" is disabled. Contact Counter Admin.`);
    }

    setCurrentStaff(target);
    localStorage.setItem('hotel_erp_active_staff_id', target.staff_id);
    return true;
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (api.isLiveSupabase() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error || !data.user) {
        return { success: false, error: error?.message || 'Login failed' };
      }
      const profile = await api.getCurrentStaffProfile(data.user.id);
      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        return { success: false, error: 'Account is disabled or profile does not exist.' };
      }
      setCurrentStaff(profile);
      localStorage.setItem('hotel_erp_active_staff_id', profile.staff_id);
      return { success: true };
    }

    // In mock mode: match email to sample staff
    const lowerEmail = email.toLowerCase().trim();
    const all = mockDb.getStaffProfiles();
    let match: StaffProfile | undefined;

    if (lowerEmail.includes('admin')) {
      match = all.find((s) => s.role === 'admin');
    } else if (lowerEmail.includes('waiter')) {
      match = all.find((s) => s.role === 'waiter');
    } else if (lowerEmail.includes('chef')) {
      match = all.find((s) => s.role === 'chef');
    } else {
      match = all.find((s) => s.is_active);
    }

    if (match) {
      if (!match.is_active) {
        return { success: false, error: 'Staff account is disabled.' };
      }
      setCurrentStaff(match);
      localStorage.setItem('hotel_erp_active_staff_id', match.staff_id);
      return { success: true };
    }

    return { success: false, error: 'Invalid credentials' };
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
        loginAsStaff,
        loginWithEmail,
        logout,
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
