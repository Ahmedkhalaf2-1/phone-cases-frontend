export function CartLineThumbnail({
  productSlug,
  thumbnail,
  className = "size-20",
}: {
  productSlug: string;
  thumbnail: { url: string; altText: string | null } | null;
  className?: string;
}) {
  if (thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail.url}
        alt={thumbnail.altText ?? productSlug}
        className={`shrink-0 rounded-2xl bg-surface object-contain p-1 shadow-soft ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-surface text-sm font-medium text-muted-foreground shadow-soft ${className}`}
    >
      {productSlug.slice(0, 2).toUpperCase()}
    </div>
  );
}
