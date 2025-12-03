import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Medicine, Sale, User, UserRole } from '../types';

const PROJECT_URL = 'https://sjypaudnotjqjhbvzjeb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeXBhdWRub3RqcWpoYnZ6amViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MjczODgsImV4cCI6MjA4MDMwMzM4OH0.t9S8456gqXnNLaEGbAL5jPZpobxRnQQ6BPSJKIsTee4';

export const supabase: SupabaseClient = createClient(PROJECT_URL, ANON_KEY);

export const STORAGE_KEYS = {
  USER: 'medistock_user',
};

// --- Auth Services ---

export const authService = {
  async signUp(email: string, password: string, clinicName: string) {
    // 1. Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          clinic_name: clinicName, // Store metadata
        }
      }
    });

    if (authError) throw authError;

    // 2. Create a profile record if user creation was successful and we have an ID
    // Note: In a real app with triggers, this might happen automatically on the DB side.
    // We do it here manually for the frontend-drive approach.
    if (authData.user && !authData.session) {
      // Email verification required, profile creation might need to wait or happen now
      // We will try to create it now.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: email,
            clinic_name: clinicName,
            role: 'ADMIN', // Default to Admin on signup
            currency: 'USD',
            created_at: new Date().toISOString()
          }
        ]);
        
      if (profileError) {
        console.error("Profile creation failed (might rely on DB trigger):", profileError);
      }
    }

    return authData;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // handle redirect loop if needed
    });
    if (error) throw error;
  }
};

// --- Data Services ---

export const dbService = {
  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    // Map DB fields to User interface
    return {
      id: data.id,
      username: data.email?.split('@')[0] || 'User',
      email: data.email,
      role: data.role as UserRole,
      clinicName: data.clinic_name,
      logoUrl: data.logo_url,
      currency: data.currency || 'USD'
    };
  },

  async updateProfile(userId: string, updates: Partial<User>) {
    // Map User interface back to DB columns
    const dbUpdates: any = {};
    if (updates.clinicName) dbUpdates.clinic_name = updates.clinicName;
    if (updates.currency) dbUpdates.currency = updates.currency;
    if (updates.logoUrl) dbUpdates.logo_url = updates.logoUrl;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) throw error;
  },

  async fetchInventory() {
    // RLS policies on Supabase should filter this by user_id/clinic_id automatically
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map snake_case to camelCase
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      batchNumber: item.batch_number,
      expiryDate: item.expiry_date,
      quantity: item.quantity,
      price: item.price,
      minStockLevel: item.min_stock_level
    })) as Medicine[];
  },

  async upsertMedicine(medicine: Medicine, userId: string) {
    const payload = {
      id: medicine.id.includes('-') ? medicine.id : undefined, // Let DB generate ID if it's new/temp
      user_id: userId, // associate with current user/clinic
      name: medicine.name,
      description: medicine.description,
      batch_number: medicine.batchNumber,
      expiry_date: medicine.expiryDate,
      quantity: medicine.quantity,
      price: medicine.price,
      min_stock_level: medicine.minStockLevel
    };

    const { data, error } = await supabase
      .from('medicines')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    
    // Return mapped object
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      batchNumber: data.batch_number,
      expiryDate: data.expiry_date,
      quantity: data.quantity,
      price: data.price,
      minStockLevel: data.min_stock_level
    } as Medicine;
  },

  async deleteMedicine(id: string) {
    const { error } = await supabase
      .from('medicines')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async fetchSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    return data.map((item: any) => ({
      id: item.id,
      date: item.date,
      totalAmount: item.total_amount,
      salesPerson: item.sales_person,
      items: item.items
    })) as Sale[];
  },

  async recordSale(sale: Sale, userId: string) {
    const { error } = await supabase
      .from('sales')
      .insert([{
        user_id: userId,
        date: sale.date,
        total_amount: sale.totalAmount,
        sales_person: sale.salesPerson,
        items: sale.items
      }]);

    if (error) throw error;
  }
};