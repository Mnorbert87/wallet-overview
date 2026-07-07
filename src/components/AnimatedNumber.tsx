import { useEffect, useRef, useState } from "react";

// Felpörgő számláló (framer-motion nélkül is stabil — requestAnimationFrame).
export function AnimatedNumber({
  value,
  format,
  durationMs = 1100,
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const startVal = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setShown(startVal + (value - startVal) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <>{format(shown)}</>;
}
