// Odak YouTube: odak sirasinda sadece izin listesindeki kanallarin videolari oynar.
// Ayarlar Linux'ta Brave politikasindan (chrome.storage.managed), macOS'ta concentra'nin
// yazdigi durum.json dosyasindan gelir: { aktif, kanallar, abonelik }
(() => {
  "use strict";

  const BILINMIYOR_MS = 3000;   // kanal bu surede anlasilamazsa video engellenir
  const YENILE_MS = 5000;       // durum.json bu araliklarla yeniden okunur
  let aktif = false;
  let abonelik = false;         // abonelik akisi da engellensin mi
  let izinli = new Set();
  let bilinmeyenVideo = null, bilinmeyenBas = 0;
  let zamanlayici = null;
  const durdurulan = new WeakSet();   // bizim durdurdugumuz videolar (izin gelince devam eder)

  // "/@3Blue1Brown", "https://www.youtube.com/@3blue1brown/videos", "/channel/UCxx" -> "@3blue1brown" | "channel/ucxx"
  function normal(s) {
    s = String(s || "").trim();
    try { s = decodeURIComponent(s); } catch (_) {}
    s = s.toLowerCase()
      .replace(/^https?:\/\/(www\.|m\.)?youtube\.com/, "")
      .replace(/^\/+/, "")
      .replace(/[?#].*$/, "");
    const p = s.split("/");
    if (p[0].startsWith("@")) return p[0];
    if ((p[0] === "channel" || p[0] === "c" || p[0] === "user") && p[1]) return p[0] + "/" + p[1];
    return s;
  }

  function videoId() {
    const u = new URL(location.href);
    if (u.pathname === "/watch") return { tur: "watch", id: u.searchParams.get("v") };
    const m = u.pathname.match(/^\/(embed|live|shorts)\/([^/?#]+)/);
    return m ? { tur: m[1], id: m[2] } : null;
  }

  function sahibiBul(v) {
    if (v.tur === "watch" || v.tur === "live") {
      const flexy = document.querySelector("ytd-watch-flexy");
      // Sayfa gecislerinde onceki videonun bilgisi kalmasin diye video-id eslesmeli
      if (!flexy || flexy.getAttribute("video-id") !== v.id) return null;
      const a = flexy.querySelector(
        "ytd-video-owner-renderer a[href], ytd-watch-metadata #owner a[href], ytd-channel-name a[href]"
      );
      return a ? normal(a.getAttribute("href")) : null;
    }
    if (v.tur === "embed") {
      const a = document.querySelector("a.ytp-title-channel-logo[href], .ytp-title-channel a[href]");
      return a ? normal(a.getAttribute("href")) : null;
    }
    return null;
  }

  // ---------- engel ekrani ----------
  const PERDE_ID = "odak-yt-perde";
  function perdeGoster(mesaj) {
    let d = document.getElementById(PERDE_ID);
    if (!d) {
      d = document.createElement("div");
      d.id = PERDE_ID;
      d.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483647", "background:#0f0f0f",
        "color:#f1f1f1", "display:flex", "flex-direction:column", "align-items:center",
        "justify-content:center", "gap:12px", "font:16px/1.5 system-ui,sans-serif",
        "text-align:center", "padding:24px"
      ].join(";");
      (document.body || document.documentElement).appendChild(d);
    }
    d.innerHTML = "";
    const b = document.createElement("div");
    b.style.cssText = "font-size:28px;font-weight:600";
    b.textContent = "Odak modu";
    const m = document.createElement("div");
    m.textContent = mesaj;
    d.append(b, m);
    videolariDurdur(document);
  }
  function videolariDurdur(doc) {
    for (const vid of doc.querySelectorAll("video")) {
      if (vid.paused) continue;
      try { vid.pause(); durdurulan.add(vid); } catch (_) {}
    }
  }

  // Kucuk pencere (resim icinde resim / YouTube'un ayri pencere oynaticisi) kapatilir
  function pipKapat() {
    try { if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {}); } catch (_) {}
    try {
      const pw = window.documentPictureInPicture && window.documentPictureInPicture.window;
      if (pw) { videolariDurdur(pw.document); pw.close(); }
    } catch (_) {}
  }

  function perdeKaldir() {
    const d = document.getElementById(PERDE_ID);
    if (d) d.remove();
  }

  // ---------- ana kontrol ----------
  // izinli: bu sayfadaki video oynayabilir | engel: perde | serbest-sayfa: perde yok ama video oynamaz
  function karar() {
    if (abonelik && location.pathname.startsWith("/feed/subscriptions")) {
      return { tur: "engel", mesaj: "Odak sirasinda abonelik akisi kapali." };
    }
    const v = videoId();
    if (!v || !v.id) { bilinmeyenVideo = null; return { tur: "serbest-sayfa" }; }
    if (v.tur === "shorts") return { tur: "engel", mesaj: "Odak sirasinda Shorts kapali." };

    const sahip = sahibiBul(v);
    if (sahip) {
      bilinmeyenVideo = null;
      return izinli.has(sahip) ? { tur: "izinli" }
        : { tur: "engel", mesaj: "Bu kanal izin listesinde degil (" + sahip + ")." };
    }
    // Kanal henuz yuklenmedi: kisa bir sure bekle (video oynamaz), sonra engelle
    if (bilinmeyenVideo !== v.id) { bilinmeyenVideo = v.id; bilinmeyenBas = Date.now(); }
    if (Date.now() - bilinmeyenBas > BILINMIYOR_MS) return { tur: "engel", mesaj: "Kanal anlasilamadi, video engellendi." };
    return { tur: "serbest-sayfa" };
  }

  function kontrol() {
    if (!aktif) { perdeKaldir(); return; }
    const k = karar();
    if (k.tur === "izinli") {
      perdeKaldir();
      for (const vid of document.querySelectorAll("video")) {
        if (durdurulan.has(vid)) { durdurulan.delete(vid); vid.play().catch(() => {}); }
      }
      return;
    }
    pipKapat();
    if (k.tur === "engel") { perdeGoster(k.mesaj); return; }
    // Ana sayfa, arama, kanal sayfasi: gezinmek serbest ama kucuk oynatici ve
    // uzerine gelince oynayan onizlemeler dahil hicbir video oynamaz
    perdeKaldir();
    videolariDurdur(document);
  }

  // Video baslar baslamaz yakala (300 ms beklemeden)
  document.addEventListener("play", (e) => {
    if (!aktif || !(e.target instanceof HTMLMediaElement)) return;
    if (karar().tur !== "izinli") { e.target.pause(); durdurulan.add(e.target); }
  }, true);

  function uygula(ayar) {
    aktif = !!(ayar && ayar.aktif);
    abonelik = !!(ayar && ayar.abonelik);
    izinli = new Set(((ayar && ayar.kanallar) || []).map(normal));
    if (aktif && !zamanlayici) zamanlayici = setInterval(kontrol, 300);
    if (!aktif && zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
    kontrol();
  }

  function ayarlariYukle() {
    chrome.storage.managed.get(null, (ayar) => {
      if (chrome.runtime.lastError) ayar = {};
      // Linux: politika varsa o gecerli
      if (ayar && typeof ayar.aktif === "boolean") { uygula(ayar); return; }
      // macOS: durum.json
      try {
        chrome.runtime.sendMessage({ tur: "durum" }, (d) => {
          if (chrome.runtime.lastError) return;   // eklenti yeniden yukleniyor; sonra tekrar denenir
          uygula(d || {});
        });
      } catch (_) { /* eklenti guncellendi, sayfa yenilenince duzelir */ }
    });
  }

  chrome.storage.onChanged.addListener((_degisen, alan) => { if (alan === "managed") ayarlariYukle(); });
  ayarlariYukle();
  setInterval(ayarlariYukle, YENILE_MS);
})();
