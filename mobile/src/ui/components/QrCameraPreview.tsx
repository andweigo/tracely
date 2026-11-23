import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { SDO_COLORS } from '../theme/tokens';

interface QrCameraPreviewProps {
  active: boolean;
  sessionKey: number;
  resolving: boolean;
  barcodePaused: boolean;
  torchMode: 'on' | 'off';
  onReadCode: (code: string) => void;
  onCameraError: (message?: string) => void;
}

/**
 * Unmounts the native CameraX viewfinder cleanly whenever paused so hardware access stops
 * immediately, while providing a visual resolving spinner during token verification.
 */
export const QrCameraPreview: React.FC<QrCameraPreviewProps> = ({
  active,
  sessionKey,
  resolving,
  barcodePaused,
  torchMode,
  onReadCode,
  onCameraError,
}) => {
  if (active) {
    return (
      <Camera
        key={`qr-camera-${sessionKey}`}
        testID="qr-camera-preview"
        style={StyleSheet.absoluteFill}
        cameraType={CameraType.Back}
        scanBarcode={!resolving && !barcodePaused}
        showFrame={false}
        torchMode={torchMode}
        allowedBarcodeTypes={['qr']}
        scanThrottleDelay={2000}
        onReadCode={(event) => {
          const code = event?.nativeEvent?.codeStringValue;
          if (code) {
            onReadCode(code);
          }
        }}
        onError={(event) => {
          onCameraError(event?.nativeEvent?.errorMessage);
        }}
      />
    );
  }

  if (resolving) {
    return (
      <View style={styles.resolvingWrap}>
        <ActivityIndicator color={SDO_COLORS.amber} />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  resolvingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
});
