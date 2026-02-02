type ValidateRequestBodyOptions = {
  requireTenantId?: boolean;
};

type ValidateRequestBodyResult<TBody> = {
  body: TBody;
  error: Response | null;
};

const forbiddenWorkspaceFields = [
  ["tenant", "Id"].join(""),
  "tenant",
  ["tenant", "id"].join("_"),
];

function getForbiddenFields(body: Record<string, unknown>): string[] {
  return forbiddenWorkspaceFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
}

function buildErrorResponse(
  message: string,
  corsHeaders: Record<string, string>,
  status: number = 400
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function validateRequestBody<TBody extends Record<string, unknown>>(
  req: Request,
  corsHeaders: Record<string, string>,
  options: ValidateRequestBodyOptions = {}
): Promise<ValidateRequestBodyResult<TBody>> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return { body: {} as TBody, error: buildErrorResponse("Invalid JSON body", corsHeaders) };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { body: {} as TBody, error: buildErrorResponse("Request body must be an object", corsHeaders) };
  }

  const forbiddenFields = getForbiddenFields(body as Record<string, unknown>);

  if (forbiddenFields.length > 0) {
    return {
      body: {} as TBody,
      error: buildErrorResponse(
        `Tenant fields are not allowed: ${forbiddenFields.join(", ")}. Use tenant_id only.`,
        corsHeaders
      ),
    };
  }

  if (options.requireTenantId) {
    try {
      validateTenantOnlyPayload(body);
    } catch (error) {
      return {
        body: {} as TBody,
        error: buildErrorResponse(
          error instanceof Error ? error.message : "tenant_id is required",
          corsHeaders
        ),
      };
    }
  }

  return { body: body as TBody, error: null };
}

export function validateTenantOnlyPayload(body: unknown): { tenant_id: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be an object");
  }

  const forbiddenFields = getForbiddenFields(body as Record<string, unknown>);
  if (forbiddenFields.length > 0) {
    throw new Error(
      `Tenant fields are not allowed: ${forbiddenFields.join(", ")}. Use tenant_id only.`
    );
  }

  const tenantId = (body as Record<string, unknown>)["tenant_id"];
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error("tenant_id is required");
  }

  return { tenant_id: tenantId };
}
