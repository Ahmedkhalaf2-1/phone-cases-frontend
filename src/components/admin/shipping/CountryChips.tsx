import { countryName } from "@/lib/admin/shipping-display";

/** Country codes as readable chips: "EG · Egypt". */
export function CountryChips({ codes }: { codes: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const name = countryName(code);
        return (
          <li
            key={code}
            className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-ink"
          >
            <span className="font-semibold">{code}</span>
            {name && <span className="text-muted-foreground"> · {name}</span>}
          </li>
        );
      })}
    </ul>
  );
}
