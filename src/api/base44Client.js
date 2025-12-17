import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

/**
 * Local dev guard:
 * Base44 SDK will redirect to the hosted login screen when requiresAuth=true.
 * That login URL 404s for local runs in this repo, so default to false unless
 * explicitly enabled via Vite env.
 */
export const requiresAuth = import.meta.env.VITE_BASE44_REQUIRE_AUTH === 'true';

export const base44 = createClient({
  appId: "6899651adcb30c1ab571dd01", 
  requiresAuth
});
