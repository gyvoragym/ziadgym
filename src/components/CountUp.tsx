import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts the first number inside a display string up from its previous value; text around it is kept as-is. */
export function CountUp({ value, duration = 600 }: { value: string; duration?: number }) {
  const m = /-?[\d,]*\.?\d+/.exec(value);
  const target = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const decimals = m && m[0].includes(".") ? m[0].split(".")[1]!.length : 0;
  const from = useRef(0);
  const [n, setN] = useState(target);
  useEffect(() => {
    if (!Number.isFinite(target) || reduced()) { setN(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration), e = 1 - Math.pow(1 - p, 3);
      setN(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, duration]);
  if (!m || !Number.isFinite(target)) return <>{value}</>;
  const shown = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <><span aria-hidden="true">{value.slice(0, m.index)}{shown}{value.slice(m.index + m[0].length)}</span><span className="sr-only">{value}</span></>;
}
