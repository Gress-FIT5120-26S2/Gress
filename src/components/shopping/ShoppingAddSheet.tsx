// src/components/shopping/ShoppingAddSheet.tsx
// The "add to cart" entry point. Reuses the shared AddItemMethodSheet (the same
// picker the fridge uses) so the UX is consistent. Choosing "manual" opens the
// lightweight ShoppingManualEntry form; "camera" is a placeholder for now --
// photo recognition is a team-wide, not-yet-implemented feature.
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AddItemMethodSheet, type AddItemMethod } from '../AddItemMethodSheet';
import { ShoppingManualEntry } from './ShoppingManualEntry';
import { useI18n } from '../../i18n';

type ShoppingAddSheetProps = {
  visible: boolean;
  inventoryNames: Set<string>;
  onClose: () => void;
  onAdd: (item: { name: string; quantity: number; unit: string }) => void | Promise<void>;
};

export function ShoppingAddSheet({ visible, inventoryNames, onClose, onAdd }: ShoppingAddSheetProps) {
  const { t } = useI18n();
  const [manualVisible, setManualVisible] = useState(false);

  const handleSelect = (method: AddItemMethod) => {
    if (method === 'manual') {
      // AddItemMethodSheet closes itself, then calls onSelect one frame later,
      // so it is safe to open the manual form here.
      setManualVisible(true);
      return;
    }
    // camera: not implemented yet (placeholder). Photo recognition is owned by
    // the team; wire it here once the recognition flow exists.
    Alert.alert(t.shopping.method.cameraSoonTitle, t.shopping.method.cameraSoonBody);
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
    </>
  );
}