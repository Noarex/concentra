# concentra

Linux (Arch) ve MacOS için planlı odak modu. Belirlediğin saatlerde dikkat dağıtan siteleri, uygulamaları ve YouTube'u engeller. Engeller süre dolmadan kalkmaz, bilgisayarı yeniden başlatsan da geri gelir.

Concentra tamamen engellenemez değildir, sudo yetkisi ile her an kaldırılabilir.

Terminal komutu: `odak` (ya da `concentra`).

## Ne engelliyor

- **Siteler:** tarayıcı politikası (Brave, Chromium, Chrome, Firefox) ve `/etc/hosts` ile.
- **YouTube:** abonelik akışı ve **kanal izin listesi**. Odak sırasında sadece izin verilen kanalların videoları oynar, Shorts kapalıdır. Bu iş tarayıcıya politika ile zorla kurulan, kapatılamayan bir eklentiyle yapılır (Chromium tabanlı tarayıcılar).
- **Uygulamalar:** Discord gibi uygulamalar odak sırasında kapatılır.
- **Ağ:** istersen Tailscale trafiği ya da belirli IP adresleri (`nftables`).
- Engel her başladığında tarayıcı kapatılır. Açık kalmış sekmeler yeniden açılınca engel sayfasına düşer.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `odak 2` / `odak 1.5` / `odak 45dk` | Tek seferlik odak (en fazla 24 saat) |
| `odak hafta` | Pazartesi-Cuma otomatik odak (varsayılan 07:30-20:00) |
| `odak full` | Her gün otomatik odak |
| `odak plan kapat` | Planı bekleme süresi (varsayılan 3 gün) sonunda kapatır |
| `odak plan ara <gün>` | Bekleme süresinden sonra planı <gün> gün duraklatır, sonra plan kendiliğinden devam eder |
| `odak plan vazgec` | Bekleyen talebi geri alır |
| `odak plan devam` | Duraklamayı hemen bitirir |
| `odak mola` | 15 dk mola. Molanın süresi bitişe eklenir |
| `odak kanal` | YouTube izin listesi |
| `odak kanal ekle\|sil @kanal` | Listeyi değiştirir (sadece odak dışında) |
| `odak eklenti` | YouTube eklentisinin kurulumu ve durumu (macOS) |
| `odak durum` | Durum |
| `odak yardim` | Komut listesi |

Planı sıkılaştırmak (hafta → full, `vazgec`, `devam`) anında uygulanır. Gevşetmek (kapat, ara, full → hafta) bekleme süresi gerektirir.

## Ayarlar

`/etc/concentra.conf`: plan saatleri, mola süresi, bekleme süresi, engellenen siteler ve uygulamalar, ağ engelleri. Kendi eklemelerini `/etc/concentra.d/*.conf` dosyalarına da yazabilirsin. Örnek:

```bash
# /etc/concentra.d/benim.conf
TAILSCALE_ENGELLE=evet
UYGULAMALAR+=(moonlight)
```

Durum bilgisi `/var/lib/concentra` klasöründe tutulur.

## Kurulum

**Arch Linux:**
```
git clone https://github.com/Noarex/concentra.git && cd concentra/aur && makepkg -si
```

**macOS (Homebrew):**
```
brew tap noarex/concentra https://github.com/Noarex/concentra
brew trust noarex/concentra
brew install concentra
sudo odak --kur
```
macOS'ta siteler `/etc/hosts`, ağ engelleri `pf`, dakikalık kontrol launchd ile yapılır.

`sudo odak --kur` iki şey ister, ikisi de bir kerelik:
- **Brave ayar profili:** gizli pencereyi, Tor penceresini ve misafir modunu kapatır. macOS'ta bunlar profil sabit olduğu için her zaman kapalı kalır, odak dışında da (Linux'ta sadece odak sırasında kapalı). System Settings → General → Device Management'tan onaylanır.
- **YouTube eklentisi:** macOS, MDM'e bağlı olmayan Mac'lerde Web Store dışı eklentiyi zorla kurdurmuyor. Bu yüzden eklenti Brave'e elle "Load unpacked" ile yüklenir (`odak eklenti` adımları gösterir). Odak sırasında eklenti her Brave profilinde yüklü ve açık değilse Brave kapatılır.

Güncelleme: `brew update && brew upgrade concentra` (macOS), `git pull` sonrası `makepkg -si` (Arch).
