import { DEMO_MODE } from "@/lib/env";
import { apiGet } from "@/lib/api/http";
import type { CaseType } from "@/lib/api/types";
import { DEMO_CASE_TYPES } from "@/lib/demo/case-types.demo";

export interface CaseTypesResult {
  source: "demo" | "live";
  caseTypes: CaseType[];
}

/** Case types (e.g. Silicone, Tough) used as a product-listing filter facet. */
export async function getCaseTypes(): Promise<CaseTypesResult> {
  if (DEMO_MODE) {
    return { source: "demo", caseTypes: DEMO_CASE_TYPES };
  }

  const caseTypes = await apiGet<CaseType[]>("/case-types");
  return { source: "live", caseTypes };
}
