import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';
import { recogniseFoodPhoto, type PhotoRecognitionResult } from '../../services/recognitionApi';

type RecognitionStage = 'camera' | 'recognising' | 'unknown' | 'error';

type PhotoRecognitionCameraProps = {
  onClose: () => void;
  onManualFallback: () => void;
  onRecognised: (result: PhotoRecognitionResult, photoUri: string) => void | Promise<void>;
  visible: boolean;
};

const FLASH_SEQUENCE: FlashMode[] = ['auto', 'on', 'off'];

export function PhotoRecognitionCamera({
  onClose,
  onManualFallback,
  onRecognised,
  visible,
}: PhotoRecognitionCameraProps) {
  const { t } = useI18n();
  const copy = t.fridge.photoRecognition;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<RecognitionStage>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [showSupportedFoods, setShowSupportedFoods] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStage('camera');
    setCapturedUri(null);
    setCameraReady(false);
    setShowSupportedFoods(false);
  }, [visible]);

  const recogniseUri = useCallback(async (sourceUri: string, sourceWidth?: number) => {
    try {
      setStage('recognising');

      // Arthur: NarIyirm
      // 中文：相机与相册图片在上传前统一转为适合模型的 JPEG，避免 HEIC 等设备格式造成接口失败。
      // EN: Camera and library images are normalized to a model-friendly JPEG before upload so device formats such as HEIC cannot break the request.
      const context = ImageManipulator.manipulate(sourceUri);
      if (sourceWidth && sourceWidth > 1600) context.resize({ height: null, width: 1600 });
      const rendered = await context.renderAsync();
      const normalized = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
      setCapturedUri(normalized.uri);

      const result = await recogniseFoodPhoto(normalized.uri);
      if (result.food === 'unknown' || result.freshness === 'unknown') {
        setStage('unknown');
        return;
      }
      await onRecognised(result, normalized.uri);
    } catch {
      setStage('error');
    }
  }, [onRecognised]);

  const capture = useCallback(async () => {
    if (!cameraReady || stage !== 'camera') return;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('camera_capture_failed');
      setCapturedUri(photo.uri);
      await recogniseUri(photo.uri, photo.width);
    } catch {
      setStage('error');
    }
  }, [cameraReady, recogniseUri, stage]);

  const choosePhoto = useCallback(async () => {
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      if (selection.canceled || !selection.assets[0]?.uri) return;
      const asset = selection.assets[0];
      setCapturedUri(asset.uri);
      await recogniseUri(asset.uri, asset.width);
    } catch {
      setStage('error');
    }
  }, [recogniseUri]);

  const retry = useCallback(() => {
    setCapturedUri(null);
    setStage('camera');
    setShowSupportedFoods(false);
  }, []);

  const cycleFlash = useCallback(() => {
    setFlash((current) => FLASH_SEQUENCE[(FLASH_SEQUENCE.indexOf(current) + 1) % FLASH_SEQUENCE.length]);
  }, []);

  const flipCamera = useCallback(() => {
    setCameraReady(false);
    setFacing((current) => current === 'back' ? 'front' : 'back');
  }, []);

  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 52;
  const isCameraAvailable = permission?.granted === true;
  const flashLabel = flash === 'auto' ? copy.flashAuto : flash === 'on' ? copy.flashOn : copy.flashOff;
  const flashIcon = flash === 'off' ? 'flash-off-outline' : flash === 'on' ? 'flash' : 'flash-outline';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      visible={visible}
    >
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {isCameraAvailable && stage === 'camera' ? (
          <CameraView
            active={visible}
            facing={facing}
            flash={flash}
            mode="picture"
            onCameraReady={() => setCameraReady(true)}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {capturedUri ? (
          <Image contentFit="cover" source={capturedUri} style={StyleSheet.absoluteFill} transition={120} />
        ) : null}
        <View pointerEvents="none" style={[styles.cameraShade, stage !== 'camera' ? styles.cameraShadeStrong : null]} />

        <View style={[styles.topBar, { paddingTop: topInset }]}>
          <Pressable
            accessibilityLabel={copy.close}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.roundButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color="#FFFFFF" name="close" size={23} />
          </Pressable>
          <Text style={styles.title}>{copy.cameraTitle}</Text>
          {isCameraAvailable && stage === 'camera' ? (
            <Pressable
              accessibilityLabel={flashLabel}
              accessibilityRole="button"
              onPress={cycleFlash}
              style={({ pressed }) => [styles.flashButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color="#FFFFFF" name={flashIcon} size={17} />
              <Text style={styles.flashText}>{flashLabel}</Text>
            </Pressable>
          ) : <View style={styles.roundButtonPlaceholder} />}
        </View>

        {permission === null ? (
          <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /></View>
        ) : null}
        {permission && !permission.granted && stage === 'camera' ? (
          <View style={styles.permissionPanel}>
            <View style={styles.permissionIcon}>
              <Ionicons color="#147E8C" name="camera-outline" size={30} />
            </View>
            <Text style={styles.permissionTitle}>{copy.permissionTitle}</Text>
            <Text style={styles.permissionDescription}>{copy.permissionDescription}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void requestPermission(); }} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
              <Text style={styles.primaryButtonText}>{copy.grantPermission}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { void choosePhoto(); }} style={styles.textButton}>
              <Text style={styles.textButtonText}>{copy.choosePhotos}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onManualFallback} style={styles.textButton}>
              <Text style={styles.textButtonText}>{copy.useManual}</Text>
            </Pressable>
          </View>
        ) : null}

        {isCameraAvailable && stage === 'camera' ? (
          <>
            <View style={[styles.modeSwitch, { top: topInset + 64 }]}>
              <View style={styles.modeSelected}>
                <Ionicons color="#174E43" name="scan-outline" size={17} />
                <Text style={styles.modeSelectedText}>{copy.photoMode}</Text>
              </View>
              <View accessibilityLabel={copy.barcodeComing} accessibilityState={{ disabled: true }} style={styles.modeDisabled}>
                <Ionicons color="#D2D7D4" name="barcode-outline" size={17} />
                <Text style={styles.modeDisabledText}>{copy.barcodeMode}</Text>
                <Text style={styles.soonText}>{copy.soon}</Text>
              </View>
            </View>
            <View pointerEvents="none" style={styles.guideWrap}>
              <View style={styles.guideFrame}>
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
              <View style={styles.hintPill}>
                <Ionicons color="#FFFFFF" name="sparkles-outline" size={14} />
                <Text style={styles.cameraHint}>{copy.cameraHint}</Text>
              </View>
            </View>
            <View style={styles.zoomPill}><Text style={styles.zoomText}>1×</Text></View>
            <View style={styles.captureBar}>
              <Pressable
                accessibilityLabel={copy.choosePhotos}
                accessibilityRole="button"
                onPress={() => { void choosePhoto(); }}
                style={({ pressed }) => [styles.dockButton, pressed ? styles.pressed : null]}
              >
                <Ionicons color="#FFFFFF" name="images-outline" size={25} />
                <Text style={styles.dockLabel}>{copy.photos}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={copy.capture}
                accessibilityRole="button"
                disabled={!cameraReady}
                onPress={() => { void capture(); }}
                style={({ pressed }) => [styles.shutterOuter, !cameraReady ? styles.disabled : null, pressed ? styles.shutterPressed : null]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
              <Pressable
                accessibilityLabel={copy.flipCamera}
                accessibilityRole="button"
                onPress={flipCamera}
                style={({ pressed }) => [styles.dockButton, pressed ? styles.pressed : null]}
              >
                <Ionicons color="#FFFFFF" name="camera-reverse-outline" size={27} />
                <Text style={styles.dockLabel}>{copy.flip}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {stage === 'recognising' ? (
          <View style={styles.analysisState}>
            <View style={styles.analysisMark}>
              <Ionicons color="#FFFFFF" name="sparkles-outline" size={28} />
            </View>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.analysisText}>{copy.recognising}</Text>
          </View>
        ) : null}

        {stage === 'unknown' || stage === 'error' ? (
          <View style={styles.resultFallback}>
            <View style={styles.sheetHandle} />
            <Text style={styles.fallbackEyebrow}>{stage === 'unknown' ? copy.tryAgainEyebrow : copy.connectionEyebrow}</Text>
            <Text style={styles.fallbackTitle}>{stage === 'unknown' ? copy.unknownTitle : copy.errorTitle}</Text>
            <Text style={styles.fallbackDescription}>{stage === 'unknown' ? copy.unknownDescription : copy.errorDescription}</Text>
            {stage === 'unknown' ? (
              <View style={styles.tipsRow}>
                <Tip icon="restaurant-outline" label={copy.tipOneItem} />
                <Tip icon="sunny-outline" label={copy.tipEvenLight} />
                <Tip icon="scan-outline" label={copy.tipFillFrame} />
              </View>
            ) : null}
            {showSupportedFoods ? (
              <Text style={styles.supportedFoods}>{copy.supportedFoodsList}</Text>
            ) : null}
            <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}>
              <Ionicons color="#FFFFFF" name="camera-outline" size={19} />
              <Text style={styles.primaryButtonText}>{copy.retry}</Text>
            </Pressable>
            <View style={styles.quietActions}>
              <Pressable accessibilityRole="button" onPress={() => { void choosePhoto(); }} style={styles.quietButton}>
                <Ionicons color="#315C51" name="images-outline" size={18} />
                <Text style={styles.quietButtonText}>{copy.choosePhotos}</Text>
              </Pressable>
              <View style={styles.quietDivider} />
              <Pressable accessibilityRole="button" onPress={onManualFallback} style={styles.quietButton}>
                <Ionicons color="#315C51" name="create-outline" size={18} />
                <Text style={styles.quietButtonText}>{copy.useManualShort}</Text>
              </Pressable>
            </View>
            {stage === 'unknown' ? (
              <Pressable accessibilityRole="button" onPress={() => setShowSupportedFoods((current) => !current)} style={styles.supportedButton}>
                <Text style={styles.supportedButtonText}>{copy.supportedFoods}</Text>
                <Ionicons color="#5E766E" name={showSupportedFoods ? 'chevron-up' : 'chevron-down'} size={15} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Tip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipIcon}><Ionicons color="#147E8C" name={icon} size={18} /></View>
      <Text style={styles.tipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#102C26' },
  cameraShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(7, 24, 20, 0.16)' },
  cameraShadeStrong: { backgroundColor: 'rgba(7, 24, 20, 0.42)' },
  topBar: { position: 'absolute', top: 0, right: 0, left: 0, minHeight: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: 'rgba(5, 22, 18, 0.34)' },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(11, 31, 26, 0.58)' },
  roundButtonPlaceholder: { width: 64, height: 44 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  flashButton: { minWidth: 64, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 22, backgroundColor: 'rgba(11, 31, 26, 0.58)' },
  flashText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionPanel: { position: 'absolute', right: 24, left: 24, top: '25%', alignItems: 'center', padding: 24, borderRadius: 24, backgroundColor: '#F7FAF8' },
  permissionIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: '#E0F4F5' },
  permissionTitle: { marginTop: 18, color: '#163D32', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  permissionDescription: { marginTop: 9, color: '#506A61', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#F58220' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  textButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 3, paddingHorizontal: 14 },
  textButtonText: { color: '#42675D', fontSize: 13, fontWeight: '700' },
  modeSwitch: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', padding: 4, borderRadius: 17, backgroundColor: 'rgba(12, 34, 28, 0.68)' },
  modeSelected: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F3F7F4' },
  modeSelectedText: { color: '#174E43', fontSize: 12.5, fontWeight: '800' },
  modeDisabled: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 },
  modeDisabledText: { color: '#D2D7D4', fontSize: 12.5, fontWeight: '700' },
  soonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 7, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)' },
  guideWrap: { position: 'absolute', right: 28, left: 28, top: '25%', alignItems: 'center' },
  guideFrame: { width: '100%', aspectRatio: 1, maxHeight: 420 },
  corner: { position: 'absolute', width: 54, height: 54, borderColor: 'rgba(255,255,255,0.94)' },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 },
  cornerBottomRight: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 18 },
  hintPill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, paddingHorizontal: 13, borderRadius: 17, backgroundColor: 'rgba(8, 28, 23, 0.62)' },
  cameraHint: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 3 },
  zoomPill: { position: 'absolute', bottom: Platform.OS === 'ios' ? 165 : 151, alignSelf: 'center', minWidth: 38, minHeight: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(8, 28, 23, 0.64)' },
  zoomText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  captureBar: { position: 'absolute', right: 0, bottom: 0, left: 0, minHeight: Platform.OS === 'ios' ? 142 : 128, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 35, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 18, backgroundColor: 'rgba(5, 22, 18, 0.54)' },
  dockButton: { width: 70, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 5 },
  dockLabel: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  shutterOuter: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'rgba(245,130,32,0.9)' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  analysisState: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 13 },
  analysisMark: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginBottom: 2, borderRadius: 34, backgroundColor: 'rgba(18, 146, 154, 0.88)' },
  analysisText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resultFallback: { position: 'absolute', right: 0, bottom: 0, left: 0, alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F8FAF8' },
  sheetHandle: { width: 42, height: 5, marginBottom: 17, borderRadius: 3, backgroundColor: '#D8DFDB' },
  fallbackEyebrow: { color: '#147E8C', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  fallbackTitle: { marginTop: 6, color: '#173D31', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  fallbackDescription: { maxWidth: 330, marginTop: 7, color: '#5A6E66', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  tipsRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 6 },
  tip: { width: '31%', alignItems: 'center', gap: 7 },
  tipIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#E4F3F3' },
  tipText: { color: '#48645B', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  supportedFoods: { marginTop: 13, color: '#5E766E', fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  retryButton: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, borderRadius: 17, backgroundColor: '#F58220' },
  quietActions: { width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  quietButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  quietButtonText: { color: '#315C51', fontSize: 12.5, fontWeight: '800' },
  quietDivider: { width: 1, height: 18, backgroundColor: '#D7E0DC' },
  supportedButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8 },
  supportedButtonText: { color: '#5E766E', fontSize: 11.5, fontWeight: '700' },
});
