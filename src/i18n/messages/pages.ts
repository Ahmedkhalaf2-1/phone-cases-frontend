import { section } from "../section";

export const pages = section(
  {
    notFoundTitle: "Page not found",
    notFoundBody: "We couldn't find what you were looking for.",
    comingSoonTitle: "Not available yet",
    comingSoonBody:
      "This page is not built in this development milestone. The homepage is the only fully implemented page right now.",
    backHome: "Back to home",
    notPublishedTitle: "Not published yet",
    notPublishedBody:
      "This page (\"{slug}\") hasn't been written yet — content is managed by the shop owner via the backend's content system.",
    pageNotAvailable: "Page not available",
    error: {
      title: "Something went wrong",
      body: "We couldn't load this page. Please try again.",
      retry: "Try again",
    },
  },
  {
    notFoundTitle: "الصفحة مش موجودة",
    notFoundBody: "مش لاقيين الصفحة اللي بتدوّر عليها.",
    comingSoonTitle: "قريبًا",
    comingSoonBody: "الصفحة دي لسه مجهزتش. الصفحة الرئيسية هي الوحيدة الجاهزة دلوقتي.",
    backHome: "ارجع للرئيسية",
    notPublishedTitle: "لسه متنشرتش",
    notPublishedBody: "الصفحة دي («{slug}») لسه مكتوبتش — المحتوى بيتحكم فيه صاحب المتجر.",
    pageNotAvailable: "الصفحة مش متاحة",
    error: {
      title: "حصلت مشكلة",
      body: "مقدرناش نفتح الصفحة دي. جرّب تاني.",
      retry: "جرّب تاني",
    },
  },
);
