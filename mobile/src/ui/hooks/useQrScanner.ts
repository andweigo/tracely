import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { Document } from '../../domain/entities/Document';
import { QrResolutionResult } from '../../domain/security/QrPayload';
import { useAppServices } from '../../state/AppServiceContext';

export type CameraPermissionState = 'checking' | 'granted' | 'denied' | 'blocked';

export interface PairCaptureTarget {
  readonly pairToken: string;
  readonly label: string;
}

export interface BatchScannedItem {
  readonly key: string;
  readonly result: QrResolutionResult;
  readonly verificationCode: string;
}

function getBatchResultKey(resolved: QrResolutionResult): string {
  switch (resolved.kind) {
    case 'document_authorized':
      return `doc:${resolved.document.id}`;
    case 'document_denied':
      return `denied:${resolved.trackingCode}`;
    case 'desktop_pair_ready':
      return `pair:${resolved.pairing.pairToken}`;
    case 'transmittal_verified':
      return `verify:${resolved.trackingCode}`;
  }
}

export interface UseQrScannerOptions {
  /** Auto-start the camera when permission is granted on mount (false by default). */
  autoStartWhenPermitted?: boolean;
  /** Optional persisted paused flag synced across tab transitions. */
  initialPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Called immediately when a Tracely Web Unlock QR / 6-char code unlocks a Soft Copy. */
  onAutoOpenDocument?: (documentId: string) => void;
}

/**
 * Shared QR scanning controller coordinating Android camera permission, hardware torch timing,
 * explicit pause/resume state, and opaque token resolution for both Dashboard and ScannerScreen.
 */
export function useQrScanner({
  autoStartWhenPermitted = false,
  initialPaused = false,
  onPausedChange,
  onAutoOpenDocument,
}: UseQrScannerOptions = {}) {
  const { scanQr, batchAcknowledgeReceipts, scannerTorchOn, setScannerTorchOn, notify } =
    useAppServices();

  const shouldAutoStartOnMount = autoStartWhenPermitted && !initialPaused;

  const resolveLockRef = useRef(false);
  const cameraMountedAtRef = useRef(0);
  const userToggledRef = useRef(false);
  const autoStartRef = useRef(shouldAutoStartOnMount);
  const lastBatchScanRef = useRef<{ code: string; at: number } | null>(null);
  const onPausedChangeRef = useRef(onPausedChange);
  onPausedChangeRef.current = onPausedChange;
  const onAutoOpenDocumentRef = useRef(onAutoOpenDocument);
  onAutoOpenDocumentRef.current = onAutoOpenDocument;

  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>(
    Platform.OS === 'android' ? 'checking' : 'granted',
  );
  const [cameraActive, setCameraActive] = useState<boolean>(
    Platform.OS !== 'android' ? shouldAutoStartOnMount : false,
  );
  const [isPaused, setIsPaused] = useState<boolean>(initialPaused);
  const [cameraSessionKey, setCameraSessionKey] = useState<number>(1);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<QrResolutionResult | null>(null);
  const [scannedVerificationCode, setScannedVerificationCode] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const batchModeRef = useRef(false);
  batchModeRef.current = batchMode;
  const [batchItems, setBatchItems] = useState<ReadonlyArray<BatchScannedItem>>([]);
  const [appliedTorchMode, setAppliedTorchMode] = useState<'on' | 'off'>('off');
  const [pairCaptureTarget, setPairCaptureTarget] = useState<PairCaptureTarget | null>(null);

  const startCamera = useCallback(() => {
    userToggledRef.current = true;
    setResult(null);
    setIsPaused(false);
    onPausedChangeRef.current?.(false);
    setCameraSessionKey((k) => k + 1);
    setCameraActive(true);
  }, []);

  const pauseCamera = useCallback(() => {
    userToggledRef.current = true;
    setCameraActive(false);
    setIsPaused(true);
    onPausedChangeRef.current?.(true);
    setScannerTorchOn(false);
    setAppliedTorchMode('off');
  }, [setScannerTorchOn]);

  useEffect(() => {
    let mounted = true;
    const verifyPermission = async () => {
      if (Platform.OS !== 'android') {
        if (!mounted) return;
        setCameraPermission('granted');
        if (autoStartRef.current && !userToggledRef.current) {
          setCameraActive(true);
        }
        return;
      }
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (!mounted) return;
        if (granted) {
          setCameraPermission('granted');
          if (autoStartRef.current && !userToggledRef.current) {
            setCameraSessionKey((k) => k + 1);
            setCameraActive(true);
          }
        } else {
          setCameraPermission('denied');
          setCameraActive(false);
        }
      } catch {
        if (!mounted) return;
        setCameraPermission('denied');
        setCameraActive(false);
      }
    };
    verifyPermission();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      setScannerTorchOn(false);
    };
  }, [setScannerTorchOn]);

  // Apply CameraX torch after bindCameraUseCases() finishes on mount
  useEffect(() => {
    if (!(cameraActive && cameraPermission === 'granted')) {
      cameraMountedAtRef.current = 0;
      setAppliedTorchMode('off');
      return;
    }

    if (cameraMountedAtRef.current === 0) {
      cameraMountedAtRef.current = Date.now();
    }

    if (!scannerTorchOn) {
      setAppliedTorchMode('off');
      return;
    }

    const elapsed = Date.now() - cameraMountedAtRef.current;
    const waitMs = Math.max(0, 350 - elapsed);
    if (waitMs === 0) {
      setAppliedTorchMode('on');
      return;
    }

    const timerId = setTimeout(() => {
      setAppliedTorchMode('on');
    }, waitMs);

    return () => clearTimeout(timerId);
  }, [cameraActive, cameraPermission, scannerTorchOn]);

  const requestCameraPermission = useCallback(
    async (enableTorchAfter = false) => {
      if (Platform.OS !== 'android') {
        setCameraPermission('granted');
        startCamera();
        return;
      }
      try {
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (alreadyGranted) {
          setCameraPermission('granted');
          startCamera();
          return;
        }

        const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Tracely Camera Access',
          message:
            'Allow camera access to scan Tracely document QR codes and desktop pairing tokens.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        });

        if (status === PermissionsAndroid.RESULTS.GRANTED) {
          setCameraPermission('granted');
          startCamera();
        } else if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setCameraPermission('blocked');
          setCameraActive(false);
          if (enableTorchAfter) setScannerTorchOn(false);
        } else {
          setCameraPermission('denied');
          setCameraActive(false);
          if (enableTorchAfter) setScannerTorchOn(false);
        }
      } catch {
        setCameraPermission('denied');
        setCameraActive(false);
        if (enableTorchAfter) setScannerTorchOn(false);
      }
    },
    [setScannerTorchOn, startCamera],
  );

  const handlePrimaryCameraPress = useCallback(() => {
    if (cameraPermission === 'blocked') {
      Linking.openSettings().catch(() => {});
      return;
    }
    if (cameraPermission !== 'granted') {
      requestCameraPermission(false);
      return;
    }
    if (cameraActive) {
      pauseCamera();
    } else {
      startCamera();
    }
  }, [cameraActive, cameraPermission, pauseCamera, requestCameraPermission, startCamera]);

  const handleToggleTorch = useCallback(() => {
    const next = !scannerTorchOn;
    setScannerTorchOn(next);
    if (!next) return;

    if (cameraPermission === 'blocked') {
      setScannerTorchOn(false);
      Linking.openSettings().catch(() => {});
      return;
    }
    if (cameraPermission !== 'granted') {
      requestCameraPermission(true);
      return;
    }
    if (!cameraActive) {
      startCamera();
    }
  }, [cameraActive, cameraPermission, requestCameraPermission, scannerTorchOn, setScannerTorchOn, startCamera]);

  const handleResolve = useCallback(
    async (rawValue: string, rethrow = false) => {
      const trimmed = rawValue.trim();
      if (!trimmed || resolveLockRef.current) return;

      const isBatch = batchModeRef.current;
      if (isBatch && lastBatchScanRef.current) {
        const sameCode = lastBatchScanRef.current.code === trimmed;
        const withinCooldown = Date.now() - lastBatchScanRef.current.at < 2500;
        if (sameCode && withinCooldown) return;
      }

      resolveLockRef.current = true;
      if (!isBatch) {
        setCameraActive(false);
        setScannerTorchOn(false);
        setAppliedTorchMode('off');
      } else {
        lastBatchScanRef.current = { code: trimmed, at: Date.now() };
      }
      setResolving(true);
      try {
        const resolved = await scanQr(trimmed);
        const verifiedCode =
          resolved.kind === 'document_authorized'
            ? (resolved.verificationCode ?? trimmed)
            : trimmed;
        setIsPaused(false);
        onPausedChangeRef.current?.(false);
        if (isBatch) {
          const key = getBatchResultKey(resolved);
          setBatchItems((prev) => {
            if (prev.some((item) => item.key === key)) return prev;
            return [{ key, result: resolved, verificationCode: verifiedCode }, ...prev];
          });
        } else if (
          resolved.kind === 'document_authorized' &&
          resolved.unlockedViaSync &&
          onAutoOpenDocumentRef.current
        ) {
          setResult(null);
          setScannedVerificationCode(null);
          onAutoOpenDocumentRef.current(resolved.document.id);
        } else {
          setResult(resolved);
          setScannedVerificationCode(verifiedCode);
          if (resolved.kind === 'desktop_pair_ready') {
            setPairCaptureTarget({
              pairToken: resolved.pairing.pairToken,
              label: resolved.pairing.draftLabel,
            });
          }
        }
      } catch (err) {
        if (!isBatch) {
          setResult(null);
          setScannedVerificationCode(null);
          setIsPaused(true);
          onPausedChangeRef.current?.(true);
        }
        if (rethrow) {
          throw err;
        }
      } finally {
        setResolving(false);
        resolveLockRef.current = false;
      }
    },
    [scanQr, setScannerTorchOn],
  );

  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => {
      const next = !prev;
      if (next) setResult(null);
      return next;
    });
  }, []);

  const removeBatchItem = useCallback((key: string) => {
    setBatchItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clearBatchItems = useCallback(() => {
    setBatchItems([]);
  }, []);

  const confirmBatchReceipts = useCallback(async () => {
    const pendingEntries: Array<{ readonly document: Document; readonly verificationCode: string }> = [];
    for (const item of batchItems) {
      if (
        item.result.kind === 'document_authorized' &&
        item.result.pendingForActorOffice &&
        !item.result.sentByActor
      ) {
        pendingEntries.push({
          document: item.result.document,
          verificationCode: item.verificationCode,
        });
      }
    }
    if (pendingEntries.length === 0) return;
    await batchAcknowledgeReceipts(pendingEntries);
    const confirmedIds = new Set(pendingEntries.map((entry) => `doc:${entry.document.id}`));
    setBatchItems((prev) => prev.filter((item) => !confirmedIds.has(item.key)));
  }, [batchAcknowledgeReceipts, batchItems]);

  const handleResetScan = useCallback(() => {
    if (cameraPermission === 'granted') {
      startCamera();
    } else {
      requestCameraPermission(false);
    }
  }, [cameraPermission, requestCameraPermission, startCamera]);

  const handleCameraError = useCallback(
    (errorMessage?: string) => {
      notify('error', errorMessage || 'Unable to start camera preview.');
      pauseCamera();
    },
    [notify, pauseCamera],
  );

  const isCameraMounted = cameraPermission === 'granted' && cameraActive;

  const scanButtonLabel =
    cameraPermission === 'blocked'
      ? 'Open Settings'
      : isCameraMounted
        ? 'Pause Scan'
        : 'Scan QR';

  const frameCaption = resolving
    ? 'Verifying token with server...'
    : cameraPermission === 'blocked'
      ? 'Enable camera permission in Android Settings'
      : isCameraMounted
        ? 'Align the QR inside the frame'
        : isPaused
          ? 'Scanner paused · Tap Scan QR to resume'
          : 'Align the QR inside the frame';

  const frameHeight = isCameraMounted ? 216 : 168;

  return {
    cameraPermission,
    cameraActive,
    isCameraMounted,
    isPaused,
    cameraSessionKey,
    resolving,
    result,
    scannedVerificationCode,
    appliedTorchMode,
    pairCaptureTarget,
    scanButtonLabel,
    frameCaption,
    frameHeight,
    scannerTorchOn,
    handlePrimaryCameraPress,
    handleToggleTorch,
    handleResolve,
    handleResetScan,
    handleCameraError,
    batchMode,
    batchItems,
    toggleBatchMode,
    removeBatchItem,
    clearBatchItems,
    confirmBatchReceipts,
    clearResult: useCallback(() => {
      setResult(null);
      setScannedVerificationCode(null);
    }, []),
    openPairCapture: useCallback(
      (pairToken: string, label: string) => setPairCaptureTarget({ pairToken, label }),
      [],
    ),
    clearPairCaptureTarget: useCallback(() => setPairCaptureTarget(null), []),
  };
}
