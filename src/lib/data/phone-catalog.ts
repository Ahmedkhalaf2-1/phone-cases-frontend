import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type { PhoneModel } from "@/lib/api/types";
import { DEMO_PHONE_MODELS } from "@/lib/demo/phone-models.demo";

export interface PhoneModelsResult {
  source: "demo" | "live";
  models: PhoneModel[];
}

/** Supported phone models for the "Find your phone" selector. */
export async function getPhoneModels(): Promise<PhoneModelsResult> {
  if (DEMO_MODE) {
    return { source: "demo", models: DEMO_PHONE_MODELS };
  }

  const models = await apiGet<PhoneModel[]>("/phone-models");
  return { source: "live", models };
}
