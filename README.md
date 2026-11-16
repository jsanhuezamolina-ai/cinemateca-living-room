# Cinemateca Living Room

Visor de fotos, videos y audios de un USB conectado a un televisor Android TV. Se controla con el mando (D-pad) y se ejecuta como app dentro de un contenedor WebView nativo.

## Funciones

- **Carpeta USB:** lee los discos montados en `/storage` y muestra su contenido. Los archivos no salen del TV.
- **Video:** lista y reproductor con retroceder, adelantar, video anterior y video siguiente.
- **Fotos:** presentación con temporizador y elección de transición.
- **Audio:** reproductor persistente en la parte inferior de la pantalla.
- **Foto + Audio:** presentación de fotos con música de fondo.
- **Navegación por D-pad:** movimiento espacial entre elementos. El buscador entra en modo escritura solo al pulsar Enter. Atrás cierra el nivel actual.

## Estructura

```
src/
  App.tsx                 Navegación global y estado
  components/             Menú superior, grupos, listas y reproductores
  utils/usbMedia.ts       Lectura de archivos del USB
  utils/audioEngine.ts    Motor de audio
  data/usbSamples.ts      Vacío: la biblioteca empieza sin archivos
android/
  app/src/main/java/com/jonathan/cinemateca/MainActivity.kt   WebView, permisos y puente con el USB
  build-apk.sh            Compila la web y genera el APK
```

## Requisitos

- Node.js 22 o superior
- Android SDK con `ANDROID_HOME` configurado, y Java 17 o superior, para generar el APK
- Android TV con Android 9 (API 28) o superior

## Ejecutar en el navegador

```bash
npm install
npm run dev
```

La app queda en `http://localhost:3000`. En el navegador no hay acceso al USB: la lectura de archivos funciona solo dentro de la app Android.

## Compilar el APK

```bash
npm install
./android/build-apk.sh
```

El script compila la web (`dist/`), copia el resultado a los assets de Android y genera `android/app/build/outputs/apk/debug/app-debug.apk`.

Instalación en el TV por red, con depuración ADB activada:

```bash
adb connect <IP-del-TV>:5555
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Permisos en Android

- Android 9 (API 28): `READ_EXTERNAL_STORAGE`, se pide al abrir la carpeta USB.
- Android 11 o superior: «Acceso a todos los archivos» (`MANAGE_EXTERNAL_STORAGE`).

## Notas técnicas

- `vite.config.ts` usa `base: "./"` para que los recursos carguen dentro del WebView.
- `index.html` fija el viewport en 1920 px con zoom 0,5, porque el WebView del TV escala 2 px por píxel CSS.
