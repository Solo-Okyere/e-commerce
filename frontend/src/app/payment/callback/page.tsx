"use client";

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type VerificationState = 'checking' | 'success' | 'failed';

function updateStoredOrderStatus(orderId: number | undefined, reference: string, status: string) {
  const existingOrders = localStorage.getItem('orders');
  if (!existingOrders) return;

  try {
    const orders: unknown[] = JSON.parse(existingOrders);
    const updatedOrders = orders.map((order) => {
      if (typeof order !== 'object' || order === null) return order;

      const candidate = order as { id?: number; payment_reference?: string; status?: string };
      if ((orderId && candidate.id === orderId) || candidate.payment_reference === reference) {
        return { ...candidate, status };
      }

      return order;
    });
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    window.dispatchEvent(new Event('adminOrdersUpdated'));
  } catch (error) {
    console.error('Failed to update stored order status:', error);
  }
}

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';
  const [state, setState] = useState<VerificationState>('checking');
  const [message, setMessage] = useState('Verifying your payment with Paystack...');

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setState('failed');
        setMessage('Payment reference is missing. Please retry checkout.');
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/api/payments/paystack/verify/${encodeURIComponent(reference)}`);
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
          updateStoredOrderStatus(data.order?.id, reference, 'failed');
          setState('failed');
          setMessage(data.message || 'Payment could not be verified. You can retry payment from checkout.');
          return;
        }

        updateStoredOrderStatus(data.order?.id, reference, 'paid');
        localStorage.removeItem('fosogo_cart');
        sessionStorage.removeItem('fosogo_checkout_key');
        sessionStorage.removeItem('fosogo_pending_order_id');
        setState('success');
        setMessage('Payment verified successfully. Your order has been confirmed.');
      } catch (error) {
        console.error('Payment verification failed:', error);
        setState('failed');
        setMessage('We could not verify the payment right now. Please check your orders or retry.');
      }
    }

    verifyPayment();
  }, [reference]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase text-gray-500">Paystack Payment</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">
          {state === 'checking' ? 'Verifying payment' : state === 'success' ? 'Payment confirmed' : 'Payment not completed'}
        </h1>
        <p className="mt-4 text-gray-600">{message}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {state === 'success' ? (
            <Link href="/orders" className="rounded-2xl bg-gray-900 px-5 py-3 text-white transition hover:bg-black">
              View Orders
            </Link>
          ) : null}
          {state === 'failed' ? (
            <Link href="/checkout" className="rounded-2xl bg-gray-900 px-5 py-3 text-white transition hover:bg-black">
              Retry Payment
            </Link>
          ) : null}
          <Link href="/" className="rounded-2xl border border-gray-300 px-5 py-3 text-gray-900 transition hover:bg-gray-100">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 text-gray-700">Verifying payment...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
