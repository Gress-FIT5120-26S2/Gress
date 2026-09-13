// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet picker.
// "manual" opens ShoppingManualEntry; "camera" opens PhotoRecognitionCamera and,
// on success (Plan A), adds the recognised food straight to the cart.
// Barcode scanning reuses the same camera + review pieces FridgeScreen uses for
// inventory (US-parity with barcodeEnabled): the difference here is US5.2 only
// needs name/quantity/unit for the cart, so BarcodeResultReview's "continue"
// adds to the cart directly instead of opening the full InventoryEntryFlow.
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

  const handleSelect = (method: AddItemMethod) => {
    if (method === 'manual') setManualVisible(true);
    else setCameraVisible(true);
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

  // 中文：条码识别复用 FridgeScreen 的预设/AI 补全逻辑，得到品类和参考单位。
  // EN: Barcode lookup reuses FridgeScreen's preset/AI enrichment to derive category and package unit.
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

  // 中文：购物车只需要名称/数量/单位，条码核对页确认后直接加入购物车，不必打开完整的库存表单。
  // EN: The cart only needs name/quantity/unit, so confirming the barcode review adds to the cart directly instead of opening the full inventory form.
  const handleBarcodeContinue = async (draft: BarcodeDraft) => {
    setBarcodeDraft(null);
    try {
      await onAdd({
        name: draft.product.name,
        quantity: Number(draft.initialValues.quantity) || 1,
        unit: draft.initialValues.unit ?? 'item',
      });
    } catch {
      // duplicate or network error -- ignore, matching the photo-recognition path above
    }
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
        onClose={() => setManualVisible(false)}
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
          setManualVisible(true);
        }}
      />
      <BarcodeResultReview
        draft={barcodeDraft}
        visible={barcodeDraft !== null}
        onClose={() => setBarcodeDraft(null)}
        onContinue={(draft) => { void handleBarcodeContinue(draft); }}
        onRescan={() => {
          setBarcodeDraft(null);
          setCameraVisible(true);
        }}
      />
    </>
  );
}