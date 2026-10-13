/** Active/Inactive pill for zones and rates (server data; nothing is derived). */
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        isActive ? "bg-green-100 text-green-800" : "bg-surface text-muted-foreground"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
