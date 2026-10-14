// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet picker.
// "manual" opens ShoppingManualEntry; "camera" opens PhotoRecognitionCamera and,
// on success, adds the recognised food straight to the cart. Barcode scanning
// reuses FridgeScreen's camera + review pieces, but "continue" opens
// ShoppingManualEntry pre-filled (not the full InventoryEntryFlow, and not a
// direct add) so the user confirms quantity/unit before it lands in the cart.
import React, { useState } from 'react';
import { AddItemMethodSheet, type AddItemMethod } from '../AddItemMethodSheet';
import { PhotoRecognitionCamera } from '../inventory-entry/PhotoRecognitionCamera';
import { BarcodeResultReview, buildBarcodeInitialValues, type BarcodeDraft } from '../inventory-entry/BarcodeResultReview';
import { ShoppingManualEntry } from './ShoppingManualEntry';
import { useI18n } from '../../i18n';
import type { PhotoRecognitionResult, RecognisedFood } from '../../services/recognitionApi';
import { getFoodPresetSuggestion, generateFoodPreset, type InventoryBatch } from '../../services/inventoryApi';
import type { BarcodeProduct } from '../../services/barcodeApi';

const FOOD_LABEL: Record<RecognisedFood, string> = {
  banana: 'Banana',
  bittermelon: 'Bitter melon',
  cucumber: 'Cucumber',
  eggplant: 'Eggplant',
  orange: 'Orange',
  papaya: 'Papaya',
  pineapple: 'Pineapple',
  tomato: 'Tomato',
};

type ShoppingAddSheetProps = {
  visible: boolean;
  inventoryNames: Set<string>;
  inventoryByName: Map<string, InventoryBatch[]>;
  onClose: () => void;
  onAdd: (item: { name: string; quantity: number; unit: string }) => void | Promise<void>;
};

export function ShoppingAddSheet({
  visible,
  inventoryNames,
  inventoryByName,
  onClose,
  onAdd,
}: ShoppingAddSheetProps) {
  const { t } = useI18n();
  const [manualVisible, setManualVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [barcodeDraft, setBarcodeDraft] = useState<BarcodeDraft | null>(null);
  // 中文：条码"继续"之前是直接扣进购物车，但核对页看着像能编辑（有图标+箭头的格子），
  //       点一下却直接加入没有中间步骤，会显得很奇怪。改成打开这张表单预填，
  //       让"看起来能编辑"名副其实，用户确认/改完数量单位再真正加入购物车。
  // EN: "Continue" used to add straight to the cart, but the review screen looks editable
  //     (rows with an icon + chevron) -- tapping one and having it just add with no in-between
  //     step read as broken. This now opens this form pre-filled instead, so the "looks editable"
  //     affordance is real: the user confirms/adjusts quantity and unit before it actually lands in the cart.
  const [manualInitialValues, setManualInitialValues] = useState<{ name: string; quantity: number; unit: string } | null>(null);

  const handleSelect = (method: AddItemMethod) => {
    if (method === 'manual') {
      setManualInitialValues(null);
      setManualVisible(true);
    } else {
      setCameraVisible(true);
    }
  };

  const handleRecognised = async (result: PhotoRecognitionResult, _photoUri: string, signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setCameraVisible(false);
    if (result.food === 'unknown') return;
    const name = FOOD_LABEL[result.food] ?? result.food;
    try {
      await onAdd({ name, quantity: 1, unit: 'item' });
    } catch {
      // duplicate or network error -- ignore; the camera already closed
    }
  };

  // 中文：复用 FridgeScreen 的预设/AI 补全逻辑，得到品类和参考单位。
  // EN: Reuses FridgeScreen's preset/AI enrichment to derive category and unit.
  const handleBarcodeProduct = async (product: BarcodeProduct, signal?: AbortSignal) => {
    let suggestion = null;
    let enrichmentSource: BarcodeDraft['enrichmentSource'] = null;
    try {
      const presetResult = await getFoodPresetSuggestion(product.name, signal);
      suggestion = presetResult.suggestion;
      if (suggestion) {
        enrichmentSource = 'preset';
      } else {
        const generatedResult = await generateFoodPreset(product.name, signal);
        suggestion = generatedResult.suggestion;
        enrichmentSource = generatedResult.generated ? 'ai' : 'preset';
      }
    } catch {
      suggestion = null;
    }
    // Arthur: NarIyirm
    // 中文：购物识别退出后不再打开旧核对层；与冰箱共用相机请求的取消信号。
    // EN: Reuse the camera's cancellation signal so leaving shopping recognition cannot open a stale review.
    if (signal?.aborted) return;
    setBarcodeDraft({ enrichmentSource, initialValues: buildBarcodeInitialValues(product, suggestion), product, suggestion });
    setCameraVisible(false);
  };

  // Arthur: NarIyirm
  // 中文：表单状态直接交接，公共弹窗层等待真实关闭完成；不再用可能晚于用户取消的固定计时器。
  // EN: Hand off form state directly while the shared modal layer waits for native dismissal; avoid a timer that can fire after cancellation.
  const handleBarcodeContinue = (draft: BarcodeDraft) => {
    setBarcodeDraft(null);
    const values = {
      name: draft.product.name,
      quantity: Number(draft.initialValues.quantity) || 1,
      unit: draft.initialValues.unit ?? 'item',
    };
    setManualInitialValues(values);
    setManualVisible(true);
  };

  return (
    <>
      <AddItemMethodSheet
        visible={visible}
        copy={t.shopping.method.picker}
        onClose={onClose}
        onSelect={handleSelect}
      />
      <ShoppingManualEntry
        visible={manualVisible}
        inventoryNames={inventoryNames}
        inventoryByName={inventoryByName}
        initialValues={manualInitialValues}
        mode="add"
        onClose={() => { setManualVisible(false); setManualInitialValues(null); }}
        onSubmit={onAdd}
      />
      <PhotoRecognitionCamera
        visible={cameraVisible}
        barcodeEnabled
        onBarcodeProduct={handleBarcodeProduct}
        onClose={() => setCameraVisible(false)}
        onRecognised={handleRecognised}
        onManualFallback={() => {
          setCameraVisible(false);
          setManualInitialValues(null);
          setManualVisible(true);
        }}
      />
      <BarcodeResultReview
        context="cart"
        draft={barcodeDraft}
        visible={barcodeDraft !== null}
        onClose={() => setBarcodeDraft(null)}
        onContinue={handleBarcodeContinue}
        onRescan={() => {
          setBarcodeDraft(null);
          setCameraVisible(true);
        }}
      />
    </>
  );
}
