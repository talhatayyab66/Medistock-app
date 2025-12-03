
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Medicine, Sale, User, UserRole } from '../types';

const PROJECT_URL = 'https://sjypaudnotjqjhbvzjeb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeXBhdWRub3RqcWpoYnZ6amViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MjczODgsImV4cCI6MjA4MDMwMzM4OH0.t9S8456gqXnNLaEGbAL5jPZpobxRnQQ6BPSJKIsTee4';

export const supabase: SupabaseClient = createClient(PROJECT_URL, ANON_KEY);

export const STORAGE_KEYS = {
  USER: 'medistock_user',
};

// Internal domain for mapping usernames to email format required by Supabase
const DUMMY_DOMAIN = 'medistock.local';

const getEmailFromUsername = (username: string) => {
  // Remove spaces and special chars to be safe
  const cleanUsername = username.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${cleanUsername}@${DUMMY_DOMAIN}`;
};

// --- Auth Services ---

export const authService = {
  async signUp(username: string, password: string, clinicName: string) {
    const email = getEmailFromUsername(username);

    // 1. Sign up the user with dummy email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          clinic_name: clinicName,
          username: username,
        }
      }
    });

    if (authError) throw authError;

    // 2. Attempt to create profile record immediately.
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: email, // Storing internal email for reference
            clinic_name: clinicName,
            role: 'ADMIN', // Default to Admin on signup
            currency: 'USD',
            created_at: new Date().toISOString()
          }
        ]);
        
      if (profileError) {
        console.warn("Profile creation during signup pending:", profileError.message);
      }
    }

    return authData;
  },

  async login(username: string, password: string) {
    const email = getEmailFromUsername(username);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // Improve error message for end users
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Incorrect username or password');
      }
      throw error;
    }
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};

// --- Data Services ---

export const dbService = {
  async getUserProfile(userId: string): Promise<User | null> {
    // 1. Try to fetch existing profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      // Extract username from dummy email if not stored in metadata (fallback)
      const usernameFromEmail = data.email ? data.email.split('@')[0] : 'User';
      
      return {
        id: data.id,
        username: usernameFromEmail,
        role: data.role as UserRole,
        clinicName: data.clinic_name,
        logoUrl: data.logo_url,
        currency: data.currency || 'USD'
      };
    }

    // 2. Self-Healing: Create profile if missing
    console.log("Profile not found. Attempting self-healing...");
    const { data: { user } } = await supabase.auth.getUser();

    if (user && user.id === userId) {
      const clinicName = user.user_metadata?.clinic_name || 'My Clinic';
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'admin';
      
      const newProfile = {
        id: userId,
        email: user.email,
        clinic_name: clinicName,
        role: 'ADMIN',
        currency: 'USD',
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile]);

      if (!insertError) {
        return {
          id: userId,
          username: username,
          role: UserRole.ADMIN,
          clinicName: clinicName,
          logoUrl: '',
          currency: 'USD'
        };
      } else {
        console.error("Self-healing failed:", insertError);
      }
    }

    return null;
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
      user_id: userId,
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
