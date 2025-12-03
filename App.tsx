import React, { useState, useEffect } from 'react';
import { User, UserRole, Medicine, Sale, CartItem } from './types';
import { authService, dbService, supabase } from './services/supabaseClient';
import { generateMedicineDescription, analyzeSalesTrends } from './services/geminiService';
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
  ClipboardList,
  User as UserIcon,
  ChevronLeft
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Sidebar ---
const Sidebar = ({ user, currentView, onViewChange, onLogout }: { 
  user: User, 
  currentView: string, 
  onViewChange: (view: string) => void,
  onLogout: () => void 
}) => {
  return (
    <div className="w-64 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-20 shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          {user.logoUrl ? (
            <img src={user.logoUrl} alt="Logo" className="w-8 h-8 rounded bg-white object-contain" />
          ) : (
            <Building2 className="text-teal-400 w-8 h-8" />
          )}
          <h1 className="font-bold text-lg leading-tight truncate">{user.clinicName || 'MediStock'}</h1>
        </div>
        <div className="text-xs text-slate-400 capitalize flex items-center gap-1">
            <UserIcon size={10} />
            {user.role.toLowerCase()} Account
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {user.role === UserRole.ADMIN && (
          <button 
            onClick={() => onViewChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
        )}
        
        <button 
          onClick={() => onViewChange('inventory')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'inventory' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          <Pill size={20} />
          Inventory
        </button>

        <button 
          onClick={() => onViewChange('pos')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'pos' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          <ShoppingCart size={20} />
          Point of Sale
        </button>

        {user.role === UserRole.ADMIN && (
          <>
            <button 
              onClick={() => onViewChange('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'sales' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <ClipboardList size={20} />
              Sales History
            </button>

            <button 
              onClick={() => onViewChange('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800'}`}
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

// --- Inventory View ---
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
        id: editingItem ? editingItem.id : crypto.randomUUID(), 
        name: formData.name,
        description: formData.description || '',
        batchNumber: formData.batchNumber || 'N/A',
        expiryDate: formData.expiryDate || new Date().toISOString().split('T')[0],
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        minStockLevel: Number(formData.minStockLevel) || 10
      };

      const savedItem = await dbService.upsertMedicine(newItemData, user.id);

      let newInventory = [...inventory];
      if (editingItem) {
        newInventory = newInventory.map(item => item.id === savedItem.id ? savedItem : item);
      } else {
        newInventory.unshift(savedItem);
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
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Trash2 className="rotate-45" size={24} /> 
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex gap-2 items-end">
                <Input 
                  label="Medicine Name" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Amoxicillin"
                />
                <Button type="button" onClick={handleGenerateDesc} disabled={isGenerating || !formData.name} className="mb-[2px]">
                  {isGenerating ? '...' : <Sparkles size={18} />}
                </Button>
              </div>
              
              <Input 
                label="Description" 
                value={formData.description || ''} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="Auto-generated by AI"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Batch Number" 
                  value={formData.batchNumber || ''} 
                  onChange={e => setFormData({...formData, batchNumber: e.target.value})} 
                />
                <Input 
                  label="Expiry Date" 
                  type="date"
                  value={formData.expiryDate || ''} 
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Quantity" 
                  type="number"
                  value={formData.quantity || ''} 
                  onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} 
                />
                <Input 
                  label="Price" 
                  type="number"
                  step="0.01"
                  value={formData.price || ''} 
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                />
              </div>
              
               <Input 
                  label="Min Stock Level" 
                  type="number"
                  value={formData.minStockLevel || ''} 
                  onChange={e => setFormData({...formData, minStockLevel: Number(e.target.value)})} 
                />
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isLoading}>{editingItem ? 'Update' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- POS View ---
const POSView = ({ user, inventory, onRecordSale }: { user: User, inventory: Medicine[], onRecordSale: (sale: Sale) => void }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const addToCart = (medicine: Medicine) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === medicine.id);
      if (existing) {
        return prev.map(item => item.id === medicine.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...medicine, cartQuantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.cartQuantity + delta);
        if (newQty > item.quantity) return item; // Stock limit
        return { ...item, cartQuantity: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    const sale: Sale = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      totalAmount: total,
      salesPerson: user.username,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.cartQuantity,
        price: item.price,
        subtotal: item.price * item.cartQuantity
      }))
    };

    try {
      // Record Sale
      await dbService.recordSale(sale, user.id);

      // Update Inventory
      for (const item of cart) {
        const originalItem = inventory.find(i => i.id === item.id);
        if (originalItem) {
          const updatedItem = { ...originalItem, quantity: originalItem.quantity - item.cartQuantity };
          await dbService.upsertMedicine(updatedItem, user.id);
        }
      }

      onRecordSale(sale);
      
      // Generate Invoice PDF
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(user.clinicName, 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text("Invoice", 105, 25, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 35);
      doc.text(`Salesperson: ${user.username}`, 14, 42);

      const tableData = cart.map(item => [
        item.name,
        item.cartQuantity.toString(),
        `${user.currency} ${item.price.toFixed(2)}`,
        `${user.currency} ${(item.price * item.cartQuantity).toFixed(2)}`
      ]);

      (doc as any).autoTable({
        startY: 50,
        head: [['Item', 'Qty', 'Price', 'Subtotal']],
        body: tableData,
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.text(`Total: ${user.currency} ${total.toFixed(2)}`, 14, finalY);
      doc.save(`invoice_${sale.id.slice(0, 8)}.pdf`);

      setCart([]);
      alert("Sale processed successfully!");
    } catch (err) {
      console.error(err);
      alert("Checkout failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) && item.quantity > 0
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Point of Sale</h2>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search medicine..." 
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredInventory.map(item => (
            <div key={item.id} 
              onClick={() => addToCart(item)}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-teal-500 transition-all hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                <div className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded">{user.currency}{item.price}</div>
              </div>
              <div className="text-xs text-slate-500 mb-2">{item.description || 'No description'}</div>
              <div className="text-xs text-slate-400">Stock: {item.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-10">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Current Order</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm text-slate-800">{item.name}</div>
                <div className="text-xs text-slate-500">{user.currency} {item.price} x {item.cartQuantity}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 rounded bg-white border flex items-center justify-center text-slate-600 hover:bg-slate-100">-</button>
                <span className="text-sm w-4 text-center">{item.cartQuantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 rounded bg-white border flex items-center justify-center text-slate-600 hover:bg-slate-100">+</button>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && <div className="text-center text-slate-400 mt-10">Cart is empty</div>}
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between text-lg font-bold text-slate-800 mb-4">
            <span>Total</span>
            <span>{user.currency} {total.toFixed(2)}</span>
          </div>
          <Button className="w-full py-3 text-lg" onClick={handleCheckout} disabled={isProcessing || cart.length === 0}>
            {isProcessing ? 'Processing...' : 'Checkout'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Sales History View ---
const SalesHistoryView = ({ sales, user }: { sales: Sale[], user: User }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const dataSummary = JSON.stringify(sales.slice(0, 10).map(s => ({ date: s.date, total: s.totalAmount, items: s.items.length })));
    const analysis = await analyzeSalesTrends(dataSummary);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Sales History</h2>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} variant="secondary">
          <Sparkles size={16} className={isAnalyzing ? "animate-spin" : ""} />
          {isAnalyzing ? "Analyzing..." : "AI Analysis"}
        </Button>
      </div>

      {aiAnalysis && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6 text-indigo-900 text-sm whitespace-pre-wrap">
          <h4 className="font-bold flex items-center gap-2 mb-2"><Sparkles size={16} /> AI Insights</h4>
          {aiAnalysis}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Salesperson</th>
              <th className="px-6 py-4">Items</th>
              <th className="px-6 py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map(sale => (
              <tr key={sale.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">{new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString()}</td>
                <td className="px-6 py-4">{sale.salesPerson}</td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate text-xs text-slate-500">
                    {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-900">{user.currency} {sale.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Settings View ---
const SettingsView = ({ user, onUpdateSettings }: { user: User, onUpdateSettings: (u: User) => void }) => {
  const [formData, setFormData] = useState({
    clinicName: user.clinicName,
    currency: user.currency,
    logoUrl: user.logoUrl || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await dbService.updateProfile(user.id, formData);
      onUpdateSettings({ ...user, ...formData });
      alert("Settings updated!");
    } catch (e) {
      alert("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Clinic Settings</h2>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <Input 
          label="Clinic Name" 
          value={formData.clinicName} 
          onChange={e => setFormData({...formData, clinicName: e.target.value})} 
        />
        
        <div className="grid grid-cols-2 gap-4">
          <div>
             <label className="text-sm font-medium text-slate-700 mb-1 block">Currency</label>
             <select 
               className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
               value={formData.currency}
               onChange={e => setFormData({...formData, currency: e.target.value})}
             >
               <option value="USD">USD ($)</option>
               <option value="EUR">EUR (€)</option>
               <option value="GBP">GBP (£)</option>
               <option value="INR">INR (₹)</option>
               <option value="PKR">PKR (Rs)</option>
             </select>
          </div>
        </div>

        <Input 
          label="Logo URL" 
          value={formData.logoUrl} 
          onChange={e => setFormData({...formData, logoUrl: e.target.value})} 
          placeholder="https://example.com/logo.png"
        />

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard View ---
const DashboardView = ({ inventory, sales, user }: { inventory: Medicine[], sales: Sale[], user: User }) => {
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const lowStockCount = inventory.filter(i => i.quantity <= i.minStockLevel).length;
  const totalItems = inventory.length;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-slate-500 text-sm font-medium mb-1">Total Revenue</div>
           <div className="text-3xl font-bold text-slate-800">{user.currency} {totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-slate-500 text-sm font-medium mb-1">Medicines in Stock</div>
           <div className="text-3xl font-bold text-slate-800">{totalItems}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="text-slate-500 text-sm font-medium mb-1">Low Stock Alerts</div>
           <div className="text-3xl font-bold text-red-600 flex items-center gap-2">
             {lowStockCount}
             {lowStockCount > 0 && <AlertCircle size={24} />}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Recent Sales</h3>
          <div className="space-y-3">
            {sales.slice(0, 5).map(sale => (
              <div key={sale.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="font-medium text-slate-800">{sale.salesPerson}</div>
                  <div className="text-xs text-slate-500">{new Date(sale.date).toLocaleDateString()}</div>
                </div>
                <div className="font-bold text-teal-600">{user.currency} {sale.totalAmount.toFixed(2)}</div>
              </div>
            ))}
             {sales.length === 0 && <div className="text-slate-400 text-center py-4">No sales recorded yet.</div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4 text-red-600">Low Stock Alert</h3>
          <div className="space-y-3">
             {inventory.filter(i => i.quantity <= i.minStockLevel).slice(0, 5).map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <div className="font-medium text-slate-800">{item.name}</div>
                  <div className="font-bold text-red-500">{item.quantity} left</div>
                </div>
             ))}
             {lowStockCount === 0 && <div className="text-slate-400 text-center py-4 text-green-600">All stock levels are healthy.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authStep, setAuthStep] = useState<'login' | 'signup' | 'forgot-password' | 'verify'>('login');
  const [view, setView] = useState('inventory');
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');

  // Initial Data Load
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadUserData(session.user.id);
    } else {
      setLoading(false);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const profile = await dbService.getUserProfile(userId);
      if (profile) {
        setUser(profile);
        const inv = await dbService.fetchInventory();
        const salesData = await dbService.fetchSales();
        setInventory(inv);
        setSales(salesData);
      } else {
        // If profile not found even after self-healing attempt in getUserProfile
        console.error("Critical: Profile still missing after self-heal.");
        await authService.logout();
        setError("Account setup incomplete. Please contact support.");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      if (data.user) {
        await loadUserData(data.user.id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const authData = await authService.signUp(email, password, clinicName);
      if (authData.user && !authData.session) {
         // Needs verification
         setAuthStep('verify');
         setLoading(false);
      } else if (authData.user) {
         // Auto logged in
         await loadUserData(authData.user.id);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.verifyOtp(email, otpCode);
      if (data.user || data.session) {
        const userId = data.user?.id || data.session?.user.id;
        if (userId) {
          // If profile wasn't created during signup trigger, create it now? 
          // We handled profile creation in signUp service, assuming it succeeded.
          await loadUserData(userId);
        } else {
           // Fallback to login
           setAuthStep('login');
           alert("Verification successful. Please login.");
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword(email);
      alert('Password reset link sent to your email.');
      setAuthStep('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setAuthStep('login');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="text-teal-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">MediStock Manager</h1>
            <p className="text-slate-500 text-sm mt-2">Clinic Inventory & Sales System</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {authStep === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center mb-4">
                 <p className="text-sm text-slate-600">We sent a code to <span className="font-semibold">{email}</span></p>
              </div>
              <Input 
                label="Verification Code" 
                placeholder="123456" 
                value={otpCode} 
                onChange={e => setOtpCode(e.target.value)} 
                required 
              />
              <Button type="submit" className="w-full" isLoading={loading}>Verify Email</Button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setAuthStep('login')} className="text-teal-600 text-sm hover:underline">Back to Login</button>
              </div>
            </form>
          )}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input 
                label="Email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <Input 
                label="Password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <div className="text-right">
                <button type="button" onClick={() => setAuthStep('forgot-password')} className="text-sm text-teal-600 hover:underline">Forgot Password?</button>
              </div>
              <Button type="submit" className="w-full" isLoading={loading}>Login</Button>
              <div className="text-center mt-4 text-sm text-slate-600">
                Don't have an account? <button type="button" onClick={() => setAuthStep('signup')} className="text-teal-600 font-semibold hover:underline">Sign up</button>
              </div>
            </form>
          )}

          {authStep === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input 
                label="Clinic/Pharmacy Name" 
                value={clinicName} 
                onChange={e => setClinicName(e.target.value)} 
                required 
              />
              <Input 
                label="Email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <Input 
                label="Password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <Button type="submit" className="w-full" isLoading={loading}>Create Account</Button>
              <div className="text-center mt-4 text-sm text-slate-600">
                Already have an account? <button type="button" onClick={() => setAuthStep('login')} className="text-teal-600 font-semibold hover:underline">Login</button>
              </div>
            </form>
          )}

          {authStep === 'forgot-password' && (
             <form onSubmit={handleForgot} className="space-y-4">
               <div className="flex items-center gap-2 mb-2 cursor-pointer" onClick={() => setAuthStep('login')}>
                  <ChevronLeft size={16} className="text-slate-500"/>
                  <span className="text-sm text-slate-500">Back</span>
               </div>
               <Input 
                 label="Enter your email" 
                 type="email" 
                 value={email} 
                 onChange={e => setEmail(e.target.value)} 
                 required 
               />
               <Button type="submit" className="w-full" isLoading={loading}>Reset Password</Button>
             </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-100 min-h-screen">
      <Sidebar 
        user={user} 
        currentView={view} 
        onViewChange={setView} 
        onLogout={handleLogout} 
      />
      <main className="flex-1 ml-64 p-6 overflow-hidden">
        {view === 'inventory' && (
          <InventoryView 
            user={user} 
            inventory={inventory} 
            onUpdateInventory={(newInv) => {
              setInventory(newInv);
              dbService.fetchInventory().then(setInventory);
            }} 
          />
        )}
        {view === 'pos' && (
          <POSView 
            user={user} 
            inventory={inventory} 
            onRecordSale={async (newSale) => {
               setSales([newSale, ...sales]);
               const inv = await dbService.fetchInventory();
               setInventory(inv);
            }} 
          />
        )}
        {view === 'dashboard' && <DashboardView user={user} inventory={inventory} sales={sales} />}
        {view === 'sales' && <SalesHistoryView user={user} sales={sales} />}
        {view === 'settings' && <SettingsView user={user} onUpdateSettings={setUser} />}
      </main>
    </div>
  );
}