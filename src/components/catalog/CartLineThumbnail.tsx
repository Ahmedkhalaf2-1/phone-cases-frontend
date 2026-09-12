import {
  PhoneCaseIllustration,
  artworkForProductSlug,
} from "@/components/graphics/PhoneCaseIllustration";

export function CartLineThumbnail({
  productSlug,
  thumbnail,
  className = "size-20",
}: {
  productSlug: string;
  thumbnail: { url: string; altText: string | null } | null;
  className?: string;
}) {
  const artwork = artworkForProductSlug(productSlug);

  if (thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail.url}
        alt={thumbnail.altText ?? productSlug}
        className={`shrink-0 rounded-sm bg-surface object-cover ${className}`}
      />
    );
  }

  if (artwork) {
    return (
      <div className={`shrink-0 overflow-hidden rounded-sm bg-surface ${className}`}>
        <PhoneCaseIllustration artwork={artwork} className="h-full w-full py-1" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-sm bg-surface text-sm font-semibold text-muted-foreground ${className}`}
    >
      {productSlug.slice(0, 2).toUpperCase()}
    </div>
  );
}
