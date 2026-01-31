# FocusMate AI - Native Mobile App

Local LLM-powered task breakdown timer for Android and iOS.

## Native App vs Web PWA

This is the **native app version** using Capacitor:

### ✅ Advantages of Native App:
- **Full device access** - Better WebGPU/MLC support
- **No browser restrictions** - Cache API works freely
- **App store distribution** - Can publish to Google Play/App Store
- **Better performance** - Native rendering, no browser overhead

### ❌ Web PWA Limitations:
- Browser Cache API restrictions (blocks web-llm)
- WebGPU support varies by browser
- HTTPS/security limitations on cloud platforms

## Development

### Install Dependencies
```bash
npm install
```

### Build Web Assets
```bash
npm run build
```

### Sync to Native Platforms
```bash
npm run cap:sync
```

### Open in Android Studio
```bash
npm run cap:android
```

### Open in Xcode
```bash
npm run cap:ios
```

## Native App Requirements

### Android:
- Android Studio
- Android SDK API 33+ (Android 13)
- Gradle 8.x

### iOS:
- Xcode 15+
- iOS 17+
- Mac computer

## Building APK (Android)

1. Build web assets: `npm run build`
2. Sync to native: `npm run cap:sync`
3. Open Android Studio: `npm run cap:android`
4. In Android Studio: Build > Build APK
5. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## Building IPA (iOS)

1. Build web assets: `npm run build`
2. Sync to native: `npm run cap:sync`
3. Open Xcode: `npm run cap:ios`
4. In Xcode: Product > Archive
5. Sign and distribute (TestFlight/App Store)

## Web-LLM Support

Native apps have full access to:
- Device GPU acceleration
- CacheStorage API
- Local file system
- Better WebGPU support

This should fix the "cache is not defined" errors seen in browser-based deployments.