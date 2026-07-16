// ===== Firebase Setup =====
firebase.initializeApp({
    apiKey: "AIzaSyDHVrCgERAOu_zbtSeSfxJHBGnthhNNQac",
    authDomain: "grocery-inventory-a1cb8.firebaseapp.com",
    projectId: "grocery-inventory-a1cb8",
    storageBucket: "grocery-inventory-a1cb8.firebasestorage.app",
    messagingSenderId: "546132582082",
    appId: "1:546132582082:web:c4e793340d22ccdfb6655b"
});
const db = firebase.firestore();
const storage = firebase.storage();
const productsRef = db.collection('products');

// Enable Firestore offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => console.warn('Offline persistence unavailable:', err.code));

// ===== Local Cache =====
let productsCache = [];
let selectedProducts = new Set();
let currentView = 'grid';
let stockHistory = JSON.parse(localStorage.getItem('stockHistory') || '[]');
let unsubscribeProducts = null;
let html5QrCode = null;
let scanTarget = 'search';
const historyRef = db.collection('stockHistory');
const CATEGORY_EMOJIS = {
    'Fruits & Vegetables': '🥬', 'Dairy & Eggs': '🥛', 'Grains & Cereals': '🌾',
    'Spices & Masala': '🌶️', 'Snacks & Biscuits': '🍪', 'Beverages': '🥤',
    'Oil & Ghee': '🫒', 'Pulses & Lentils': '🫘', 'Personal Care': '🧴',
    'Household': '🏠', 'Frozen Foods': '🧊', 'Bakery': '🍞', 'Rice': '🍚', 'Other': '📦'
};

let currentImageData = null;
let currentImageFile = null; // Raw File object for Firebase Storage upload

function getProducts() { return productsCache; }

// ===== Security: HTML Escaping (XSS Prevention) =====
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ===== Image Helpers =====
function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be under 2MB', 'error');
        return;
    }
    currentImageFile = file; // Store raw file for Firebase Storage upload
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageData = e.target.result;
        showImagePreview(currentImageData);
    };
    reader.readAsDataURL(file);
}

function showImagePreview(src) {
    const placeholder = document.getElementById('uploadPlaceholder');
    const preview = document.getElementById('uploadPreview');
    const previewImg = document.getElementById('previewImg');
    placeholder.style.display = 'none';
    preview.style.display = 'flex';
    previewImg.src = src;
}

function clearImagePreview() {
    currentImageData = null;
    currentImageFile = null;
    const placeholder = document.getElementById('uploadPlaceholder');
    const preview = document.getElementById('uploadPreview');
    const previewImg = document.getElementById('previewImg');
    const fileInput = document.getElementById('productImage');
    placeholder.style.display = 'flex';
    preview.style.display = 'none';
    previewImg.src = '';
    if (fileInput) fileInput.value = '';
}

// ===== Firebase Storage Image Upload/Delete =====
async function uploadProductImage(file, productId) {
    const ext = file.name.split('.').pop() || 'jpg';
    const imagePath = `products/${productId}.${ext}`;
    const ref = storage.ref(imagePath);
    await ref.put(file, { contentType: file.type });
    const url = await ref.getDownloadURL();
    return { imageUrl: url, imagePath: imagePath };
}

async function deleteProductImage(imagePath) {
    if (!imagePath) return;
    try {
        await storage.ref(imagePath).delete();
    } catch (e) {
        console.warn('Image deletion skipped (may not exist):', e.code);
    }
}

// ===== Toast (with optional Undo) =====
function showToast(message, type = 'success', undoCallback = null) {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const undoHtml = undoCallback ? `<button class="toast-undo" onclick="this._undo()">Undo</button>` : '';
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${message}</span>${undoHtml}`;
    if (undoCallback) {
        const btn = toast.querySelector('.toast-undo');
        btn._undo = () => { undoCallback(); toast.remove(); };
    }
    container.appendChild(toast);
    const dismiss = () => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; setTimeout(() => toast.remove(), 300); };
    const timer = setTimeout(dismiss, undoCallback ? 5000 : 3000);
    if (undoCallback) toast.querySelector('.toast-undo').addEventListener('click', () => clearTimeout(timer));
}

// ===== Navigation =====
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    const titles = {
        'dashboard': ['Dashboard', 'Overview of your grocery inventory'],
        'products': ['Products', 'Manage your product inventory'],
        'add-product': ['Add Product', 'Add a new product to inventory'],
        'categories': ['Categories', 'Browse products by category'],
        'alerts': ['Low Stock Alerts', 'Products that need restocking'],
        'history': ['Stock History', 'Track all inventory changes']
    };
    const [title, sub] = titles[page] || ['', ''];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = sub;
    closeSidebar();
    // Update mobile bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
    });
    if (page === 'dashboard') renderDashboard();
    if (page === 'products') { selectedProducts.clear(); updateBulkBar(); renderProducts(); }
    if (page === 'categories') renderCategories();
    if (page === 'alerts') renderAlerts();
    if (page === 'history') renderHistory();
}

// ===== Sidebar =====
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// ===== Dashboard =====
function renderDashboard() {
    const products = getProducts();
    const total = products.length;
    const inStock = products.filter(p => p.quantity > (p.minQuantity || 5)).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= (p.minQuantity || 5)).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    const totalValue = products.reduce((s, p) => s + ((p.price || 0) * p.quantity), 0);

    document.getElementById('statTotalProducts').textContent = total;
    document.getElementById('statInStock').textContent = inStock;
    document.getElementById('statLowStock').textContent = lowStock + outOfStock;
    document.getElementById('statTotalValue').textContent = '₹' + totalValue.toLocaleString('en-IN');
    // Animated counters
    animateCounter('statTotalProducts', total);
    animateCounter('statInStock', inStock);
    animateCounter('statLowStock', lowStock + outOfStock);
    animateCounterValue('statTotalValue', totalValue);

    const catCounts = {};
    products.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
    const catBars = document.getElementById('categoryBars');
    if (Object.keys(catCounts).length === 0) {
        catBars.innerHTML = '<p class="empty-state-text">Add products to see category breakdown</p>';
    } else {
        const maxCount = Math.max(...Object.values(catCounts));
        catBars.innerHTML = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) =>
            `<div class="category-bar-item"><div class="category-bar-label"><span>${CATEGORY_EMOJIS[cat] || '📦'} ${escapeHtml(cat)}</span><span>${count}</span></div><div class="category-bar-track"><div class="category-bar-fill" style="width:${(count / maxCount) * 100}%"></div></div></div>`
        ).join('');
    }

    const recentList = document.getElementById('recentList');
    const recent = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    if (recent.length === 0) {
        recentList.innerHTML = '<p class="empty-state-text">No products added yet</p>';
    } else {
        recentList.innerHTML = recent.map(p =>
            `<div class="recent-item"><div class="recent-dot" style="background:${p.quantity === 0 ? 'var(--red)' : p.quantity <= (p.minQuantity || 5) ? 'var(--yellow)' : 'var(--green)'}"></div><div class="recent-info"><div class="recent-name">${escapeHtml(p.name)}</div><div class="recent-meta">${escapeHtml(p.category)} · ${p.quantity} ${escapeHtml(p.unit)}</div></div><div class="recent-price">₹${p.price || 0}</div></div>`
        ).join('');
    }

    const lowItems = products.filter(p => p.quantity <= (p.minQuantity || 5));
    const card = document.getElementById('lowStockDashboardCard');
    if (lowItems.length > 0) {
        card.style.display = 'block';
        document.getElementById('lowStockDashboardList').innerHTML = lowItems.slice(0, 5).map(p =>
            `<div class="low-stock-item"><span>${escapeHtml(p.name)} <span style="color:var(--text-muted)">(${escapeHtml(p.category)})</span></span><span style="color:${p.quantity === 0 ? 'var(--red)' : 'var(--yellow)'};font-weight:600">${p.quantity} ${escapeHtml(p.unit)}</span></div>`
        ).join('');
    } else { card.style.display = 'none'; }

    document.getElementById('alertBadge').textContent = lowItems.length;
    document.getElementById('alertBadge').style.display = lowItems.length > 0 ? 'inline' : 'none';
}

// ===== Products =====
function renderProducts(searchQuery = '') {
    const products = getProducts();
    const catFilter = document.getElementById('filterCategory').value;
    const stockFilter = document.getElementById('filterStock').value;
    const sortBy = document.getElementById('sortBy').value;

    let filtered = products.filter(p => {
        const queryClean = searchQuery.toLowerCase().trim();
        if (searchQuery && 
            !p.name.toLowerCase().includes(queryClean) && 
            !(p.brand || '').toLowerCase().includes(queryClean) &&
            !(p.barcode || '').toLowerCase().includes(queryClean)
        ) return false;
        if (catFilter !== 'all' && p.category !== catFilter) return false;
        if (stockFilter === 'in-stock' && p.quantity <= (p.minQuantity || 5)) return false;
        if (stockFilter === 'low-stock' && (p.quantity === 0 || p.quantity > (p.minQuantity || 5))) return false;
        if (stockFilter === 'out-of-stock' && p.quantity !== 0) return false;
        return true;
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            case 'price-asc': return (a.price||0) - (b.price||0);
            case 'price-desc': return (b.price||0) - (a.price||0);
            case 'qty-asc': return a.quantity - b.quantity;
            case 'qty-desc': return b.quantity - a.quantity;
            case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
            case 'date-asc': return new Date(a.createdAt) - new Date(b.createdAt);
            default: return 0;
        }
    });

    const grid = document.getElementById('productsGrid');
    grid.className = currentView === 'list' ? 'products-grid list-view' : 'products-grid';
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><h3>No products yet</h3><p>Start by adding your first product</p><button class="btn btn-primary" onclick="resetForm(); navigateTo('add-product');">Add First Product</button></div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const badgeClass = p.quantity === 0 ? 'badge-out-of-stock' : p.quantity <= (p.minQuantity || 5) ? 'badge-low-stock' : 'badge-in-stock';
        const badgeText = p.quantity === 0 ? 'Out of Stock' : p.quantity <= (p.minQuantity || 5) ? 'Low Stock' : 'In Stock';
        const imgSrc = p.imageUrl || p.imageData;
        const imageHtml = imgSrc
            ? `<div class="product-card-image"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" loading="lazy"></div>`
            : `<div class="product-card-image"><div class="product-card-image-placeholder">${CATEGORY_EMOJIS[p.category] || '📦'}</div></div>`;
        const checked = selectedProducts.has(p.id) ? 'checked' : '';
        const minQty = p.minQuantity || 5;
        const maxQty = Math.max(p.quantity, minQty * 2, 1);
        const pct = Math.min(100, Math.round((p.quantity / maxQty) * 100));
        const barColor = p.quantity === 0 ? 'var(--red)' : p.quantity <= minQty ? 'var(--yellow)' : 'var(--green)';
        const stockBar = `<div class="stock-bar-track"><div class="stock-bar-fill" style="width:${pct}%;background:${barColor}" data-pct="${pct}"></div></div>`;
        return `<div class="product-card" data-id="${escapeHtml(p.id)}">
            <label class="product-select" onclick="event.stopPropagation()"><input type="checkbox" ${checked} onchange="toggleSelect('${escapeHtml(p.id)}',this.checked)"></label>
            ${imageHtml}
            <div class="product-card-top">
                <div><div class="product-name">${escapeHtml(p.name)}</div>${p.brand ? `<div class="product-brand">${escapeHtml(p.brand)}</div>` : ''}</div>
                <span class="product-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="product-details">
                <div class="product-detail"><span class="label">Category</span><span class="value">${CATEGORY_EMOJIS[p.category] || '📦'} ${escapeHtml(p.category)}</span></div>
                <div class="product-detail"><span class="label">Price</span><span class="value">₹${p.price || 0}</span></div>
                <div class="product-detail"><span class="label">Stock</span><span class="value">${p.quantity} ${escapeHtml(p.unit)}</span></div>
            </div>
            ${stockBar}
            <div class="product-actions">
                <div class="product-qty-controls">
                    <button class="qty-btn" onclick="updateQty('${escapeHtml(p.id)}',-1)">−</button>
                    <div class="qty-display">${p.quantity}</div>
                    <button class="qty-btn" onclick="updateQty('${escapeHtml(p.id)}',1)">+</button>
                </div>
                <button class="btn-icon" onclick="viewProduct('${escapeHtml(p.id)}')" title="View"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                <button class="btn-icon" onclick="editProduct('${escapeHtml(p.id)}')" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn-icon danger" onclick="confirmDelete('${escapeHtml(p.id)}')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
        </div>`;
    }).join('');

    const cats = [...new Set(products.map(p => p.category))].sort();
    const filterCat = document.getElementById('filterCategory');
    const currentVal = filterCat.value;
    filterCat.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    filterCat.value = currentVal;
}

// ===== Firestore CRUD =====
function updateQty(id, delta) {
    const p = productsCache.find(x => x.id === id);
    if (!p) return;
    const oldQty = p.quantity;
    const newQty = Math.max(0, p.quantity + delta);
    productsRef.doc(id).update({ quantity: newQty }).then(() => {
        addHistoryEntry('stock', p.name, `Qty changed: ${oldQty} → ${newQty} ${p.unit}`, p.category);
    }).catch(e => showToast('Error updating quantity', 'error'));
}

function viewProduct(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalTitle').textContent = p.name;
    const imgSrc = p.imageUrl || p.imageData;
    const modalImageHtml = imgSrc
        ? `<div class="modal-product-image"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}"></div>`
        : '';
    document.getElementById('modalBody').innerHTML = `
        ${modalImageHtml}
        <div class="detail-row"><span class="detail-label">Brand</span><span class="detail-value">${escapeHtml(p.brand) || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${CATEGORY_EMOJIS[p.category] || ''} ${escapeHtml(p.category)}</span></div>
        <div class="detail-row"><span class="detail-label">Selling Price</span><span class="detail-value">₹${p.price || 0}</span></div>
        <div class="detail-row"><span class="detail-label">Cost Price</span><span class="detail-value">${p.costPrice ? '₹' + p.costPrice : '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Quantity</span><span class="detail-value">${p.quantity} ${escapeHtml(p.unit)}</span></div>
        <div class="detail-row"><span class="detail-label">Min Stock Level</span><span class="detail-value">${p.minQuantity || 5} ${escapeHtml(p.unit)}</span></div>
        <div class="detail-row"><span class="detail-label">Barcode</span><span class="detail-value">${escapeHtml(p.barcode) || '—'}</span></div>
        <div class="detail-row"><span class="detail-label">Stock Value</span><span class="detail-value">₹${((p.price||0) * p.quantity).toLocaleString('en-IN')}</span></div>
        <div class="detail-row"><span class="detail-label">Added On</span><span class="detail-value">${new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
        ${p.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${escapeHtml(p.notes)}</span></div>` : ''}`;
    document.getElementById('modalOverlay').classList.add('active');
}

function editProduct(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productBrand').value = p.brand || '';
    document.getElementById('productBarcode').value = p.barcode || '';
    document.getElementById('productCategory').value = p.category;
    document.getElementById('productUnit').value = p.unit;
    document.getElementById('productPrice').value = p.price || '';
    document.getElementById('productCost').value = p.costPrice || '';
    document.getElementById('productQty').value = p.quantity;
    document.getElementById('productMinQty').value = p.minQuantity || 5;
    document.getElementById('productNotes').value = p.notes || '';
    // Load existing image (prefer Storage URL, fallback to legacy base64)
    const existingImage = p.imageUrl || p.imageData;
    if (existingImage) {
        currentImageData = existingImage;
        currentImageFile = null; // No new file to upload unless user picks one
        showImagePreview(existingImage);
    } else {
        clearImagePreview();
    }
    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('submitFormBtn').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Update Product';
    navigateTo('add-product');
    document.getElementById('pageTitle').textContent = 'Edit Product';
    document.getElementById('pageSubtitle').textContent = 'Update product details';
}

let deleteTargetId = null;
function confirmDelete(id) {
    deleteTargetId = id;
    const p = getProducts().find(x => x.id === id);
    document.getElementById('deleteMessage').textContent = `Are you sure you want to delete "${p ? p.name : 'this product'}"? This action cannot be undone.`;
    document.getElementById('deleteModalOverlay').classList.add('active');
}

function renderCategories() {
    const products = getProducts();
    const catData = {};
    products.forEach(p => {
        if (!catData[p.category]) catData[p.category] = { count: 0, value: 0 };
        catData[p.category].count++;
        catData[p.category].value += (p.price || 0) * p.quantity;
    });
    const grid = document.getElementById('categoriesGrid');
    if (Object.keys(catData).length === 0) {
        grid.innerHTML = `<div class="empty-state"><h3>No categories yet</h3><p>Add products to see categories here</p></div>`;
        return;
    }
    grid.innerHTML = Object.entries(catData).sort((a, b) => b[1].count - a[1].count).map(([cat, data]) =>
        `<div class="category-card" data-category="${escapeHtml(cat)}" onclick="filterByCategory(this.dataset.category)"><div class="category-emoji">${CATEGORY_EMOJIS[cat] || '📦'}</div><div class="category-name">${escapeHtml(cat)}</div><div class="category-count">${data.count} product${data.count !== 1 ? 's' : ''}</div><div class="category-value">₹${data.value.toLocaleString('en-IN')}</div></div>`
    ).join('');
}

function filterByCategory(cat) {
    document.getElementById('filterCategory').value = cat;
    navigateTo('products');
}

function renderAlerts() {
    const products = getProducts();
    const lowItems = products.filter(p => p.quantity <= (p.minQuantity || 5));
    const list = document.getElementById('alertsList');
    if (lowItems.length === 0) {
        list.innerHTML = `<div class="empty-state"><h3>All stocked up!</h3><p>No low stock alerts at the moment</p></div>`;
        return;
    }
    list.innerHTML = lowItems.sort((a, b) => a.quantity - b.quantity).map(p =>
        `<div class="alert-item ${p.quantity === 0 ? 'critical' : ''}">
            <div class="alert-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div class="alert-info"><div class="alert-name">${escapeHtml(p.name)}</div><div class="alert-detail">${p.quantity === 0 ? 'Out of stock!' : `Only ${p.quantity} ${escapeHtml(p.unit)} left`} · Min: ${p.minQuantity || 5} ${escapeHtml(p.unit)}</div></div>
            <div class="alert-action"><button class="btn btn-sm btn-primary" onclick="editProduct('${escapeHtml(p.id)}')">Restock</button></div>
        </div>`
    ).join('');
}

function refreshCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const id = activePage.id.replace('page-', '');
    if (id === 'dashboard') renderDashboard();
    else if (id === 'products') renderProducts(document.getElementById('globalSearch')?.value || '');
    else if (id === 'categories') renderCategories();
    else if (id === 'alerts') renderAlerts();
    else if (id === 'history') renderHistory();
}

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('productMinQty').value = '5';
    document.getElementById('formTitle').textContent = 'Add New Product';
    document.getElementById('submitFormBtn').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save Product';
    clearImagePreview();
}

// ===== Firestore Real-time Listener =====
let firstLoad = true;

function startProductsListener() {
    if (unsubscribeProducts) unsubscribeProducts();

    const query = productsRef.orderBy('createdAt', 'desc');

    unsubscribeProducts = query.onSnapshot(snapshot => {
        if (firstLoad) { showSkeletonCards(); firstLoad = false; }
        productsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        refreshCurrentPage();
    }, err => {
        console.error('Firestore error:', err);
        showToast('Error connecting to cloud database', 'error');
    });
}

// Start listener immediately
startProductsListener();

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); });
    });

    document.getElementById('menuToggle').addEventListener('click', openSidebar);
    document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);


    document.getElementById('addProductBtn').addEventListener('click', () => { resetForm(); navigateTo('add-product'); });
    document.getElementById('emptyAddBtn')?.addEventListener('click', () => { resetForm(); navigateTo('add-product'); });

    // Form submit - save to Firestore with Firebase Storage image upload
    document.getElementById('productForm').addEventListener('submit', async e => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitFormBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Saving...';

        try {
            const editId = document.getElementById('editProductId').value;
            const productId = editId || productsRef.doc().id; // Pre-generate ID for new products

            const productData = {
                name: document.getElementById('productName').value.trim(),
                brand: document.getElementById('productBrand').value.trim(),
                category: document.getElementById('productCategory').value,
                unit: document.getElementById('productUnit').value,
                price: parseFloat(document.getElementById('productPrice').value) || 0,
                costPrice: parseFloat(document.getElementById('productCost').value) || 0,
                quantity: parseInt(document.getElementById('productQty').value) || 0,
                minQuantity: parseInt(document.getElementById('productMinQty').value) || 5,
                barcode: document.getElementById('productBarcode').value.trim(),
                notes: document.getElementById('productNotes').value.trim(),
                updatedAt: new Date().toISOString()
            };

            // Handle image upload to Firebase Storage
            if (currentImageFile) {
                // New image selected — upload to Storage
                const oldProduct = editId ? getProducts().find(x => x.id === editId) : null;
                if (oldProduct && oldProduct.imagePath) {
                    await deleteProductImage(oldProduct.imagePath); // Remove old image
                }
                const { imageUrl, imagePath } = await uploadProductImage(currentImageFile, productId);
                productData.imageUrl = imageUrl;
                productData.imagePath = imagePath;
                productData.imageData = null; // Clear legacy base64 field
            } else if (currentImageData && !currentImageData.startsWith('data:')) {
                // Keeping existing Storage URL (no change needed)
                // Don't overwrite imageUrl/imagePath
            } else if (!currentImageData) {
                // Image was removed
                const oldProduct = editId ? getProducts().find(x => x.id === editId) : null;
                if (oldProduct && oldProduct.imagePath) {
                    await deleteProductImage(oldProduct.imagePath);
                }
                productData.imageUrl = null;
                productData.imagePath = null;
                productData.imageData = null;
            } else {
                // Legacy: currentImageData is base64 (from old data during edit)
                // Migrate it to Storage
                // For now, keep it — it will be migrated next edit with a file pick
                productData.imageData = currentImageData;
            }

            if (editId) {
                await productsRef.doc(editId).update(productData);
                addHistoryEntry('updated', productData.name, 'Product details updated', productData.category);
                showToast('Product updated successfully!');
            } else {
                productData.createdAt = new Date().toISOString();
                await productsRef.doc(productId).set(productData);
                addHistoryEntry('added', productData.name, `Added with ${productData.quantity} ${productData.unit}`, productData.category);
                showToast('Product added successfully!');
            }
            resetForm();
            navigateTo('products');
        } catch (err) {
            console.error('Save error:', err);
            showToast('Error saving product: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save Product';
        }
    });

    document.getElementById('cancelFormBtn').addEventListener('click', () => { resetForm(); navigateTo('products'); });

    // ===== Image Upload Listeners =====
    const uploadZone = document.getElementById('imageUploadZone');
    const fileInput = document.getElementById('productImage');

    uploadZone.addEventListener('click', (e) => {
        if (e.target.closest('.remove-image-btn')) return;
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    });

    document.getElementById('removeImageBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        clearImagePreview();
    });

    ['filterCategory', 'filterStock', 'sortBy'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => renderProducts(document.getElementById('globalSearch').value));
    });

    document.getElementById('globalSearch').addEventListener('input', e => {
        const val = e.target.value;
        const mobileInput = document.getElementById('mobileSearchInput');
        if (mobileInput) mobileInput.value = val;
        if (!document.getElementById('page-products').classList.contains('active')) navigateTo('products');
        renderProducts(val);
    });

    // Mobile Search Event Listeners
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    document.getElementById('mobileSearchToggle')?.addEventListener('click', () => {
        if (mobileSearchOverlay) {
            mobileSearchOverlay.classList.add('active');
            if (mobileSearchInput) {
                mobileSearchInput.value = document.getElementById('globalSearch').value;
                setTimeout(() => mobileSearchInput.focus(), 150);
            }
        }
    });

    document.getElementById('mobileSearchCloseBtn')?.addEventListener('click', () => {
        if (mobileSearchOverlay) mobileSearchOverlay.classList.remove('active');
        if (mobileSearchInput) mobileSearchInput.value = '';
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) globalSearch.value = '';
        renderProducts('');
    });

    mobileSearchInput?.addEventListener('input', e => {
        const val = e.target.value;
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) globalSearch.value = val;
        if (!document.getElementById('page-products').classList.contains('active')) navigateTo('products');
        renderProducts(val);
    });

    // Barcode Scanner Event Listeners
    document.getElementById('barcodeScanBtn')?.addEventListener('click', () => startBarcodeScanner('search'));
    document.getElementById('formScanBarcodeBtn')?.addEventListener('click', () => startBarcodeScanner('input'));
    document.getElementById('barcodeScannerClose')?.addEventListener('click', stopBarcodeScanner);
    document.getElementById('barcodeScannerModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) stopBarcodeScanner();
    });

    document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modalOverlay').classList.remove('active'));
    document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    document.getElementById('deleteModalClose').addEventListener('click', () => document.getElementById('deleteModalOverlay').classList.remove('active'));
    document.getElementById('deleteModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('active'); });
    document.getElementById('deleteCancelBtn').addEventListener('click', () => document.getElementById('deleteModalOverlay').classList.remove('active'));

    // Delete from Firestore (also clean up Storage image)
    document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
        if (deleteTargetId) {
            const id = deleteTargetId;
            const p = getProducts().find(x => x.id === id);
            const savedData = p ? { ...p } : null;
            try {
                // Delete image from Storage if exists
                if (p && p.imagePath) {
                    await deleteProductImage(p.imagePath);
                }
                await productsRef.doc(id).delete();
                if (p) addHistoryEntry('deleted', p.name, 'Removed from inventory', p.category);
                showToast(`"${p ? p.name : 'Product'}" deleted`, 'error', savedData ? () => {
                    // Restore the deleted product (image in Storage is gone, but data is restored)
                    const { id: _id, ...restoreData } = savedData;
                    restoreData.imageUrl = null;
                    restoreData.imagePath = null;
                    restoreData.imageData = null;
                    productsRef.doc(id).set(restoreData).then(() => {
                        addHistoryEntry('added', savedData.name, 'Restored via Undo', savedData.category);
                        showToast('Product restored! (image was removed)', 'success');
                    });
                } : null);
            } catch (err) {
                showToast('Error deleting product', 'error');
            }
            deleteTargetId = null;
            document.getElementById('deleteModalOverlay').classList.remove('active');
        }
    });

    // Theme Toggle
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') document.body.classList.add('light-theme');
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    // Mobile Bottom Nav
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.addEventListener('click', () => { if(btn.dataset.page==='add-product') resetForm(); navigateTo(btn.dataset.page); });
    });

    // View Toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            renderProducts(document.getElementById('globalSearch').value);
        });
    });

    // Export Dropdown
    document.getElementById('exportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('exportMenu').classList.toggle('show');
    });
    document.addEventListener('click', () => document.getElementById('exportMenu')?.classList.remove('show'));
    document.getElementById('exportExcel').addEventListener('click', () => exportToExcel(getProducts()));
    document.getElementById('exportPDF').addEventListener('click', () => exportToPDF(getProducts()));

    // Bulk Actions
    document.getElementById('selectAll').addEventListener('change', (e) => {
        const cards = document.querySelectorAll('.product-card input[type="checkbox"]');
        cards.forEach(cb => { cb.checked = e.target.checked; toggleSelect(cb.closest('.product-card')?.dataset.id || cb.closest('[data-id]')?.dataset.id, e.target.checked); });
        // Re-select from visible cards
        if(e.target.checked) { document.querySelectorAll('.product-card').forEach(c => selectedProducts.add(c.dataset.id)); }
        else { selectedProducts.clear(); }
        updateBulkBar();
    });
    document.getElementById('bulkDeleteBtn').addEventListener('click', () => {
        if(selectedProducts.size === 0) return;
        if(!confirm(`Delete ${selectedProducts.size} products?`)) return;
        const batch = db.batch();
        selectedProducts.forEach(id => { const p=getProducts().find(x=>x.id===id); if(p) addHistoryEntry('deleted',p.name,'Bulk deleted',p.category); batch.delete(productsRef.doc(id)); });
        batch.commit().then(() => { showToast(`${selectedProducts.size} products deleted`,'error'); selectedProducts.clear(); updateBulkBar(); }).catch(()=>showToast('Error','error'));
    });
    document.getElementById('bulkExportBtn').addEventListener('click', () => {
        const items = getProducts().filter(p => selectedProducts.has(p.id));
        if(items.length) exportToExcel(items, 'selected_products');
    });
    document.getElementById('bulkCancelBtn').addEventListener('click', () => { selectedProducts.clear(); updateBulkBar(); renderProducts(document.getElementById('globalSearch').value); });

    // History
    document.getElementById('historyFilter').addEventListener('change', () => renderHistory());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if(!confirm('Clear all history?')) return;
        stockHistory = []; localStorage.setItem('stockHistory', '[]'); renderHistory(); showToast('History cleared','info');
    });

    renderDashboard();
});

// ===== New Feature Functions =====
function addHistoryEntry(type, name, detail, category) {
    const entry = { type, name, detail, category: category||'', timestamp: new Date().toISOString() };
    stockHistory.unshift(entry);
    if(stockHistory.length > 200) stockHistory = stockHistory.slice(0,200);
    localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
}

function renderHistory() {
    const filter = document.getElementById('historyFilter').value;
    let items = stockHistory;
    if(filter !== 'all') items = items.filter(h => h.type === filter);
    const list = document.getElementById('historyList');
    if(items.length === 0) { list.innerHTML = '<div class="empty-state"><h3>No history yet</h3><p>Stock changes will appear here</p></div>'; return; }
    const icons = {added:'＋',updated:'✎',deleted:'✕',stock:'↕'};
    list.innerHTML = items.slice(0,100).map(h => {
        const d = new Date(h.timestamp);
        const time = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
        return `<div class="history-item"><div class="history-dot ${h.type}">${icons[h.type]||'•'}</div><div class="history-content"><div class="history-title">${escapeHtml(h.name)}</div><div class="history-detail">${escapeHtml(h.detail)}${h.category?' · '+escapeHtml(h.category):''}</div></div><div class="history-time">${time}</div></div>`;
    }).join('');
}

function toggleSelect(id, checked) {
    if(checked) selectedProducts.add(id); else selectedProducts.delete(id);
    updateBulkBar();
}

function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    if(selectedProducts.size > 0) { bar.style.display = 'flex'; document.getElementById('bulkCount').textContent = selectedProducts.size + ' selected'; }
    else { bar.style.display = 'none'; }
}

function exportToExcel(products, filename) {
    if(typeof XLSX==='undefined'){showToast('Excel library loading...','info');return;}
    const data = products.map(p=>({Name:p.name,Brand:p.brand||'',Category:p.category,Price:p.price||0,Cost:p.costPrice||0,Qty:p.quantity,Unit:p.unit,MinQty:p.minQuantity||5,Notes:p.notes||''}));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Inventory');
    XLSX.writeFile(wb,(filename||'inventory')+'.xlsx');
    showToast('Excel exported!'); addHistoryEntry('updated','Export','Exported '+products.length+' products to Excel','');
}

function exportToPDF(products) {
    if(typeof jspdf==='undefined'){showToast('PDF library loading...','info');return;}
    const {jsPDF}=jspdf; const doc=new jsPDF();
    doc.setFontSize(18); doc.text('GroceryVault Inventory',14,20);
    doc.setFontSize(10); doc.text('Generated: '+new Date().toLocaleString('en-IN'),14,28);
    const rows=products.map(p=>[p.name,p.category,'₹'+(p.price||0),p.quantity+' '+p.unit,p.quantity===0?'Out':'OK']);
    doc.autoTable({head:[['Name','Category','Price','Stock','Status']],body:rows,startY:34,styles:{fontSize:9},headStyles:{fillColor:[139,92,246]}});
    doc.save('inventory_report.pdf');
    showToast('PDF exported!'); addHistoryEntry('updated','Export','Exported '+products.length+' products to PDF','');
}

// ===== Animated Counter =====
function animateCounter(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = parseInt(el.textContent.replace(/[^\d]/g, '')) || 0;
    if (start === target) return;
    const duration = 600;
    const startTime = performance.now();
    const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
    };
    requestAnimationFrame(step);
}

function animateCounterValue(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const start = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || 0;
    if (start === target) return;
    const duration = 700;
    const startTime = performance.now();
    const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = start + (target - start) * eased;
        el.textContent = '₹' + Math.round(val).toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = '₹' + target.toLocaleString('en-IN');
    };
    requestAnimationFrame(step);
}

// ===== Skeleton Loader =====
function showSkeletonCards() {
    const grid = document.getElementById('productsGrid');
    if (!grid || !document.getElementById('page-products').classList.contains('active')) return;
    const skeletonCard = `
        <div class="product-card skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-bar"></div>
        </div>`;
    grid.innerHTML = skeletonCard.repeat(6);
}

// ===== Barcode Scanner =====
function startBarcodeScanner(target = 'search') {
    scanTarget = target;
    const modal = document.getElementById('barcodeScannerModal');
    if (!modal) return;
    modal.classList.add('active');

    // Create a new instance
    html5QrCode = new Html5Qrcode("barcodeScannerView");
    
    const config = { 
        fps: 10, 
        qrbox: (width, height) => {
            const min = Math.min(width, height);
            const boxWidth = Math.floor(min * 0.7);
            const boxHeight = Math.floor(boxWidth * 0.6);
            return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.0
    };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
            handleScanResult(decodedText);
            stopBarcodeScanner();
        },
        (errorMessage) => {
            // silent fail
        }
    ).catch(err => {
        console.error("Error starting camera scanner:", err);
        showToast("Could not access camera", "error");
        stopBarcodeScanner();
    });
}

function stopBarcodeScanner() {
    const modal = document.getElementById('barcodeScannerModal');
    if (modal) modal.classList.remove('active');
    
    if (html5QrCode) {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                html5QrCode = null;
            }).catch(err => {
                console.error("Error stopping scanner:", err);
                html5QrCode = null;
            });
        } else {
            html5QrCode = null;
        }
    }
}

function handleScanResult(code) {
    if (scanTarget === 'input') {
        const input = document.getElementById('productBarcode');
        if (input) {
            input.value = code;
            showToast(`Scanned barcode: ${code}`, 'success');
        }
    } else {
        const codeClean = code.trim().toLowerCase();
        const found = productsCache.find(p => (p.barcode || '').trim().toLowerCase() === codeClean);
        if (found) {
            showToast(`Found product: ${found.name}`, 'success');
            viewProduct(found.id);
        } else {
            showToast(`Product not found for: ${code}`, 'info');
            navigateTo('products');
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.value = code;
                renderProducts(code);
            }
        }
    }
}
