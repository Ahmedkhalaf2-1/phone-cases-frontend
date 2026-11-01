import { builtInBrandLogo } from "@/config/brand-logos";

/**
 * A phone brand's logo: the uploaded one, else a built-in logo for
 * well-known brands, else the brand's initial.
 */
export function BrandLogo({
  slug,
  name,
  logoUrl,
  className = "size-12",
  imageClassName = "p-2.5",
  muted,
}: {
  slug: string;
  name: string;
  logoUrl?: string | null;
  /** Size and shape of the tile. */
  className?: string;
  /** Padding around the logo inside the tile. */
  imageClassName?: string;
  /** Faded look, e.g. for a hidden brand. */
  muted?: boolean;
}) {
  const src = logoUrl || builtInBrandLogo(slug);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white ${
        muted ? "opacity-50 grayscale" : ""
      } ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`h-full w-full object-contain ${imageClassName}`} />
      ) : (
        <span className="font-display text-xl text-ink uppercase">{name.trim()[0] ?? "?"}</span>
      )}
    </span>
  );
}
