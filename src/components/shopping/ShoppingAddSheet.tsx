// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet picker so
// the UX matches the fridge. "manual" opens the lightweight ShoppingManualEntry
// form; "camera" opens the team's PhotoRecognitionCamera and, on a successful
// recognition (Plan A), adds the recognised food straight to the cart.
import React, { useState } from 'react';
import { AddItemMethodSheet, type AddItemMethod } from '../AddItemMethodSheet';
import { PhotoRecognitionCamera } from '../inventory-entry/PhotoRecognitionCamera';
import { ShoppingManualEntry } from './ShoppingManualEntry';
import { useI18n } from '../../i18n';
import type { PhotoRecognitionResult, RecognisedFood } from '../../services/recognitionApi';

// The recogniser returns a food code (e.g. 'tomato'); map it to a readable name.
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
  onClose: () => void;
  onAdd: (item: { name: string; quantity: number; unit: string }) => void | Promise<void>;
};

export function ShoppingAddSheet({ visible, inventoryNames, onClose, onAdd }: ShoppingAddSheetProps) {
  const { t } = useI18n();
  const [manualVisible, setManualVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  const handleSelect = (method: AddItemMethod) => {
    if (method === 'manual') {
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
        onClose={() => setManualVisible(false)}
        onSubmit={onAdd}
      />
      <PhotoRecognitionCamera
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onRecognised={handleRecognised}
        onManualFallback={() => {
          // recognition failed / user chose manual: hand off to the manual form
          setCameraVisible(false);
          setManualVisible(true);
        }}
      />
    </>
  );
}