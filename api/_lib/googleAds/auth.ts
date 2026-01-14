export type GoogleAdsAuth = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId?: string;
  linkedCustomerId?: string;
};

export type GoogleAdsCustomerRef = {
  customerId: string; // digits only, no dashes
  loginCustomerId?: string; // digits only, no dashes
  linkedCustomerId?: string; // digits only, no dashes
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function googleAdsAuthFromEnv(): GoogleAdsAuth {
  // NOTE: OAuth/token storage is assumed to exist elsewhere in the product.
  // This env-based fallback is used for development and initial deployment wiring.
  return {
    developerToken: requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    clientId: requireEnv("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_ADS_CLIENT_SECRET"),
    refreshToken: requireEnv("GOOGLE_ADS_REFRESH_TOKEN"),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    linkedCustomerId: process.env.GOOGLE_ADS_LINKED_CUSTOMER_ID || undefined,
  };
}

