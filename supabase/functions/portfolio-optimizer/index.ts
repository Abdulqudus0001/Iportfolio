// This Supabase Edge Function is deprecated.
// All portfolio optimization logic has been consolidated into the 'secure-api-gateway' function.
// This file is kept to avoid breaking deployment pipelines but should not be used.

// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (_req: Request) => {
  return new Response(
      JSON.stringify({ error: "This function is deprecated. Please use 'secure-api-gateway'." }),
      { status: 410, headers: { 'Content-Type': 'application/json' } },
    );
});
