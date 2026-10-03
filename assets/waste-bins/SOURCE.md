# Waste sorting bin artwork

The six transparent PNG sprites in this folder are prerendered from the 240 L wheelie-bin model at `../waste-wheelie-bin.glb`.

- Source: https://3dassets.dev/assets/laundrette-and-cleaning-wheeled-bin-240-bed58e32
- Creator: 3D Assets
- License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- Local rendering command: `python scripts/render_waste_bins.py` (requires NumPy and Pillow)

The source provides a hinged lid and wheels. The app uses prerendered open and closed states for offline use and to keep the sorting overlay lightweight in Expo Go. The green, yellow and red variants are visual category cues; users should still follow their local council's collection rules.
