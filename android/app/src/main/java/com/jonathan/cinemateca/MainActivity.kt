package com.jonathan.cinemateca

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

private const val HOST = "appassets.androidplatform.net"
private const val USB_PREFIX = "/usb/"

// Extensiones que el frontend acepta (utils/usbMedia.ts).
private val MEDIA_EXTS = setOf(
    "mp4", "mkv", "webm", "mov", "avi", "m4v",
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif",
    "mp3", "flac", "wav", "m4a", "aac", "ogg", "opus",
)

// Requisitos mínimos del dispositivo (coinciden con minSdk del build.gradle).
private const val MIN_SDK = 28   // Android 9
private const val MIN_WEBVIEW = 80 // Chromium 80 o superior

// Volúmenes que no son el USB.
private val SKIP_VOLUMES = setOf("emulated", "self")

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    // Archivos del USB. El índice es la parte final de la URL /usb/<n>.
    private data class UsbEntry(val file: File, val mime: String)
    private val usbEntries = mutableListOf<UsbEntry>()

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            addJavascriptInterface(UsbBridge(), "AndroidUsb")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    val uri = request.url
                    if (uri.host == HOST && uri.path?.startsWith(USB_PREFIX) == true) {
                        val index = uri.path!!.removePrefix(USB_PREFIX).toIntOrNull() ?: return notFound()
                        return serveUsb(index, request.requestHeaders["Range"])
                    }
                    return assetLoader.shouldInterceptRequest(uri)
                }
            }
        }
        // Solo en builds depurables (APK de prueba): permite inspeccionar la web desde Chrome con adb.
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        setContentView(webView)
        setupBack()
        checkCompatibility()
        webView.loadUrl("https://$HOST/assets/index.html")
    }

    // Revisa lo que la app necesita del dispositivo y avisa en pantalla si algo falta.
    private fun checkCompatibility() {
        val problems = mutableListOf<String>()
        if (Build.VERSION.SDK_INT < MIN_SDK) {
            problems += "Requiere Android 9 o superior (este equipo tiene ${Build.VERSION.RELEASE})."
        }
        val pkg = try {
            WebView.getCurrentWebViewPackage()
        } catch (e: Exception) {
            null
        }
        if (pkg == null) {
            problems += "No hay WebView disponible. Actualiza «Android System WebView» desde la tienda."
        } else {
            val major = pkg.versionName?.substringBefore('.')?.toIntOrNull() ?: 0
            if (major in 1 until MIN_WEBVIEW) {
                problems += "El WebView del equipo (${pkg.versionName}) es antiguo. Actualiza «Android System WebView»."
            }
        }
        if (problems.isNotEmpty()) {
            android.widget.Toast.makeText(this, problems.joinToString("\n"), android.widget.Toast.LENGTH_LONG).show()
        }
        if (!packageManager.hasSystemFeature("android.software.leanback")) {
            // No es un error: la app también funciona en tablet/teléfono, pero está pensada para el control del TV.
            android.util.Log.i("Cinemateca", "Dispositivo sin Leanback: la navegación por control remoto puede ser limitada.")
        }
    }

    private fun setupBack() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // La web decide: cerrar reproductor/presentación o volver a Grupos. Si no hay nada, sale de la app.
                webView.evaluateJavascript("(window.androidBack && window.androidBack()) ? 'true' : 'false'") { result ->
                    if (result != "\"true\"" && result != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })
    }

    inner class UsbBridge {
        @JavascriptInterface
        fun pickFolder() {
            runOnUiThread { loadUsb() }
        }

        @JavascriptInterface
        fun scanSource(path: String) {
            runOnUiThread { scanFolder(path) }
        }
    }

    // Android 11+: "Acceso a todos los archivos". Android 9/10 (este TV): permiso de lectura en diálogo.
    private val readPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) loadUsb()
        else sendToWeb(JSONObject().put("root", "").put("files", JSONArray())
            .put("error", "Sin permiso de archivos: acéptalo y vuelve a pulsar Carpeta USB"))
    }

    private fun hasStorageAccess(): Boolean =
        if (Build.VERSION.SDK_INT >= 30) Environment.isExternalStorageManager()
        else checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

    private fun loadUsb() {
        if (!hasStorageAccess()) {
            if (Build.VERSION.SDK_INT >= 30) {
                openAllFilesSettings()
                sendToWeb(JSONObject().put("root", "").put("files", JSONArray())
                    .put("error", "Activa «Acceso a todos los archivos» y vuelve a pulsar Carpeta USB"))
            } else {
                readPermission.launch(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
            return
        }
        Thread {
            // Orígenes disponibles: cada USB y el almacenamiento interno (y su carpeta "TV" si existe).
            val sources = JSONArray()
            File("/storage").listFiles()
                ?.filter { it.isDirectory && it.name !in SKIP_VOLUMES && it.canRead() }
                ?.forEach { vol ->
                    sources.put(sourceJson(vol, "USB ${vol.name}"))
                }
            File("/storage/emulated/0").takeIf { it.canRead() }?.let { internal ->
                sources.put(sourceJson(internal, "Almacenamiento interno"))
                File(internal, "TV").takeIf { it.isDirectory && it.canRead() }?.let { tv ->
                    sources.put(sourceJson(tv, "Almacenamiento interno / TV"))
                }
            }
            runOnUiThread {
                webView.evaluateJavascript("window.onUsbSources && window.onUsbSources(${sources})", null)
            }
        }.start()
    }

    private fun sourceJson(dir: File, label: String): JSONObject =
        JSONObject()
            .put("path", dir.absolutePath)
            .put("label", label)
            .put("media", countMedia(dir, 0))

    // Escanea el origen elegido por el usuario. Solo acepta carpetas dentro de /storage.
    private fun scanFolder(path: String) {
        val dir = File(path).canonicalFile
        if (!dir.isDirectory || !dir.absolutePath.startsWith("/storage/")) {
            sendToWeb(JSONObject().put("root", "").put("files", JSONArray()).put("error", "Origen no válido"))
            return
        }
        Thread {
            usbEntries.clear()
            val files = JSONArray()
            walk(dir, "", files, 0)
            val name = when (dir.absolutePath) {
                "/storage/emulated/0" -> "Almacenamiento interno"
                "/storage/emulated/0/TV" -> "TV"
                else -> dir.name
            }
            val label = if (files.length() == 0) "$name: sin archivos multimedia" else name
            sendToWeb(JSONObject().put("root", label).put("files", files))
        }.start()
    }

    private fun countMedia(dir: File, depth: Int): Int {
        if (depth > 6) return 0
        var n = 0
        dir.listFiles()?.forEach { f ->
            if (f.isDirectory) n += countMedia(f, depth + 1)
            else if (f.extension.lowercase() in MEDIA_EXTS) n++
        }
        return n
    }

    private fun walk(dir: File, folder: String, out: JSONArray, depth: Int) {
        if (depth > 8) return
        dir.listFiles()?.sortedBy { it.name.lowercase() }?.forEach { f ->
            if (f.isDirectory) {
                walk(f, if (folder.isEmpty()) f.name else "$folder/${f.name}", out, depth + 1)
                return@forEach
            }
            val ext = f.extension.lowercase()
            if (ext !in MEDIA_EXTS) return@forEach
            val mime = mimeFromExt(ext)
            val idx = usbEntries.size
            usbEntries.add(UsbEntry(f, mime))
            out.put(
                JSONObject()
                    .put("name", f.name)
                    .put("folder", folder)
                    .put("mime", mime)
                    .put("size", f.length())
                    .put("url", "https://$HOST$USB_PREFIX$idx")
            )
        }
    }

    private fun sendToWeb(payload: JSONObject) {
        runOnUiThread {
            webView.evaluateJavascript("window.onUsbFiles && window.onUsbFiles($payload)", null)
        }
    }

    private fun openAllFilesSettings() {
        val intents = listOf(
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName")),
            Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")),
        )
        for (i in intents) {
            if (i.resolveActivity(packageManager) != null) {
                startActivity(i)
                return
            }
        }
    }

    private fun mimeFromExt(ext: String): String = when (ext) {
        "mp4", "m4v" -> "video/mp4"
        "webm" -> "video/webm"
        "mkv" -> "video/x-matroska"
        "mov" -> "video/quicktime"
        "avi" -> "video/x-msvideo"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "bmp" -> "image/bmp"
        "avif" -> "image/avif"
        "mp3" -> "audio/mpeg"
        "flac" -> "audio/flac"
        "wav" -> "audio/wav"
        "m4a", "aac" -> "audio/mp4"
        "ogg", "opus" -> "audio/ogg"
        else -> "application/octet-stream"
    }

    // Sirve el archivo del USB con soporte de Range: sin esto el video no permite avanzar.
    private fun serveUsb(index: Int, rangeHeader: String?): WebResourceResponse {
        val entry = usbEntries.getOrNull(index) ?: return notFound()
        val total = entry.file.length()
        var start = 0L
        var end = total - 1
        var status = 200
        val headers = mutableMapOf("Accept-Ranges" to "bytes")

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            val parts = rangeHeader.removePrefix("bytes=").split("-")
            start = parts[0].toLongOrNull() ?: 0L
            end = parts.getOrNull(1)?.takeIf { it.isNotEmpty() }?.toLongOrNull() ?: (total - 1)
            end = minOf(end, total - 1)
            if (start > end) {
                return WebResourceResponse(entry.mime, null, 416, "Range Not Satisfiable", mapOf("Content-Range" to "bytes */$total"), null)
            }
            status = 206
            headers["Content-Range"] = "bytes $start-$end/$total"
        }
        val input = FileInputStream(entry.file)
        skipFully(input, start)
        headers["Content-Length"] = (end - start + 1).toString()
        return WebResourceResponse(
            entry.mime, null, status,
            if (status == 206) "Partial Content" else "OK",
            headers,
            LimitedStream(input, end - start + 1),
        )
    }

    private fun skipFully(input: InputStream, bytes: Long) {
        var left = bytes
        while (left > 0) {
            val skipped = input.skip(left)
            if (skipped <= 0) {
                if (input.read() == -1) break
                left--
            } else {
                left -= skipped
            }
        }
    }

    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), null)
}

// Limita la lectura a una cantidad de bytes (para respuestas 206).
private class LimitedStream(private val src: InputStream, private var remaining: Long) : InputStream() {
    override fun read(): Int {
        if (remaining <= 0) return -1
        val b = src.read()
        if (b != -1) remaining--
        return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (remaining <= 0) return -1
        val n = src.read(b, off, minOf(len.toLong(), remaining).toInt())
        if (n > 0) remaining -= n
        return n
    }

    override fun close() = src.close()
}
