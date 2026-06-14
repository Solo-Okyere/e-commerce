"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback, useRef } from 'react';

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

type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  size: string;
};

function getApiUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (!configuredUrl) return '';
  try {
    const url = new URL(configuredUrl);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return '';
  } catch {
    return '';
  }
  return configuredUrl.replace(/\/$/, '');
}

export default function Home() {
  const idCounter = useRef<number>((() => {
    try {
      const localCart = localStorage.getItem('fosogo_cart');
      if (localCart) {
        const cartItems: { id: number }[] = JSON.parse(localCart);
        return cartItems.reduce((max, item) => Math.max(max, item.id), 0);
      }
    } catch {}
    return 0;
  })());

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pageAnimated, setPageAnimated] = useState(false);
  const [shopEntered, setShopEntered] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const splashAnimationClass = showSplash ? 'opacity-100 scale-100' : 'opacity-0 scale-95';

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('fosogo_token') : null;
  }

  function getCategoryName(id?: number) {
    if (!id) return null;
    return categories.find((c) => c.id === id)?.name ?? null;
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const hasSeenSplash = sessionStorage.getItem('fosogo_seen_splash');
    if (!hasSeenSplash) setShowSplash(true);
    const entered = sessionStorage.getItem('fosogo_shop_entered') === 'true';
    if (entered) setShopEntered(true);
  }, [mounted]);

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const productsResponse = await fetch(`${apiUrl}/api/products`);
      if (!productsResponse.ok) throw new Error('Failed to load products');
      setProducts(await productsResponse.json());

      const categoriesResponse = await fetch(`${apiUrl}/api/categories`);
      if (categoriesResponse.ok) setCategories(await categoriesResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const filterProducts = useCallback(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== null) {
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    }
    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

  useEffect(() => {
    const loadCart = async () => {
      const token = getToken();
      if (token) {
        try {
          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/cart`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.status === 401) {
            localStorage.removeItem('fosogo_token');
          } else if (!response.ok) {
            return;
          } else {
            const data = await response.json();
            setCartCount(Array.isArray(data) ? data.length : 0);
            return;
          }
        } catch {
          setCartCount(0);
          return;
        }
      }
      const localCart = localStorage.getItem('fosogo_cart');
      if (localCart) {
        try {
          setCartCount((JSON.parse(localCart) as CartItem[]).length);
        } catch {
          setCartCount(0);
        }
      } else {
        setCartCount(0);
      }
    };
    loadCart();
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.style.overflow = showSplash ? 'hidden' : 'auto';
    }
  }, [showSplash]);

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = getApiUrl();
    if (url.startsWith('/uploads') || url.startsWith('/api/products/images/')) return `${apiUrl}${url}`;
    return url;
  }

  function getProductSizes(product?: Product | null) {
    const allowed = ['s', 'm', 'l', 'xl', 'xxl'];
    const sizes = product?.sizes
      ? product.sizes.split(',').map((s) => s.trim().toLowerCase()).filter((s) => allowed.includes(s))
      : [];
    return [...new Set(sizes)];
  }

  async function handleAddToCart(productId: number, size: string) {
    setMessage(null);
    setAddingId(productId);
    const normalizedSize = size.trim().toLowerCase();
    const token = getToken();

    if (token) {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ product_id: productId, quantity: 1, size: normalizedSize }),
        });
        if (response.status === 401) {
          localStorage.removeItem('fosogo_token');
        } else if (!response.ok) {
          const ct = response.headers.get('content-type') || '';
          const payload = ct.includes('application/json') ? await response.json() : {};
          throw new Error(payload.message || 'Unable to add item to cart');
        } else {
          setMessage(`Size ${normalizedSize.toUpperCase()} added to cart.`);
          setCartCount((c) => c + 1);
          setSelectedProduct(null);
          setAddingId(null);
          return;
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Unknown error');
        setAddingId(null);
        return;
      }
    }

    const localCart = localStorage.getItem('fosogo_cart');
    let cartItems: CartItem[] = [];
    if (localCart) {
      try { cartItems = JSON.parse(localCart); } catch {}
    }
    const existing = cartItems.find((i) => i.product_id === productId && i.size === normalizedSize);
    if (existing) {
      existing.quantity += 1;
    } else {
      cartItems.push({ id: ++idCounter.current, product_id: productId, quantity: 1, size: normalizedSize });
    }
    localStorage.setItem('fosogo_cart', JSON.stringify(cartItems));
    setCartCount(cartItems.length);
    setMessage(`Size ${normalizedSize.toUpperCase()} added to cart.`);
    setSelectedProduct(null);
    setAddingId(null);
  }

  function enterShop() {
    setIsExiting(true);
    setTimeout(() => {
      sessionStorage.setItem('fosogo_seen_splash', 'true');
      sessionStorage.setItem('fosogo_shop_entered', 'true');
      setShopEntered(true);
      setShowSplash(false);
      setIsExiting(false);
      setPageAnimated(true);
      requestAnimationFrame(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
      });
    }, 500);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-[60] border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Brand */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-sm shadow-pink-500/30">
              <span className="text-sm font-black leading-none">F</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none tracking-tight text-slate-900 dark:text-zinc-50">FOSOGO</p>
              <p className="mt-0.5 text-[11px] leading-none text-slate-400 dark:text-zinc-500">Boutique</p>
            </div>
          </div>

          {/* Center nav */}
          <nav className={`hidden lg:flex items-center gap-0.5 text-sm text-slate-500 dark:text-zinc-400 transition-opacity ${!shopEntered ? 'pointer-events-none opacity-40' : ''}`}>
            {[
              { href: '#products', label: 'Products' },
              { href: '/orders', label: 'Orders' },
              { href: '/history', label: 'History' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                tabIndex={!shopEntered ? -1 : 0}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className={`flex items-center gap-2 transition-opacity ${!shopEntered ? 'pointer-events-none opacity-40' : ''}`}>
            {/* Search */}
            <div className="relative hidden sm:block">
              <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!shopEntered}
                className="w-40 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:bg-zinc-700/80"
              />
            </div>

            {/* Cart */}
            <Link
              href="/cart"
              tabIndex={!shopEntered ? -1 : 0}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Splash ── */}
      {mounted && showSplash ? (
        <div
          className={`fixed inset-x-0 bottom-0 top-[57px] z-50 flex items-center justify-center overflow-hidden px-4 text-white transition-all duration-500 ease-out ${splashAnimationClass} ${isExiting ? 'pointer-events-none' : ''}`}
        >
          <div className="absolute inset-0 splash-bg" />
          <div className="absolute inset-0 bg-zinc-950/50" />
          <div className="relative max-w-3xl text-center">
            <p className="splash-badge inline-flex rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pink-200 ring-1 ring-white/15">
              New arrivals
            </p>
            <h2 className="splash-title splash-heading-gradient mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Elevate your wardrobe with curated boutique fashion.
            </h2>
            <p className="splash-desc mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-300">
              Discover feminine silhouettes, modern essentials, and bold accessories crafted for a polished look.
            </p>
            <button
              type="button"
              onClick={enterShop}
              className="splash-btn mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-pink-50 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Enter shop
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section id="products">

          {/* Section header */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pink-500">Collection</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                New arrivals
              </h2>
            </div>
            <span className="text-sm tabular-nums text-slate-400 dark:text-zinc-500">
              {filteredProducts.length} items
            </span>
          </div>

          {/* Category pills + search (mobile) */}
          <div className="mt-5 flex flex-col gap-3">
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCategory === null
                    ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              {(searchQuery || selectedCategory !== null) && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                  className="shrink-0 rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-400 hover:text-rose-500 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-rose-600 dark:hover:text-rose-400"
                >
                  Clear ×
                </button>
              )}
            </div>

            {/* Mobile search */}
            <div className="relative sm:hidden">
              <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* Toast message */}
          {message && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {message}
            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                  <div className="aspect-[3/4] bg-slate-200 dark:bg-zinc-700" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3 rounded bg-slate-200 dark:bg-zinc-700 w-3/4" />
                    <div className="h-3 rounded bg-slate-200 dark:bg-zinc-700 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-12 text-center dark:border-rose-900 dark:bg-rose-950/30">
              <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 p-16 text-center dark:border-zinc-700">
              <svg className="h-8 w-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                {searchQuery || selectedCategory ? 'No products match your filters.' : 'No products available.'}
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product, index) => {
                const catName = getCategoryName(product.category_id);
                const outOfStock = (product.stock ?? 0) === 0;
                const noSizes = getProductSizes(product).length === 0;

                return (
                  <article
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`group cursor-pointer overflow-hidden rounded-xl bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:bg-zinc-900 dark:hover:shadow-zinc-900/60 ${
                      pageAnimated ? `animate-fade-in-up prod-stagger-${index}` : ''
                    }`}
                  >
                    {/* Image */}
                    <div className="relative aspect-[3/4] overflow-hidden bg-slate-50 dark:bg-zinc-800">
                      {product.image_url ? (
                        <Image
                          src={normalizeImageUrl(product.image_url)!}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          loading="eager"
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300 dark:text-zinc-600">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        </div>
                      )}

                      {/* Category chip */}
                      {catName && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm dark:bg-zinc-900/85 dark:text-zinc-300">
                          {catName}
                        </span>
                      )}

                      {/* Sold out overlay */}
                      {outOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/55 dark:bg-zinc-900/55">
                          <span className="rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400">
                            Sold out
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-3.5">
                      <h4 className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">
                        {product.name}
                      </h4>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                          GH₵{product.price.toFixed(2)}
                        </p>
                        <button
                          type="button"
                          disabled={outOfStock || addingId === product.id || noSizes}
                          onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        >
                          {addingId === product.id ? '…' : noSizes ? 'N/A' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer strip */}
        <footer className="mt-24 border-t border-slate-100 py-8 text-center dark:border-zinc-800">
          <p className="text-xs text-slate-400 dark:text-zinc-600">
            © {new Date().getFullYear()} FOSOGO Closet · All rights reserved
          </p>
        </footer>
      </main>

      {/* ── Size-picker modal ── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 sm:max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-500">Select size</p>
                <h3 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900 dark:text-zinc-50">
                  {selectedProduct.name}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
                  GH₵{selectedProduct.price.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedProduct(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Size buttons */}
            {getProductSizes(selectedProduct).length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {getProductSizes(selectedProduct).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleAddToCart(selectedProduct.id, size)}
                    disabled={addingId === selectedProduct.id}
                    className="flex h-11 min-w-[3rem] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold uppercase tracking-wide text-slate-900 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-200 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                No sizes available for this product.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
