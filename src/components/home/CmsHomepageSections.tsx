import Link from "next/link";
import type { HomepageSection } from "@/lib/api/types";

/**
 * Renders staff-published CMS sections into the existing reference design
 * — a BANNER as a full-width image/text panel, a PROMO_STRIP as a slim
 * announcement bar. This maps the backend's two section types onto fixed
 * layouts; it is not a general page builder, so a new backend section
 * type would need a new case here rather than open-ended rendering.
 */
export function CmsHomepageSections({ sections }: { sections: HomepageSection[] }) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) =>
        section.type === "PROMO_STRIP" ? (
          <PromoStrip key={section.id} section={section} />
        ) : (
          <Banner key={section.id} section={section} />
        ),
      )}
    </>
  );
}

function PromoStrip({ section }: { section: HomepageSection }) {
  const content = (
    <p className="mx-auto max-w-[1440px] px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white uppercase sm:px-6 lg:px-8">
      {section.title ?? section.body}
    </p>
  );
  return (
    <div className="bg-ink">
      {section.linkUrl ? (
        <Link href={section.linkUrl} className="block hover:bg-accent">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function Banner({ section }: { section: HomepageSection }) {
  const body = (
    <div className="relative isolate flex min-h-[280px] items-end overflow-hidden rounded-sm sm:min-h-[360px]">
      {section.media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={section.media.url}
          alt={section.media.altText ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-surface" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      <div className="relative flex flex-col gap-2 p-6 text-white sm:p-10">
        {section.title && (
          <h2 className="font-display text-3xl tracking-tight uppercase sm:text-4xl">
            {section.title}
          </h2>
        )}
        {section.body && <p className="max-w-md text-sm text-white/85">{section.body}</p>}
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      {section.linkUrl ? (
        <Link href={section.linkUrl} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}
