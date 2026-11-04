// Odak YouTube arka plani.
// - macOS: durum, concentra'nin eklenti klasorune yazdigi durum.json'dan okunur
//   (Linux'ta ayarlar politikadan, chrome.storage.managed ile gelir).
// - Odak sirasinda "siteler" listesindeki alan adlarini (alt alan adlari dahil) tarayici
//   icinde engeller ve o sitelerde acik kalmis sekmeleri yeniler. /etc/hosts sadece listedeki
//   adlari kapsadigi icin, onceden acilmis bir sayfa baska alt adreslerden (yayin sunuculari vb.)
//   veri cekmeye devam edebiliyordu.

const TURLER = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"];
const KURAL_ID = 1;

async function durumOku() {
  try {
    const yonetilen = await chrome.storage.managed.get(null);
    if (yonetilen && typeof yonetilen.aktif === "boolean") return yonetilen;   // Linux
  } catch (_) {}
  try {
    const r = await fetch(chrome.runtime.getURL("durum.json"), { cache: "no-store" });
    return r.ok ? await r.json() : null;                                       // macOS
  } catch (_) {
    return null;
  }
}

function eslesir(url, siteler) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return siteler.some((s) => h === s || h.endsWith("." + s));
  } catch (_) {
    return false;
  }
}

let calisiyor = false;
async function siteKurallariniGuncelle() {
  if (calisiyor) return;
  calisiyor = true;
  try {
    const d = await durumOku();
    const siteler = d && d.aktif && Array.isArray(d.siteler)
      ? d.siteler.map((s) => String(s).toLowerCase()).filter((s) => /^[a-z0-9.-]+$/.test(s))
      : [];
    const mevcut = await chrome.declarativeNetRequest.getDynamicRules();
    const eskiListe = JSON.stringify(mevcut.length ? mevcut[0].condition.requestDomains : []);
    if (eskiListe !== JSON.stringify(siteler)) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: mevcut.map((k) => k.id),
        addRules: siteler.length ? [{
          id: KURAL_ID, priority: 1, action: { type: "block" },
          condition: { requestDomains: siteler, resourceTypes: TURLER },
        }] : [],
      });
    }
    // engel acikken o sitelerde acik sekme kalmasin: yenilenince engel sayfasina duser
    if (siteler.length) {
      for (const t of await chrome.tabs.query({})) {
        if (eslesir(t.url || t.pendingUrl || "", siteler)) chrome.tabs.reload(t.id).catch(() => {});
      }
    }
  } catch (_) {
  } finally {
    calisiyor = false;
  }
}

// YouTube icerik betigi durumu sorar (macOS)
chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevap) => {
  if (!mesaj || mesaj.tur !== "durum") return;
  durumOku().then((d) => cevap(d)).catch(() => cevap(null));
  siteKurallariniGuncelle();
  return true;
});

chrome.alarms.create("odak", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(siteKurallariniGuncelle);
chrome.runtime.onStartup.addListener(siteKurallariniGuncelle);
chrome.runtime.onInstalled.addListener(siteKurallariniGuncelle);
chrome.storage.onChanged.addListener((_d, alan) => { if (alan === "managed") siteKurallariniGuncelle(); });
// engel acikken yeni acilan ya da yonlendirilen sekmeler
chrome.tabs.onUpdated.addListener((_id, degisim) => { if (degisim.url) siteKurallariniGuncelle(); });
siteKurallariniGuncelle();
