"use client";

import { useEffect } from "react";

import liquidGlass from "@/lib/liquidGlass";

// Applies the real-refraction glass effect to a ref'd element for as long as
// this component is mounted. Options are read once (glass panels don't need
// to react to prop changes) — pass a stable object or inline literal.
export default function useLiquidGlass(ref, options) {
  useEffect(() => {
    if (!ref.current) return;
    const glass = liquidGlass(ref.current, options);
    return () => glass.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
