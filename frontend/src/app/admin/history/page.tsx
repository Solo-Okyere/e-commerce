"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: number;
  name: string;
  image_url?: string;
};

type OrderItem = {
  product_id: number;
  quantity: number;
  size?: string;
  price: number;
  product?: Product | null;
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
  items: OrderItem[];
};

type RawAdminOrder = Record<string, unknown>;

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

function normalizeAdminOrder(order: RawAdminOrder): AdminOrder {
  const createdAt =
    typeof order['created_at'] === 'string'
      ? order['created_at']
      : typeof order['createdAt'] === 'string'
      ? order['createdAt']
      : new Date().toISOString();

  return {
    ...(order as any),
    createdAt,
  } as AdminOrder;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminHistoryPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() === 'delivered'),
    [orders]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        let allOrders: AdminOrder[] = [];

        try {
          const response = await fetch(`${apiUrl}/api/payments/orders/all`);

          if (response.ok) {
            const data = await response.json();
            allOrders = data
              .map(normalizeAdminOrder)
              .sort((a: AdminOrder, b: AdminOrder) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          } else {
            const payload = await response.json();
            console.warn('Admin history order fetch failed, falling back to localStorage:', payload);
          }
        } catch (fetchOrdersError) {
          console.warn('Admin history order fetch failed, falling back to localStorage:', fetchOrdersError);
        }

        if (allOrders.length === 0) {
          const stored = localStorage.getItem('orders');
          const ordersJson: RawAdminOrder[] = stored ? JSON.parse(stored) : [];
          allOrders = ordersJson
            .map(normalizeAdminOrder)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        setOrders(allOrders);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Order History</h1>
              <p className="mt-2 text-gray-600">Review delivered customer orders only.</p>
            </div>
            <Link href="/admin" className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-6 py-3 text-white transition hover:bg-black">
              Back to Admin Panel
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-gray-600">Loading orders...</div>
        ) : error ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-red-600">{error}</div>
        ) : deliveredOrders.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center text-gray-600">
            <p className="text-lg">No delivered orders found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {deliveredOrders.map((order) => {
              let statusClass = 'bg-gray-100 text-gray-800';
              if (order.status.toLowerCase() === 'pending') {
                statusClass = 'bg-yellow-100 text-yellow-800';
              } else if (order.status.toLowerCase() === 'processing') {
                statusClass = 'bg-blue-100 text-blue-800';
              } else if (order.status.toLowerCase() === 'shipped') {
                statusClass = 'bg-purple-100 text-purple-800';
              } else if (order.status.toLowerCase() === 'delivered') {
                statusClass = 'bg-green-100 text-green-800';
              } else if (order.status.toLowerCase() === 'cancelled') {
                statusClass = 'bg-red-100 text-red-800';
              }
              return (
                <div key={order.id} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Order {getOrderNumber(order)}</h2>
                      <p className="mt-1 text-sm text-gray-600">Placed on {formatDate(order.createdAt)}</p>
                      <p className="text-sm text-gray-600">Customer: {getCustomerName(order)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">GH₵{order.total.toFixed(2)}</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Shipping Address</p>
                      <p className="mt-2 text-gray-600">
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
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Payment Method</p>
                      <p className="mt-2 text-gray-600">{order.payment_method}</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-slate-50 p-4">
                    <h3 className="text-lg font-semibold text-gray-900">Items</h3>
                    <div className="mt-4 space-y-3">
                      {order.items.map((item) => (
                        <div key={`${item.product_id}-${item.size || 'no-size'}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{item.product?.name ?? 'Unknown product'}</p>
                            {item.size ? <p className="text-sm uppercase text-gray-600">Size: {item.size}</p> : null}
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}