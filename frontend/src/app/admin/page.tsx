"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category_id?: number;
  stock?: number;
  sizes?: string;
};

type Category = {
  id: number;
  name: string;
  description?: string;
};

type RawAdminOrder = Record<string, unknown>;
type AdminView = 'overview' | 'products' | 'orders' | 'add';

function normalizeAdminOrder(order: RawAdminOrder): AdminOrder {
  const createdAt =
    typeof order['created_at'] === 'string'
      ? order['created_at']
      : typeof order['createdAt'] === 'string'
      ? order['createdAt']
      : new Date().toISOString();

  return {
    ...order,
    createdAt,
  } as AdminOrder;
}

const sizeOptions = ['s', 'm', 'l', 'xl', 'xxl'];
const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'eva-admin';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('overview');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((order) => {
      const status = order.status.toLowerCase();
      return status !== 'delivered' && status !== 'cancelled';
    }),
    [orders]
  );
  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() === 'pending'),
    [orders]
  );
  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders]
  );

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const [productsRes, categoriesRes, usersRes] = await Promise.all([
        fetch(`${apiUrl}/api/products`),
        fetch(`${apiUrl}/api/categories`),
        fetch(`${apiUrl}/api/users`),
      ]);

      if (!productsRes.ok || !categoriesRes.ok || !usersRes.ok) {
        const errors = [];
        if (!productsRes.ok) errors.push(`products (${productsRes.status})`);
        if (!categoriesRes.ok) errors.push(`categories (${categoriesRes.status})`);
        if (!usersRes.ok) errors.push(`users (${usersRes.status})`);
        throw new Error(`Failed to load data: ${errors.join(', ')}`);
      }

      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      const usersData = await usersRes.json();

      let ordersData: AdminOrder[] = [];
      let fetchedOrdersFromApi = false;

      try {
        const ordersRes = await fetch(`${apiUrl}/api/payments/orders/all`);

        if (ordersRes.ok) {
          const rawOrders: RawAdminOrder[] = await ordersRes.json();
          ordersData = rawOrders.map(normalizeAdminOrder);
          fetchedOrdersFromApi = true;
        } else {
          const payload = await ordersRes.json();
          console.warn('Admin order fetch failed, falling back to localStorage:', payload);
        }
      } catch (fetchOrdersError) {
        console.warn('Admin order fetch failed, falling back to localStorage:', fetchOrdersError);
      }

      const ordersJson = localStorage.getItem('orders');
      const storedOrders: RawAdminOrder[] = ordersJson ? (JSON.parse(ordersJson) as RawAdminOrder[]) : [];
      const normalizedStoredOrders = storedOrders.map(normalizeAdminOrder);

      if (!fetchedOrdersFromApi) {
        ordersData = normalizedStoredOrders;
      }

      ordersData = ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setProducts(productsData);
      setCategories(categoriesData);
      setUsers(usersData);
      setOrders(ordersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  function getOrderNumber(order: AdminOrder) {
    return order.order_number || `FSG-${String(order.id).padStart(4, '0')}`;
  }

  function getCustomerName(order: AdminOrder) {
    if (order.user?.name) return order.user.name;
    try {
      const addr = JSON.parse(order.shipping_address);
      if (addr?.name) return addr.name;
    } catch {
      // ignore invalid JSON
    }
    return 'Guest';
  }

  function parseSizes(sizes?: string) {
    const parsed = sizes
      ? sizes.split(',').map((size) => size.trim().toLowerCase()).filter((size) => sizeOptions.includes(size))
      : [];
    return parsed;
  }

  function toggleSize(size: string) {
    setSelectedSizes((current) =>
      current.includes(size)
        ? current.filter((item) => item !== size)
        : [...current, size]
    );
  }

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    if (password !== adminPassword) {
      setAuthError('Incorrect password. Please try again.');
      setPassword('');
      return;
    }

    setLoading(true);
    setIsAuthenticated(true);
    setPassword('');
  }

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return url.startsWith('/uploads') ? `${apiUrl}${url}` : url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setError(null);

    if (selectedSizes.length === 0) {
      setError('Please select at least one available size for this product.');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('image_url', imageUrl || '');
      if (imageFile) {
        formData.append('image', imageFile);
      }
      formData.append('category_id', categoryId || '');
      formData.append('stock', stock || '0');
      formData.append('sizes', selectedSizes.join(','));

      let response;
      if (editingProduct) {
        response = await fetch(`${apiUrl}/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: formData,
        });
      } else {
        response = await fetch(`${apiUrl}/api/products`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save product');
      }

      setMessage(editingProduct ? 'Product updated successfully' : 'Product added successfully');
      resetForm();
      setAdminView('products');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function deleteProduct(productId: number) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete product');
      }

      setMessage('Product deleted successfully');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function updateOrderStatus(orderId: number, newStatus: string) {
    setUpdatingOrderId(orderId);
    setMessage(null);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/payments/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Failed to update order status (${response.status})`);
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus.toLowerCase() } : order
        )
      );

      const ordersJson = localStorage.getItem('orders');
      if (ordersJson) {
        const storedOrders: AdminOrder[] = JSON.parse(ordersJson);
        const syncedOrders = storedOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus.toLowerCase() } : order
        );
        localStorage.setItem('orders', JSON.stringify(syncedOrders));
      }

      setMessage('Order status updated successfully');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
    setImageFile(null);
    setCategoryId('');
    setStock('');
    setSelectedSizes([]);
    setEditingProduct(null);
    setShowAddForm(false);
  }

  function openAddProductForm() {
    resetForm();
    setAdminView('add');
  }

  function populateForm(product: Product) {
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setImageUrl(product.image_url || '');
    setImageFile(null);
    setCategoryId(product.category_id?.toString() || '');
    setStock(product.stock?.toString() || '');
    setSelectedSizes(parseSizes(product.sizes));
    setEditingProduct(product);
    setShowAddForm(true);
    setAdminView('add');
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    void Promise.resolve().then(fetchData);
  }, [fetchData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'orders' || !event.newValue) return;

      try {
        const storedOrders: RawAdminOrder[] = JSON.parse(event.newValue);
        const normalizedOrders = storedOrders.map(normalizeAdminOrder);

        setOrders((currentOrders) => {
          const existingIds = new Set(currentOrders.map((order) => order.id));
          const newOrders = normalizedOrders.filter((order) => !existingIds.has(order.id));
          const mergedOrders = [
            ...currentOrders,
            ...newOrders,
          ];

          if (newOrders.length > 0) {
            setNewOrderCount((count) => count + newOrders.length);
            setNewOrderAlert(true);
          }

          return mergedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      } catch {
        // Ignore invalid storage content
      }
    };

    const handleAdminOrdersUpdated = () => {
      setNewOrderAlert(true);
      void fetchData();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('adminOrdersUpdated', handleAdminOrdersUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('adminOrdersUpdated', handleAdminOrdersUpdated);
    };
  }, [fetchData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!newOrderAlert) return;

    const timeout = window.setTimeout(() => {
      setNewOrderAlert(false);
      setNewOrderCount(0);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [isAuthenticated, newOrderAlert]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = () => {
      void fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(236,72,153,0.28),transparent_35%),linear-gradient(315deg,rgba(14,165,233,0.2),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
        <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-pink-950/30 backdrop-blur sm:p-10">
            <div className="text-center">
              <p className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.25em] text-pink-100 ring-1 ring-white/15">
                FOSOGO Closet
              </p>
              <h1 className="mt-5 text-4xl font-black text-white sm:text-6xl">Admin Access</h1>
              <p className="mt-3 text-lg text-pink-100">Store management control center</p>
            </div>

            <form onSubmit={handleAdminLogin} className="mt-12 space-y-6">
              <div>
                <label htmlFor="admin-password" className="block text-lg font-bold text-white sm:text-2xl">
                  Enter Admin Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError(null);
                  }}
                  autoComplete="current-password"
                  autoFocus
                  required
                  placeholder="Password"
                  className="mt-5 block h-16 w-full rounded-2xl border border-white/20 bg-slate-950/55 px-6 text-lg font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] outline-none transition placeholder:text-slate-500 focus:border-pink-200 focus:bg-slate-950/75 focus:ring-4 focus:ring-pink-500/20"
                />
                {authError && (
                  <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
                    {authError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="h-16 w-full rounded-2xl bg-white px-6 text-lg font-black text-slate-950 shadow-lg shadow-pink-950/30 transition hover:scale-[1.01] hover:bg-pink-100 focus:outline-none focus:ring-4 focus:ring-pink-500/30"
              >
                Login
              </button>
            </form>

            <div className="mt-10 border-t border-white/10 pt-6 text-center">
              <Link href="/" className="font-semibold text-pink-100 transition hover:text-white">
                Back to Store
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 py-10 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-slate-200 shadow-2xl shadow-pink-950/20 backdrop-blur">
            Loading admin dashboard...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 py-10 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(236,72,153,0.2),transparent_32%),linear-gradient(315deg,rgba(14,165,233,0.16),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">FOSOGO Closet</p>
              <h1 className="mt-6 bg-gradient-to-r from-pink-300 via-white to-sky-200 bg-clip-text text-4xl font-black text-transparent sm:text-6xl">
                Admin Dashboard
              </h1>
              <p className="mt-3 text-lg text-slate-300">Manage your e-commerce platform</p>
              {newOrderAlert && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-pink-500/15 px-4 py-2 text-sm font-semibold text-pink-100 ring-1 ring-pink-300/25">
                  <span>New order received</span>
                  {newOrderCount > 0 && (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white px-2 text-xs text-slate-950">
                      {newOrderCount}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/history"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/15 hover:text-white"
              >
                Order History
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/15 hover:text-white"
              >
                Back to Store
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/5 p-2 backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { id: 'overview' as AdminView, label: 'Overview' },
              { id: 'products' as AdminView, label: 'Products' },
              { id: 'orders' as AdminView, label: 'Orders' },
              { id: 'add' as AdminView, label: editingProduct ? 'Edit Product' : 'Add Product' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => (tab.id === 'add' ? openAddProductForm() : setAdminView(tab.id))}
                className={`rounded-2xl px-5 py-4 text-sm font-bold transition ${
                  adminView === tab.id
                    ? 'bg-white text-slate-950 shadow-lg shadow-pink-950/20'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-700 shadow-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {adminView === 'overview' && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Total Revenue</p>
              <p className="mt-2 text-3xl font-black text-white">GH₵{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Pending Orders</p>
              <p className="mt-2 text-3xl font-black text-white">{pendingOrders.length}</p>
            </div>
          </div>
        )}

        {(adminView === 'add' || showAddForm) && (
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Product name"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Product description"
                  className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Image URL</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    title="Select image file"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    If both are provided, the uploaded file takes priority.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    title="Select category"
                    className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Available Sizes</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <label
                        key={size}
                        className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold uppercase transition ${
                          selectedSizes.includes(size)
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSizes.includes(size)}
                          onChange={() => toggleSize(size)}
                          className="sr-only"
                        />
                        {size}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-gray-900 px-6 py-3 text-white transition hover:bg-black"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-900 transition hover:border-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {adminView === 'products' && (
          <div className="rounded-3xl bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Products ({products.length})</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {products.map((product) => (
                <div key={product.id} className="p-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {product.image_url && normalizeImageUrl(product.image_url) ? (
                      <Image
                        src={normalizeImageUrl(product.image_url)!}
                        alt={product.name}
                        width={64}
                        height={64}
                        className="h-full w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-600 truncate">{product.description}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm font-medium text-gray-900">GH₵{product.price.toFixed(2)}</span>
                      <span className="text-sm text-gray-500">Stock: {product.stock}</span>
                      <span className="text-sm text-gray-500 uppercase">Sizes: {parseSizes(product.sizes).join(', ') || 'None'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => populateForm(product)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminView === 'orders' && (
          <div className="mt-8 rounded-3xl bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Active Orders ({activeOrders.length})
              </h2>
              <p className="mt-1 text-sm text-gray-600">Manage pending, processing, and shipped orders.</p>
            </div>
            <div className="divide-y divide-gray-200">
              {activeOrders.length === 0 ? (
                <div className="p-6 text-gray-600">No active orders found.</div>
              ) : (
                activeOrders.map((order) => (
                    <div key={order.id} className="p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Order {getOrderNumber(order)}</p>
                          <p className="font-semibold text-gray-900">{getCustomerName(order)}</p>
                        </div>
                        <div className="space-y-1 text-right text-sm text-gray-500">
                          <span>{new Date(order.createdAt).toLocaleString()}</span>
                          <div className="flex items-center gap-2 justify-end">
                            <label htmlFor={`order-status-${order.id}`} className="text-xs font-medium text-gray-600">Status:</label>
                            <select
                              id={`order-status-${order.id}`}
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              disabled={updatingOrderId === order.id}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-gray-500">Total</p>
                          <p className="text-lg font-semibold text-gray-900">GH₵{order.total.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Shipping</p>
                          <p className="text-sm text-gray-700">
                            {(() => {
                              try {
                                const addr = JSON.parse(order.shipping_address);
                                return `${addr.name}, ${addr.phone}, ${addr.address}, ${addr.city}`;
                              } catch {
                                return order.shipping_address;
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">Items</p>
                        <div className="mt-3 space-y-3">
                          {order.items.map((item) => (
                            <div key={`${item.product_id}-${item.size || 'no-size'}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{item.product?.name ?? 'Unknown product'}</p>
                                {item.size ? <p className="text-sm font-semibold uppercase text-gray-900">Size: {item.size}</p> : null}
                                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
