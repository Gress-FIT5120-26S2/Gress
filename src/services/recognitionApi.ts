import { File } from 'expo-file-system';
import { requestApi } from './apiClient';

export type RecognisedFood =
  | 'banana'
  | 'bittermelon'
  | 'cucumber'
  | 'eggplant'
  | 'orange'
  | 'papaya'
  | 'pineapple'
  | 'tomato';

export type RecognitionFreshness = 'fresh' | 'semi_fresh' | 'rotten';

export type PhotoRecognitionResult = {
  confidence: number;
  food: RecognisedFood | 'unknown';
  freshness: RecognitionFreshness | 'unknown';
  rawPrediction: string | null;
  reason: string | null;
};

// Arthur: NarIyirm
// 中文：相机页从这里上传单张缓存图片；requestApi 负责设备凭证，Express recognition.js 只在内存中代理到模型服务。
// EN: The camera uploads one cached image here; requestApi adds device credentials while Express recognition.js proxies it to the model entirely in memory.
export function recogniseFoodPhoto(uri: string): Promise<PhotoRecognitionResult> {
  const form = new FormData();
  const photo = new File(uri);

  // Arthur: NarIyirm
  // 中文：Expo 57 的 fetch 只接受真实 Blob；File 直接引用相机缓存文件，避免伪造 FormDataPart 或展开为更大的 base64。
  // EN: Expo 57 fetch requires a real Blob; File references the camera cache directly without a synthetic FormDataPart or larger base64 copy.
  form.append('file', photo);

  return requestApi<PhotoRecognitionResult>('/api/photo-recognition', {
    body: form,
    method: 'POST',
  });
}
