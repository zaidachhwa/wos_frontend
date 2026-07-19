"use client";

import { useEffect, useRef } from "react";

import liquidGlass from "@/lib/liquidGlass";

// Applies the real-refraction glass effect to a ref'd element for as long as
// this component is mounted. Options are read once (glass panels don't need
// to react to prop changes) — pass a stable object or inline literal.
// Returns a ref to the {supported, refresh, destroy} handle so callers that
// reveal the element later (e.g. dialog.showModal()) can force an immediate
// refresh() instead of waiting on the debounced ResizeObserver.
export default function useLiquidGlass(ref, options) {
  const glassRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const glass = liquidGlass(ref.current, options);
    glassRef.current = glass;
    return () => {
      glass.destroy();
      glassRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return glassRef;
}
