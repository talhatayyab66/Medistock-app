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
  AlertCircle
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
          <button 
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <Settings size={20} />
            Settings
          </button>
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
              <h3 className="text-lg font-bold">{editingItem ? 'Edit Medicine' : 'Add New Medicine'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2 items-end">
                <Input 
                  label="Name" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Paracetamol 500mg"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="mb-[1px]" 
                  onClick={handleGenerateDesc}
                  disabled={isGenerating || !formData.name}
                  title="Generate description with AI"
                >
                  {isGenerating ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
                </Button>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Batch Number" 
                  value={formData.batchNumber || ''} 
                  onChange={e => setFormData({...formData, batchNumber: e.target.value})}
                />
                <Input 
                  type="date"
                  label="Expiry Date" 
                  value={formData.expiryDate || ''} 
                  onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <Input 
                  type="number"
                  label="Quantity" 
                  value={formData.quantity || ''} 
                  onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
                />
                 <Input 
                  type="number"
                  label="Price" 
                  value={formData.price || ''} 
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                />
                 <Input 
                  type="number"
                  label="Min Level" 
                  value={formData.minStockLevel || ''} 
                  onChange={e => setFormData({...formData, minStockLevel: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} isLoading={isLoading}>{editingItem ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. POS Component
const POSView = ({ user, inventory, onUpdateInventory, onRecordSale }: { 
  user: User, 
  inventory: Medicine[], 
  onUpdateInventory: (items: Medicine[]) => void,
  onRecordSale: (sale: Sale) => void 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredItems = inventory.filter(item => 
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
    item.quantity > 0
  );

  const addToCart = (item: Medicine) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      if (existing.cartQuantity < item.quantity) {
        setCart(cart.map(c => c.id === item.id ? { ...c, cartQuantity: c.cartQuantity + 1 } : c));
      }
    } else {
      setCart([...cart, { ...item, cartQuantity: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQty = c.cartQuantity + delta;
        if (newQty > 0 && newQty <= c.quantity) {
          return { ...c, cartQuantity: newQty };
        }
      }
      return c;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Prepare Sale Object
      const sale: Sale = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        totalAmount,
        salesPerson: user.username,
        items: cart.map(c => ({
          name: c.name,
          quantity: c.cartQuantity,
          price: c.price,
          subtotal: c.price * c.cartQuantity
        }))
      };

      // 2. Persist Sale
      await dbService.recordSale(sale, user.id);
      onRecordSale(sale);

      // 3. Update Inventory (Optimistic UI update + DB update)
      const newInventory = inventory.map(item => {
        const cartItem = cart.find(c => c.id === item.id);
        if (cartItem) {
          const newItem = { ...item, quantity: item.quantity - cartItem.cartQuantity };
          // Fire and forget update for performance, or handle individually
          dbService.upsertMedicine(newItem, user.id); 
          return newItem;
        }
        return item;
      });
      onUpdateInventory(newInventory);

      // 4. Generate PDF
      generatePDF(sale, user);

      // 5. Clear Cart
      setCart([]);
      alert('Sale successful! Invoice generated.');
    } catch (err) {
      alert("Checkout failed. Please check connection.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = (sale: Sale, user: User) => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(user.clinicName || 'Clinic Invoice', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(sale.date).toLocaleString()}`, 15, 30);
    doc.text(`Invoice ID: ${sale.id.slice(0, 8).toUpperCase()}`, 15, 35);
    doc.text(`Served by: ${sale.salesPerson}`, 15, 40);

    // Simple Table Header
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.text("Item", 15, y);
    doc.text("Qty", 100, y);
    doc.text("Price", 130, y);
    doc.text("Total", 160, y);
    
    doc.line(15, y + 2, 195, y + 2);
    
    y += 10;
    doc.setFont("helvetica", "normal");
    
    sale.items.forEach(item => {
      doc.text(item.name, 15, y);
      doc.text(item.quantity.toString(), 100, y);
      doc.text(`${user.currency} ${item.price.toFixed(2)}`, 130, y);
      doc.text(`${user.currency} ${item.subtotal.toFixed(2)}`, 160, y);
      y += 8;
    });

    doc.line(15, y, 195, y);
    y += 10;
    
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: ${user.currency} ${sale.totalAmount.toFixed(2)}`, 140, y);
    
    doc.save(`invoice_${sale.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="flex h-full">
      {/* Product List */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Point of Sale</h2>
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search medicines..." 
            className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => addToCart(item)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-800">{item.name}</h3>
                <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full">{user.currency} {item.price}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2 truncate">{item.description}</p>
              <div className="text-xs text-slate-400">Stock: {item.quantity} | Batch: {item.batchNumber}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart size={20} /> Current Sale
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">Cart is empty</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-slate-500">{user.currency} {item.price} x {item.cartQuantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-200 rounded">-</button>
                  <span className="text-sm font-bold w-4 text-center">{item.cartQuantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-200 rounded">+</button>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-1 hover:bg-red-50 rounded ml-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-between mb-4 text-lg font-bold">
            <span>Total</span>
            <span>{user.currency} {totalAmount.toFixed(2)}</span>
          </div>
          <Button 
            className="w-full py-3 text-lg" 
            disabled={cart.length === 0 || isProcessing} 
            isLoading={isProcessing}
            onClick={handleCheckout}
          >
            <FileText size={20} /> Process Payment
          </Button>
        </div>
      </div>
    </div>
  );
};

// 4. Main App
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('login'); // login, register, forgot, verify, dashboard, inventory, pos, settings
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  
  // Auth Form State
  const [authForm, setAuthForm] = useState({ email: '', password: '', clinicName: '', code: '' });
  const [authStep, setAuthStep] = useState<'login' | 'signup' | 'verify' | 'forgot'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Initial Auth Check
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const profile = await dbService.getUserProfile(data.session.user.id);
        if (profile) {
          setUser(profile);
          setCurrentView('inventory');
        } else {
            // Fallback if profile missing but auth exists
            await supabase.auth.signOut();
        }
      }
    };
    checkSession();
  }, []);

  // Fetch Data when User logs in
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        try {
          const [invData, salesData] = await Promise.all([
            dbService.fetchInventory(),
            dbService.fetchSales()
          ]);
          setInventory(invData);
          setSales(salesData);
        } catch (e) {
          console.error("Data load error:", e);
        }
      };
      loadData();
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const { user: authUser } = await authService.login(authForm.email, authForm.password);
      if (authUser) {
        const profile = await dbService.getUserProfile(authUser.id);
        if (profile) {
          setUser(profile);
          setCurrentView('inventory');
        } else {
          setAuthError("Profile not found. Please contact support.");
          await supabase.auth.signOut();
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      await authService.signUp(authForm.email, authForm.password, authForm.clinicName);
      setAuthStep('verify');
    } catch (err: any) {
      setAuthError(err.message || 'Signup failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      await authService.verifyOtp(authForm.email, authForm.code);
      // Auto login after verify
      await handleLogin(e);
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed');
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      await authService.resetPassword(authForm.email);
      alert('Password reset link sent to your email.');
      setAuthStep('login');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setInventory([]);
    setSales([]);
    setCurrentView('login');
    setAuthStep('login');
    setAuthForm({ email: '', password: '', clinicName: '', code: '' });
  };

  const handleClinicUpdate = async (settings: Partial<User>) => {
    if (user) {
      try {
        await dbService.updateProfile(user.id, settings);
        const updatedUser = { ...user, ...settings };
        setUser(updatedUser);
        alert('Settings updated!');
      } catch (err) {
        alert("Failed to update settings.");
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <Building2 className="w-12 h-12 text-teal-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-slate-800">MediStock Access</h1>
            <p className="text-slate-500 text-sm">Clinic Inventory Management</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {authError}
            </div>
          )}

          {authStep === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="Email" type="email" placeholder="admin@clinic.com" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
              <Input label="Password" type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required />
              <div className="flex justify-end">
                <button type="button" onClick={() => setAuthStep('forgot')} className="text-xs text-teal-600 hover:underline">Forgot password?</button>
              </div>
              <Button type="submit" className="w-full" isLoading={authLoading}>Sign In</Button>
              <div className="text-center text-sm text-slate-500 mt-4">
                Don't have an account? <button type="button" onClick={() => setAuthStep('signup')} className="text-teal-600 font-semibold">Sign Up</button>
              </div>
            </form>
          )}

          {authStep === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input label="Clinic Name" placeholder="My Clinic" value={authForm.clinicName} onChange={e => setAuthForm({...authForm, clinicName: e.target.value})} required />
              <Input label="Email" type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
              <Input label="Password" type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required />
              <Button type="submit" className="w-full" isLoading={authLoading}>Create Admin Account</Button>
              <div className="text-center text-sm text-slate-500 mt-4">
                Already have an account? <button type="button" onClick={() => setAuthStep('login')} className="text-teal-600 font-semibold">Login</button>
              </div>
            </form>
          )}

          {authStep === 'verify' && (
             <form onSubmit={handleVerify} className="space-y-4">
             <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4">
               An email code has been sent to {authForm.email}. Please enter it below.
             </div>
             <Input label="Verification Code" placeholder="e.g. 123456" value={authForm.code} onChange={e => setAuthForm({...authForm, code: e.target.value})} required />
             <Button type="submit" className="w-full" isLoading={authLoading}>Verify & Login</Button>
             <div className="text-center text-sm mt-2">
               <button type="button" onClick={() => setAuthStep('login')} className="text-slate-500">Back to Login</button>
             </div>
           </form>
          )}

          {authStep === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-sm text-slate-600 mb-2">Enter your email address and we'll send you a link to reset your password.</div>
              <Input label="Email" type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
              <Button type="submit" className="w-full" isLoading={authLoading}>Send Reset Link</Button>
              <div className="text-center text-sm mt-4">
                <button type="button" onClick={() => setAuthStep('login')} className="text-slate-500">Back to Login</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Settings Component (Inline to share state)
  const SettingsView = () => {
    const [localSettings, setLocalSettings] = useState({
      clinicName: user.clinicName,
      currency: user.currency,
      logoUrl: user.logoUrl || ''
    });

    return (
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Clinic Settings</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Input 
              label="Clinic Name" 
              value={localSettings.clinicName} 
              onChange={e => setLocalSettings({...localSettings, clinicName: e.target.value})} 
            />
            
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Currency</label>
              <select 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                value={localSettings.currency}
                onChange={e => setLocalSettings({...localSettings, currency: e.target.value})}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </div>

            <Input 
              label="Logo URL" 
              placeholder="https://example.com/logo.png"
              value={localSettings.logoUrl} 
              onChange={e => setLocalSettings({...localSettings, logoUrl: e.target.value})} 
            />
          </div>
          <Button onClick={() => handleClinicUpdate(localSettings)}>Save Changes</Button>
        </div>

        <div className="mt-8 bg-slate-100 text-slate-700 p-6 rounded-xl text-sm">
          <h3 className="font-bold text-slate-800 mb-2">Team Management</h3>
          <p className="mb-4">
            To add Sales Persons (Subusers), please create an account for them using the Signup page, or use the Supabase Dashboard to invite them with the role 'SALES'.
          </p>
          <div className="font-mono bg-white p-3 rounded mb-2 border border-slate-200">
            Your User ID: {user.id} <br/>
            Current Role: {user.role}
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const totalStock = inventory.reduce((acc, item) => acc + item.quantity, 0);
    const lowStockCount = inventory.filter(item => item.quantity <= item.minStockLevel).length;
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);

    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm font-medium mb-1">Total Revenue</div>
             <div className="text-3xl font-bold text-teal-600">{user.currency} {totalRevenue.toFixed(2)}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm font-medium mb-1">Total Items in Stock</div>
             <div className="text-3xl font-bold text-slate-800">{totalStock}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-sm font-medium mb-1">Low Stock Alerts</div>
             <div className="text-3xl font-bold text-red-500">{lowStockCount}</div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Sales</h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Sales Person</th>
                <th className="px-6 py-3">Items</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 5).map(sale => (
                <tr key={sale.id} className="border-t border-slate-100">
                  <td className="px-6 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="px-6 py-3">{sale.salesPerson}</td>
                  <td className="px-6 py-3">{sale.items.length} items</td>
                  <td className="px-6 py-3 text-right font-bold">{user.currency} {sale.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar user={user} currentView={currentView} onViewChange={setCurrentView} onLogout={handleLogout} />
      <main className="ml-64 flex-1 h-screen overflow-auto">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'inventory' && <InventoryView user={user} inventory={inventory} onUpdateInventory={setInventory} />}
        {currentView === 'pos' && <POSView user={user} inventory={inventory} onUpdateInventory={setInventory} onRecordSale={(sale) => setSales([sale, ...sales])} />}
        {currentView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
