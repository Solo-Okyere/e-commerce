"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  };
};

type LocalCartItem = {
  id: number;
  product_id: number;
  quantity: number;
  size: string;
};

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return url.startsWith('/uploads') ? `${apiUrl}${url}` : url;
}

type CheckoutFormProps = {
  items: CartItem[];
  total: number;
  onSuccess?: () => void;
};

function CheckoutForm({ items, total, onSuccess }: CheckoutFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const momoNumber = process.env.NEXT_PUBLIC_ADMIN_MOMO_NUMBER || '233240290207';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);
    setSuccessMessage(null);

    if (!name || !phone || !address || !city) {
      setError('Please fill in all shipping and contact fields.');
      return;
    }

    const validItems = items.filter(item => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      setError('Your cart is empty or items are invalid.');
      return;
    }

    if (validItems.some(item => !item.size)) {
      setError('Please choose a size for every item before checkout.');
      return;
    }

    setProcessing(true);
    setError(null);

    const token = localStorage.getItem('fosogo_token');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/payments/confirm-momo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          phone,
          shippingAddress: address,
          city,
          items: validItems.map(item => ({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            size: item.size,
          })),
        }),
      });

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (response.status === 401) {
        localStorage.removeItem('fosogo_token');
        setError('Session expired. Please log in again.');
        setProcessing(false);
        return;
      }

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || 'Failed to confirm mobile money payment';
        throw new Error(errorMsg);
      }

      const orderId = data.order?.id || data.orderId || Date.now();

      // Build order object for localStorage
      const newOrder = {
        id: orderId,
        order_number: data.order?.order_number || data.orderNumber || `FSG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(orderId).padStart(4, '0')}`,
        items: validItems.map(item => {
          const product = items.find(i => i.product_id === item.product_id)?.product;
          return {
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            size: item.size,
            price: product?.price || 0,
            product,
          };
        }),
        total,
        status: data.order?.status || 'pending',
        createdAt: new Date().toISOString(),
        shipping_address: JSON.stringify({ name, phone, address, city }),
        payment_method: 'momo',
      };

      // Save to localStorage (customer orders page reads from here)
      const existingOrders = localStorage.getItem('orders');
      const orders: unknown[] = existingOrders ? JSON.parse(existingOrders) : [];
      orders.unshift(newOrder);
      localStorage.setItem('orders', JSON.stringify(orders));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('adminOrdersUpdated'));
      }

      // Clear temporary cart and form state
      localStorage.removeItem('fosogo_cart');
      setName('');
      setPhone('');
      setAddress('');
      setCity('');
      setSuccessMessage('Payment confirmed! Redirecting to the shop...');
      setProcessing(false);
      onSuccess?.();
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  return (
     <form onSubmit={handleSubmit} className="space-y-4">
       <div>
         <label htmlFor="checkout-name" className="block text-sm font-medium text-gray-700">Full Name</label>
         <input
           id="checkout-name"
           type="text"
           value={name}
           onChange={(e) => setName(e.target.value)}
           required
           className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
         />
       </div>
       <div>
         <label htmlFor="checkout-phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
         <input
           id="checkout-phone"
           type="tel"
           value={phone}
           onChange={(e) => setPhone(e.target.value)}
           required
           className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
         />
       </div>
       <div>
         <label htmlFor="checkout-address" className="block text-sm font-medium text-gray-700">Shipping Address</label>
         <textarea
           id="checkout-address"
           value={address}
           onChange={(e) => setAddress(e.target.value)}
           required
           rows={3}
           className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
         />
       </div>
       <div>
         <label htmlFor="checkout-city" className="block text-sm font-medium text-gray-700">City</label>
         <input
           id="checkout-city"
           type="text"
           value={city}
           onChange={(e) => setCity(e.target.value)}
           required
           className="mt-1 block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
         />
       </div>

      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {successMessage && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>}

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm text-gray-600">Pay via Mobile Money to:</p>
        <p className="mt-1 text-lg font-bold text-gray-900">{momoNumber}</p>
      </div>

      <button
        type="submit"
        disabled={processing}
        className="w-full rounded-2xl bg-gray-900 px-5 py-3 text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {processing ? 'Confirming order…' : `Confirm order and pay GH₵${total.toFixed(2)}`}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
   const [items, setItems] = useState<CartItem[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   function getToken() {
     return typeof window !== 'undefined' ? localStorage.getItem('fosogo_token') : null;
   }

   const fetchCart = useCallback(async () => {
     const token = getToken();
     if (token) {
       try {
         const apiUrl = process.env.NEXT_PUBLIC_API_URL;
         const response = await fetch(`${apiUrl}/api/cart`, {
           headers: { Authorization: `Bearer ${token}` },
         });

         if (response.status === 401) {
           localStorage.removeItem('fosogo_token');
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

     const localCart = localStorage.getItem('fosogo_cart');
     if (localCart) {
       try {
         const cartItems: LocalCartItem[] = JSON.parse(localCart);
         const itemsWithProducts = await Promise.all(cartItems.map(async (item) => {
           try {
             const apiUrl = process.env.NEXT_PUBLIC_API_URL;
             const response = await fetch(`${apiUrl}/api/products/${item.product_id}`);
             if (response.ok) {
               const product = await response.json();
               return { ...item, product };
             }
           } catch {}
           return item;
         }));
         setItems(itemsWithProducts);
       } catch (err) {
         console.error('Failed to load local cart:', err);
       }
     } else {
       setError('Your cart is empty.');
     }
     setLoading(false);
   }, []);

   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect
     fetchCart();
   }, [fetchCart]);

    const total = items.reduce((sum, item) => sum + ((item.product?.price ?? 0) * item.quantity), 0);

   const handleCheckoutSuccess = () => {
     setItems([]);
   };

   return (
     <div className="min-h-screen bg-gray-50 py-10">
       <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-2 text-gray-600">Pay with mobile money using the admin&apos;s Ghana cedis number.</p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-gray-600">Loading checkout details...</div>
        ) : error ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm text-gray-600">Your cart is empty.</div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900">Payment details</h2>
              <CheckoutForm items={items} total={total} onSuccess={handleCheckoutSuccess} />
            </section>
            <aside className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-900">Order summary</h2>
                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                     <div key={`${item.id}-${item.product_id}-${item.size || 'no-size'}`} className="flex items-center justify-between gap-4">
                       <div className="flex items-center gap-3">
                          {item.product?.image_url && (
                            <Image
                              src={normalizeImageUrl(item.product.image_url)!}
                              alt={item.product.name}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-lg object-contain"
                              unoptimized
                            />
                          )}
                         <span className="text-sm text-gray-700">
                           {item.product?.name ?? 'Product'}
                           {item.size ? <span className="block font-semibold uppercase text-gray-900">Size: {item.size}</span> : null}
                         </span>
                       </div>
                       <span className="text-sm font-semibold text-gray-900">
                         GH₵{(item.product?.price ?? 0).toFixed(2)} x {item.quantity}
                       </span>
                     </div>
                   ))}
                 </div>
                 <div className="mt-6 border-t border-gray-200 pt-4 text-lg font-semibold text-gray-900">
                   Total: GH₵{total.toFixed(2)}
                 </div>
              </div>
            </aside>
          </div>
        )}
       </div>
      </div>
   );
 }
