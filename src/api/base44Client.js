import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "6899651adcb30c1ab571dd01", 
  requiresAuth: true // Ensure authentication is required for all operations
});
