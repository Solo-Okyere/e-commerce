"use client";

import { useEffect, useState } from 'react';
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

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  orderCount: number;
};

type AdminOrderItem = {
  product_id: number;
  quantity: number;
  size?: string;
  price: number;
  product?: {
    id: number;
    name: string;
    image_url?: string;
  } | null;
};

type AdminOrder = {
  id: number;
  order_number?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  total: number;
  status: string;
  shipping_address: string;
  payment_method: string;
  createdAt: string;
  items: AdminOrderItem[];
};

const sizeOptions = ['s', 'm', 'l', 'xl', 'xxl'];

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
      const token = getToken();

      if (token) {
        try {
          const ordersRes = await fetch(`${apiUrl}/api/payments/orders/all`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (ordersRes.ok) {
            const rawOrders: any[] = await ordersRes.json();
            ordersData = rawOrders.map((order) => ({
              ...order,
              createdAt: order.created_at || order.createdAt || new Date().toISOString(),
            }));
          } else if (ordersRes.status === 401) {
            localStorage.removeItem('fosogo_token');
          } else {
            const payload = await ordersRes.json();
            throw new Error(payload.message || 'Failed to load admin orders');
          }
        } catch (fetchOrdersError) {
          console.warn('Admin order fetch failed, falling back to localStorage:', fetchOrdersError);
        }
      }

      if (ordersData.length === 0) {
        const ordersJson = localStorage.getItem('orders');
        const storedOrders: AdminOrder[] = ordersJson ? JSON.parse(ordersJson) : [];
        ordersData = storedOrders.map((order) => ({
          ...order,
          createdAt: order.created_at || order.createdAt || new Date().toISOString(),
        }));
      }

      setProducts(productsData);
      setCategories(categoriesData);
      setUsers(usersData);
      setOrders(ordersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
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

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return url.startsWith('/uploads') ? `${apiUrl}${url}` : url;
  }

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('fosogo_token') : null;
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setError(null);

    if (selectedSizes.length === 0) {
      setError('Please select at least one available size for this product.');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function deleteProduct(productId: number) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
      // Update localStorage directly
      const ordersJson = localStorage.getItem('orders');
      if (!ordersJson) {
        throw new Error('No orders found');
      }

      const orders: AdminOrder[] = JSON.parse(ordersJson);
      const orderIndex = orders.findIndex(o => o.id === orderId);

      if (orderIndex === -1) {
        throw new Error('Order not found');
      }

      // Update status
      orders[orderIndex].status = newStatus;
      localStorage.setItem('orders', JSON.stringify(orders));

      // Update local state immediately for responsive UI
      setOrders(orders);

      // Also update via API if needed (optional, for sync)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        await fetch(`${apiUrl}/api/payments/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (apiErr) {
        console.warn('Could not update order status via API (localStorage updated successfully)', apiErr);
      }

      setMessage('Order status updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white p-8 shadow-sm text-gray-600">Loading admin panel...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="mt-2 text-gray-600">Manage products and inventory.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/history"
                className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-900 transition hover:border-gray-900 hover:bg-gray-100"
              >
                Delivered History
              </Link>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-2xl bg-gray-900 px-6 py-3 text-white transition hover:bg-black"
              >
                {showAddForm ? 'Cancel' : 'Add Product'}
              </button>
            </div>
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

        {showAddForm && (
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

        {/* Customers section hidden - code preserved */}
        {false && (
        <div className="mt-8 rounded-3xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Customers ({users.length})</h2>
            <p className="mt-1 text-sm text-gray-600">View all users and their total order counts.</p>
          </div>
          <div className="divide-y divide-gray-200">
            {users.length === 0 ? (
              <div className="p-6 text-gray-600">No customers found.</div>
            ) : (
              users
                .filter(user => !(user.name === 'okyere' && user.email === 'quexipapphlicker@gmail.com'))
                .map((user) => (
                  <div key={user.id} className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 text-right">
                      <p className="font-medium text-gray-900 capitalize">{user.role}</p>
                      <p>{user.orderCount} {user.orderCount === 1 ? 'order' : 'orders'}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
        )}

        <div className="mt-8 rounded-3xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Active Orders ({orders.filter((order) => order.status.toLowerCase() !== 'delivered').length})</h2>
            <p className="mt-1 text-sm text-gray-600">Manage pending, processing, and shipped orders.</p>
          </div>
          <div className="divide-y divide-gray-200">
            {orders.filter((order) => order.status.toLowerCase() !== 'delivered').length === 0 ? (
              <div className="p-6 text-gray-600">No active orders found.</div>
            ) : (
              orders
                .filter((order) => order.status.toLowerCase() !== 'delivered')
                .map((order) => (
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
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
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
      </div>
    </div>
  );
}
