// Odak YouTube arka plani.
// - macOS: durum, concentra'nin eklenti klasorune yazdigi durum.json'dan okunur
//   (Linux'ta ayarlar politikadan, chrome.storage.managed ile gelir).
// - Odak sirasinda "siteler" listesindeki alan adlarini (alt alan adlari dahil) tarayici
//   icinde engeller ve o sitelerde acik kalmis sekmeleri yeniler. /etc/hosts sadece listedeki
//   adlari kapsadigi icin, onceden acilmis bir sayfa baska alt adreslerden (yayin sunuculari vb.)
//   veri cekmeye devam edebiliyordu.
// - Hicbir adim takilip kalamaz: her cagri zaman asimina tabi, son hata chrome.storage.local'a
//   yazilir (servis calisaninin konsolunda: chrome.storage.local.get(console.log)).

const TURLER = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"];
const KURAL_ID = 1;

// bir chrome cagrisi cevap vermezse sonsuza kadar beklemeyelim
function sureli(p, ms, ne) {
  return Promise.race([p, new Promise((_, red) => setTimeout(() => red(new Error(ne + " zaman asimi")), ms))]);
}

async function durumOku() {
  // macOS: durum.json (Linux paketinde bu dosya yok)
  try {
    const r = await sureli(fetch(chrome.runtime.getURL("durum.json"), { cache: "no-store" }), 3000, "durum.json");
    if (r.ok) return await r.json();
  } catch (_) {}
  // Linux: politika
  try {
    const y = await sureli(chrome.storage.managed.get(null), 3000, "politika");
    if (y && typeof y.aktif === "boolean") return y;
  } catch (_) {}
  return null;
}

function eslesir(url, siteler) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return siteler.some((s) => h === s || h.endsWith("." + s));
  } catch (_) {
    return false;
  }
}

function kaydet(bilgi) {
  chrome.storage.local.set({ son: { zaman: new Date().toISOString(), ...bilgi } }).catch(() => {});
}

let calisan = null, basladi = 0;
function siteKurallariniGuncelle() {
  // ayni anda tek guncelleme; ama takilan bir guncelleme digerlerini sonsuza dek engellemesin
  if (calisan && Date.now() - basladi < 15000) return calisan;
  basladi = Date.now();
  calisan = guncelle().finally(() => { calisan = null; });
  return calisan;
}

async function guncelle() {
  try {
    const d = await durumOku();
    if (!d) { kaydet({ hata: "durum okunamadi" }); return; }   // bilinmiyorsa mevcut kurala dokunma
    const siteler = d.aktif && Array.isArray(d.siteler)
      ? d.siteler.map((s) => String(s).toLowerCase()).filter((s) => /^[a-z0-9.-]+$/.test(s))
      : [];
    const istenen = siteler.length ? [{
      id: KURAL_ID, priority: 1, action: { type: "block" },
      condition: { requestDomains: siteler, resourceTypes: TURLER },
    }] : [];
    const mevcut = await sureli(chrome.declarativeNetRequest.getDynamicRules(), 5000, "kural okuma");
    const ayni = mevcut.length === istenen.length && (istenen.length === 0 ||
      (JSON.stringify(mevcut[0].condition.requestDomains) === JSON.stringify(siteler) &&
       JSON.stringify([...(mevcut[0].condition.resourceTypes || [])].sort()) === JSON.stringify([...TURLER].sort())));
    if (!ayni) {
      await sureli(chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: mevcut.map((k) => k.id), addRules: istenen,
      }), 5000, "kural yazma");
    }
    // engel acikken o sitelerde acik sekme kalmasin: yenilenince engel sayfasina duser
    let yenilenen = 0;
    if (siteler.length) {
      for (const t of await sureli(chrome.tabs.query({}), 5000, "sekme listesi")) {
        if (eslesir(t.url || t.pendingUrl || "", siteler)) { yenilenen++; chrome.tabs.reload(t.id).catch(() => {}); }
      }
    }
    kaydet({ aktif: !!d.aktif, site: siteler.length, kural: istenen.length, degisti: !ayni, yenilenen });
  } catch (e) {
    console.error("odak:", e);
    kaydet({ hata: String(e && e.message || e) });
  }
}

// YouTube icerik betigi durumu sorar (macOS)
chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevap) => {
  if (!mesaj || mesaj.tur !== "durum") return;
  durumOku().then((d) => cevap(d)).catch(() => cevap(null));
  siteKurallariniGuncelle();
  return true;
});

chrome.alarms.get("odak").then((a) => { if (!a) chrome.alarms.create("odak", { periodInMinutes: 0.5 }); })
  .catch(() => chrome.alarms.create("odak", { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener(siteKurallariniGuncelle);
chrome.runtime.onStartup.addListener(siteKurallariniGuncelle);
chrome.runtime.onInstalled.addListener(siteKurallariniGuncelle);
chrome.storage.onChanged.addListener((_d, alan) => { if (alan === "managed") siteKurallariniGuncelle(); });
// engel acikken yeni acilan ya da yonlendirilen sekmeler
chrome.tabs.onUpdated.addListener((_id, degisim) => { if (degisim.url) siteKurallariniGuncelle(); });
siteKurallariniGuncelle();
