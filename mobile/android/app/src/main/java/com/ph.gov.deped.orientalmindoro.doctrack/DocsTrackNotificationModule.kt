package ph.gov.deped.orientalmindoro.doctrack

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class DocsTrackNotificationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val MODULE_NAME = "DocsTrackNotifications"
    private const val CHANNEL_ID = "doctrack_custody_alerts"
    private const val CHANNEL_NAME = "Tracely Custody Alerts"
    private const val GROUP_KEY = "ph.gov.deped.orientalmindoro.doctrack.ALERTS"
    private const val SUMMARY_ID = 9000
    private const val PREFS_NAME = "doctrack_notif_prefs"
    private const val KEY_ACTIVE_IDS = "active_notif_ids"
    private const val KEY_ANNOUNCED_IDS = "announced_notif_ids"
    private const val MAX_ANNOUNCED_HISTORY = 250
    private const val REQUEST_POST_NOTIFICATIONS = 4209
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun requestNotificationPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      promise.resolve(true)
      return
    }
    val granted =
      reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
    if (granted) {
      promise.resolve(true)
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    try {
      activity.requestPermissions(
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        REQUEST_POST_NOTIFICATIONS,
      )
      promise.resolve(true)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @Synchronized
  @ReactMethod
  fun syncDeviceNotifications(
    notifications: ReadableArray,
    unreadCount: Int,
    showLockScreenDetails: Boolean,
    silentBaseline: Boolean,
  ) {
    val manager =
      reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    ensureChannel(manager)

    val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val previousIds = prefs.getStringSet(KEY_ACTIVE_IDS, emptySet())?.toSet() ?: emptySet()
    val announcedIds =
      LinkedHashSet<String>(prefs.getStringSet(KEY_ANNOUNCED_IDS, emptySet()) ?: emptySet())
    val nextIds = LinkedHashSet<String>()

    val safeUnread = if (unreadCount < 0) 0 else unreadCount
    if (safeUnread == 0 || notifications.size() == 0) {
      for (oldId in previousIds) {
        manager.cancel(oldId.hashCode())
      }
      manager.cancel(SUMMARY_ID)
      prefs.edit().putStringSet(KEY_ACTIVE_IDS, emptySet()).apply()
      updateLauncherBadges(0)
      return
    }

    // On initial app render / session hydration, silently baseline pre-existing unread IDs so
    // notifications left unread never buzz or pop up again when reopening the app.
    if (silentBaseline) {
      for (i in 0 until notifications.size()) {
        val map = notifications.getMap(i) ?: continue
        val id = map.getString("id") ?: continue
        nextIds.add(id)
        announcedIds.add(id)
      }
      for (oldId in previousIds) {
        if (!nextIds.contains(oldId)) {
          manager.cancel(oldId.hashCode())
        }
      }
      val boundedAnnounced = boundAnnouncedIds(announcedIds, nextIds)
      prefs
        .edit()
        .putStringSet(KEY_ACTIVE_IDS, nextIds)
        .putStringSet(KEY_ANNOUNCED_IDS, boundedAnnounced)
        .apply()
      updateLauncherBadges(safeUnread)
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted =
        reactContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
          PackageManager.PERMISSION_GRANTED
      if (!granted) {
        updateLauncherBadges(safeUnread)
        return
      }
    }

    val iconRes = reactContext.applicationInfo.icon
    val launchIntent =
      reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        reactContext,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    var newlyPostedCount = 0
    var firstNewTitle: String? = null

    for (i in 0 until notifications.size()) {
      val map = notifications.getMap(i) ?: continue
      val id = map.getString("id") ?: continue
      nextIds.add(id)

      // Never re-alert or re-pop an unread notification that was already surfaced on this device
      if (announcedIds.contains(id)) {
        continue
      }

      val title = map.getString("title")?.takeIf { it.isNotBlank() } ?: "Tracely Alert"
      val content =
        map.getString("content")?.takeIf { it.isNotBlank() }
          ?: map.getString("authenticatedDetail")
          ?: "New custody update awaits review."
      val lockPreview =
        map.getString("lockScreenPreview")?.takeIf { it.isNotBlank() }
          ?: "You have $safeUnread unread custody alert(s)."

      val publicVersion =
        buildBaseNotification(
          iconRes = iconRes,
          title = "Tracely Custody Alert",
          body = lockPreview,
          unreadCount = safeUnread,
          contentIntent = contentIntent,
        )
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .build()

      val builder =
        buildBaseNotification(
          iconRes = iconRes,
          title = title,
          body = content,
          unreadCount = safeUnread,
          contentIntent = contentIntent,
        )
          .setGroup(GROUP_KEY)
          .setAutoCancel(true)
          .setOnlyAlertOnce(true)
          .setVisibility(
            if (showLockScreenDetails) Notification.VISIBILITY_PUBLIC
            else Notification.VISIBILITY_PRIVATE,
          )
          .setPublicVersion(publicVersion)

      manager.notify(id.hashCode(), builder.build())
      announcedIds.add(id)
      newlyPostedCount += 1
      if (firstNewTitle == null) {
        firstNewTitle = title
      }
    }

    // Remove alerts that were marked read or removed
    for (oldId in previousIds) {
      if (!nextIds.contains(oldId)) {
        manager.cancel(oldId.hashCode())
      }
    }

    // Only emit/refresh the summary notification when genuinely new alerts arrive
    if (newlyPostedCount > 0) {
      val summaryBody =
        if (safeUnread == 1) {
          firstNewTitle ?: notifications.getMap(0)?.getString("title") ?: "1 unread custody update"
        } else {
          "$safeUnread unread document custody updates"
        }
      val summary =
        buildBaseNotification(
          iconRes = iconRes,
          title = "Tracely · $safeUnread Unread",
          body = summaryBody,
          unreadCount = safeUnread,
          contentIntent = contentIntent,
        )
          .setGroup(GROUP_KEY)
          .setGroupSummary(true)
          .setAutoCancel(true)
          .setOnlyAlertOnce(true)
          .build()
      manager.notify(SUMMARY_ID, summary)
    }

    val boundedAnnounced = boundAnnouncedIds(announcedIds, nextIds)

    prefs
      .edit()
      .putStringSet(KEY_ACTIVE_IDS, nextIds)
      .putStringSet(KEY_ANNOUNCED_IDS, boundedAnnounced)
      .apply()
    updateLauncherBadges(safeUnread)
  }

  private fun boundAnnouncedIds(
    announcedIds: LinkedHashSet<String>,
    activeIds: Set<String>,
  ): Set<String> {
    if (announcedIds.size <= MAX_ANNOUNCED_HISTORY) {
      return announcedIds
    }
    val kept = LinkedHashSet<String>(activeIds)
    for (entry in announcedIds.toList().takeLast(MAX_ANNOUNCED_HISTORY)) {
      if (kept.size >= MAX_ANNOUNCED_HISTORY) break
      kept.add(entry)
    }
    return kept
  }

  @Synchronized
  @ReactMethod
  fun clearDeviceNotifications() {
    val manager =
      reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val previousIds = prefs.getStringSet(KEY_ACTIVE_IDS, emptySet()) ?: emptySet()
    for (oldId in previousIds) {
      manager.cancel(oldId.hashCode())
    }
    manager.cancel(SUMMARY_ID)
    // Preserve KEY_ANNOUNCED_IDS across restarts and sign-outs so unread alerts never re-notify.
    prefs
      .edit()
      .putStringSet(KEY_ACTIVE_IDS, emptySet())
      .apply()
    updateLauncherBadges(0)
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val existing = manager.getNotificationChannel(CHANNEL_ID)
      if (existing == null) {
        val channel =
          NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Tracely document custody routing alerts and counters"
            setShowBadge(true)
            enableVibration(true)
          }
        manager.createNotificationChannel(channel)
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun buildBaseNotification(
    iconRes: Int,
    title: String,
    body: String,
    unreadCount: Int,
    contentIntent: PendingIntent?,
  ): Notification.Builder {
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(reactContext, CHANNEL_ID)
          .setBadgeIconType(Notification.BADGE_ICON_SMALL)
      } else {
        Notification.Builder(reactContext)
      }

    builder
      .setSmallIcon(iconRes)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setNumber(unreadCount)

    if (contentIntent != null) {
      builder.setContentIntent(contentIntent)
    }

    return builder
  }

  private fun updateLauncherBadges(count: Int) {
    val safeCount = if (count < 0) 0 else count
    val pkgName = reactContext.packageName
    val launchComponent =
      reactContext.packageManager.getLaunchIntentForPackage(pkgName)?.component?.className
        ?: "$pkgName.MainActivity"

    val broadcasts =
      listOf(
        Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
          putExtra("badge_count", safeCount)
          putExtra("badge_count_package_name", pkgName)
          putExtra("badge_count_class_name", launchComponent)
        },
        Intent("com.transsion.hilauncher.ACTION_UNREAD_CHANGED").apply {
          putExtra("packageName", pkgName)
          putExtra("className", launchComponent)
          putExtra("count", safeCount)
        },
        Intent("com.huawei.android.launcher.action.CHANGE_BADGE").apply {
          putExtra("package", pkgName)
          putExtra("class", launchComponent)
          putExtra("badgenumber", safeCount)
        },
      )

    for (intent in broadcasts) {
      try {
        reactContext.sendBroadcast(intent)
      } catch (_: Throwable) {
        // Ignore launchers that restrict implicit badge broadcasts
      }
    }
  }
}
