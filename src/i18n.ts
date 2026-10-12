// The app's words in English and Turkish, for every window. "system"
// follows the language WebView2 reports, which is Windows' display language.

export const languages = ["system", "en", "tr"] as const;
export type Language = (typeof languages)[number];
type Locale = Exclude<Language, "system">;

const en = {
  // Camera window menu (right-click and tray)
  "menu.camera": "Cam source",
  "menu.background": "Background (B)",
  "menu.mirror": "Mirror (M)",
  "menu.screenLight": "Screen light (L)",
  "menu.settings": "Settings... (S)",
  "menu.hide": "Hide (H)",
  "menu.show": "Show",
  "menu.exit": "Exit (Q)",
  "camera.unnamed": "Camera {n}",

  "background.Off": "Off",
  "background.Blur": "Blur",
  "background.Dark blur": "Dark blur",

  // Messages in the camera window
  "message.tryAgain": "Try again",
  "message.denied": "No camera access",
  "message.deniedHint": "Allow it under Windows Settings > Privacy & security > Camera.",
  "message.disconnected": "Camera disconnected",
  "message.disconnectedHint":
    "Plug it back in and YouCam will reconnect, or right-click to pick another.",
  "message.noCamera": "No camera found",
  "message.noCameraHint": "Plug one in and YouCam will connect to it.",
  "message.obsOff": "OBS Virtual Camera is off",
  "message.obsOffHint": "Start it in OBS (Start Virtual Camera) and YouCam will connect.",
  "message.busy": "Camera is in use",
  "message.busyObsHint": "If OBS has it, start OBS's Virtual Camera and use that.",
  "message.useObs": "Use OBS Virtual Camera",
  "message.busyHint": "YouCam will connect once the other app lets go of it.",
  "message.failed": "Camera didn't start",
  "message.failedHint": "YouCam will keep trying.",
  "message.backgroundFailed": "Background effect failed",
  "message.backgroundFailedHint": "It is off for now; press B to try again.",
  "message.shortcutTaken": "{shortcut} is taken",
  "message.shortcutTakenHint": "Another app uses it; pick another in Settings.",

  // Window titles
  "title.settings": "YouCam Settings",
  "title.light": "YouCam Light",

  // Settings window
  "tabs.label": "Settings",
  "tab.camera": "Camera",
  "tab.shape": "Shape",
  "tab.picture": "Picture",
  "tab.general": "General",
  "tab.keys": "Keys",

  "settings.source": "Source",
  "settings.noCamera": "No camera found",
  "settings.quality": "Quality",
  "settings.mirror": "Mirror",
  "settings.rotate": "Rotate",
  "settings.turnLeft": "Turn left",
  "settings.turnRight": "Turn right",

  "settings.shapeAndSize": "Shape and size",
  "shape.Square": "Square",
  "shape.Rounded": "Rounded",
  "shape.Circle": "Circle",
  "shape.Hexagon": "Hexagon",
  "settings.size": "Size",
  "size.Small": "Small",
  "size.Medium": "Medium",
  "size.Large": "Large",
  "settings.sizeHint": "Now {width} × {height}. Scroll on the camera for any size in between.",
  "settings.aspectRatio": "Aspect ratio",
  "aspect.None": "Free",
  "settings.border": "Border",
  "settings.noBorder": "No border",
  "color.White": "White",
  "color.Black": "Black",
  "color.Red": "Red",
  "color.Yellow": "Yellow",
  "color.Green": "Green",
  "color.Cyan": "Cyan",
  "color.Blue": "Blue",
  "color.Purple": "Purple",
  "color.Pink": "Pink",
  "settings.anyColour": "Any colour",
  "settings.pickColour": "Pick any colour",
  "settings.width": "Width",

  "settings.background": "Background",
  "settings.adjustments": "Adjustments",
  "settings.reset": "Reset",
  "settings.brightness": "Brightness",
  "settings.contrast": "Contrast",
  "settings.blackAndWhite": "Black and white",

  "settings.language": "Language",
  "language.system": "System",
  "settings.alwaysOnTop": "Always on top",
  "settings.alwaysOnTopHint": "Keeps the camera above other windows.",
  "settings.screenLight": "Screen light",
  "settings.screenLightHint": "A bright window that lights your face. Right-click it for its colour.",
  "settings.hideShow": "Hide and show",
  "settings.noShortcut": "No shortcut",
  "settings.hideShowHint": "Works even with a game in front.",
  "settings.shortcutTaken": "Another app uses this shortcut. Pick another one.",

  "keys.intro": "With the camera window in front:",
  "keys.mirror": "Mirror",
  "keys.rotate": "Turn right, turn left",
  "keys.background": "Next background",
  "keys.alwaysOnTop": "Always on top",
  "keys.screenLight": "Screen light",
  "keys.hide": "Hide",
  "keys.settings": "Settings",
  "keys.exit": "Exit",
  "keys.wheel": "Mouse wheel",
  "keys.resize": "Resize",
  "keys.rightClick": "Right-click",
  "keys.menu": "Menu",

  // Screen light menu
  "light.6500": "White (6500K)",
  "light.5600": "Daylight (5600K)",
  "light.4500": "Neutral (4500K)",
  "light.3200": "Warm (3200K)",
  "light.red": "Red",
  "light.pink": "Pink",
  "light.purple": "Purple",
  "light.blue": "Blue",
  "light.cyan": "Cyan",
  "light.custom": "Custom...",
  "light.fullscreen": "Fullscreen (F)",
  "light.close": "Close (L)",
};

export type MessageKey = keyof typeof en;

const tr: Record<MessageKey, string> = {
  "menu.camera": "Kamera",
  "menu.background": "Arka plan (B)",
  "menu.mirror": "Ayna (M)",
  "menu.screenLight": "Ekran ışığı (L)",
  "menu.settings": "Ayarlar... (S)",
  "menu.hide": "Gizle (H)",
  "menu.show": "Göster",
  "menu.exit": "Çıkış (Q)",
  "camera.unnamed": "Kamera {n}",

  "background.Off": "Kapalı",
  "background.Blur": "Bulanık",
  "background.Dark blur": "Koyu bulanık",

  "message.tryAgain": "Tekrar dene",
  "message.denied": "Kameraya erişim yok",
  "message.deniedHint": "Windows Ayarları > Gizlilik ve güvenlik > Kamera bölümünden izin verin.",
  "message.disconnected": "Kamera çıkarıldı",
  "message.disconnectedHint":
    "Geri takınca YouCam yeniden bağlanır; başka bir kamera için sağ tıklayın.",
  "message.noCamera": "Kamera bulunamadı",
  "message.noCameraHint": "Bir kamera takın, YouCam ona bağlanır.",
  "message.obsOff": "OBS Virtual Camera kapalı",
  "message.obsOffHint": "OBS'te sanal kamerayı başlatın, YouCam bağlanır.",
  "message.busy": "Kamera kullanımda",
  "message.busyObsHint": "Kamerayı OBS kullanıyorsa OBS'in sanal kamerasını başlatıp onu seçin.",
  "message.useObs": "OBS Virtual Camera'yı kullan",
  "message.busyHint": "Diğer uygulama kamerayı bırakınca YouCam bağlanır.",
  "message.failed": "Kamera açılmadı",
  "message.failedHint": "YouCam denemeye devam ediyor.",
  "message.backgroundFailed": "Arka plan efekti açılmadı",
  "message.backgroundFailedHint": "Şimdilik kapalı; tekrar denemek için B'ye basın.",
  "message.shortcutTaken": "{shortcut} kullanımda",
  "message.shortcutTakenHint": "Başka bir uygulama kullanıyor; ayarlardan başka bir kısayol seçin.",

  "title.settings": "YouCam Ayarları",
  "title.light": "YouCam Ekran Işığı",

  "tabs.label": "Ayarlar",
  "tab.camera": "Kamera",
  "tab.shape": "Şekil",
  "tab.picture": "Görüntü",
  "tab.general": "Genel",
  "tab.keys": "Tuşlar",

  "settings.source": "Kaynak",
  "settings.noCamera": "Kamera bulunamadı",
  "settings.quality": "Kalite",
  "settings.mirror": "Ayna",
  "settings.rotate": "Döndür",
  "settings.turnLeft": "Sola çevir",
  "settings.turnRight": "Sağa çevir",

  "settings.shapeAndSize": "Şekil ve boyut",
  "shape.Square": "Kare",
  "shape.Rounded": "Yuvarlak",
  "shape.Circle": "Daire",
  "shape.Hexagon": "Altıgen",
  "settings.size": "Boyut",
  "size.Small": "Küçük",
  "size.Medium": "Orta",
  "size.Large": "Büyük",
  "settings.sizeHint": "Şu an {width} × {height}. Aradaki boyutlar için kamerada tekerleği çevirin.",
  "settings.aspectRatio": "En-boy oranı",
  "aspect.None": "Serbest",
  "settings.border": "Çerçeve",
  "settings.noBorder": "Çerçeve yok",
  "color.White": "Beyaz",
  "color.Black": "Siyah",
  "color.Red": "Kırmızı",
  "color.Yellow": "Sarı",
  "color.Green": "Yeşil",
  "color.Cyan": "Camgöbeği",
  "color.Blue": "Mavi",
  "color.Purple": "Mor",
  "color.Pink": "Pembe",
  "settings.anyColour": "İstediğiniz renk",
  "settings.pickColour": "İstediğiniz rengi seçin",
  "settings.width": "Kalınlık",

  "settings.background": "Arka plan",
  "settings.adjustments": "Ayarlamalar",
  "settings.reset": "Sıfırla",
  "settings.brightness": "Parlaklık",
  "settings.contrast": "Kontrast",
  "settings.blackAndWhite": "Siyah-beyaz",

  "settings.language": "Dil",
  "language.system": "Sistem",
  "settings.alwaysOnTop": "Her zaman üstte",
  "settings.alwaysOnTopHint": "Kamerayı diğer pencerelerin üstünde tutar.",
  "settings.screenLight": "Ekran ışığı",
  "settings.screenLightHint": "Yüzünüzü aydınlatan parlak bir pencere. Rengi için üstüne sağ tıklayın.",
  "settings.hideShow": "Gizle ve göster",
  "settings.noShortcut": "Kısayol yok",
  "settings.hideShowHint": "Oyun öndeyken bile çalışır.",
  "settings.shortcutTaken": "Bu kısayolu başka bir uygulama kullanıyor. Başka birini seçin.",

  "keys.intro": "Kamera penceresi öndeyken:",
  "keys.mirror": "Ayna",
  "keys.rotate": "Sağa çevir, sola çevir",
  "keys.background": "Sonraki arka plan",
  "keys.alwaysOnTop": "Her zaman üstte",
  "keys.screenLight": "Ekran ışığı",
  "keys.hide": "Gizle",
  "keys.settings": "Ayarlar",
  "keys.exit": "Çıkış",
  "keys.wheel": "Fare tekerleği",
  "keys.resize": "Boyutlandır",
  "keys.rightClick": "Sağ tık",
  "keys.menu": "Menü",

  "light.6500": "Beyaz (6500K)",
  "light.5600": "Gün ışığı (5600K)",
  "light.4500": "Nötr (4500K)",
  "light.3200": "Sıcak (3200K)",
  "light.red": "Kırmızı",
  "light.pink": "Pembe",
  "light.purple": "Mor",
  "light.blue": "Mavi",
  "light.cyan": "Camgöbeği",
  "light.custom": "Özel...",
  "light.fullscreen": "Tam ekran (F)",
  "light.close": "Kapat (L)",
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, tr };
let locale: Locale = "en";

export function savedLanguage(): Language {
  const saved = localStorage.getItem("language");
  return languages.find((l) => l === saved) ?? "system";
}

export function setLanguage(language: Language): void {
  locale =
    language === "system"
      ? navigator.language.toLowerCase().startsWith("tr")
        ? "tr"
        : "en"
      : language;
  document.documentElement.lang = locale;
}
setLanguage(savedLanguage());

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text = dictionaries[locale][key];
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

const isKey = (key: string): key is MessageKey => key in en;

// A setting's value in words, e.g. option("shape", "Hexagon"); a value with
// no words of its own (such as "720p") shows as it is
export function option(group: string, value: string): string {
  const key = `${group}.${value}`;
  return isKey(key) ? t(key) : value;
}
