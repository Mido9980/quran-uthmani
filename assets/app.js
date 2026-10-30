(() => {
  function fail(msg) {
    var d = document.getElementById("diag");
    if (d) { d.hidden = false; d.textContent = msg; }
    var s = document.getElementById("splash");
    if (s) s.style.display = "none";
  }
  if (!window.QURAN_META) { fail("ملف البيانات لم يتحمل — أعد تحميل الصفحة"); return; }
  const { surahs, juz } = window.QURAN_META;
  const $ = id => document.getElementById(id);
  const app = $("app"), topbar = $("topbar"), readerBar = $("readerBar"), appEl = $("app");
  const K = { page: "quran.page", paper: "quran.paper", marks: "quran.marks", offline: "quran.offline", edition: "quran.edition" };

  const st = {
    page: +(localStorage.getItem(K.page) || 1),
    paper: localStorage.getItem(K.paper) || "cream",
    marks: JSON.parse(localStorage.getItem(K.marks) || "[]"),
    edition: localStorage.getItem(K.edition) || "white",
    view: "list"
  };
  document.body.dataset.paper = st.paper;

  const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const EDITIONS = {
    white: { name: "مصحف المدينة — أبيض", dir: "pages/" },
    blue:  { name: "مصحف المدينة — أزرق", dir: "pages-blue/" }
  };
  const pageSrc = p => `${(EDITIONS[st.edition] || EDITIONS.white).dir}${String(p).padStart(3, "0")}.png`;
  const surahOf = p => [...surahs].reverse().find(s => s.p <= p) || surahs[0];
  const juzOf = p => { let j = 1; juz.forEach((sp, i) => { if (p >= sp) j = i + 1; }); return j; };

  /* ---------- splash ---------- */
  function boot() {
    setTimeout(() => {
      const s = $("splash");
      s.classList.add("hide");
      setTimeout(() => s.remove(), 550);
      topbar.hidden = false;
      appEl.hidden = false;
      route();
    }, 1100);
  }
  window.addEventListener("load", boot);
  // أمان: لو حدث load اتأخر لأي سبب
  setTimeout(() => { if (document.getElementById("splash")) { try { boot(); } catch {} } }, 2600);

  /* ---------- navigation ---------- */
  function go(hash) { location.hash = hash; }
  window.addEventListener("hashchange", route);

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [part, arg] = h.split("/");
    closeSheet();
    if (part === "read" || part === "page") {
      let p = arg === "last" ? st.page : parseInt(arg, 10);
      if (part === "read" && !arg) p = 1;
      openReader(isNaN(p) ? st.page : p);
      showReaderChrome(true);
      return;
    }
    if (part === "about") return renderAbout();
    showReaderChrome(false);
    renderList();
  }

  function showReaderChrome(reader) {
    readerBar.hidden = !reader;
    appEl.classList.toggle("no-bar", !reader);
    $("backBtn").textContent = reader ? "☰" : "☰";
  }

  /* ---------- list ---------- */
  let tab = "surahs";
  function renderList() {
    st.view = "list";
    app.innerHTML = `
      <section class="hero">
        <h1>المصحف الشريف</h1>
        <p>الرسم العثماني · ٦٠٤ صفحات · مصحف المدينة النبوية</p>
        <div class="acts">
          <button class="btn gold" id="continueBtn">متابعة القراءة · صفحة ${AR(st.page)}</button>
          <button class="btn" id="offlineBtn">تحميل للقراءة أوفلاين</button>
          <button class="btn" id="aboutBtn">عن المصحف</button>
        </div>
        <div id="offlineWrap"></div>
      </section>
      <input class="search" id="q" placeholder="ابحث عن سورة…" autocomplete="off">
      <div class="tabs">
        <button id="tab1" class="on">السور</button>
        <button id="tab2">الأجزاء</button>
        <button id="tab3">العلامات</button>
      </div>
      <div class="list" id="list"></div>`;

    $("continueBtn").onclick = () => go(`#/page/${st.page}`);
    $("aboutBtn").onclick = () => go("#/about");
    $("offlineBtn").onclick = downloadAll;
    $("q").oninput = e => paintList(tab, e.target.value.trim());
    $("tab1").onclick = () => { tab = "surahs"; paintTabs(); paintList(tab); };
    $("tab2").onclick = () => { tab = "juz"; paintTabs(); paintList(tab); };
    $("tab3").onclick = () => { tab = "marks"; paintTabs(); paintList(tab); };

    function paintTabs() {
      ["tab1", "tab2", "tab3"].forEach((id, i) => $(id).classList.toggle("on", ["surahs", "juz", "marks"][i] === tab));
    }
    paintList(tab);
  }

  function paintList(t, q = "") {
    const list = $("list");
    if (!list) return;
    if (t === "surahs") {
      const items = surahs.filter(s => !q || s.ar.includes(q) || s.en.toLowerCase().includes(q.toLowerCase()));
      list.innerHTML = items.map(s => `
        <div class="row" data-p="${s.p}">
          <div class="num">${AR(s.n)}</div>
          <div class="t"><b>سورة ${s.ar}</b><small>${AR(s.v)} آية · تبدأ صفحة ${AR(s.p)}</small></div>
          <span class="badge ${s.m ? "" : "m"}">${s.m ? "مكية" : "مدنية"}</span>
        </div>`).join("") || '<p class="note">مفيش نتائج</p>';
      list.querySelectorAll(".row").forEach(r => r.onclick = () => go(`#/page/${r.dataset.p}`));
    } else if (t === "juz") {
      list.innerHTML = juz.map((p, i) => `
        <div class="row" data-p="${p}">
          <div class="num">${AR(i + 1)}</div>
          <div class="t"><b>الجزء ${AR(i + 1)}</b><small>يبدأ صفحة ${AR(p)}</small></div>
          <span class="badge">${AR(p)}</span>
        </div>`).join("");
      list.querySelectorAll(".row").forEach(r => r.onclick = () => go(`#/page/${r.dataset.p}`));
    } else {
      const marks = [...st.marks].sort((a, b) => a - b);
      list.innerHTML = marks.length ? marks.map(p => {
        const s = surahOf(p);
        return `<div class="row" data-p="${p}">
          <div class="num">${AR(p)}</div>
          <div class="t"><b>${s.ar}</b><small>علامة على صفحة ${AR(p)}</small></div>
          <span class="badge m">🔖</span></div>`;
      }).join("") : '<p class="note">مفيش علامات محفوظة. افتح أي صفحة واضغط 🔖 فوق.</p>';
      list.querySelectorAll(".row").forEach(r => r.onclick = () => go(`#/page/${r.dataset.p}`));
    }
  }

  /* ---------- reader ---------- */
  function openReader(p) {
    p = Math.min(604, Math.max(1, p));
    st.page = p; localStorage.setItem(K.page, p);
    app.innerHTML = `
      <div class="reader">
        <div class="page-wrap">
          <button class="zone next" id="zNext" aria-label="التالي"></button>
          <img class="page-img" id="pageImg" src="${pageSrc(p)}" alt="صفحة ${p}" draggable="false">
          <button class="zone prev" id="zPrev" aria-label="السابق"></button>
        </div>
      </div>`;
    app.classList.add("no-bar");
    $("zPrev").onclick = () => go(`#/page/${Math.min(604, p + 1)}`);
    $("zNext").onclick = () => go(`#/page/${Math.max(1, p - 1)}`);
    $("pageLbl").textContent = AR(p);
    $("surahLbl").textContent = surahOf(p).ar;
    $("juzLbl").textContent = "الجزء " + AR(juzOf(p));
    $("bmBtn").classList.toggle("on", st.marks.includes(p));

    // preload neighbours
    [p - 1, p + 1].filter(x => x >= 1 && x <= 604).forEach(x => { const i = new Image(); i.src = pageSrc(x); });

    // swipe
    let sx = 0, sy = 0;
    const wrap = app.querySelector(".page-wrap");
    wrap.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    wrap.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 55 || Math.abs(dy) > 70) return;
      if (dx < 0) go(`#/page/${Math.min(604, p + 1)}`);  // سحب لليسار = التالي (RTL)
      else go(`#/page/${Math.max(1, p - 1)}`);
    }, { passive: true });
  }

  $("prevBtn").onclick = () => go(`#/page/${Math.min(604, st.page + 1)}`);
  $("nextBtn").onclick = () => go(`#/page/${Math.max(1, st.page - 1)}`);
  $("backBtn").onclick = () => {
    if (location.hash.includes("/page/") || location.hash.includes("/read/")) go("#/");
    else openSheet();
  };
  $("bmBtn").onclick = () => {
    const i = st.marks.indexOf(st.page);
    if (i >= 0) st.marks.splice(i, 1); else st.marks.push(st.page);
    localStorage.setItem(K.marks, JSON.stringify(st.marks));
    $("bmBtn").classList.toggle("on", st.marks.includes(st.page));
    toast(st.marks.includes(st.page) ? "تم حفظ العلامة" : "تم حذف العلامة");
  };
  $("themeBtn").onclick = openThemeSheet;

  document.addEventListener("keydown", e => {
    if (!location.hash.includes("/page")) return;
    if (e.key === "ArrowLeft") go(`#/page/${Math.min(604, st.page + 1)}`);
    if (e.key === "ArrowRight") go(`#/page/${Math.max(1, st.page - 1)}`);
  });

  /* ---------- sheets ---------- */
  function closeSheet() { $("sheet").hidden = true; }
  function openSheet(html) { $("sheetInner").innerHTML = html; $("sheet").hidden = false; }
  $("sheet").onclick = e => { if (e.target.id === "sheet") closeSheet(); };

  function openThemeSheet() {
    const papers = [["cream", "ورقي", "#f7f3e8"], ["white", "أبيض", "#f2f2f2"], ["sepia", "سيبيا", "#efe2c6"], ["green", "أخضر", "#dfeade"], ["night", "ليلي", "#0b1512"]];
    openSheet(`
      <h3>لون الصفحة</h3>
      ${papers.map(([k, n, c]) => `<div class="opt ${st.paper === k ? "on" : ""}" data-paper="${k}">
        <span class="swatch" style="background:${c}"></span><span>${n}</span></div>`).join("")}
      <h3 style="margin-top:16px">نسخة المصحف</h3>
      ${Object.entries(EDITIONS).map(([k, v]) => `<div class="opt ${st.edition === k ? "on" : ""}" data-ed="${k}">
        <span class="swatch" style="background:${k === "blue" ? "#dfeefc" : "#ffffff"}"></span><span>${v.name}</span></div>`).join("")}
      <h3 style="margin-top:16px">انتقال سريع</h3>
      <div class="note">اكتب رقم الصفحة (١ – ٦٠٤)</div>
      <input class="search" id="jumpInput" inputmode="numeric" placeholder="رقم الصفحة">
      <button class="btn gold" id="jumpGo" style="margin-top:10px;width:100%">اذهب</button>
    `);
    document.querySelectorAll("[data-ed]").forEach(el => el.onclick = () => {
      st.edition = el.dataset.ed;
      localStorage.setItem(K.edition, st.edition);
      closeSheet();
      const img = document.getElementById("pageImg");
      if (img) img.src = pageSrc(st.page);
      toast("تم التغيير إلى " + EDITIONS[st.edition].name);
    });
    document.querySelectorAll("[data-paper]").forEach(el => el.onclick = () => {
      st.paper = el.dataset.paper;
      localStorage.setItem(K.paper, st.paper);
      document.body.dataset.paper = st.paper;
      closeSheet();
    });
    $("jumpGo").onclick = () => {
      const v = parseInt(($("jumpInput").value || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10);
      if (v >= 1 && v <= 604) { closeSheet(); go(`#/page/${v}`); }
      else toast("رقم غير صحيح");
    };
  }

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    let t = $("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.style.cssText = "position:fixed;bottom:72px;inset-inline:0;margin:auto;max-width:300px;text-align:center;background:rgba(212,175,55,.96);color:#20180a;padding:10px 16px;border-radius:12px;font-size:14px;z-index:70;font-family:inherit;box-shadow:0 8px 20px rgba(0,0,0,.3)";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(toastT);
    toastT = setTimeout(() => t.style.opacity = "0", 1600);
  }

  /* ---------- about ---------- */
  function renderAbout() {
    app.innerHTML = `
      <section class="hero" style="margin-top:6px">
        <h1>عن المصحف</h1>
        <p>نسخة كاملة من مصحف المدينة النبوية بالرسم العثماني، ٦٠٤ صفحات، برواية حفص عن عاصم.</p>
      </section>
      <div class="list">
        <div class="row" style="cursor:default"><div class="t">
          <b>المصدر</b>
          <small style="display:block;margin-top:6px;line-height:1.8">
          صفحات المصحف من إصدار مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة، وهو المرجع المتعارف عليه للرسم العثماني، وملف الصفحات متاح للتحميل من pdfquran.com.
          </small>
        </div></div>
        <div class="row" style="cursor:default"><div class="t">
          <b>المراجعة</b>
          <small style="display:block;margin-top:6px;line-height:1.8">
          لم أتحقق من وجود اعتماد رسمي من لجنة مراجعة المصحف بالأزهر الشريف لهذا الملف تحديدًا، ولهذا لا يُنسب التطبيق للأزهر. لو عايز نشره على نطاق واسع، الأفضل طلب إذن رسمي من اللجنة أو شراء نسخة مراجعة موثقة.
          </small>
        </div></div>
        <div class="row" style="cursor:default"><div class="t">
          <b>العمل أوفلاين</b>
          <small style="display:block;margin-top:6px;line-height:1.8">بعد فتح أي صفحة مرة واحدة بتتحفظ على جهازك وتشتغل بدون نت. زرار «تحميل للقراءة أوفلاين» بيحفظ المصحف كله (حوالي ٣٥ ميجا).</small>
        </div></div>
        <div class="row" data-back="1"><div class="t"><b>رجوع للفهرس</b><small>اضغط هنا</small></div></div>
      </div>`;
    document.querySelector("[data-back]").onclick = () => go("#/");
  }

  /* ---------- offline download ---------- */
  async function downloadAll() {
    const wrap = $("offlineWrap");
    wrap.innerHTML = `<div class="note" id="dlNote" style="margin-top:12px">جاري التحميل… ٠ / ٦٠٤</div><div class="loadbar"><i id="dlBar"></i></div>`;
    let done = 0;
    const queue = Array.from({ length: 604 }, (_, i) => i + 1);
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        try { await fetch(pageSrc(p), { cache: "force-cache" }); } catch {}
        done++;
        if (done % 5 === 0 || done === 604) {
          const n = $("dlNote"), b = $("dlBar");
          if (n) n.textContent = `جاري التحميل… ${AR(done)} / ٦٠٤`;
          if (b) b.style.width = (done / 604 * 100) + "%";
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    localStorage.setItem(K.offline, "1");
    const n = $("dlNote");
    if (n) n.textContent = "تم حفظ المصحف كامل على جهازك ✔";
    toast("المصحف محفوظ أوفلاين");
  }

  /* ---------- service worker ---------- */
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  /* start */
  if (document.readyState === "complete") window.dispatchEvent(new Event("load"));
})();
