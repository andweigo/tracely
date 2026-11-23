package ph.gov.deped.orientalmindoro.doctrack

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.view.WindowManager
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class DocsTrackSecurityModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val MODULE_NAME = "DocsTrackSecurity"
    private const val REQUEST_CONFIRM_CREDENTIAL = 4108
  }

  private var pendingAuthPromise: Promise? = null

  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      if (requestCode != REQUEST_CONFIRM_CREDENTIAL) return
      val promise = pendingAuthPromise ?: return
      pendingAuthPromise = null
      if (resultCode == Activity.RESULT_OK) {
        promise.resolve("authenticated")
      } else {
        promise.resolve("cancelled")
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun setScreenshotShield(enabled: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactContext.currentActivity?.window ?: return@runOnUiThread
      if (enabled) {
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  @ReactMethod
  @Suppress("DEPRECATION")
  fun authenticateDevice(title: String, subtitle: String, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve("in_app_required")
      return
    }
    val keyguard = reactContext.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (keyguard == null || !keyguard.isDeviceSecure) {
      promise.resolve("in_app_required")
      return
    }
    val intent = keyguard.createConfirmDeviceCredentialIntent(title, subtitle)
    if (intent == null) {
      promise.resolve("in_app_required")
      return
    }
    pendingAuthPromise?.resolve("cancelled")
    pendingAuthPromise = promise
    activity.startActivityForResult(intent, REQUEST_CONFIRM_CREDENTIAL)
  }
}
