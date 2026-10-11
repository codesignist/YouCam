# YouCam

YouTube yayıncıları için geliştirilmiş masaüstü webcam uygulaması.

[English readme/İngilizce readme](README_EN.md)

![YouCamSS](https://user-images.githubusercontent.com/1472881/100539154-81fe7000-3245-11eb-933d-9c6ad3253a8d.PNG)

### Motivasyon

OBS studio'da kamera kaydı oluşturulurken ekranda kendinizi göremiyorsunuz maalesef. Bunun için ayrıca bir yazılıma ya da referans monitöre ihtiyacınız var. Bu şekilde minik, pratik bir yazılımın olmayışı ve NW.js ile deneme çalışması yapmak için bu uygulama oluşturuldu.

### Kurulum

Bağımlılıklar (NW.js binary dahil):

```
pnpm install
```

Doğrudan çalıştırmak için:

```
pnpm start
```

Paketlemek için:

```
pnpm build
```

Varsayılan olarak win64 paketi `./dist` altına üretilir. Platform/mimari için `package.json` içindeki `nwbuild` bölümünü düzenleyin.
Daha fazla bilgi için; [nw-builder](https://github.com/nwutils/nw-builder)

## Kullanılan Paket/ler

- [NW.js](https://nwjs.io/) — masaüstü çalışma ortamı
- [nw-builder](https://github.com/nwutils/nw-builder) — paketleyici
- [MediaPipe](https://ai.google.dev/edge/mediapipe) — arka plan bulanıklaştırma (selfie segmentation modeli, Apache-2.0)

## Klavye Kısayolları

| Tuş | İşlev |
|---|---|
| `M` | Ayna (mirror) aç/kapa |
| `R` / `Shift+R` | Saat yönünde / tersine döndür |
| `B` | Arka plan: kapalı / bulanık / koyu bulanık |
| `T` | Always on top aç/kapa |
| `L` | Ekran ışığı aç/kapa |
| `Q` / `Esc` | Çıkış |
| Fare tekerleği | Pencereyi büyüt / küçült |
| Sağ tık | Bağlam menüsü |

Ekran ışığı, yüzünüzü bir monitörle aydınlatmak için ayrı bir ışık penceresidir (ör. ikinci monitörde tam ekran). Işık penceresinde sağ tık ile renk sıcaklığı seçilir: White (6500K, en parlak), Daylight (5600K), Neutral (4500K), Warm (3200K). En iyi sonuç için odadaki diğer ışıkların rengine en yakın olanı seçin. Yayıncıların yan/arka ışık olarak en çok kullandığı vurgu renkleri de var: Red, Pink, Purple, Blue, Cyan. Bunlar (Cyan dışında) beyazdan çok daha az ışık verir, ana ışık olarak değil vurgu olarak kullanılır. Başka bir renk için Custom... renk seçiciyi açar. Çift tık, `F` ya da `F11` tam ekrana alır, `Esc` tam ekrandan çıkar, `L` kapatır. Rengi, konumu, boyutu ve tam ekran durumu hatırlanır.

## Yapılacaklar

- [x] Ölçü çeşitleri
- [x] Keskin ve yumuşak kenarlı farklı şekiller
- [x] Ayna (mirror) özelliği
- [x] İngilizce ReadMe.md
- [x] Klavye kısayolları
- [x] Seçili kameranın hatırlanması
- [x] Görüntü kalitesi seçimi (480p / 720p / 1080p)
- [x] Pencere konumu ve boyutunun hatırlanması
- [x] Arka plan bulanıklaştırma
- [x] Koyu bulanık arka plan
- [x] Ekran ışığı

## Katılım

Geliştirilmesini istediğiniz özellikleri bildirebilir ya da PR göndererek katılımda bulunabilirsiniz.
