// Registry of CSS-only "materials" a zone can be painted with, on top of its
// own author-picked color — same shape/lookup pattern as OBJECT_TYPES in
// icons.js. Every value is a semi-transparent black/white overlay (never a
// texture with its own hue), so it reads reasonably over any zone.color and
// in both light/dark theme (zone.color itself bypasses theme variables
// entirely — there's no adaptation to rely on there).
export const ZONE_TEXTURES = {
  none: { label: "Nessuna (tinta unita)", css: "none" },
  hatch: {
    label: "Diagonale (predefinita)",
    css: "repeating-linear-gradient(135deg, rgba(0,0,0,0.055) 0 3px, transparent 3px 10px)",
  },
  wood: {
    label: "Assi di legno",
    css: "repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 6px)",
  },
  stone: {
    label: "Piastrelle di pietra",
    css: "repeating-linear-gradient(0deg, rgba(0,0,0,0.09) 0 2px, transparent 2px 26px), repeating-linear-gradient(90deg, rgba(0,0,0,0.09) 0 2px, transparent 2px 26px)",
  },
  carpet: {
    label: "Tappeto intrecciato",
    css: "repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)",
  },
  grass: {
    label: "Erba",
    css: "repeating-radial-gradient(circle at 25% 30%, rgba(0,0,0,0.09) 0 1.5px, transparent 1.5px 9px), repeating-radial-gradient(circle at 70% 65%, rgba(255,255,255,0.07) 0 1.5px, transparent 1.5px 11px)",
  },
  marble: {
    label: "Marmo venato",
    css: "repeating-linear-gradient(115deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 34px), repeating-linear-gradient(25deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 46px)",
  },
  water: {
    label: "Increspature d'acqua",
    css: "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0 2px, transparent 2px 14px)",
  },
};

// Zones saved before this feature lack `textureId` — fall back to "hatch"
// (the texture that was already always shown), same additive-field
// convention as puzzle.briefing || "".
export function zoneTextureCss(textureId) {
  return ZONE_TEXTURES[textureId || "hatch"]?.css ?? ZONE_TEXTURES.hatch.css;
}
