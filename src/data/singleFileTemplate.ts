import firebaseConfig from '../../firebase-applet-config.json';

export function buildSingleFileHtml(): string {
  const configJson = JSON.stringify(
    {
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    },
    null,
    2
  );

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>أدكاوى (ADKAWY) — منظومة توصيل مدينة إدكو (٤ واجهات لحظية)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --orange: #FF6B00;
      --orange-hover: #E55F00;
      --navy: #1E293B;
      --bg: #F6F8FB;
      --surface: #FFFFFF;
      --border: rgba(226, 232, 240, 0.82);
      --muted: #64748B;
      --radius: 20px;
      --shadow-soft: 0 10px 30px -10px rgba(15, 23, 42, 0.07), 0 2px 8px -2px rgba(15, 23, 42, 0.03);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', sans-serif;
      background: var(--bg);
      color: var(--navy);
      line-height: 1.65;
      padding-bottom: 5.5rem;
    }
    header {
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(18px) saturate(180%);
      -webkit-backdrop-filter: blur(18px) saturate(180%);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 4px 24px -6px rgba(15, 23, 42, 0.05);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .brand {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--orange);
      text-decoration: none;
      white-space: nowrap;
    }
    .nav-links { display: flex; align-items: center; gap: 1.2rem; }
    .nav-btn {
      background: none;
      border: none;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.92rem;
      color: var(--muted);
      cursor: pointer;
      padding: 0.35rem 0;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      transition: color 180ms ease, border-color 180ms ease;
    }
    .nav-btn.active { color: var(--navy); border-bottom-color: var(--orange); }
    .sub-nav {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--border);
    }
    .container { max-width: 1180px; margin: 0 auto; padding: 2rem 1.25rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-soft);
      padding: 1.5rem;
      transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease;
    }
    .card-interactive:hover {
      transform: translateY(-3px);
      box-shadow: 0 20px 42px -12px rgba(15, 23, 42, 0.11);
    }
    .hero-banner {
      border-radius: 24px;
      padding: 2rem;
      margin-bottom: 1.75rem;
      color: #FFF;
      background: linear-gradient(135deg, #FF6B00 0%, #F25C00 55%, #B83B00 100%);
      box-shadow: 0 22px 54px -14px rgba(255, 107, 0, 0.38);
    }
    .hero-banner h1 { color: #FFF; font-size: 1.8rem; margin-bottom: 0.5rem; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-val { font-size: 1.65rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 0.25rem; }
    .store-cover {
      height: 180px;
      border-radius: 24px;
      background: linear-gradient(135deg, #1E293B 0%, #FF6B00 100%);
    }
    .store-overlap { margin: -2.8rem 1rem 1.5rem; position: relative; z-index: 10; }
    .product-row-card { display: flex; align-items: stretch; gap: 1rem; padding: 1.15rem; }
    .product-thumb {
      width: 96px;
      min-height: 96px;
      border-radius: 16px;
      background: linear-gradient(135deg, #FFF7ED, #FFEDD5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--orange);
      flex-shrink: 0;
      font-size: 0.8rem;
      text-align: center;
      padding: 0.45rem;
    }
    .sticky-cta-bar {
      position: fixed;
      bottom: 0;
      right: 0;
      left: 0;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }
    .auth-box { max-width: 460px; margin: 2.5rem auto; }
    h1, h2, h3 { font-weight: 700; color: var(--navy); }
    label { display: block; font-size: 0.85rem; font-weight: 700; margin: 0.85rem 0 0.35rem; }
    input, select, textarea {
      width: 100%;
      padding: 0.72rem 0.95rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      font-family: inherit;
      font-size: 0.92rem;
      color: var(--navy);
      background: #FFF;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.68rem 1.2rem;
      border-radius: 14px;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.9rem;
      border: 1px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 160ms ease, background 160ms ease;
    }
    .btn-giant { min-height: 58px; font-size: 1.02rem; width: 100%; }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      background: linear-gradient(90deg, #FF6B00, #FF8533);
      color: #FFF;
      box-shadow: 0 8px 20px -4px rgba(255, 107, 0, 0.4);
    }
    .btn-navy { background: var(--navy); color: #FFF; }
    .btn-outline { background: #FFF; color: var(--navy); border-color: var(--border); }
    .btn-block { width: 100%; }
    .stack { display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1rem; }
    .grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.4rem;
      margin-top: 1.25rem;
    }
    .meta { font-size: 0.84rem; color: var(--muted); margin: 0.25rem 0 0.55rem; }
    .alert { padding: 0.85rem 1.15rem; border-radius: 16px; font-size: 0.9rem; margin-bottom: 1.25rem; font-weight: 600; }
    .alert-err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .alert-ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
    .hidden { display: none !important; }
    .floating-cart {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      left: 1rem;
      max-width: 780px;
      margin: 0 auto;
      border-radius: 20px;
      background: rgba(30, 41, 59, 0.95);
      color: #FFF;
      padding: 0.85rem 1.35rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 40;
    }
    .pay-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-top: 0.5rem; }
    .pay-card {
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1rem;
      cursor: pointer;
      text-align: right;
      background: #FFF;
      font-family: inherit;
    }
    .pay-card.selected { border-color: var(--orange); background: #FFF7ED; }
    .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.85rem; margin: 1rem 0; }
    .step-box { border: 1px solid var(--border); border-radius: 16px; padding: 0.95rem; background: #F8FAFC; }
    .step-box.active { border-color: var(--orange); background: #FFF7ED; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.88rem; }
    th, td { padding: 0.75rem 0.6rem; border-bottom: 1px solid var(--border); text-align: right; }
    th { color: var(--muted); font-weight: 700; background: #F8FAFC; }
  </style>
</head>
<body>
  <header>
    <a href="#" id="logoHomeLink" class="brand">أدكاوى</a>

    <nav id="portalNav" class="nav-links hidden" aria-label="شريط التنقل بين واجهات المنظومة">
      <button type="button" class="nav-btn active" data-portal="customer">العميل</button>
      <button type="button" class="nav-btn" data-portal="store" id="navStorePortalBtn">المتجر</button>
      <button type="button" class="nav-btn" data-portal="courier" id="navCourierPortalBtn">المندوب</button>
      <button type="button" class="nav-btn" data-portal="admin">الإدارة</button>
    </nav>

    <button id="logoutBtn" class="btn btn-navy hidden">خروج</button>
  </header>

  <main class="container">
    <div id="statusBox" class="alert hidden"></div>

    <!-- شاشة تسجيل الدخول -->
    <section id="authSection" class="card auth-box">
      <h2>مرحباً بك في أدكاوى (ADKAWY)</h2>
      <p class="meta">منظومة التوصيل اللحظية المتكاملة لمدينة إدكو</p>
      <form id="emailAuthForm">
        <label for="emailInput">البريد الإلكتروني</label>
        <input id="emailInput" type="email" dir="ltr" placeholder="name@example.com" required />
        <label for="passwordInput">كلمة المرور</label>
        <input id="passwordInput" type="password" dir="ltr" placeholder="٦ أحرف على الأقل" minlength="6" required />
        <div class="stack">
          <button type="submit" class="btn btn-primary btn-block">تسجيل الدخول بالبريد</button>
          <button type="button" id="registerBtn" class="btn btn-outline btn-block">إنشاء حساب جديد</button>
        </div>
      </form>
      <div class="stack" style="border-top:1px solid var(--border);padding-top:1rem;">
        <button type="button" id="anonLoginBtn" class="btn btn-navy btn-block">دخول كزائر (مجهول)</button>
        <button type="button" id="googleLoginBtn" class="btn btn-outline btn-block">المتابعة بحساب Google</button>
      </div>
    </section>

    <!-- ١. واجهة العميل (Customer Portal) -->
    <div id="customerPortal" class="hidden">
      <div class="sub-nav">
        <button type="button" class="btn btn-outline" data-cview="stores">متاجر إدكو</button>
        <button type="button" class="btn btn-outline" data-cview="cart" id="subCartBtn">السلة</button>
        <button type="button" class="btn btn-outline" data-cview="orders">طلباتي والتتبع</button>
      </div>

      <section id="storesView">
        <div class="hero-banner">
          <h1>أشهى مطاعم ومتاجر إدكو تصلك ساخنة في دقائق</h1>
          <p style="opacity:0.92;margin-bottom:1.1rem;">تزامن لحظي عبر onSnapshot بين العميل والمتجر والمندوب والإدارة</p>
          <button id="seedAllBtn" class="btn btn-navy">+ إضافة متاجر ومنتجات ومناديب إدكو النموذجية</button>
        </div>
        <h2>متاجر ومطاعم مدينة إدكو المتاحة الآن</h2>
        <div id="storesContainer" class="grid-cards"></div>
      </section>

      <section id="storeMenuView" class="hidden">
        <div class="store-cover">
          <div style="padding:1rem;">
            <button type="button" id="backToStoresBtn" class="btn btn-outline">العودة إلى المتاجر</button>
          </div>
        </div>
        <div id="storeHeaderCard" class="card store-overlap"></div>
        <div id="productsContainer" class="grid-cards"></div>
      </section>

      <section id="cartView" class="hidden">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h2>سلة المشتريات</h2>
            <button type="button" id="clearCartBtn" class="btn btn-outline">إفراغ السلة</button>
          </div>
          <div id="cartListContainer"></div>
          <div id="cartSummaryBox" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);"></div>
        </div>
      </section>

      <section id="checkoutView" class="hidden">
        <div class="card" style="max-width:640px;margin:0 auto;">
          <h2>إتمام الطلب وتأكيد العنوان</h2>
          <p class="meta">يُحفظ الطلب في مجموعة orders بحالة pending ليظهر فوراً للمتجر والإدارة</p>
          <form id="checkoutForm">
            <label for="custName">اسم العميل</label>
            <input id="custName" type="text" required minlength="2" placeholder="مثال: أحمد محمد الإدكاوي" />

            <label for="custPhone">رقم الهاتف المحمول</label>
            <input id="custPhone" type="tel" dir="ltr" required pattern="^01[0125][0-9]{8}$" placeholder="01012345678" />

            <label for="custNeighborhood">الحي / المنطقة في إدكو</label>
            <select id="custNeighborhood">
              <option value="شارع البحر">شارع البحر</option>
              <option value="حي المحطة">حي المحطة</option>
              <option value="المعدية">المعدية</option>
              <option value="وسط البلد - السوق">وسط البلد - السوق</option>
              <option value="كوبري شربت">كوبري شربت</option>
            </select>

            <label for="custAddress">العنوان بالتفصيل</label>
            <input id="custAddress" type="text" required minlength="5" placeholder="اسم الشارع ورقم العقار" />

            <label>طريقة الدفع</label>
            <div class="pay-options">
              <button type="button" class="pay-card selected" id="payCashBtn">
                <strong>كاش عند الاستلام</strong>
                <div class="meta" style="margin:0;">الدفع نقداً للمندوب</div>
              </button>
              <button type="button" class="pay-card" id="payVisaBtn">
                <strong>بطاقة بنكية (فيزا)</strong>
                <div class="meta" style="margin:0;">دفع إلكتروني ببطاقة Visa</div>
              </button>
            </div>

            <div class="sticky-cta-bar">
              <div id="checkoutTotalLine" style="font-weight:700;font-size:1.02rem;"></div>
              <button type="submit" class="btn btn-primary">تأكيد الطلب</button>
            </div>
          </form>
        </div>
      </section>

      <section id="trackingView" class="hidden">
        <div id="trackingContent" class="card"></div>
      </section>

      <section id="ordersView" class="hidden">
        <div class="card">
          <h2>سجل طلباتي وتتبع المندوب</h2>
          <div id="ordersList" style="margin-top:0.85rem;"></div>
        </div>
      </section>
    </div>

    <!-- ٢. واجهة المتجر (Store Dashboard) -->
    <section id="storePortal" class="hidden">
      <div class="card" style="margin-bottom:1.25rem;">
        <h2>لوحة تحكم المتجر والمطبخ (Store Dashboard)</h2>
        <p class="meta">استقبل الطلبات الجديدة (pending) وحدد وقت التحضير ليتم إشعار العميل والمندوب في نفس الثانية</p>
      </div>
      <div id="storeOrdersContainer" class="grid-cards"></div>
    </section>

    <!-- ٣. واجهة المندوب (Courier Mobile App) -->
    <section id="courierPortal" class="hidden">
      <div class="card" style="margin-bottom:1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
        <div>
          <h2>تطبيق كابتن التوصيل (Courier App)</h2>
          <p class="meta" id="courierStatusLabel">كابتن محمود الإدكاوي · 01098765432 · متاح لاستلام الطلبات</p>
        </div>
        <button type="button" id="toggleCourierAvailBtn" class="btn btn-primary">تبديل التفرغ (متاح / غير متاح)</button>
      </div>
      <div id="courierOrdersContainer" class="grid-cards"></div>
    </section>

    <!-- ٤. واجهة الإدارة (Admin Dashboard) -->
    <section id="adminPortal" class="hidden">
      <div id="adminKpis" class="kpi-grid"></div>
      <div class="card" style="margin-bottom:1.5rem;overflow-x:auto;">
        <h2>جدول جميع الطلبات اللحظي وتعيين المناديب</h2>
        <div id="adminOrdersTableWrap"></div>
      </div>
      <div class="card">
        <h2>إدارة المتاجر (تفعيل / إيقاف)</h2>
        <div id="adminStoresWrap" style="margin-top:0.85rem;"></div>
      </div>
    </section>
  </main>

  <div id="floatingCartBar" class="floating-cart hidden">
    <div id="floatingCartInfo" style="font-weight:700;font-size:0.92rem;"></div>
    <button type="button" id="openCartFromBarBtn" class="btn btn-primary">عرض السلة</button>
  </div>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
    import {
      getAuth,
      onAuthStateChanged,
      signInAnonymously,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      GoogleAuthProvider,
      signInWithPopup,
      signOut
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
    import {
      initializeFirestore,
      collection,
      doc,
      setDoc,
      addDoc,
      updateDoc,
      query,
      where,
      onSnapshot,
      serverTimestamp,
      writeBatch
    } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

    const firebaseConfig = ${configJson};
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = initializeFirestore(
      app,
      { experimentalForceLongPolling: true },
      firebaseConfig.firestoreDatabaseId
    );
    const googleProvider = new GoogleAuthProvider();

    let currentUser = null;
    let activePortal = "customer";
    let activeCustomerView = "stores";
    let selectedPayment = "cash";
    let courierAvailable = true;
    let cart = [];
    let allStores = [];
    let allOrders = [];
    let trackedOrderId = null;
    let unsubStores = null;
    let unsubProducts = null;
    let unsubOrders = null;

    const statusLabels = {
      pending: "قيد المراجعة",
      preparing: "جارٍ التحضير",
      on_the_way: "في الطريق إليك",
      delivering: "في الطريق إليك",
      delivered: "تم التوصيل",
      cancelled: "ملغي"
    };

    function showStatus(msg, isError = false) {
      const box = document.getElementById("statusBox");
      box.textContent = msg;
      box.className = "alert " + (isError ? "alert-err" : "alert-ok");
      box.classList.remove("hidden");
    }

    function switchPortal(portal) {
      activePortal = portal;
      ["customer", "store", "courier", "admin"].forEach((p) => {
        document.getElementById(p + "Portal").classList.toggle("hidden", p !== portal);
      });
      document.querySelectorAll("[data-portal]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.portal === portal);
      });
      updateFloatingCart();
      renderAllPortals();
    }

    function switchCustomerView(cview) {
      activeCustomerView = cview;
      ["stores", "store_menu", "cart", "checkout", "tracking", "orders"].forEach((v) => {
        const elId = v === "store_menu" ? "storeMenuView" : v + "View";
        document.getElementById(elId).classList.toggle("hidden", v !== cview);
      });
      if (cview === "cart") renderCartPage();
      updateFloatingCart();
    }

    function updateFloatingCart() {
      const bar = document.getElementById("floatingCartBar");
      const subCartBtn = document.getElementById("subCartBtn");
      const count = cart.reduce((s, i) => s + i.quantity, 0);
      subCartBtn.textContent = count > 0 ? \`السلة (\${count})\` : "السلة";

      if (
        currentUser &&
        activePortal === "customer" &&
        count > 0 &&
        (activeCustomerView === "stores" || activeCustomerView === "store_menu")
      ) {
        const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
        const total = subtotal + cart[0].deliveryFee;
        document.getElementById("floatingCartInfo").textContent = \`\${count} منتجات في السلة · الإجمالي: \${total} ج.م\`;
        bar.classList.remove("hidden");
      } else {
        bar.classList.add("hidden");
      }
    }

    function listenStores(uid) {
      if (unsubStores) unsubStores();
      const q = query(collection(db, "stores"), where("createdBy", "==", uid));
      const qActive = query(collection(db, "stores"), where("isActive", "==", true));
      const map = new Map();

      const sync = () => {
        allStores = Array.from(map.values());
        renderCustomerStores();
        renderAdminStores();
      };

      const u1 = onSnapshot(qActive, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        sync();
      });
      const u2 = onSnapshot(q, (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        sync();
      });
      unsubStores = () => { u1(); u2(); };
    }

    function renderCustomerStores() {
      const container = document.getElementById("storesContainer");
      const activeList = allStores.filter((s) => s.isActive);
      container.innerHTML = "";
      if (!activeList.length) {
        container.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;"><h3>لا توجد متاجر متاحة</h3><p class="meta">اضغط على زر إضافة المتاجر النموذجية أعلاه.</p></div>';
        return;
      }
      activeList.forEach((s) => {
        const card = document.createElement("div");
        card.className = "card card-interactive";
        card.innerHTML = \`
          <h3>\${s.name}</h3>
          <div class="meta">\${s.category} · \${s.neighborhood} · \${s.deliveryTimeMinutes || 25} دقيقة · توصيل \${s.deliveryFee} ج.م</div>
          <p style="font-size:0.9rem;margin-bottom:1rem;">\${s.description}</p>
          <button type="button" class="btn btn-primary btn-block">فتح قائمة المتجر</button>
        \`;
        card.querySelector("button").addEventListener("click", () => openStoreMenu(s));
        container.appendChild(card);
      });
    }

    function openStoreMenu(store) {
      document.getElementById("storeHeaderCard").innerHTML = \`
        <h2>\${store.name}</h2>
        <div class="meta">\${store.category} · \${store.neighborhood} · رسوم التوصيل \${store.deliveryFee} ج.م</div>
        <p>\${store.description}</p>
      \`;
      switchCustomerView("store_menu");

      if (unsubProducts) unsubProducts();
      const pq = query(
        collection(db, "products"),
        where("storeId", "==", store.id),
        where("isAvailable", "==", true)
      );
      unsubProducts = onSnapshot(pq, (snap) => {
        const container = document.getElementById("productsContainer");
        container.innerHTML = "";
        if (snap.empty) {
          container.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;">لا توجد منتجات مضافة لهذا المتجر بعد.</div>';
          return;
        }
        snap.forEach((pSnap) => {
          const p = { id: pSnap.id, ...pSnap.data() };
          const card = document.createElement("div");
          card.className = "card card-interactive product-row-card";
          card.innerHTML = \`
            <div class="product-thumb">\${p.category}</div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <h3>\${p.name}</h3>
                <p style="font-size:0.86rem;color:#64748B;margin:0.3rem 0 0.75rem;">\${p.description}</p>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>\${p.price} ج.م</strong>
                <button type="button" class="btn btn-primary">إضافة +</button>
              </div>
            </div>
          \`;
          card.querySelector("button").addEventListener("click", () => {
            if (cart.length && cart[0].storeId !== store.id) cart = [];
            const found = cart.find((c) => c.productId === p.id);
            if (found) found.quantity += 1;
            else cart.push({
              storeId: store.id,
              storeName: store.name,
              storeOwnerId: store.createdBy || currentUser.uid,
              deliveryFee: Number(store.deliveryFee),
              productId: p.id,
              name: p.name,
              price: Number(p.price),
              quantity: 1
            });
            updateFloatingCart();
          });
          container.appendChild(card);
        });
      });
    }

    function renderCartPage() {
      const listEl = document.getElementById("cartListContainer");
      const sumEl = document.getElementById("cartSummaryBox");
      if (!cart.length) {
        listEl.innerHTML = '<p class="meta">السلة فارغة حالياً.</p>';
        sumEl.innerHTML = "";
        return;
      }
      listEl.innerHTML = cart.map((item) => \`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>\${item.name}</strong>
            <div class="meta">\${item.price} ج.م × \${item.quantity} = \${item.price * item.quantity} ج.م</div>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center;">
            <button type="button" class="btn btn-outline" data-act="dec" data-id="\${item.productId}">-</button>
            <strong>\${item.quantity}</strong>
            <button type="button" class="btn btn-outline" data-act="inc" data-id="\${item.productId}">+</button>
            <button type="button" class="btn btn-outline" style="color:#DC2626;" data-act="del" data-id="\${item.productId}">حذف</button>
          </div>
        </div>
      \`).join("");

      listEl.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = cart.findIndex((c) => c.productId === btn.dataset.id);
          if (idx < 0) return;
          if (btn.dataset.act === "inc") cart[idx].quantity += 1;
          else if (btn.dataset.act === "dec") {
            cart[idx].quantity -= 1;
            if (cart[idx].quantity <= 0) cart.splice(idx, 1);
          } else cart.splice(idx, 1);
          renderCartPage();
          updateFloatingCart();
        });
      });

      const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      const fee = cart[0].deliveryFee;
      const total = subtotal + fee;
      sumEl.innerHTML = \`
        <div style="margin-bottom:1rem;">
          <div>المجموع الفرعي: <strong>\${subtotal} ج.م</strong> · رسوم التوصيل: <strong>\${fee} ج.م</strong></div>
          <div style="font-size:1.15rem;color:var(--orange);font-weight:700;">الإجمالي الكلي: \${total} ج.م</div>
        </div>
        <button type="button" id="goToCheckoutBtn" class="btn btn-primary btn-block">المتابعة لإتمام الطلب</button>
      \`;
      document.getElementById("goToCheckoutBtn").addEventListener("click", () => {
        document.getElementById("checkoutTotalLine").textContent = \`الإجمالي المطلوب دفعه: \${total} ج.م\`;
        switchCustomerView("checkout");
      });
    }

    document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser || !cart.length) return;
      const subtotal = Math.trunc(cart.reduce((s, i) => s + i.price * i.quantity, 0));
      const deliveryFee = Math.trunc(cart[0].deliveryFee);
      const totalAmount = subtotal + deliveryFee;
      const itemCount = Math.trunc(cart.reduce((s, i) => s + i.quantity, 0));
      const items = cart.slice(0, 15).map((i) => ({
        productId: i.productId,
        name: i.name,
        price: Math.trunc(i.price),
        quantity: Math.trunc(i.quantity)
      }));

      try {
        const docRef = await addDoc(collection(db, "orders"), {
          customerId: currentUser.uid,
          storeOwnerId: cart[0].storeOwnerId || currentUser.uid,
          storeId: cart[0].storeId,
          storeName: cart[0].storeName,
          customerName: document.getElementById("custName").value.trim(),
          customerPhone: document.getElementById("custPhone").value.trim(),
          deliveryNeighborhood: document.getElementById("custNeighborhood").value,
          deliveryAddress: document.getElementById("custAddress").value.trim(),
          items,
          itemsSummary: items.map((i) => \`\${i.name} × \${i.quantity}\`).join("، "),
          itemNames: items.slice(0, 10).map((i) => \`\${i.name} (\${i.quantity})\`),
          itemCount,
          subtotal,
          deliveryFee,
          totalAmount,
          paymentMethod: selectedPayment,
          status: "pending",
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        cart = [];
        e.target.reset();
        trackedOrderId = docRef.id;
        showStatus("تم إرسال الطلب بنجاح! يمكنك قبوله الآن من واجهة المتجر في الأعلى.");
        switchCustomerView("tracking");
        renderTrackingView();
      } catch (err) {
        showStatus("تعذر حفظ الطلب: " + err.message, true);
      }
    });

    function renderTrackingView() {
      const box = document.getElementById("trackingContent");
      const ord = allOrders.find((o) => o.id === trackedOrderId) || allOrders[0];
      if (!ord) {
        box.innerHTML = '<h2>لا يوجد طلب محدد للتتبع</h2>';
        return;
      }
      const isOnWay = ord.status === "on_the_way" || ord.status === "delivering";
      box.innerHTML = \`
        <h2>تتبع الطلب اللحظي — \${ord.storeName}</h2>
        <p class="meta">رقم الطلب: #\${ord.id.slice(0, 8)} · الحالة الحالية: <strong>\${statusLabels[ord.status] || ord.status}</strong>\${ord.prepTimeMinutes ? " · وقت التحضير: " + ord.prepTimeMinutes + " دقيقة" : ""}</p>
        <div class="steps-grid">
          <div class="step-box \${ord.status === 'pending' ? 'active' : ''}"><strong>١. قيد المراجعة</strong><div class="meta">في انتظار قبول المطعم</div></div>
          <div class="step-box \${ord.status === 'preparing' ? 'active' : ''}"><strong>٢. جارٍ التحضير</strong><div class="meta">المطبخ يجهز طلبك</div></div>
          <div class="step-box \${isOnWay ? 'active' : ''}"><strong>٣. في الطريق إليك</strong><div class="meta">مع كابتن التوصيل</div></div>
          <div class="step-box \${ord.status === 'delivered' ? 'active' : ''}"><strong>٤. تم التوصيل</strong><div class="meta">وصل الطلب بنجاح</div></div>
        </div>
        \${ord.courierName ? \`<div style="padding:1rem;border-radius:16px;background:#FFF7ED;margin-bottom:1rem;"><strong>بيانات المندوب:</strong> \${ord.courierName} · هاتف: <a href="tel:\${ord.courierPhone}" dir="ltr">\${ord.courierPhone}</a>\${ord.courierLocation ? " · الموقع: " + ord.courierLocation : ""}</div>\` : ""}
        <p><strong>الأصناف:</strong> \${ord.itemsSummary} · <strong>الإجمالي:</strong> \${ord.totalAmount} ج.م</p>
      \`;
    }

    function renderStorePortal() {
      const wrap = document.getElementById("storeOrdersContainer");
      const activeList = allOrders.filter((o) => o.status === "pending" || o.status === "preparing");
      if (!activeList.length) {
        wrap.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;">لا توجد طلبات جديدة أو قيد التحضير حالياً.</div>';
        return;
      }
      wrap.innerHTML = activeList.map((o) => \`
        <div class="card">
          <h3>\${o.storeName} — #\${o.id.slice(0, 6)}</h3>
          <div class="meta">العميل: \${o.customerName} · \${o.deliveryNeighborhood} · الحالة: \${statusLabels[o.status]}</div>
          <p style="margin:0.6rem 0;"><strong>الأصناف المطلوبة:</strong> \${o.itemsSummary}</p>
          \${o.status === "pending" ? \`
            <label>وقت التحضير المتوقع (دقيقة)</label>
            <select data-prep="\${o.id}" style="margin-bottom:0.75rem;">
              <option value="20">٢٠ دقيقة</option>
              <option value="30">٣٠ دقيقة</option>
              <option value="45">٤٥ دقيقة</option>
            </select>
            <button type="button" class="btn btn-primary btn-block" data-accept="\${o.id}">قبول الطلب وبدء التحضير</button>
          \` : \`<div class="meta" style="color:var(--orange);font-weight:700;">جارٍ التحضير (\${o.prepTimeMinutes || 20} د) — في انتظار استلام المندوب</div>\`}
        </div>
      \`).join("");

      wrap.querySelectorAll("button[data-accept]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.accept;
          const prepSel = wrap.querySelector(\`select[data-prep="\${id}"]\`);
          const prepTimeMinutes = Number(prepSel ? prepSel.value : 20);
          try {
            await updateDoc(doc(db, "orders", id), {
              status: "preparing",
              prepTimeMinutes,
              updatedAt: serverTimestamp()
            });
            showStatus("تم قبول الطلب وتغيير حالته إلى preparing!");
          } catch (err) { showStatus(err.message, true); }
        });
      });
    }

    function renderCourierPortal() {
      const wrap = document.getElementById("courierOrdersContainer");
      const queue = allOrders.filter((o) => o.status === "preparing" || o.status === "on_the_way" || o.status === "delivering");
      if (!queue.length) {
        wrap.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;">لا توجد طلبات جاهزة للاستلام أو قيد التوصيل حالياً.</div>';
        return;
      }
      wrap.innerHTML = queue.map((o) => \`
        <div class="card">
          <h3>من: \${o.storeName}</h3>
          <p style="margin:0.4rem 0;"><strong>إلى العميل:</strong> \${o.customerName} (\${o.deliveryNeighborhood} — \${o.deliveryAddress})</p>
          <p class="meta">هاتف العميل: \${o.customerPhone} · تحصيل: \${o.totalAmount} ج.م</p>
          \${o.status === "preparing" ? \`
            <button type="button" class="btn btn-primary btn-giant" data-pickup="\${o.id}" style="margin-top:0.85rem;">استلام الطلب من المتجر والانطلاق</button>
          \` : \`
            <div style="margin:0.75rem 0;padding:0.75rem;border-radius:14px;background:#F8FAFC;">الموقع الحالي: \${o.courierLocation || "في الطريق داخل مدينة إدكو"}</div>
            <button type="button" class="btn btn-navy btn-giant" data-deliver="\${o.id}">تم التوصيل بنجاح وتسليم الطلب للعميل</button>
          \`}
        </div>
      \`).join("");

      wrap.querySelectorAll("button[data-pickup]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!courierAvailable) {
            showStatus("يرجى تفعيل حالة (متاح) أولاً لاستلام الطلبات.", true);
            return;
          }
          try {
            await updateDoc(doc(db, "orders", btn.dataset.pickup), {
              status: "on_the_way",
              courierId: currentUser.uid,
              courierName: "كابتن محمود الإدكاوي",
              courierPhone: "01098765432",
              courierLocation: "في الطريق عبر شارع البحر — إدكو",
              updatedAt: serverTimestamp()
            });
            showStatus("تم استلام الطلب وتحديث حالته إلى on_the_way!");
          } catch (err) { showStatus(err.message, true); }
        });
      });

      wrap.querySelectorAll("button[data-deliver]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await updateDoc(doc(db, "orders", btn.dataset.deliver), {
              status: "delivered",
              courierLocation: "وصل إلى عنوان العميل بمدينة إدكو",
              updatedAt: serverTimestamp()
            });
            showStatus("تم تسليم الطلب بنجاح (delivered)!");
          } catch (err) { showStatus(err.message, true); }
        });
      });
    }

    function renderAdminStores() {
      const wrap = document.getElementById("adminStoresWrap");
      if (!wrap) return;
      if (!allStores.length) {
        wrap.innerHTML = '<p class="meta">لا توجد متاجر مسجلة بعد.</p>';
        return;
      }
      wrap.innerHTML = allStores.map((s) => \`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>\${s.name}</strong> · <span class="meta">\${s.neighborhood} · \${s.isActive ? "مفعّل" : "متوقف مؤقتاً"}</span>
          </div>
          <button type="button" class="btn btn-outline" data-toggle-store="\${s.id}" data-active="\${s.isActive}">\${s.isActive ? "إيقاف مؤقت" : "تفعيل المتجر"}</button>
        </div>
      \`).join("");

      wrap.querySelectorAll("button[data-toggle-store]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const next = btn.dataset.active !== "true";
          try {
            await updateDoc(doc(db, "stores", btn.dataset.toggleStore), { isActive: next });
            showStatus(next ? "تم تفعيل المتجر بنجاح" : "تم إيقاف المتجر مؤقتاً");
          } catch (err) { showStatus(err.message, true); }
        });
      });
    }

    function renderAdminPortal() {
      const validOrders = allOrders.filter((o) => o.status !== "cancelled");
      const totalSales = validOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
      const activeStoresCount = allStores.filter((s) => s.isActive).length;

      document.getElementById("adminKpis").innerHTML = \`
        <div class="card"><div class="meta">إجمالي المبيعات</div><div class="kpi-val">\${totalSales} ج.م</div></div>
        <div class="card"><div class="meta">إجمالي الطلبات</div><div class="kpi-val">\${allOrders.length}</div></div>
        <div class="card"><div class="meta">المناديب المتاحون</div><div class="kpi-val">\${courierAvailable ? 1 : 0}</div></div>
        <div class="card"><div class="meta">المتاجر النشطة</div><div class="kpi-val">\${activeStoresCount}</div></div>
      \`;

      const tableWrap = document.getElementById("adminOrdersTableWrap");
      if (!allOrders.length) {
        tableWrap.innerHTML = '<p class="meta">لا توجد طلبات مسجلة حالياً.</p>';
        return;
      }
      tableWrap.innerHTML = \`
        <table>
          <thead>
            <tr><th>الطلب</th><th>المتجر</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>المندوب</th><th>إجراء</th></tr>
          </thead>
          <tbody>
            \${allOrders.map((o) => \`
              <tr>
                <td>#\${o.id.slice(0, 6)}</td>
                <td>\${o.storeName}</td>
                <td>\${o.customerName}</td>
                <td>\${o.totalAmount} ج.م</td>
                <td>\${statusLabels[o.status] || o.status}</td>
                <td>\${o.courierName || "غير معيّن"}</td>
                <td>
                  \${o.status !== "delivered" && o.status !== "cancelled" ? \`<button type="button" class="btn btn-outline" style="color:#DC2626;padding:0.35rem 0.7rem;" data-cancel="\${o.id}">إلغاء</button>\` : "—"}
                </td>
              </tr>
            \`).join("")}
          </tbody>
        </table>
      \`;

      tableWrap.querySelectorAll("button[data-cancel]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await updateDoc(doc(db, "orders", btn.dataset.cancel), {
              status: "cancelled",
              updatedAt: serverTimestamp()
            });
            showStatus("تم إلغاء الطلب من لوحة الإدارة.");
          } catch (err) { showStatus(err.message, true); }
        });
      });

      renderAdminStores();
    }

    function renderAllPortals() {
      const pendingCount = allOrders.filter((o) => o.status === "pending").length;
      const courierCount = allOrders.filter((o) => o.status === "preparing" || o.status === "on_the_way").length;
      document.getElementById("navStorePortalBtn").textContent = pendingCount ? \`المتجر (\${pendingCount})\` : "المتجر";
      document.getElementById("navCourierPortalBtn").textContent = courierCount ? \`المندوب (\${courierCount})\` : "المندوب";

      const list = document.getElementById("ordersList");
      if (!allOrders.length) {
        list.innerHTML = '<p class="meta">لا توجد طلبات مسجلة بعد.</p>';
      } else {
        list.innerHTML = allOrders.map((o) => \`
          <div style="padding:0.75rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong>\${o.storeName}</strong> — \${o.totalAmount} ج.م
              <div class="meta">\${o.itemsSummary} · الحالة: \${statusLabels[o.status] || o.status}</div>
            </div>
            <button type="button" class="btn btn-outline" data-track="\${o.id}">تتبع</button>
          </div>
        \`).join("");
        list.querySelectorAll("button[data-track]").forEach((b) => {
          b.addEventListener("click", () => {
            trackedOrderId = b.dataset.track;
            renderTrackingView();
            switchCustomerView("tracking");
          });
        });
      }
      renderTrackingView();
      renderStorePortal();
      renderCourierPortal();
      renderAdminPortal();
    }

    function listenOrders(uid) {
      if (unsubOrders) unsubOrders();
      const map = new Map();
      const sync = () => {
        allOrders = Array.from(map.values());
        renderAllPortals();
      };
      const u1 = onSnapshot(query(collection(db, "orders"), where("customerId", "==", uid)), (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        sync();
      });
      const u2 = onSnapshot(query(collection(db, "orders"), where("storeOwnerId", "==", uid)), (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        sync();
      });
      const u3 = onSnapshot(query(collection(db, "orders"), where("courierId", "==", uid)), (snap) => {
        snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        sync();
      });
      unsubOrders = () => { u1(); u2(); u3(); };
    }

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      document.getElementById("authSection").classList.toggle("hidden", !!user);
      document.getElementById("portalNav").classList.toggle("hidden", !user);
      document.getElementById("logoutBtn").classList.toggle("hidden", !user);
      if (user) {
        listenStores(user.uid);
        listenOrders(user.uid);
        switchPortal("customer");
        switchCustomerView("stores");
      } else {
        ["customerPortal", "storePortal", "courierPortal", "adminPortal"].forEach((id) =>
          document.getElementById(id).classList.add("hidden")
        );
        updateFloatingCart();
      }
    });

    document.querySelectorAll("[data-portal]").forEach((btn) => {
      btn.addEventListener("click", () => switchPortal(btn.dataset.portal));
    });
    document.querySelectorAll("[data-cview]").forEach((btn) => {
      btn.addEventListener("click", () => switchCustomerView(btn.dataset.cview));
    });

    document.getElementById("toggleCourierAvailBtn").addEventListener("click", async () => {
      courierAvailable = !courierAvailable;
      document.getElementById("courierStatusLabel").textContent =
        "كابتن محمود الإدكاوي · 01098765432 · " + (courierAvailable ? "متاح لاستلام الطلبات" : "غير متاح مؤقتاً");
      if (currentUser) {
        try {
          await setDoc(doc(db, "couriers", currentUser.uid), {
            name: "كابتن محمود الإدكاوي",
            phone: "01098765432",
            neighborhood: "شارع البحر",
            vehicleType: "motorcycle",
            isAvailable: courierAvailable,
            currentLocation: "شارع البحر — إدكو",
            uid: currentUser.uid,
            updatedAt: serverTimestamp()
          });
        } catch (_) {}
      }
      renderAdminPortal();
    });

    document.getElementById("logoHomeLink").addEventListener("click", (e) => {
      e.preventDefault();
      if (currentUser) { switchPortal("customer"); switchCustomerView("stores"); }
    });
    document.getElementById("backToStoresBtn").addEventListener("click", () => switchCustomerView("stores"));
    document.getElementById("openCartFromBarBtn").addEventListener("click", () => switchCustomerView("cart"));
    document.getElementById("clearCartBtn").addEventListener("click", () => {
      cart = [];
      renderCartPage();
      updateFloatingCart();
    });

    document.getElementById("payCashBtn").addEventListener("click", () => {
      selectedPayment = "cash";
      document.getElementById("payCashBtn").classList.add("selected");
      document.getElementById("payVisaBtn").classList.remove("selected");
    });
    document.getElementById("payVisaBtn").addEventListener("click", () => {
      selectedPayment = "visa";
      document.getElementById("payVisaBtn").classList.add("selected");
      document.getElementById("payCashBtn").classList.remove("selected");
    });

    document.getElementById("emailAuthForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value); }
      catch (err) { showStatus(err.message, true); }
    });
    document.getElementById("registerBtn").addEventListener("click", async () => {
      try { await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value); }
      catch (err) { showStatus(err.message, true); }
    });
    document.getElementById("anonLoginBtn").addEventListener("click", async () => {
      try { await signInAnonymously(auth); }
      catch (err) { showStatus("يرجى تفعيل الدخول المجهول من Firebase Console أو استخدام Google: " + err.message, true); }
    });
    document.getElementById("googleLoginBtn").addEventListener("click", async () => {
      try { await signInWithPopup(auth, googleProvider); }
      catch (err) { showStatus(err.message, true); }
    });
    document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

    document.getElementById("seedAllBtn").addEventListener("click", async () => {
      if (!currentUser) return;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, "stores", "edku_bahr_seafood"), {
          name: "أسماك وبحريات المعدية والبحر",
          category: "أسماك وبحريات",
          neighborhood: "شارع البحر",
          description: "أسماك بحر طازجة يومياً مع أرز صيادية أصلي.",
          deliveryFee: 20,
          deliveryTimeMinutes: 30,
          rating: 4.9,
          imageKey: "seafood",
          isActive: true,
          menuItems: [{ id: "mullet_grilled", name: "وجبة بوري مشوي بالردة", price: 185 }],
          createdBy: currentUser.uid,
          createdAt: serverTimestamp()
        });
        batch.set(doc(db, "products", "prod_bahr_mullet"), {
          storeId: "edku_bahr_seafood",
          name: "وجبة بوري مشوي بالردة مع أرز صيادية",
          description: "سمك بوري بحر طازج مشوي بالردة والدقة الإدكاوية.",
          category: "مشويات بحرية",
          price: 185,
          imageKey: "seafood",
          isAvailable: true,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp()
        });
        batch.set(doc(db, "products", "prod_bahr_shrimp_tagine"), {
          storeId: "edku_bahr_seafood",
          name: "طاجن جمبري بلدي بالخلطة في الفخار",
          description: "جمبري بلدي طازج مطهو في طاجن فخار مع الفلفل والليمون.",
          category: "طواجن بحرية",
          price: 295,
          imageKey: "shrimp_casserole",
          isAvailable: true,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp()
        });
        await batch.commit();
        showStatus("تمت إضافة المتجر ومنتجاته بنجاح!");
      } catch (err) { showStatus(err.message, true); }
    });
  </script>
</body>
</html>`;
}
