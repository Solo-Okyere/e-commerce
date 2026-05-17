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

export default function Home() {
  const idCounter = useRef<number>((() => {
    try {
      const localCart = localStorage.getItem('fosogo_cart');
      if (localCart) {
        const cartItems: { id: number }[] = JSON.parse(localCart);
        const maxId = cartItems.reduce((max, item) => Math.max(max, item.id), 0);
        return maxId;
      }
    } catch {
      // ignore parse errors
    }
    return 0;
  })());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('fosogo_token') : null;
  }
  const [addingId, setAddingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pageAnimated, setPageAnimated] = useState(false);
  const [shopEntered, setShopEntered] = useState(false);

  const splashAnimationClass = showSplash ? 'opacity-100 scale-100' : 'opacity-0 scale-95';
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const hasSeenSplash = sessionStorage.getItem('fosogo_seen_splash');
    if (!hasSeenSplash) {
      setShowSplash(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
    // Restore shop-entered state (controls navbar interactivity)
    const entered = sessionStorage.getItem('fosogo_shop_entered') === 'true';
    if (entered) setShopEntered(true);
  }, [mounted]);

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      // Fetch products
      const productsResponse = await fetch(`${apiUrl}/api/products`);
      if (!productsResponse.ok) {
        throw new Error('Failed to load products');
      }
      const productsData = await productsResponse.json();
      setProducts(productsData);

      // Fetch categories
      const categoriesResponse = await fetch(`${apiUrl}/api/categories`);
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const filterProducts = useCallback(() => {
    let filtered = products;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory !== null) {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

    useEffect(() => {
      const loadCart = async () => {
        const token = getToken();
        if (token) {
         try {
           const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
           const response = await fetch(`${apiUrl}/api/cart`, {
             headers: { Authorization: `Bearer ${token}` },
           });
           
            if (response.status === 401) {
              localStorage.removeItem('fosogo_token');
              // Fall through to localStorage cart
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
       
       // Load from localStorage
       const localCart = localStorage.getItem('fosogo_cart');
       if (localCart) {
         try {
           const cartItems: CartItem[] = JSON.parse(localCart);
           setCartCount(cartItems.length);
         } catch {
           setCartCount(0);
         }
       } else {
         setCartCount(0);
       }
     };

      loadCart();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData();
    }, [fetchData]);

   useEffect(() => {
     filterProducts(); // eslint-disable-line react-hooks/set-state-in-effect
   }, [filterProducts]);

   useEffect(() => {
     if (typeof window !== 'undefined') {
       if (showSplash) {
         document.body.style.overflow = 'hidden';
       } else {
         document.body.style.overflow = 'auto';
       }
     }
   }, [showSplash]);

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    if (url.startsWith('/uploads')) {
      return `${apiUrl}${url}`;
    }
    return url;
  }

  function getProductSizes(product?: Product | null) {
    const allowedSizes = ['s', 'm', 'l', 'xl', 'xxl'];
    const sizes = product?.sizes
      ? product.sizes.split(',').map((size) => size.trim().toLowerCase()).filter((size) => allowedSizes.includes(size))
      : [];

    return [...new Set(sizes)];
  }

   async function handleAddToCart(productId: number, size: string) {
      setMessage(null);
      setAddingId(productId);
      const normalizedSize = size.trim().toLowerCase();
      const token = getToken();

      if (token) {
       // Add via API
       try {
         const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
         const response = await fetch(`${apiUrl}/api/cart`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${token}`,
           },
           body: JSON.stringify({ product_id: productId, quantity: 1, size: normalizedSize }),
         });

         const payload = await response.json();
         
          if (response.status === 401) {
            localStorage.removeItem('fosogo_token');
            // Fall through to localStorage cart below
         } else if (!response.ok) {
           throw new Error(payload.message || 'Unable to add item to cart');
         } else {
           setMessage(`Size ${normalizedSize.toUpperCase()} item added to cart successfully.`);
           setCartCount((count) => count + 1);
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
     
     // Fallback: add to localStorage
     const localCart = localStorage.getItem('fosogo_cart');
     let cartItems: CartItem[] = [];
     if (localCart) {
       try {
         cartItems = JSON.parse(localCart);
       } catch {}
     }
     const existingItem = cartItems.find((item) =>
       item.product_id === productId && item.size === normalizedSize
     );
     if (existingItem) {
       existingItem.quantity += 1;
     } else {
       cartItems.push({ id: ++idCounter.current, product_id: productId, quantity: 1, size: normalizedSize });
     }
     localStorage.setItem('fosogo_cart', JSON.stringify(cartItems));
     setCartCount(cartItems.length);
     setMessage(`Size ${normalizedSize.toUpperCase()} item added to cart successfully.`);
     setSelectedProduct(null);
     setAddingId(null);
    }

    function enterShop() {
      setIsExiting(true);
      // Wait for exit animation to complete before hiding splash
      setTimeout(() => {
        sessionStorage.setItem('fosogo_seen_splash', 'true');
        // mark that the user has actively entered the shop
        sessionStorage.setItem('fosogo_shop_entered', 'true');
        setShopEntered(true);
        setShowSplash(false);
        setIsExiting(false);
        setPageAnimated(true);
        requestAnimationFrame(() => {
          document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        });
      }, 500); // Match this with CSS transition duration
    }

   return (
     <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="relative z-[60] border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/20">
              <span className="text-lg font-black">F</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">FOSOGO Closet</h1>
              <p className="text-sm text-slate-500">Boutique fashion marketplace</p>
            </div>
          </div>
          {/** Disable nav interactivity until user clicks Shop now */}
          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
            {(() => {
              const navDisabled = !shopEntered;
              const disabledClass = navDisabled ? 'pointer-events-none opacity-60' : '';

              return (
                <>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={navDisabled}
                    tabIndex={navDisabled ? -1 : 0}
                    className={`w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none sm:w-56 ${disabledClass}`}
                  />
                  <Link
                    href="#products"
                    aria-disabled={navDisabled ? 'true' : 'false'}
                    tabIndex={navDisabled ? -1 : 0}
                    onClick={(e) => { if (navDisabled) { e.preventDefault(); e.stopPropagation(); } }}
                    className={`rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 ${disabledClass}`}
                  >
                    Products
                  </Link>
                  <Link
                    href="/orders"
                    aria-disabled={navDisabled ? 'true' : 'false'}
                    tabIndex={navDisabled ? -1 : 0}
                    onClick={(e) => { if (navDisabled) { e.preventDefault(); e.stopPropagation(); } }}
                    className={`rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 ${disabledClass}`}
                  >
                    Orders
                  </Link>
                  <Link
                    href="/history"
                    aria-disabled={navDisabled ? 'true' : 'false'}
                    tabIndex={navDisabled ? -1 : 0}
                    onClick={(e) => { if (navDisabled) { e.preventDefault(); e.stopPropagation(); } }}
                    className={`rounded-full px-4 py-2 transition hover:bg-slate-100 hover:text-slate-900 ${disabledClass}`}
                  >
                    History
                  </Link>
                  <Link
                    href="/cart"
                    aria-disabled={navDisabled ? 'true' : 'false'}
                    tabIndex={navDisabled ? -1 : 0}
                    onClick={(e) => { if (navDisabled) { e.preventDefault(); e.stopPropagation(); } }}
                    className={`rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition hover:border-slate-300 ${disabledClass}`}
                  >
                    Cart ({cartCount})
                  </Link>
                </>
              );
            })()}
          </nav>
        </div>
      </header>

       {mounted && showSplash ? (
         <div className={`fixed inset-x-0 bottom-0 top-[145px] z-50 flex items-center justify-center bg-slate-950 px-4 text-white sm:top-[121px] lg:top-[93px] transition-all duration-500 ease-out ${splashAnimationClass} ${isExiting ? 'pointer-events-none' : ''}`}>
           <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(236,72,153,0.28),transparent_35%),linear-gradient(315deg,rgba(14,165,233,0.2),transparent_40%)]" />
           <div className="relative max-w-3xl text-center">
             <p className="inline-flex rounded-full bg-white/10 px-4 py-1 text-sm font-semibold text-pink-100 ring-1 ring-white/15">
               New arrivals
             </p>
             <h2 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
               Elevate your wardrobe with curated boutique fashion.
             </h2>
             <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
               Discover feminine silhouettes, modern essentials, and bold accessories crafted for a polished look.
             </p>
             <button
               type="button"
               onClick={enterShop}
               className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-950 transition-all duration-200 active:scale-95 hover:bg-pink-100 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
             >
               Shop now
             </button>
           </div>
         </div>
       ) : null}

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section id="products">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-600">Featured collection</p>
              <h3 className="mt-2 text-3xl font-semibold text-slate-900">Browse new arrivals</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{filteredProducts.length} items</div>
          </div>

          {/* Filter Controls */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <select
                aria-label="Filter by category"
                value={selectedCategory ?? ''}
                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {(searchQuery || selectedCategory) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {message ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 shadow-sm">
              {message}
            </div>
          ) : null}

           {loading ? (
             <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-sm">
               Loading products...
             </div>
           ) : error ? (
             <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">{error}</div>
           ) : filteredProducts.length === 0 ? (
             <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-sm">
               {searchQuery || selectedCategory ? 'No products match your search criteria.' : 'No products available.'}
             </div>
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product, index) => {
                  return (
                    <article
                       key={product.id}
                       onClick={() => setSelectedProduct(product)}
                       className={`group cursor-pointer overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl hover:scale-[1.02] ${pageAnimated ? 'animate-fade-in-up prod-stagger-' + index : ''}`}
                    >
                      <div className="relative h-72 bg-slate-100">
                         {product.image_url ? (
                           <Image
                             src={normalizeImageUrl(product.image_url)!}
                             alt={product.name}
                             fill
                             sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                             loading="eager"
                             className="object-contain p-4 transition duration-500 group-hover:scale-105"
                             unoptimized
                           />
                         ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">No image</div>
                        )}
                      </div>
                      <div className="space-y-4 p-6">
                        <div>
                          <h4 className="text-xl font-semibold text-slate-900">{product.name}</h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-3">{product.description}</p>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold text-slate-900">GH₵{product.price.toFixed(2)}</p>
                            <p className="text-sm text-slate-500">Stock: {product.stock ?? 0}</p>
                          </div>
                          <button
                            type="button"
                            disabled={product.stock === 0 || addingId === product.id || getProductSizes(product).length === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedProduct(product);
                            }}
                            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {addingId === product.id ? 'Adding…' : getProductSizes(product).length === 0 ? 'No sizes' : 'Choose size'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
               </div>
             )}
            </section>
      </main>

      {selectedProduct ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">Select size</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-500">GH₵{selectedProduct.price.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {getProductSizes(selectedProduct).length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {getProductSizes(selectedProduct).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleAddToCart(selectedProduct.id, size)}
                    disabled={addingId === selectedProduct.id}
                    className="rounded-full border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-bold uppercase text-slate-900 transition hover:border-slate-900 hover:bg-white"
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                No sizes have been added for this product yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
