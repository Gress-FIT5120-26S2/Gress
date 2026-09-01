// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet picker.
// "manual" opens ShoppingManualEntry; "camera" opens PhotoRecognitionCamera and,
// on success (Plan A), adds the recognised food straight to the cart.
import React, { useState } from 'react';
import { AddItemMethodSheet, type AddItemMethod } from '../AddItemMethodSheet';
import { PhotoRecognitionCamera } from '../inventory-entry/PhotoRecognitionCamera';
import { ShoppingManualEntry } from './ShoppingManualEntry';
import { useI18n } from '../../i18n';
import type { PhotoRecognitionResult, RecognisedFood } from '../../services/recognitionApi';
import type { InventoryBatch } from '../../services/inventoryApi';

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
        onClose={() => setCameraVisible(false)}
        onRecognised={handleRecognised}
        onManualFallback={() => {
          setCameraVisible(false);
          setManualVisible(true);
        }}
      />
    </>
  );
}