// Function to generate section data
const getSectionData = (id, section, selector) => ({ id, section, selector });

// Check cart drawer and set sections to render
const cartDrawer = document.querySelector('cart-drawer');
let sectionsToRender = [];

if (cartDrawer) {
  const mainCartId = document.getElementById('main-cart-items')?.dataset.id;
  if (mainCartId) {
    sectionsToRender = [
      getSectionData(`#shopify-section-${mainCartId}`, mainCartId, `#shopify-section-${mainCartId} cart-items`),
      getSectionData("#cart-counter", "cart-counter", "#shopify-section-cart-counter"),
      getSectionData("#CartDrawer-Body", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-Body"),
      getSectionData("#CartDrawer-FormSummary", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-FormSummary")
    ];
  } else {
    sectionsToRender = [
      getSectionData("#CartDrawer-Body", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-Body"),
      getSectionData("#CartDrawer-FormSummary", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-FormSummary")
    ];
  }
} else {
  const mainCartId = document.getElementById('main-cart-items')?.dataset.id;
  if (mainCartId) {
    sectionsToRender = [
      getSectionData(`#shopify-section-${mainCartId}`, mainCartId, `#shopify-section-${mainCartId} cart-items`),
      getSectionData('#cart-counter', 'cart-counter', '#shopify-section-cart-counter')
    ];
  } else {
    sectionsToRender = [];
  }
}

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', event => {
      event.preventDefault();
      const cartItems =
        this.closest('cart-drawer-items') ||
        this.closest('cart-items');
      cartItems.updateQuantity(this.dataset.index, 0);
      updateFreeShipping();
    });
  }
}
customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.freeShipping = document.querySelectorAll('shipping-bar');

    this.currentItemCount = Array.from(
      this.querySelectorAll('[name="updates[]"]')
    ).reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);

    this.debouncedOnChange = debounce(event => {
      this.onChange(event);
    }, 300);
    this.addEventListener(
      'change', this.debouncedOnChange.bind(this)
    );

    updateFreeShipping();
  }

  calculateTotalItemCount(items) {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  onChange(event) {
    if (event.target.name !== 'updates[]') return;

    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute('name')
    );
  }

  getSectionsToRender() {
    return sectionsToRender;
  }

  updateQuantity(line, quantity, name) {
    this.classList.add('is-loading');

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map(section => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, {
      ...fetchConfig(),
      ...{ body }
    })
      .then(response => response.text())
      .then(state => {
        const parsedState = JSON.parse(state);
        this.getSectionsToRender()?.forEach(section => {
          const elementToReplace = document.querySelector(section.selector) || document.querySelector(section.id);


          if (elementToReplace) {
            if (!parsedState.errors) {
              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            }
          } else {
            console.error(`Element with selector ${section.selector} not found`);
          }

        });
        if (!parsedState.errors) {
          this.totalItemCount = this.calculateTotalItemCount(parsedState.items);
        }
        this.updateLiveRegions(line, parsedState.item_count, parsedState.errors);

        const lineItem = document.getElementById(`CartItem-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`))
          lineItem.querySelector(`[name="${name}"]`).focus();

        updateCartCounters();
        updateFreeShipping();
      })
      .finally(() => this.classList.remove('is-loading'));
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  updateLiveRegions(line, itemCount, parsedError) {
    if (parsedError) {
      document
        .querySelectorAll(`[data-line-item-error][data-line="${line}"]`)
        .forEach(error => {
          error.innerHTML = parsedError;
        });
    }

    this.currentItemCount = itemCount;
  }
}
customElements.define('cart-items', CartItems);

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("keyup", event => event.code.toUpperCase() === "ESCAPE" && this.close());
    this.setCartLink();
    this.parentElement.addEventListener("shopify:section:select", () => this.open());
    this.parentElement.addEventListener("shopify:section:deselect", () => this.close());
  }

  setCartLink() {
    // Handle all cart links (desktop and mobile)
    const cartLinks = document.querySelectorAll("[data-cart-link]");
    cartLinks.forEach(cartLink => {
      cartLink.setAttribute("role", "button");
      cartLink.setAttribute("aria-haspopup", "dialog");
      // Remove href to prevent navigation
      cartLink.setAttribute("href", "#");
      cartLink.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this.open(cartLink);
      });
      cartLink.addEventListener("keydown", event => {
        if (event.code.toUpperCase() !== "SPACE") return;
        event.preventDefault();
        event.stopPropagation();
        this.open(cartLink);
      });
    });
    
    // Also set up cart link after DOM is ready if not found initially
    if (cartLinks.length === 0) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => this.setCartLink(), 100);
        });
      } else {
        setTimeout(() => this.setCartLink(), 100);
      }
    }
  }

  open(opener) {
    if (opener) this.setActiveElement(opener);
    this.classList.add("is-visible");
    document.querySelector('body').style.overflow = 'hidden';
    this.addEventListener("transitionend", () => { this.focusOnCartDrawer(); }, { once: true });

    setTimeout(() => {
      document.addEventListener("click", this.handleOutsideClick);
    }, 100);

    const productReccomendations = document.querySelector(".product-recommendations");
    if (productReccomendations) {
      if (productReccomendations.classList.contains("hidden")) {
        document.querySelector(".cart-drawer-items").classList.add("cart-drawer-items__full");
      } else {
        document.querySelector(".cart-drawer-items").classList.remove("cart-drawer-items__full");
      }
    }
  }

  close() {
    this.classList.remove("is-visible");
    document.querySelector('body').style.overflow = 'auto';
    removeTrapFocus(this.activeElement);

    document.removeEventListener("click", this.handleOutsideClick);

    const isHeaderMenuOpen = header.classList.contains("menu-open");

    if (isHeaderMenuOpen) {
      return;
    }

    // if we are on the cart page, resubmit form
    if (window.location.pathname === "/cart") {
      const cartDrawerForm = document.getElementById("CartDrawer-FormSummary");
      if (cartDrawerForm) {
        cartDrawerForm.submit();
      }
    }
  }

  handleOutsideClick = event => {
    const cartDrawerInner = this.querySelector(".cart-drawer__inner");
    if (cartDrawerInner && !cartDrawerInner.contains(event.target)) {
      this.close();
    }
  };

  setActiveElement(element) {
    this.activeElement = element;
  }

  focusOnCartDrawer() {
    const containerToTrapFocusOn = this.firstElementChild;
    const focusElement = this.querySelector("[data-drawer-close]");
    trapFocus(containerToTrapFocusOn, focusElement);
  }

  renderContents(response, open = true) {
    this.getSectionsToRender()?.forEach(section => {
      const sectionElement = document.querySelector(section.id);
      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(
        response.sections[section.section],
        section.selector
      );

      updateCartCounters();
    });
    if (!open) {
      return;
    }

    this.open();
  }

  getSectionsToRender() {
    return sectionsToRender;
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }
}
customElements.define("cart-drawer", CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return sectionsToRender;
  }
}
customElements.define("cart-drawer-items", CartDrawerItems);

// Discount Code Handler
class DiscountCodeHandler {
  constructor() {
    this.init();
  }

  init() {
    // Use event delegation on document for reliable click handling
    document.addEventListener('click', (event) => {
      const applyButton = event.target.closest('.cart__discount-apply, .cart-drawer__discount-apply');
      if (applyButton) {
        event.preventDefault();
        event.stopPropagation();
        const form = applyButton.closest('form, .cart-drawer__discount-form, .cart__discount-form');
        if (form) {
          this.applyDiscountCode(form);
        }
      }
    });

    // Handle Enter key in discount input
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const input = event.target;
        if (input && input.name === 'discount' && input.closest('#Cart-DiscountForm, #CartDrawer-DiscountForm')) {
          event.preventDefault();
          const form = input.closest('form, .cart-drawer__discount-form, .cart__discount-form');
          if (form) {
            this.applyDiscountCode(form);
          }
        }
      }
    });
  }

  applyDiscountCode(form) {
    const input = form.querySelector('input[name="discount"]');
    if (!input) return;
    
    const discountCode = input.value.trim();
    // Target the specific apply button by class
    const applyButton = form.querySelector('.cart__discount-apply, .cart-drawer__discount-apply');
    const originalButtonHTML = applyButton ? applyButton.innerHTML : '';
    
    // Find message element with null safety
    const accordionBody = form.closest('.accordion__body-inner');
    const messageEl = accordionBody 
      ? accordionBody.querySelector('.cart-drawer__discount-message, .cart__discount-message')
      : null;

    if (!discountCode) {
      if (messageEl) this.showMessage(messageEl, 'Please enter a discount code', 'error');
      return;
    }

    const isCartDrawer = form.closest('cart-drawer') !== null;

    // Disable button and show loading state on the specific apply button
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.innerHTML = 'Applying...';
    }
    if (messageEl) this.clearMessage(messageEl);

    // Store discount code in localStorage
    localStorage.setItem('discount_code', discountCode);

    this.sendDiscountRequest(discountCode)
      .then(success => {
        if (!success) throw new Error('Failed to apply discount');

        if (messageEl) this.showMessage(messageEl, 'Discount code applied!', 'success');
        input.value = '';
        
        // Small delay to ensure Shopify processes the discount before refreshing
        setTimeout(() => {
          this.refreshCartSections(isCartDrawer);
        }, 300);
      })
      .catch(error => {
        console.error('Error applying discount code:', error);
        if (messageEl) this.showMessage(messageEl, 'Invalid or expired discount code', 'error');
      })
      .finally(() => {
        if (applyButton) {
          applyButton.disabled = false;
          applyButton.innerHTML = originalButtonHTML || 'Apply';
        }
      });
  }

  getSectionInnerHTML(html, selector) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const element = doc.querySelector(selector);
    return element ? element.innerHTML : html;
  }

  showMessage(messageEl, text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.setAttribute(`data-${type}`, 'true');
    messageEl.removeAttribute(`data-${type === 'success' ? 'error' : 'success'}`);
    messageEl.style.display = 'block';
  }

  clearMessage(messageEl) {
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.removeAttribute('data-success');
    messageEl.removeAttribute('data-error');
    messageEl.style.display = 'none';
  }

  sendDiscountRequest(discountCode) {
    return fetch(`/discount/${encodeURIComponent(discountCode)}?redirect=/cart`, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'follow'
    }).then(response => response.ok || response.type === 'opaqueredirect' || response.redirected);
  }

  refreshCartSections(isCartDrawer) {
    const sections = sectionsToRender && sectionsToRender.length ? sectionsToRender : [];

    if (!sections.length) {
      if (!isCartDrawer) {
        window.location.reload();
      }
      return;
    }

    const sectionHandles = [...new Set(sections.map(section => section.section))];
    const sectionsQuery = sectionHandles.join(',');

    fetch(`${routes.cart_url}?sections=${sectionsQuery}`)
      .then(response => response.json())
      .then(sectionsData => {
        const parser = new DOMParser();

        sections.forEach(section => {
          const sectionHTML = sectionsData[section.section];
          if (!sectionHTML) return;

          const doc = parser.parseFromString(sectionHTML, 'text/html');
          const elementToReplace = document.querySelector(section.id);
          const newElement = doc.querySelector(section.id);
          
          if (elementToReplace && newElement) {
            elementToReplace.innerHTML = newElement.innerHTML;
          }
        });

        updateCartCounters();
        if (typeof updateFreeShipping === 'function') {
          updateFreeShipping();
        }
      })
      .catch(error => {
        console.error('Error refreshing cart sections:', error);
        if (!isCartDrawer) {
          window.location.reload();
        }
      });
  }
}

// Initialize discount code handler when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DiscountCodeHandler();
  });
} else {
  new DiscountCodeHandler();
}

// Ensure cart drawer link is set up even if cart drawer loads later
document.addEventListener('DOMContentLoaded', () => {
  const cartDrawer = document.querySelector('cart-drawer');
  if (cartDrawer && typeof cartDrawer.setCartLink === 'function') {
    // Re-setup cart links in case they were added dynamically
    setTimeout(() => {
      cartDrawer.setCartLink();
    }, 100);
  }
});

// Also handle cart links globally as fallback
document.addEventListener('click', (event) => {
  const cartLink = event.target.closest('[data-cart-link]');
  if (cartLink && cartLink.href && cartLink.href.includes('/cart')) {
    const cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer) {
      event.preventDefault();
      event.stopPropagation();
      cartDrawer.open(cartLink);
    }
  }
}, true);
