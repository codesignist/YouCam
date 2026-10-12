# YouCam

YouTuber'lar ve yayıncılar için küçük bir webcam penceresi. Kameranızı daire, altıgen ya da başka bir şekilde, her şeyin üstünde ekranda tutar; kayıt yaparken kendinizi görürsünüz. OBS kameranızı kaydederken size göstermez, bunun için ayrı bir uygulama ya da ikinci bir monitör gerekir. YouCam o uygulama.

[English](README_EN.md)

![YouCam](https://user-images.githubusercontent.com/1472881/100539154-81fe7000-3245-11eb-933d-9c6ad3253a8d.PNG)

## Özellikler

- Daire, altıgen, yuvarlak köşeli ya da kare şekil; istenirse renkli çerçeve
- Diğer pencerelerin üstünde durur; sürükleyerek taşınır, üstünde tekerlekle büyütülüp küçültülür
- Dijital yakınlaştırma: `Ctrl`+tekerlekle yüzünüze yakınlaşır, `Ctrl`+sürüklemeyle görüntüyü kaydırırsınız
- Arka planı bulanıklaştırma ya da koyu bulanıklaştırma; bilgisayarınızda yapılır, hiçbir yere gönderilmez
- Parlaklık, kontrast, siyah-beyaz, ayna ve döndürme
- Ekran ışığı: yüzünüzü monitörle aydınlatan ikinci bir pencere, beyaz ya da renkli
- `Ctrl+Shift+Y` ile her yerden gizleyip gösterme, oyun öndeyken bile; gizliyken kamera kapalıdır
- Kamera açılamazsa nedenini söyler, kamera geri gelince kendiliğinden bağlanır
- Kamerayı, ayarları ve pencerenin yerini hatırlar
- Türkçe ya da İngilizce: Windows'un dilini izler, ayarlardan da seçilebilir

## İndirme

Windows 10 ve 11 için [son sürümden](https://github.com/codesignist/YouCam/releases/latest):

- `youcam-<sürüm>-win-x64-setup.exe`: kurulum programı
- `youcam-<sürüm>-win-x64-portable.zip`: sadece `youcam.exe`, kurulum gerekmez

YouCam kod imzalı değil, bu yüzden ilk çalıştırmada Windows SmartScreen uyarı verebilir.

## Kullanım

Kamerayı sürükleyerek taşıyın, üstünde tekerleği çevirerek boyutunu değiştirin. `Ctrl` basılıyken tekerlek görüntüyü farenin olduğu yere yakınlaştırır, sürükleme de görüntüyü kaydırır. Sağ tık menüsünde kamera, arka plan, ayna, ekran ışığı, ayarlar, gizle ve çıkış var. Diğer her şey ayarlar penceresinde (Settings... ya da `S`); kameranın yanında açılır, her değişikliği yaparken görürsünüz.

| Tuş | İşlev |
|---|---|
| `M` | Ayna |
| `R` / `Shift+R` | Saat yönünde / tersine döndür |
| `B` | Arka plan: kapalı / bulanık / koyu bulanık |
| `T` | Her zaman üstte |
| `L` | Ekran ışığı |
| `H` | Gizle |
| `S` | Ayarlar |
| `0` | Yakınlaştırmayı sıfırla |
| `Q` / `Esc` | Çıkış |
| `Ctrl+Shift+Y` | Her yerden gizle / göster, oyundan odağı almadan (ayarlardan değiştirilebilir) |

Tray simgesine tıklamak da pencereyi gizler ve gösterir. YouCam açıkken yeniden başlatmak ikinci bir pencere açmaz, açık olanı gösterir.

### Ekran ışığı

Ekran ışığı, yüzünüzü bir monitörle aydınlatmak için düz bir penceredir; örneğin ikinci monitörde tam ekran. Rengini sağ tıkla seçin: White (6500K, en parlak), Daylight (5600K), Neutral (4500K) ya da Warm (3200K); odadaki diğer ışıklara en yakın olanı seçin. Red, Pink, Purple, Blue ve Cyan yandan ya da arkadan renkli ışık içindir; Cyan dışındakiler beyazdan çok daha az ışık verir. Custom... ile istediğiniz rengi seçebilirsiniz. Çift tık, `F` ya da `F11` tam ekrana alır, `Esc` tam ekrandan çıkar, `L` ışığı kapatır. Rengini, yerini ve tam ekran durumunu hatırlar.

## Kaynaktan derleme

[Node.js](https://nodejs.org/) ve [pnpm](https://pnpm.io/), bir de [Tauri'nin gerektirdikleri](https://tauri.app/start/prerequisites/) gerekir: Rust ve Windows'ta Visual Studio C++ derleme araçları.

```
pnpm install
pnpm dev     # çalıştırır
pnpm build   # kurulum programı: src-tauri/target/release/bundle/nsis/
```

[Tauri](https://tauri.app/), TypeScript ve [Vite](https://vite.dev/) ile yapıldı. Arka plan bulanıklaştırma [MediaPipe](https://ai.google.dev/edge/mediapipe)'ın selfie segmentation modelini kullanır (Apache-2.0).

## Katkı

Fikirlere ve pull request'lere açığız. Görmek istediğiniz bir özellik için [issue](https://github.com/codesignist/YouCam/issues) açın.

## Lisans

[ISC](LICENSE)
