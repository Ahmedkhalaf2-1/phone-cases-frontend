import { section } from "../section";

export const cart = section(
  {
    title: "Your bag",
    demoNotice:
      "Demo mode — this cart is simulated locally in your browser (backend offline). It is not a real order.",
    loading: "Loading your bag…",
    empty: "Your bag is empty.",
    browse: "Browse phone cases",
    summary: "Summary",
    coupon: "Coupon",
    couponCode: "Coupon code",
    demoCode: "Try demo code {code}.",
    shippingAtCheckout: "Shipping is calculated at checkout.",
    checkout: "Checkout",
    includes: "includes {price}",
    unavailableExcluded: "excluded from your total",
    loadOptionsError: "Could not load other options for this product.",
    loadingOptions: "Loading options…",
    outOfStockSuffix: "out of stock",
    quantityLabel: "Quantity",
    errors: {
      loadBag: "Could not load your bag. Check your connection and retry.",
      notReady: "Your bag isn't ready yet — try again in a moment.",
      generic: "Something went wrong.",
    },
  },
  {
    title: "سلة التسوق",
    demoNotice:
      "وضع تجريبي — هذه السلة محاكاة داخل متصفحك (الخادم غير متصل). هذا ليس طلبًا حقيقيًا.",
    loading: "جارٍ تحميل السلة…",
    empty: "سلتك فاضية.",
    browse: "تصفّح كوفرات الهاتف",
    summary: "ملخص الطلب",
    coupon: "كوبون",
    couponCode: "كود الخصم",
    demoCode: "جرّب الكود التجريبي {code}.",
    shippingAtCheckout: "يتم احتساب الشحن عند إتمام الطلب.",
    checkout: "إتمام الطلب",
    includes: "يشمل {price}",
    unavailableExcluded: "غير محسوب في إجمالي طلبك",
    loadOptionsError: "تعذّر تحميل الخيارات الأخرى لهذا المنتج.",
    loadingOptions: "جارٍ تحميل الخيارات…",
    outOfStockSuffix: "غير متوفر",
    quantityLabel: "الكمية",
    errors: {
      loadBag: "تعذّر تحميل السلة. تأكد من اتصالك وحاول مرة أخرى.",
      notReady: "السلة ليست جاهزة بعد — حاول مرة أخرى بعد لحظة.",
      generic: "حدث خطأ ما.",
    },
  },
);
