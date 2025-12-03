export enum UserRole {
  ADMIN = 'ADMIN',
  SALES = 'SALES'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  clinicName: string;
  email?: string; // For verification flow
  logoUrl?: string;
  currency: string;
}

export interface Medicine {
  id: string;
  name: string;
  description: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  price: number;
  minStockLevel: number;
}

export interface CartItem extends Medicine {
  cartQuantity: number;
}

export interface Sale {
  id: string;
  date: string; // ISO string
  totalAmount: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  salesPerson: string;
}

export interface ClinicSettings {
  currency: string;
  logoUrl: string;
  name: string;
  address: string;
  phone: string;
}
