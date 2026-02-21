/* ============================================================
   Siya Clothing — Core Application JavaScript
   ============================================================
   Features:
   - Page loader with timeout
   - Sticky header with blur-on-scroll
   - Mobile navigation hamburger
   - 3D card tilt (rAF-throttled)
   - Product filtering via data-* attributes
   - Image gallery with lightbox
   - Cart with localStorage persistence + focus trap
   - Scroll reveal animations (IntersectionObserver)
   - Form validation (newsletter + contact)
   - Toast notifications
   - Skeleton loader removal
   - Accordion toggle
   - Quantity selector
   ============================================================ */

; (function () {
  'use strict';

  /* ---------- Utility Helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- Page Loader ---------- */
  function initLoader() {
    const loader = $('#pageLoader');
    if (!loader) return;
    const hide = () => {
      loader.classList.add('hidden');
      setTimeout(() => { loader.style.display = 'none'; }, 600);
    };
    if (document.readyState === 'complete') { hide(); }
    else { window.addEventListener('load', hide); }
    // Safety fallback
    setTimeout(hide, 3500);
  }

  /* ---------- Sticky Header ---------- */
  function initHeader() {
    const header = $('#header');
    if (!header) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('scrolled', window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---------- Mobile Nav ---------- */
  function initMobileNav() {
    const hamburger = $('#hamburger');
    const mobileNav = $('#mobileNav');
    if (!hamburger || !mobileNav) return;

    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('active');
      mobileNav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    $$('a', mobileNav).forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------- 3D Card Tilt (rAF-throttled) ---------- */
  function initTiltCards() {
    const cards = $$('[data-tilt]');
    if (!cards.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    cards.forEach(card => {
      let rafId = null;

      card.addEventListener('mousemove', (e) => {
        if (rafId) return; // throttle
        rafId = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -8;
          const rotateY = ((x - centerX) / centerX) * 8;
          card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`;
          rafId = null;
        });
      });

      card.addEventListener('mouseleave', () => {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(.25,.46,.45,.94)';
        setTimeout(() => { card.style.transition = ''; }, 500);
      });
    });
  }

  /* ---------- Scroll Reveal ---------- */
  function initScrollReveal() {
    const reveals = $$('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    reveals.forEach(el => observer.observe(el));
  }

  /* ---------- Cart System (localStorage persistent) ---------- */
  const Cart = {
    KEY: 'elev_cart',

    getItems() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
      catch { return []; }
    },

    save(items) {
      localStorage.setItem(this.KEY, JSON.stringify(items));
      this.updateUI();
    },

    addItem(item) {
      const items = this.getItems();
      const existing = items.find(i => i.name === item.name && i.size === item.size && i.color === item.color);
      if (existing) {
        existing.qty += item.qty;
      } else {
        items.push(item);
      }
      this.save(items);
      showToast(`${item.name} added to cart!`, 'success');
    },

    removeItem(index) {
      const items = this.getItems();
      items.splice(index, 1);
      this.save(items);
    },

    getTotal() {
      return this.getItems().reduce((sum, i) => sum + (i.price * i.qty), 0);
    },

    getCount() {
      return this.getItems().reduce((sum, i) => sum + i.qty, 0);
    },

    updateUI() {
      // Update cart count badges
      $$('.cart-count').forEach(badge => {
        const count = this.getCount();
        badge.textContent = count;
        badge.classList.toggle('show', count > 0);
      });

      // Update cart total
      const totalEl = $('#cartTotal');
      if (totalEl) totalEl.textContent = `₹${this.getTotal().toFixed(0)}`;

      // Update cart items display
      const container = $('#cartItems');
      if (!container) return;
      const items = this.getItems();

      if (items.length === 0) {
        container.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
        return;
      }

      container.innerHTML = items.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-img"><img src="${item.img}" alt="${item.name}" loading="lazy"></div>
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div style="font-size:.75rem;color:var(--clr-text-muted)">${item.size || ''} ${item.color ? '/ ' + item.color : ''} × ${item.qty}</div>
            <div class="cart-item-price">₹${(item.price * item.qty).toFixed(0)}</div>
            <button class="cart-item-remove" data-remove="${i}" aria-label="Remove ${item.name}">Remove</button>
          </div>
        </div>
      `).join('');

      // Remove buttons
      $$('[data-remove]', container).forEach(btn => {
        btn.addEventListener('click', () => {
          Cart.removeItem(parseInt(btn.dataset.remove));
        });
      });
    }
  };

  /* ---------- Wishlist Data ---------- */
  const Wishlist = {
    KEY: 'elev_wishlist',

    getItems() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
      catch { return []; }
    },

    save(items) {
      localStorage.setItem(this.KEY, JSON.stringify(items));
      this.updateUI();
    },

    addItem(item) {
      const items = this.getItems();
      if (items.find(i => i.name === item.name)) return; // Already exists
      items.push(item);
      this.save(items);
      showToast(`${item.name} added to wishlist!`, 'success');
    },

    removeItem(index) {
      const items = this.getItems();
      const removed = items[index];
      items.splice(index, 1);
      this.save(items);
      if (removed) showToast(`${removed.name} removed from wishlist`, 'success');
    },

    hasItem(name) {
      return this.getItems().some(i => i.name === name);
    },

    getCount() {
      return this.getItems().length;
    },

    updateUI() {
      // Update wishlist count badges
      $$('.wishlist-count').forEach(badge => {
        const count = this.getCount();
        badge.textContent = count;
        badge.classList.toggle('show', count > 0);
      });

      // Update wishlist items display
      const container = $('#wishlistItems');
      if (!container) return;
      const items = this.getItems();

      if (items.length === 0) {
        container.innerHTML = '<div class="cart-empty">Your wishlist is empty</div>';
        return;
      }

      container.innerHTML = items.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-img"><img src="${item.img}" alt="${item.name}" loading="lazy"></div>
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">₹${item.price.toFixed(0)}</div>
            <div style="display:flex;gap:.5rem;margin-top:.25rem">
              <a href="product-detail.html?id=${item.id}" class="cart-item-remove" style="color:var(--clr-accent)">View</a>
              <button class="cart-item-remove" data-wishlist-remove="${i}" aria-label="Remove ${item.name}">Remove</button>
            </div>
          </div>
        </div>
      `).join('');

      // Remove buttons
      $$('[data-wishlist-remove]', container).forEach(btn => {
        btn.addEventListener('click', () => {
          Wishlist.removeItem(parseInt(btn.dataset.wishlistRemove));
        });
      });
    }
  };

  /* ---------- Cart Flyout ---------- */
  function initCart() {
    const cartBtn = $('#cartBtn');
    const cartClose = $('#cartClose');
    const cartOverlay = $('#cartOverlay');
    const cartFlyout = $('#cartFlyout');
    if (!cartBtn || !cartFlyout) return;

    let focusTrapElements = [];
    let previousFocus = null;

    function openCart() {
      previousFocus = document.activeElement;
      cartFlyout.classList.add('open');
      cartOverlay.classList.add('open');
      cartFlyout.setAttribute('aria-hidden', 'false');
      cartOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      Cart.updateUI();

      // Focus trap
      focusTrapElements = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', cartFlyout);
      if (focusTrapElements.length) focusTrapElements[0].focus();
    }

    function closeCart() {
      cartFlyout.classList.remove('open');
      cartOverlay.classList.remove('open');
      cartFlyout.setAttribute('aria-hidden', 'true');
      cartOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (previousFocus) previousFocus.focus();
    }

    cartBtn.addEventListener('click', openCart);
    if (cartClose) cartClose.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    // Focus trap on Tab
    cartFlyout.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeCart(); return; }
      if (e.key !== 'Tab') return;
      const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', cartFlyout);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    // Initialize cart display from localStorage
    Cart.updateUI();
  }

  /* ---------- Add to Cart (Product Detail) ---------- */
  function initAddToCart() {
    const btn = $('#addToCartBtn');
    if (!btn) return;

    const qtyMinus = $('#qtyMinus');
    const qtyPlus = $('#qtyPlus');
    const qtyValue = $('#qtyValue');
    let qty = 1;

    if (qtyMinus) qtyMinus.addEventListener('click', () => {
      if (qty > 1) { qty--; qtyValue.textContent = qty; }
    });
    if (qtyPlus) qtyPlus.addEventListener('click', () => {
      if (qty < 10) { qty++; qtyValue.textContent = qty; }
    });

    btn.addEventListener('click', () => {
      const selectedSize = $('#selectedSize')?.textContent || '';
      const selectedColor = $('#selectedColor')?.textContent || '';

      if (selectedSize === 'Select a size') {
        showToast('Please select a size', 'error');
        return;
      }

      Cart.addItem({
        name: btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        img: btn.dataset.img,
        size: selectedSize,
        color: selectedColor,
        qty: qty
      });

      // Button animation
      btn.classList.add('added');
      btn.disabled = true;
      setTimeout(() => {
        btn.classList.remove('added');
        btn.disabled = false;
      }, 2000);
    });
  }

  /* ---------- Size Selector ---------- */
  function initSizeSelector() {
    const sizeBtns = $$('.size-btn:not(.disabled)');
    const sizeLabel = $('#selectedSize');
    if (!sizeBtns.length) return;

    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        if (sizeLabel) sizeLabel.textContent = btn.dataset.size;
      });
    });
  }

  /* ---------- Color Selector (Product Detail) ---------- */
  function initColorSelector() {
    const swatches = $$('.product-info .color-swatch, .product-detail .color-swatch');
    const colorLabel = $('#selectedColor');
    if (!swatches.length) return;

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        if (colorLabel && swatch.dataset.color) colorLabel.textContent = swatch.dataset.color;
      });
    });
  }

  /* ---------- Image Gallery ---------- */
  function initGallery() {
    const thumbs = $$('.gallery-thumb');
    const mainImg = $('#mainImage');
    if (!thumbs.length || !mainImg) return;

    // Use dynamic images set by initProductDetail()
    const images = window._productImages || [];

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        mainImg.style.opacity = '0';
        setTimeout(() => {
          mainImg.src = images[parseInt(thumb.dataset.index)];
          mainImg.style.opacity = '1';
        }, 200);
      });
    });

    // Lightbox
    const galleryMain = $('#galleryMain');
    const lightbox = $('#lightbox');
    const lightboxImg = $('#lightboxImg');
    const lightboxClose = $('#lightboxClose');

    if (galleryMain && lightbox && lightboxImg) {
      galleryMain.addEventListener('click', () => {
        lightboxImg.src = mainImg.src;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (lightboxClose) lightboxClose.focus();
      });

      const closeLightbox = () => {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      };

      if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
      });
    }
  }

  /* ---------- Accordion ---------- */
  function initAccordion() {
    $$('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        const isOpen = item.classList.contains('open');
        // Close siblings (optional — remove for independent toggles)
        const siblings = $$('.accordion-item', item.parentElement);
        siblings.forEach(s => {
          s.classList.remove('open');
          const h = $('button', s);
          if (h) h.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          header.setAttribute('aria-expanded', 'true');
        }
      });

      // Keyboard accessibility
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });
  }

  /* ---------- Product Filters ---------- */
  function initFilters() {
    const productGrid = $('#productGrid');
    const skeletonGrid = $('#skeletonGrid');
    if (!productGrid) return;

    // Read URL filter param (e.g. ?filter=new)
    const urlParams = new URLSearchParams(window.location.search);
    let activeTag = urlParams.get('filter') || ''; // 'new', 'bestseller', 'sale', or ''

    // Update page title if tag filter active
    const pageTitle = $('.page-title');
    if (pageTitle && activeTag) {
      const labels = { new: 'New Arrivals', bestseller: 'Best Sellers', sale: 'Sale' };
      if (labels[activeTag]) pageTitle.textContent = labels[activeTag];
    }

    const filterCheckboxes = $$('[data-filter="category"], [data-filter="size"]');
    const colorSwatches = $$('.filter-sidebar .color-swatch');
    const priceRange = $('#priceRange');
    const priceValue = $('#priceValue');
    const sortSelect = $('#sortSelect');
    const resultsCount = $('#resultsCount');
    const clearBtn = $('#clearFilters');
    const filterToggle = $('#filterToggle');
    const filterSidebar = $('#filterSidebar');

    // Show products after "loading"
    setTimeout(() => {
      if (skeletonGrid) skeletonGrid.style.display = 'none';
      productGrid.style.display = '';
      applyFilters(); // Apply filters (including URL param) immediately
      initScrollReveal(); // Re-trigger reveal for product cards
    }, 1200);

    // Mobile filter toggle
    if (filterToggle && filterSidebar) {
      // Show toggle on mobile
      if (window.innerWidth <= 768) filterToggle.style.display = '';
      window.addEventListener('resize', () => {
        filterToggle.style.display = window.innerWidth <= 768 ? '' : 'none';
      });
      filterToggle.addEventListener('click', () => {
        filterSidebar.classList.toggle('open');
        filterSidebar.style.display = filterSidebar.classList.contains('open') ? 'block' : '';
      });
    }

    // Active color filters
    let activeColors = [];

    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatch.classList.toggle('active');
        const color = swatch.dataset.value;
        if (activeColors.includes(color)) {
          activeColors = activeColors.filter(c => c !== color);
        } else {
          activeColors.push(color);
        }
        applyFilters();
      });
    });

    if (priceRange) {
      priceRange.addEventListener('input', () => {
        const val = parseInt(priceRange.value);
        if (priceValue) priceValue.textContent = `\u20B9${val.toLocaleString('en-IN')}`;
        applyFilters();
      });
    }

    filterCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    if (sortSelect) sortSelect.addEventListener('change', applyFilters);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        filterCheckboxes.forEach(cb => cb.checked = false);
        colorSwatches.forEach(s => s.classList.remove('active'));
        activeColors = [];
        activeTag = ''; // Clear URL tag filter too
        if (priceRange) { priceRange.value = 2000; if (priceValue) priceValue.textContent = '₹2,000'; }
        if (sortSelect) sortSelect.value = 'featured';
        if (pageTitle) pageTitle.textContent = 'Shop All';
        // Clean the URL param without reload
        history.replaceState(null, '', window.location.pathname);
        applyFilters();
      });
    }

    function applyFilters() {
      const cards = $$('.product-card', productGrid);
      const activeCategories = $$('[data-filter="category"]:checked').map(cb => cb.value);
      const activeSizes = $$('[data-filter="size"]:checked').map(cb => cb.value);
      const maxPrice = priceRange ? parseInt(priceRange.value) : 9999;

      let visibleCards = [];

      cards.forEach(card => {
        const category = card.dataset.category;
        const price = parseInt(card.dataset.price);
        const sizes = (card.dataset.size || '').split(',');
        const color = card.dataset.color;
        const tag = card.dataset.tag || '';

        const catMatch = activeCategories.length === 0 || activeCategories.includes(category);
        const sizeMatch = activeSizes.length === 0 || activeSizes.some(s => sizes.includes(s));
        const priceMatch = price <= maxPrice;
        const colorMatch = activeColors.length === 0 || activeColors.includes(color);
        const tagMatch = !activeTag || tag === activeTag;

        const visible = catMatch && sizeMatch && priceMatch && colorMatch && tagMatch;
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCards.push(card);
      });

      // Sort
      if (sortSelect) {
        const sortVal = sortSelect.value;
        visibleCards.sort((a, b) => {
          const priceA = parseInt(a.dataset.price);
          const priceB = parseInt(b.dataset.price);
          if (sortVal === 'price-low') return priceA - priceB;
          if (sortVal === 'price-high') return priceB - priceA;
          return 0;
        });
        visibleCards.forEach(card => productGrid.appendChild(card));
      }

      if (resultsCount) resultsCount.textContent = visibleCards.length;
    }
  }

  /* ---------- Newsletter Form ---------- */
  function initNewsletter() {
    const form = $('#newsletterForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#nlEmail');
      if (email && email.value && email.value.includes('@')) {
        showToast('Welcome! Check your inbox for 10% off 🎉', 'success');
        email.value = '';
      } else {
        showToast('Please enter a valid email address', 'error');
      }
    });
  }

  /* ---------- Contact Form ---------- */
  function initContactForm() {
    const form = $('#contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      // Validate name
      const nameGroup = $('#nameGroup');
      const name = $('#contactName');
      if (!name.value.trim()) {
        nameGroup.classList.add('error');
        valid = false;
      } else {
        nameGroup.classList.remove('error');
      }

      // Validate email
      const emailGroup = $('#emailGroup');
      const email = $('#contactEmail');
      if (!email.value.trim() || !email.value.includes('@')) {
        emailGroup.classList.add('error');
        valid = false;
      } else {
        emailGroup.classList.remove('error');
      }

      // Validate message
      const msgGroup = $('#messageGroup');
      const msg = $('#contactMessage');
      if (!msg.value.trim()) {
        msgGroup.classList.add('error');
        valid = false;
      } else {
        msgGroup.classList.remove('error');
      }

      if (valid) {
        showToast('Message sent successfully! We\'ll be in touch soon. ✉️', 'success');
        form.reset();
      }
    });

    // Clear error on input
    $$('input, textarea', form).forEach(field => {
      field.addEventListener('input', () => {
        field.closest('.form-group')?.classList.remove('error');
      });
    });
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function showToast(message, type = 'success') {
    const toast = $('#toast');
    const toastMsg = $('#toastMessage');
    const toastIcon = toast?.querySelector('.toast-icon');
    if (!toast || !toastMsg) return;

    clearTimeout(toastTimer);
    toast.classList.remove('show', 'success', 'error');

    toastMsg.textContent = message;
    toast.classList.add(type);
    if (toastIcon) toastIcon.textContent = type === 'success' ? '✓' : '✕';

    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  /* ---------- Wishlist Button ---------- */
  function initWishlist() {
    const btn = $('#wishlistBtn');
    if (!btn) return;

    // Get product info from the add-to-cart button or data attributes
    const cartBtn = $('#addToCartBtn');
    const productName = cartBtn?.dataset.name || '';
    const productPrice = parseFloat(cartBtn?.dataset.price || 0);
    const productImg = cartBtn?.dataset.img || '';
    // Try to get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id')) || 0;

    // Check if already wishlisted
    let wishlisted = Wishlist.hasItem(productName);
    if (wishlisted) {
      btn.textContent = '♥ Added to Wishlist';
      btn.style.borderColor = 'var(--clr-accent)';
      btn.style.color = 'var(--clr-accent)';
    }

    btn.addEventListener('click', () => {
      wishlisted = !wishlisted;
      if (wishlisted) {
        Wishlist.addItem({
          id: productId,
          name: productName,
          price: productPrice,
          img: productImg
        });
      } else {
        // Remove by finding the index
        const items = Wishlist.getItems();
        const idx = items.findIndex(i => i.name === productName);
        if (idx !== -1) Wishlist.removeItem(idx);
        else showToast('Removed from wishlist', 'success');
      }
      btn.textContent = wishlisted ? '♥ Added to Wishlist' : '♡ Add to Wishlist';
      btn.style.borderColor = wishlisted ? 'var(--clr-accent)' : '';
      btn.style.color = wishlisted ? 'var(--clr-accent)' : '';
    });
  }

  /* ---------- Wishlist Flyout ---------- */
  function initWishlistFlyout() {
    const wishBtn = $('#wishlistNavBtn');
    const wishClose = $('#wishlistClose');
    const wishOverlay = $('#wishlistOverlay');
    const wishFlyout = $('#wishlistFlyout');
    if (!wishBtn || !wishFlyout) return;

    let previousFocus = null;

    function openWishlist() {
      previousFocus = document.activeElement;
      wishFlyout.classList.add('open');
      wishOverlay.classList.add('open');
      wishFlyout.setAttribute('aria-hidden', 'false');
      wishOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      Wishlist.updateUI();
      const focusable = $$('button, [href], input', wishFlyout);
      if (focusable.length) focusable[0].focus();
    }

    function closeWishlist() {
      wishFlyout.classList.remove('open');
      wishOverlay.classList.remove('open');
      wishFlyout.setAttribute('aria-hidden', 'true');
      wishOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (previousFocus) previousFocus.focus();
    }

    wishBtn.addEventListener('click', openWishlist);
    if (wishClose) wishClose.addEventListener('click', closeWishlist);
    if (wishOverlay) wishOverlay.addEventListener('click', closeWishlist);

    wishFlyout.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeWishlist(); return; }
      if (e.key !== 'Tab') return;
      const focusable = $$('button, [href], input', wishFlyout);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    Wishlist.updateUI();
  }

  /* ---------- Parallax Hero ---------- */
  function initParallax() {
    const heroBg = $('.hero-bg');
    if (!heroBg) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scroll = window.scrollY;
          heroBg.style.transform = `translateY(${scroll * 0.3}px) scale(1.1)`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ---------- Hero Cursor Glow ---------- */
  function initHeroCursorEffect() {
    const hero = $('.hero');
    if (!hero) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const glow = document.createElement('div');
    glow.style.cssText = `
      position:absolute;width:400px;height:400px;border-radius:50%;
      background:radial-gradient(circle,rgba(201,169,110,.08) 0%,transparent 70%);
      pointer-events:none;z-index:1;transition:transform .1s;
      transform:translate(-50%,-50%)
    `;
    hero.style.position = 'relative';
    hero.appendChild(glow);

    let rafId = null;
    hero.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        glow.style.left = `${e.clientX - rect.left}px`;
        glow.style.top = `${e.clientY - rect.top}px`;
        rafId = null;
      });
    });
  }

  /* ---------- Smooth Page Transition ---------- */
  function initPageTransitions() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  }

  /* ---------- Dynamic Product Detail Page ---------- */
  function initProductDetail() {
    const main = $('#productDetailMain');
    if (!main) return; // Not on product-detail page

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    // Check if PRODUCTS data is available
    if (typeof PRODUCTS === 'undefined' || typeof getProductById === 'undefined') {
      main.innerHTML = '<div style="text-align:center;padding:4rem 1rem"><h2>Product data not available</h2><p style="color:var(--clr-text-muted);margin-top:1rem">Please try again later.</p><a href="products.html" class="btn btn-primary" style="margin-top:2rem;display:inline-block">Browse Products</a></div>';
      return;
    }

    if (!productId) {
      // No ID — redirect to products page
      window.location.href = 'products.html';
      return;
    }

    const product = getProductById(productId);

    if (!product) {
      // Invalid ID — show error with back link
      main.innerHTML = `
        <div style="text-align:center;padding:4rem 1rem">
          <h2 style="font-size:var(--fs-xl)">Product Not Found</h2>
          <p style="color:var(--clr-text-muted);margin-top:1rem;max-width:400px;margin-left:auto;margin-right:auto">
            Sorry, we couldn't find the product you're looking for. It may have been removed or the link may be incorrect.
          </p>
          <a href="products.html" class="btn btn-primary" style="margin-top:2rem;display:inline-block">Browse All Products</a>
        </div>`;
      document.title = 'Product Not Found — Siya Clothing';
      const bcName = $('#breadcrumbName');
      if (bcName) bcName.textContent = 'Not Found';
      return;
    }

    // Update page title and breadcrumb
    document.title = `${product.name} — Siya Clothing`;
    const bcName = $('#breadcrumbName');
    if (bcName) bcName.textContent = product.name;


    // Build color swatches
    const colorsHTML = product.colors.map((c, i) => `
      <button class="color-swatch${i === 0 ? ' active' : ''}" style="background:${c.hex}" data-color="${c.name}" aria-label="${c.name}" title="${c.name}"></button>
    `).join('');

    // Build size buttons
    const sizesHTML = product.sizes.map(s => `
      <button class="size-btn" role="radio" aria-checked="false" data-size="${s}">${s}</button>
    `).join('');

    // Build price display
    const priceHTML = product.oldPrice
      ? `₹${product.price.toLocaleString('en-IN')} <span class="old-price">₹${product.oldPrice.toLocaleString('en-IN')}</span>`
      : `₹${product.price.toLocaleString('en-IN')}`;

    // Build details list
    const detailsHTML = product.details.map(d => `<li>${d}</li>`).join('');

    // Render the full product detail
    main.innerHTML = `
    <div class="product-detail">
      <!-- Gallery -->
      <div class="gallery reveal">
        <div class="gallery-main" id="galleryMain" role="img" aria-label="Product image">
          <img src="${productImg(product.images[0], 800)}" alt="${product.name}" id="mainImage">
        </div>
      </div>

      <!-- Product Info -->
      <div class="product-info reveal">
        <p class="product-category">${product.category}</p>
        <h1 class="product-name">${product.name}</h1>
        <p class="product-price">${priceHTML}</p>
        <p class="product-desc">${product.description}</p>

        <!-- Color Selector -->
        <div class="size-selector">
          <div class="label">Color — <span id="selectedColor">${product.colors[0].name}</span></div>
          <div class="color-swatches" style="margin-top:.5rem">${colorsHTML}</div>
        </div>

        <!-- Size Selector -->
        <div class="size-selector">
          <div class="label">Size — <span id="selectedSize">Select a size</span></div>
          <div class="size-options" role="radiogroup" aria-label="Size selection">${sizesHTML}</div>
        </div>

        <!-- Add to Cart -->
        <div class="add-to-cart-group">
          <div class="qty-selector">
            <button class="qty-btn" id="qtyMinus" aria-label="Decrease quantity">−</button>
            <span class="qty-value" id="qtyValue" aria-live="polite">1</span>
            <button class="qty-btn" id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary btn-add-cart" id="addToCartBtn"
                  data-name="${product.name}" data-price="${product.price}"
                  data-img="${productImg(product.images[0], 150)}">
            Add to Cart — ₹${product.price.toLocaleString('en-IN')}
          </button>
        </div>

        <!-- Wishlist -->
        <button class="btn btn-outline" style="width:100%;margin-bottom:var(--sp-lg)" id="wishlistBtn">
          ♡ Add to Wishlist
        </button>
      </div>
    </div>

    <!-- Full-width Accordion Section -->
    <div class="product-detail-extra">
      <div class="accordion">
          <div class="accordion-item open">
            <button class="accordion-header" aria-expanded="true">
              Description <span class="accordion-icon">▾</span>
            </button>
            <div class="accordion-body">
              <div class="accordion-body-inner">
                <p>${product.description}</p>
                <ul style="margin-top:.5rem;padding-left:1.2rem;list-style:disc;color:var(--clr-text-muted)">
                  ${detailsHTML}
                </ul>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <button class="accordion-header" aria-expanded="false">
              Size & Fit <span class="accordion-icon">▾</span>
            </button>
            <div class="accordion-body">
              <div class="accordion-body-inner">
                <p>${product.fit}</p>
              </div>
            </div>
          </div>
          <div class="accordion-item">
            <button class="accordion-header" aria-expanded="false">
              Shipping & Returns <span class="accordion-icon">▾</span>
            </button>
            <div class="accordion-body">
              <div class="accordion-body-inner">
                <p>Free standard shipping on orders over $150. Express shipping available at checkout.</p>
                <p style="margin-top:.5rem">We accept returns within 30 days of purchase. Items must be unworn with original tags attached.</p>
              </div>
            </div>
          </div>
        </div>
    </div>`;

    // Store images array on the gallery for the gallery init to pick up
    window._productImages = product.images.map(img => productImg(img, 800));

    // Re-initialize interactive components after DOM injection
    window._pdpInitialized = true;
    initAddToCart();
    initSizeSelector();
    initColorSelector();
    initGallery();
    initAccordion();
    initWishlist();
    initScrollReveal();
  }

  /* ---------- Search Overlay ---------- */
  function initSearch() {
    const searchBtn = $('#searchBtn');
    if (!searchBtn) return;

    // Build overlay HTML and inject into body
    if (!$('#searchOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'searchOverlay';
      overlay.className = 'search-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Search products');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <div class="search-modal">
          <div class="search-bar">
            <span class="search-icon-inner">🔍</span>
            <input
              id="searchInput"
              type="search"
              class="search-input"
              placeholder="Search products, categories..."
              autocomplete="off"
              aria-label="Search products"
            />
            <button id="searchClose" class="search-close" aria-label="Close search">✕</button>
          </div>
          <div id="searchResults" class="search-results" role="listbox" aria-live="polite"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const overlay = $('#searchOverlay');
    const input = $('#searchInput');
    const results = $('#searchResults');
    const closeBtn = $('#searchClose');
    let previousFocus = null;

    function openSearch() {
      previousFocus = document.activeElement;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input && input.focus(), 60);
      renderResults('');
    }

    function closeSearch() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (input) input.value = '';
      if (results) results.innerHTML = '';
      if (previousFocus) previousFocus.focus();
    }

    function renderResults(query) {
      if (!results) return;
      const q = query.trim().toLowerCase();

      // Guard if PRODUCTS not available (non-product pages)
      if (typeof PRODUCTS === 'undefined') {
        results.innerHTML = `
          <div class="search-empty">
            <div class="search-empty-icon">🔍</div>
            <p>Start typing to search</p>
            <a href="products.html?q=${encodeURIComponent(q)}" class="btn btn-primary" style="margin-top:1rem">Browse All Products →</a>
          </div>`;
        return;
      }

      const matched = q === ''
        ? PRODUCTS.slice(0, 6)
        : PRODUCTS.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        ).slice(0, 8);

      if (matched.length === 0) {
        results.innerHTML = `
          <div class="search-empty">
            <div class="search-empty-icon">😞</div>
            <p>No products found for "<strong>${query}</strong>"</p>
            <a href="products.html" class="btn btn-outline" style="margin-top:1rem;display:inline-block">Browse All Products</a>
          </div>`;
        return;
      }

      results.innerHTML = `
        <p class="search-hint">${q === '' ? 'Popular picks' : `${matched.length} result${matched.length !== 1 ? 's' : ''} for "${query}"`}</p>
        <div class="search-grid">
          ${matched.map(p => {
        const img = (p.images && p.images[0]) ? `${p.images[0]}&w=200&q=70&fit=crop` : '';
        const price = p.oldPrice
          ? `<span class="search-price">₹${p.price.toFixed(0)}</span><span class="search-old-price">₹${p.oldPrice.toFixed(0)}</span>`
          : `<span class="search-price">₹${p.price.toFixed(0)}</span>`;
        return `
              <a href="product-detail.html?id=${p.id}" class="search-card" role="option">
                <div class="search-card-img">
                  ${img ? `<img src="${img}" alt="${p.name}" loading="lazy">` : `<div class="search-card-placeholder">📦</div>`}
                </div>
                <div class="search-card-info">
                  <p class="search-card-cat">${p.category}</p>
                  <p class="search-card-name">${p.name}</p>
                  <div class="search-card-price">${price}</div>
                </div>
              </a>`;
      }).join('')}
        </div>
        ${matched.length >= 6 && q !== '' ? `<div class="search-footer"><a href="products.html" class="btn btn-outline">View all results ↗</a></div>` : ''}`;
    }

    // Wire events
    searchBtn.addEventListener('click', openSearch);
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeSearch();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
    });
    if (input) {
      input.addEventListener('input', () => renderResults(input.value));
    }
  }

  /* ---------- Initialize Everything ---------- */
  function init() {
    initPageTransitions();
    initLoader();
    initHeader();
    initMobileNav();
    initTiltCards();
    initScrollReveal();
    initCart();
    initWishlistFlyout();
    initSearch();
    initProductDetail(); // Must run before individual component inits

    // Skip these if product detail page already initialized them
    if (!window._pdpInitialized) {
      initAddToCart();
      initSizeSelector();
      initColorSelector();
      initGallery();
      initAccordion();
      initWishlist();
    }

    initFilters();
    initNewsletter();
    initContactForm();
    initParallax();
    initHeroCursorEffect();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
