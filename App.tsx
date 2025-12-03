import React, { useState, useEffect } from 'react';
import { User, UserRole, Medicine, Sale, CartItem } from './types';
import { authService, dbService, supabase } from './services/supabaseClient';
import { generateMedicineDescription } from './services/geminiService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { 
  LayoutDashboard, 
  Pill, 
  ShoppingCart, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Search, 
  FileText,
  Building2,
  Sparkles,
  Edit2,
  AlertCircle,
  ClipboardList
} from 'lucide-react';

// 1. Sidebar Component
const Sidebar = ({ user, currentView, onViewChange, onLogout }: { 
  user: User, 
  currentView: string, 
  onViewChange: (view: string) => void,
  onLogout: () => void 
}) => {
  return (
    <div className="w-64 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-20">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          {user.logoUrl ? (
            <img src={user.logoUrl} alt="Logo" className="w-8 h-8 rounded bg-white object-contain" />
          ) : (
            <Building2 className="text-teal-400 w-8 h-8" />
          )}
          <h1 className="font-bold text-lg leading-tight truncate">{user.clinicName || 'MediStock'}</h1>
        </div>
        <div className="text-xs text-slate-400 capitalize">{user.role.toLowerCase()} Account</div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {user.role === UserRole.ADMIN && (
          <button 
            onClick={() => onViewChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
        )}
        
        <button 
          onClick={() => onViewChange('inventory')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'inventory' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          <Pill size={20} />
          Inventory
        </button>

        <button 
          onClick={() => onViewChange('pos')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'pos' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          <ShoppingCart size={20} />
          Point of Sale
        </button>

        {user.role === UserRole.ADMIN && (
          <>
            <button 
              onClick={() => onViewChange('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'sales' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <ClipboardList size={20} />
              Sales History
            </button>

            <button 
              onClick={() => onViewChange('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Settings size={20} />
              Settings
            </button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
};

// 2. Inventory Component
const InventoryView = ({ user, inventory, onUpdateInventory }: { user: User, inventory: Medicine[], onUpdateInventory: (items: Medicine[]) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medicine | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Medicine>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateDesc = async () => {
    if (!formData.name) return;
    setIsGenerating(true);
    const desc = await generateMedicineDescription(formData.name);
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.quantity) return;
    setIsLoading(true);

    try {
      const newItemData: Medicine = {
        id: editingItem ? editingItem.id : crypto.randomUUID(), // Temp ID if new
        name: formData.name,
        description: formData.description || '',
        batchNumber: formData.batchNumber || 'N/A',
        expiryDate: formData.expiryDate || new Date().toISOString().split('T')[0],
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        minStockLevel: Number(formData.minStockLevel) || 10
      };

      // Upsert to Supabase
      const savedItem = await dbService.upsertMedicine(newItemData, user.id);

      let newInventory = [...inventory];
      if (editingItem) {
        newInventory = newInventory.map(item => item.id === savedItem.id ? savedItem : item);
      } else {
        newInventory.unshift(savedItem); // Add to top
      }
      
      onUpdateInventory(newInventory);
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({});
    } catch (err) {
      alert("Failed to save medicine. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await dbService.deleteMedicine(id);
        onUpdateInventory(inventory.filter(i => i.id !== id));
      } catch (err) {
        alert("Failed to delete item.");
      }
    }
  };

  const filteredItems = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
        {user.role === UserRole.ADMIN && (
          <Button onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }}>
            <Plus size={18} /> Add Medicine
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search items..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Medicine Name</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4 text-right">Stock</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-center">Status</th>
                {user.role === UserRole.ADMIN && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div>{item.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px]">{item.description}</div>
                  </td>
                  <td className="px-6 py-4">{item.batchNumber}</td>
                  <td className="px-6 py-4">{item.expiryDate}</td>
                  <td className={`px-6 py-4 text-right font-medium ${item.quantity <= item.minStockLevel ? 'text-red-500' : ''}`}>
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-right">{user.currency} {item.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.quantity > item.minStockLevel ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.quantity > item.minStockLevel ? 'In Stock' : 'Low Stock'}
                    </span>
                  </td>
                  {user.role === UserRole.ADMIN && (
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-1 text-slate-500 hover:text-teal-600">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-500 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredItems.length === 0 && (
                 <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">No medicines found.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200">
