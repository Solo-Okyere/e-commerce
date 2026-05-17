"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';

type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  size?: string;
  product?: {
    id: number;
    name: string;
    price: number;
    image_url?: string;
    stock?: number;
  };
};

type LocalCartItem = {
  id: number;
  product_id: number;
  quantity: number;
  size: string;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

   useEffect(() => {
     const storedToken = localStorage.getItem('fosogo_token');
     if (storedToken !== token) {
       // eslint-disable-next-line react-hooks/set-state-in-effect
       setToken(storedToken);
     }
     // eslint-disable-line react-hooks/exhaustive-deps
   }, []);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return url.startsWith('/uploads') ? `${apiUrl}${url}` : url;
  }

   const loadCart = useCallback(async (authToken: string | null) => {
     if (authToken) {
       // Load from API
       try {
         const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
         const response = await fetch(`${apiUrl}/api/cart`, {
           headers: { Authorization: `Bearer ${authToken}` },
         });

         if (response.status === 401) {
           localStorage.removeItem('fosogo_token');
           setToken(null);
           // Fall through to localStorage cart below
         } else if (!response.ok) {
           const payload = await response.json();
           throw new Error(payload.message || 'Failed to load cart');
         } else {
           const data = await response.json();
           setItems(data);
           return;
         }
       } catch (err) {
         setError(err instanceof Error ? err.message : 'Unknown error');
         return;
       }
     }

     // Load from localStorage
     const localCart = localStorage.getItem('fosogo_cart');
     if (localCart) {
       try {
         const cartItems: LocalCartItem[] = JSON.parse(localCart);
         // Fetch product details for each item
         const itemsWithProducts = await Promise.all(cartItems.map(async (item) => {
           try {
             const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
             const response = await fetch(`${apiUrl}/api/products/${item.product_id}`);
             if (response.ok) {
               return { ...item, product: await response.json() };
             }
           } catch {}
           return item; // without product if fetch fails
         }));
         setItems(itemsWithProducts);
       } catch (err) {
         console.error('Failed to load local cart:', err);
       }
     } else {
       setItems([]);
     }
     setLoading(false);
   }, []);

   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect
     loadCart(token);
   }, [loadCart, token]);

  const total = items.reduce((sum, item) => sum + ((item.product?.price ?? 0) * item.quantity), 0);

   async function updateQuantity(itemId: number, quantity: number) {
     if (quantity < 1) return;
     setMessage(null);
     setSavingItemId(itemId);

     if (token) {
       // Update via API
       try {
         const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
         const response = await fetch(`${apiUrl}/api/cart/${itemId}`, {
           method: 'PUT',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${token}`,
           },
           body: JSON.stringify({ quantity }),
         });

         if (response.status === 401) {
           localStorage.removeItem('fosogo_token');
           setToken(null);
           setMessage('Session expired. Please log in again.');
           setSavingItemId(null);
           return;
         }

         if (!response.ok) {
           const payload = await response.json();
           throw new Error(payload.message || 'Failed to update cart');
         }

         const updatedItem = await response.json();
         setItems((current) => current.map((item) => (item.id === itemId ? updatedItem : item)));
         setMessage('Cart updated successfully.');
       } catch (err) {
         setMessage(err instanceof Error ? err.message : 'Unknown error');
       }
     } else {
       // Update localStorage
       setItems((current) => {
         const updated = current.map((item) =>
           item.id === itemId ? { ...item, quantity } : item
         );
          localStorage.setItem('fosogo_cart', JSON.stringify(updated.map((item) => {
          const { product, ...rest } = item;
          return rest;
        })));
         return updated;
       });
       setMessage('Cart updated successfully.');
     }
     setSavingItemId(null);
   }

  async function removeItem(itemId: number) {
    setMessage(null);
    setRemovingItemId(itemId);

    if (token) {
      // Remove via API
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/cart/${itemId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem('fosogo_token');
          setToken(null);
          setMessage('Session expired. Please log in again.');
          setRemovingItemId(null);
          return;
        }

        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.message || 'Failed to remove item');
        }

        setItems((current) => current.filter((item) => item.id !== itemId));
        setMessage('Item removed from cart.');
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Unknown error');
      }
    } else {
      // Remove from localStorage
      setItems((current) => {
        const updated = current.filter((item) => item.id !== itemId);
        localStorage.setItem('fosogo_cart', JSON.stringify(updated.map(({ product: _, ...rest }) => rest)));
        return updated;
      });
      setMessage('Item removed from cart.');
    }
    setRemovingItemId(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[2rem] bg-white p-8 shadow-lg shadow-slate-200/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Your Cart</h1>
              <p className="mt-2 text-slate-600">Review items before checkout.</p>
            </div>
            <Link href="/" className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
              Continue shopping
            </Link>
          </div>
          <div className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
            {items.length} item(s)
          </div>
        </div>

        {message ? (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-sm text-emerald-700 shadow-sm">{message}</div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-slate-600">Loading cart...</div>
        ) : error ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-slate-600">Your cart is empty.</div>
        ) : (
           <div className="space-y-6">
             {items.map((item) => (
               <div key={`${item.id}-${item.product_id}-${item.size || 'no-size'}`} className="grid gap-6 rounded-[2rem] bg-white p-6 shadow-sm sm:grid-cols-[2.5fr_1fr] sm:items-center">
                <div className="flex items-start gap-4">
                   <div className="relative h-28 w-28 overflow-hidden rounded-3xl bg-slate-100">
                      {item.product?.image_url ? (
                        <Image src={normalizeImageUrl(item.product.image_url)!} alt={item.product.name} fill sizes="(max-width: 640px) 100vw, 28vw" className="object-contain p-4" unoptimized />
                      ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">No image</div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{item.product?.name ?? 'Unknown Product'}</h2>
                    <p className="mt-2 text-sm text-slate-500">GH₵{(item.product?.price ?? 0).toFixed(2)} each</p>
                    {item.size ? (
                      <p className="mt-1 text-sm font-semibold uppercase text-slate-700">Size: {item.size}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-400">Stock: {item.product?.stock ?? 0} available</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={item.quantity <= 1 || savingItemId === item.id}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="min-w-[2.5rem] text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={savingItemId === item.id || item.quantity >= (item.product?.stock ?? 0)}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        disabled={removingItemId === item.id}
                        onClick={() => removeItem(item.id)}
                        className="ml-4 rounded-full bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {removingItemId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start justify-between gap-4 sm:items-end">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Item total</p>
                    <p className="text-2xl font-semibold text-slate-900">GH₵{((item.product?.price ?? 0) * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-[2rem] bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Estimated total</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-900">GH₵{total.toFixed(2)}</p>
                </div>
                <Link href="/checkout" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Checkout now
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
