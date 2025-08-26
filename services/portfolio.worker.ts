// This web worker is deprecated.
// All portfolio optimization logic has been moved to the 'secure-api-gateway' Supabase Edge Function.
// This file is kept to avoid breaking existing imports but should not be used.

self.onmessage = (event) => {
  self.postMessage({ type: 'ERROR', payload: 'This worker is deprecated.' });
};
