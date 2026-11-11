/**
 * The Krumms dog. Drawn as a CSS mask over the PNG's transparency, so it takes the brand text color in both light
 * and dark mode (an <img> could not be recolored). Decorative: the product name is always next to it.
 */
export default function BrandMark({ className = "h-8 w-10" }: { className?: string }) {
  const mask = {
    WebkitMaskImage: "url(/krumms-mark.png)",
    maskImage: "url(/krumms-mark.png)",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as const;
  return <span aria-hidden className={`inline-block bg-brand-text ${className}`} style={mask} />;
}
