package ph.gov.deped.orientalmindoro.doctrack

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class DocsTrackSecurityPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    when (name) {
      DocsTrackSecurityModule.MODULE_NAME -> DocsTrackSecurityModule(reactContext)
      DocsTrackNotificationModule.MODULE_NAME -> DocsTrackNotificationModule(reactContext)
      DocsTrackViewerModule.MODULE_NAME -> DocsTrackViewerModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        DocsTrackSecurityModule.MODULE_NAME to ReactModuleInfo(
          name = DocsTrackSecurityModule.MODULE_NAME,
          className = DocsTrackSecurityModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
        DocsTrackNotificationModule.MODULE_NAME to ReactModuleInfo(
          name = DocsTrackNotificationModule.MODULE_NAME,
          className = DocsTrackNotificationModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
        DocsTrackViewerModule.MODULE_NAME to ReactModuleInfo(
          name = DocsTrackViewerModule.MODULE_NAME,
          className = DocsTrackViewerModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = false,
        ),
      )
    }
}
