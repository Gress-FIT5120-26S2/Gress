// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet picker.
// "manual" opens ShoppingManualEntry; "camera" opens PhotoRecognitionCamera and,
// on success, adds the recognised food straight to the cart. Barcode scanning
// reuses FridgeScreen's camera + review pieces, but "continue" opens
// ShoppingManualEntry pre-filled (not the full InventoryEntryFlow, and not a
// direct add) so the user confirms quantity/unit before it lands in the cart.
import React, { useEffect, useRef, useState } from 'react';
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

  const handleRecognised = async (result: PhotoRecognitionResult) => {
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
  const handleBarcodeProduct = async (product: BarcodeProduct) => {
    let suggestion = null;
    let enrichmentSource: BarcodeDraft['enrichmentSource'] = null;
    try {
      const presetResult = await getFoodPresetSuggestion(product.name);
      suggestion = presetResult.suggestion;
      if (suggestion) {
        enrichmentSource = 'preset';
      } else {
        const generatedResult = await generateFoodPreset(product.name);
        suggestion = generatedResult.suggestion;
        enrichmentSource = generatedResult.generated ? 'ai' : 'preset';
      }
    } catch {
      suggestion = null;
    }
    setBarcodeDraft({ enrichmentSource, initialValues: buildBarcodeInitialValues(product, suggestion), product, suggestion });
    setCameraVisible(false);
  };

  // 中文：AddItemMethodSheet 会等自己的关闭动画真正播完（Animated.timing 的 finished 回调）
  //       才调用 onSelect，就是为了不让一个原生 Modal 在另一个还没关完时就开始打开——
  //       两个 <Modal> 在同一帧内一开一关，在 iOS 上会崩溃。BarcodeResultReview 没有这层
  //       保护，onContinue 是直接从按钮点击同步触发的，所以这里手动补一个延迟，等它关闭
  //       动画播完再打开下一个 Modal。
  // EN: AddItemMethodSheet waits for its own close animation to actually finish (the
  //     Animated.timing "finished" callback) before calling onSelect, specifically so one
  //     native Modal never starts presenting while another is still dismissing -- two <Modal>s
  //     transitioning in the same frame crashes on iOS. BarcodeResultReview has no such
  //     protection; onContinue fires synchronously from the button press. This adds the same
  //     kind of delay by hand, waiting for its close animation before opening the next Modal.
  const pendingManualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pendingManualTimer.current) clearTimeout(pendingManualTimer.current); }, []);
  const handleBarcodeContinue = (draft: BarcodeDraft) => {
    setBarcodeDraft(null);
    const values = {
      name: draft.product.name,
      quantity: Number(draft.initialValues.quantity) || 1,
      unit: draft.initialValues.unit ?? 'item',
    };
    if (pendingManualTimer.current) clearTimeout(pendingManualTimer.current);
    pendingManualTimer.current = setTimeout(() => {
      setManualInitialValues(values);
      setManualVisible(true);
    }, 350);
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