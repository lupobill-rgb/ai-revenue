import { z } from "zod";
import { executeApprovedProposal } from "../_lib/googleAdsOperator/executor";

export const config = {
  api: {
    bodyParser: true,
  },
};

const BodySchema = z.object({
  proposalId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  adAccountId: z.string().uuid(),
  approvedPayload: z.any(),
  runId: z.string().uuid().optional(),
  actorType: z.enum(["system", "ai", "human"]).optional(),
  actorId: z.string().uuid().optional(),
});

function requireInternalSecret(req: any) {
  const expected = process.env.ADS_OPERATOR_INTERNAL_SECRET;
  if (!expected) throw new Error("Missing ADS_OPERATOR_INTERNAL_SECRET");
  const provided = req.headers["x-internal-secret"];
  if (!provided || provided !== expected) throw new Error("Unauthorized");
}

export default async function handler(req: any, res: any) {
  try {
    requireInternalSecret(req);
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = BodySchema.parse(req.body);
    const result = await executeApprovedProposal({
      proposalId: body.proposalId,
      workspaceId: body.workspaceId,
      adAccountId: body.adAccountId,
      approvedPayload: body.approvedPayload,
      runId: body.runId,
      actorType: body.actorType ?? "system",
      actorId: body.actorId,
    });
    return res.status(200).json({ ok: true, result });
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : "Unknown error";
    const code = msg === "Unauthorized" ? 401 : 500;
    return res.status(code).json({ ok: false, error: msg });
  }
}

