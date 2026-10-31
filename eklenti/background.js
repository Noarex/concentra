// macOS: durum concentra'nin eklenti klasorune yazdigi durum.json dosyasindan okunur.
// (Linux'ta ayarlar politikadan, chrome.storage.managed ile gelir.)
chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevap) => {
  if (!mesaj || mesaj.tur !== "durum") return;
  fetch(chrome.runtime.getURL("durum.json"), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => cevap(d))
    .catch(() => cevap(null));
  return true;
});
