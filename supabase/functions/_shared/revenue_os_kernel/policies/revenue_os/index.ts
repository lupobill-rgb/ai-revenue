import type { KernelDecision, KernelEvent } from "../../types.ts";

import * as growthLeadResponseV1 from "./growth/lead_response_v1.ts";
import * as growthUsageThresholdUpsellV1 from "./growth/usage_threshold_upsell_v1.ts";
import * as ftsBookingConfirmationV1 from "./fts/booking_confirmation_v1.ts";
import * as pipelineDealCloseGuardV1 from "./pipeline/deal_close_guard_v1.ts";
import * as pipelineInvoiceSendGuardV1 from "./pipeline/invoice_send_guard_v1.ts";
import * as marginDiscountGuardV1 from "./margin/discount_guard_v1.ts";

export type PolicyHandler = (event: KernelEvent) => Promise<KernelDecision[]>;

export const revenueOsPolicies = {
  growthLeadResponseV1: growthLeadResponseV1.handle as PolicyHandler,
  growthUsageThresholdUpsellV1: growthUsageThresholdUpsellV1.handle as PolicyHandler,
  ftsBookingConfirmationV1: ftsBookingConfirmationV1.handle as PolicyHandler,
  pipelineDealCloseGuardV1: pipelineDealCloseGuardV1.handle as PolicyHandler,
  pipelineInvoiceSendGuardV1: pipelineInvoiceSendGuardV1.handle as PolicyHandler,
  marginDiscountGuardV1: marginDiscountGuardV1.handle as PolicyHandler,
};


