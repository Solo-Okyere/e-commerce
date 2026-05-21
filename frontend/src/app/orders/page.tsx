"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

type Product = {
  id: number;
  name: string;
  price: number;
  image_url?: string;
};

type OrderItem = {
  product_id: number;
  quantity: number;
  size?: string;
  price: number;
  product?: Product;
};

type Order = {
  id: number;
  order_number?: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
  shipping_address: string;
  payment_method: string;
};

type SyncedOrderStatus = {
  localId: number | string;
  id: number;
  order_number?: string;
  status: string;
};

async function syncStoredOrderStatuses(storedOrders: Order[]) {
  if (storedOrders.length === 0) return storedOrders;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const response = await fetch(`${apiUrl}/api/payments/orders/statuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: storedOrders.map((order) => ({
          id: order.id,
          order_number: order.order_number,
          total: order.total,
          shipping_address: order.shipping_address,
        })),
      }),
    });

    if (!response.ok) return storedOrders;

    const payload = await response.json();
    const statusByLocalId = new Map(
      (payload.statuses as SyncedOrderStatus[] | undefined)?.map((status) => [String(status.localId), status]) || []
    );

    const syncedOrders = storedOrders.map((order) => {
      const syncedStatus = statusByLocalId.get(String(order.id));
      if (!syncedStatus) return order;
      return {
        ...order,
        id: syncedStatus.id,
        order_number: syncedStatus.order_number || order.order_number,
        status: syncedStatus.status,
      };
    });

    localStorage.setItem('orders', JSON.stringify(syncedOrders));
    return syncedOrders;
  } catch {
    return storedOrders;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('fosogo_token') : null;
  }

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();

      try {
        if (token) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          const response = await fetch(`${apiUrl}/api/payments/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 401) {
            localStorage.removeItem('fosogo_token');
            // Fall through to localStorage
          } else if (!response.ok) {
            const payload = await response.json();
            throw new Error(payload.message || 'Failed to load orders');
          } else {
            const data = await response.json();
            const ordersFromApi: Order[] = data.map((order: Record<string, unknown>) => ({
              ...order,
              createdAt: order.created_at as string,
            }));
            const filtered = ordersFromApi.filter((order: Order) => order.status.toLowerCase() !== 'delivered');
            filtered.sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(filtered);
            return;
          }
        }

        // Fallback to localStorage
        const ordersJson = localStorage.getItem('orders');
        const storedOrders: Order[] = ordersJson ? JSON.parse(ordersJson) : [];
        const syncedOrders = await syncStoredOrderStatuses(storedOrders);
        const filteredAndSorted = syncedOrders
          .filter((order: Order) => order.status.toLowerCase() !== 'delivered')
          .sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(filteredAndSorted);
      } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, [loadOrders]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getOrderNumber(order: Order) {
    return order.order_number || `FSG-${String(order.id).padStart(4, '0')}`;
  }

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return url.startsWith('/uploads') ? `${apiUrl}${url}` : url;
  }

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActiveStep = (status: string): number => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 1;
      case 'processing':
        return 2;
      case 'shipped':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  const handleRefresh = () => {
    loadOrders();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
              <p className="mt-2 text-gray-600">View your order history and track your purchases.</p>
            </div>
            {orders.length > 0 && (
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Orders
              </button>
            )}
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-gray-600">Loading orders...</div>
        ) : error ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-red-600">{error}</div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center text-gray-600">
             <p className="text-lg">You haven&apos;t placed any orders yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-2xl bg-gray-900 px-6 py-3 text-white transition hover:bg-black"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const activeStep = getActiveStep(order.status);
              const isTrackingView = typeof window !== 'undefined' && window.location.search.includes(`track=${order.id}`);

              return (
                <div key={order.id} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-gray-900">Order {getOrderNumber(order)}</h2>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">Placed on {formatDate(order.createdAt)}</p>
                      <p className="text-sm text-gray-600">Payment: {order.payment_method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">GH₵{order.total.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</p>
                      <Link
                        href={`/orders?track=${order.id}`}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition"
                      >
                        Track Order
                      </Link>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                    <div className="space-y-4">
                      {(order.items || []).map((item) => (
                        <div key={`${item.product_id}-${item.size || 'no-size'}`} className="flex items-center gap-4">
                          {item.product?.image_url && (
                            <img
                              src={normalizeImageUrl(item.product.image_url)}
                              alt={item.product.name}
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{item.product?.name ?? 'Product'}</h4>
                            {item.size ? <p className="text-sm font-semibold uppercase text-gray-900">Size: {item.size}</p> : null}
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                            <p className="text-sm text-gray-600">per item</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Shipping Address</h3>
                    <p className="text-gray-600">
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

                  {isTrackingView && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Tracking</h3>
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold ${
                            activeStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            1
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold ${activeStep >= 1 ? 'text-blue-900' : 'text-gray-500'}`}>
                              Order Confirmed
                            </p>
                            <p className="text-sm text-gray-600">Your order has been received.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold ${
                            activeStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            2
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold ${activeStep >= 2 ? 'text-blue-900' : 'text-gray-500'}`}>
                              Processing
                            </p>
                            <p className="text-sm text-gray-600">Your order is being prepared.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold ${
                            activeStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            3
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold ${activeStep >= 3 ? 'text-blue-900' : 'text-gray-500'}`}>
                              Shipped
                            </p>
                            <p className="text-sm text-gray-600">Your order is on its way.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-semibold ${
                            activeStep >= 4 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            4
                          </div>
                          <div className="flex-1">
                            <p className={`font-semibold ${activeStep >= 4 ? 'text-green-900' : 'text-gray-500'}`}>
                              Delivered
                            </p>
                            <p className="text-sm text-gray-600">Order delivered successfully.</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-lg bg-blue-50 p-4 border border-blue-200">
                        <p className="text-sm">
                          Current Status: <span className="font-bold capitalize text-blue-900">{order.status}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
