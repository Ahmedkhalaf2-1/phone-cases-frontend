"use client";

import Link from "next/link";
import { FOOTER_LINKS, SITE } from "@/config/site";
import { useI18n } from "@/i18n/I18nProvider";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 border-b border-white/15 pb-10 md:flex-row md:items-end md:justify-between">
          <h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/contrast-logo-white.png"
              alt={SITE.brandName}
              loading="lazy"
              decoding="async"
              width={908}
              height={120}
              className="h-auto w-[70vw] max-w-[520px] sm:w-[45vw]"
            />
          </h2>

          <div className="flex flex-col gap-6 border-white/15 md:flex-row md:items-center md:gap-8 md:border-s md:ps-8">
            <p className="font-display text-2xl leading-tight uppercase">
              {t("nav.taglineLine1")}{" "}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/ct-emblem-white.png"
                alt=""
                loading="lazy"
                decoding="async"
                width={256}
                height={256}
                className="inline-block size-6 align-[-0.1em]"
              />
              <br />
              {t("nav.taglineLine2")}
            </p>

            <nav aria-label={t("nav.footerLabel")} className="grid gap-2 text-sm">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-white/80 underline-offset-4 hover:text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t(`nav.${link.key}`)}
                </Link>
              ))}
            </nav>

            <p className="border-white/15 text-sm font-medium tracking-tight text-white/60 md:border-s md:ps-8">
              {t("nav.moreThanACase")}
            </p>
          </div>
        </div>

        <p className="pt-6 text-xs text-white/40">
          © {new Date().getFullYear()} {SITE.brandName}. {t("nav.rights")}
        </p>
      </div>
    </footer>
  );
}
