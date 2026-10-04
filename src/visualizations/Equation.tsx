import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export default function Equation({ value }: { value: string }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (target.current)
      katex.render(value, target.current, {
        displayMode: true,
        output: "htmlAndMathml",
        trust: false,
        throwOnError: false,
        strict: "error",
        maxExpand: 100,
        maxSize: 10,
      });
  }, [value]);
  return (
    <div
      className="lesson-equation"
      ref={target}
      data-testid="lesson-equation"
    />
  );
}
