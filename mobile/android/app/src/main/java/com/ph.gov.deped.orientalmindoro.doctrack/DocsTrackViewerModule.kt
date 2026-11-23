package ph.gov.deped.orientalmindoro.doctrack

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class DocsTrackViewerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val MODULE_NAME = "DocsTrackViewer"
    private const val VIEWER_DIR_NAME = "viewer"
    private const val MAX_RENDER_PAGES = 25
    private const val TARGET_RENDER_WIDTH_PX = 1440
    private val ioExecutor = Executors.newSingleThreadExecutor()
  }

  private var activePrintWebView: WebView? = null

  override fun getName(): String = MODULE_NAME

  private fun viewerCacheDir(): File {
    val dir = File(reactContext.cacheDir, VIEWER_DIR_NAME)
    if (!dir.exists()) {
      dir.mkdirs()
    }
    return dir
  }

  private fun sanitizeFileName(raw: String?, fallback: String): String {
    val cleaned = (raw ?: "")
      .replace(Regex("[\\\\/:*?\"<>|\\x00-\\x1F\\x7F]+"), "_")
      .trim('.', ' ')
    return if (cleaned.isNotEmpty()) cleaned.take(120) else fallback
  }

  private fun downloadToViewerCache(signedUrl: String, fileName: String): File {
    val dir = viewerCacheDir()
    val safeName = sanitizeFileName(fileName, "document.bin")
    val targetFile = File(dir, "${System.currentTimeMillis()}_$safeName")

    val connection = (URL(signedUrl).openConnection() as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 15000
      readTimeout = 20000
      instanceFollowRedirects = true
      setRequestProperty("Cache-Control", "no-store")
    }

    try {
      val code = connection.responseCode
      if (code !in 200..299) {
        throw IllegalStateException("Server returned HTTP $code while loading file.")
      }
      connection.inputStream.use { input ->
        FileOutputStream(targetFile).use { output ->
          input.copyTo(output)
        }
      }
    } catch (err: Throwable) {
      targetFile.delete()
      throw err
    } finally {
      connection.disconnect()
    }

    return targetFile
  }

  @ReactMethod
  fun renderPdfPages(signedUrl: String, fileName: String, promise: Promise) {
    ioExecutor.execute {
      var pdfFile: File? = null
      var pfd: ParcelFileDescriptor? = null
      var renderer: PdfRenderer? = null
      try {
        pdfFile = downloadToViewerCache(signedUrl, fileName)
        val pagesDir = File(viewerCacheDir(), "pages_${System.currentTimeMillis()}")
        pagesDir.mkdirs()

        pfd = ParcelFileDescriptor.open(pdfFile, ParcelFileDescriptor.MODE_READ_ONLY)
        renderer = PdfRenderer(pfd)
        val totalPages = renderer.pageCount
        val renderCount = minOf(totalPages, MAX_RENDER_PAGES)
        val pageUris = Arguments.createArray()

        for (index in 0 until renderCount) {
          val page = renderer.openPage(index)
          try {
            val scale = if (page.width > 0) {
              (TARGET_RENDER_WIDTH_PX.toFloat() / page.width.toFloat()).coerceIn(1.0f, 3.0f)
            } else {
              2.0f
            }
            val bitmapWidth = (page.width * scale).toInt().coerceAtLeast(1)
            val bitmapHeight = (page.height * scale).toInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888)
            try {
              val canvas = Canvas(bitmap)
              canvas.drawColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

              val outFile = File(pagesDir, "page_$index.png")
              FileOutputStream(outFile).use { fos ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 92, fos)
              }
              pageUris.pushString(Uri.fromFile(outFile).toString())
            } finally {
              bitmap.recycle()
            }
          } finally {
            page.close()
          }
        }

        val payload = Arguments.createMap().apply {
          putInt("pageCount", totalPages)
          putInt("renderedCount", renderCount)
          putString("localPath", pdfFile.absolutePath)
          putArray("pageUris", pageUris)
        }
        promise.resolve(payload)
      } catch (err: Throwable) {
        promise.reject("PDF_RENDER_FAILED", err.message ?: "Unable to render PDF preview.", err)
      } finally {
        try {
          renderer?.close()
        } catch (_: Throwable) {
        }
        try {
          pfd?.close()
        } catch (_: Throwable) {
        }
      }
    }
  }

  @ReactMethod
  fun openExternalViewer(signedUrl: String, fileName: String, mimeType: String, promise: Promise) {
    ioExecutor.execute {
      try {
        val localFile = downloadToViewerCache(signedUrl, fileName)
        val authority = "${reactContext.packageName}.fileprovider"
        val contentUri = FileProvider.getUriForFile(reactContext, authority, localFile)
        val resolvedMime = if (mimeType.isNotBlank()) mimeType else "*/*"

        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(contentUri, resolvedMime)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val chooser = Intent.createChooser(viewIntent, "Open $fileName").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        UiThreadUtil.runOnUiThread {
          try {
            reactContext.startActivity(chooser)
            promise.resolve(true)
          } catch (_: Throwable) {
            try {
              val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(signedUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              }
              reactContext.startActivity(browserIntent)
              promise.resolve(true)
            } catch (fallbackErr: Throwable) {
              promise.reject(
                "NO_EXTERNAL_VIEWER",
                fallbackErr.message ?: "No application available to open this file.",
                fallbackErr,
              )
            }
          }
        }
      } catch (err: Throwable) {
        promise.reject("OPEN_EXTERNAL_FAILED", err.message ?: "Unable to download file for viewing.", err)
      }
    }
  }

  @ReactMethod
  fun clearViewerCache(promise: Promise) {
    ioExecutor.execute {
      try {
        val dir = File(reactContext.cacheDir, VIEWER_DIR_NAME)
        if (dir.exists()) {
          dir.deleteRecursively()
        }
        promise.resolve(true)
      } catch (_: Throwable) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun printRoutingSlipHtml(html: String, jobName: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = reactContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "Active screen is required to print the routing slip.")
        return@runOnUiThread
      }

      try {
        val webView = WebView(activity)
        webView.settings.javaScriptEnabled = false
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        activePrintWebView = webView

        webView.webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(
            view: WebView?,
            request: WebResourceRequest?,
          ): Boolean = true

          override fun onPageFinished(view: WebView, url: String?) {
            try {
              val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
              if (printManager == null) {
                promise.reject("PRINT_UNAVAILABLE", "Android print service is unavailable on this device.")
                activePrintWebView = null
                return
              }
              val safeJob = jobName.ifBlank { "DocsTracker Routing Slip" }
              val adapter = view.createPrintDocumentAdapter(safeJob)
              val attributes = PrintAttributes.Builder()
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build()
              printManager.print(safeJob, adapter, attributes)
              promise.resolve(true)
            } catch (err: Throwable) {
              promise.reject("PRINT_FAILED", err.message ?: "Unable to start routing slip print job.", err)
            } finally {
              activePrintWebView = null
            }
          }
        }

        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
      } catch (err: Throwable) {
        activePrintWebView = null
        promise.reject("PRINT_INIT_FAILED", err.message ?: "Unable to prepare routing slip print view.", err)
      }
    }
  }
}
