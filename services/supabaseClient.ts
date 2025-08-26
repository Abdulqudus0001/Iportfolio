import { createClient } from '@supabase/supabase-js';

// This setup is designed to work for local development.
// The Supabase URL is derived from your project logs.
// You must provide your Supabase anon key below for the application to connect to your backend.

const supabaseUrl = 'https://avxgjocwbyxtnriuhscc.supabase.co';

// --- PASTE YOUR SUPABASE ANON KEY HERE ---
// You can find this in your Supabase project settings under "API".
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eGdqb2N3Ynl4dG5yaXVoc2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMTE2NTUsImV4cCI6MjA3MDg4NzY1NX0.kUgjhoaVHmwzlI0SXabdpMO8ObnBn0tm4k3_vKCz0DE'; 

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE') {
  const errorMessage = "Supabase configuration is missing. Please open `services/supabaseClient.ts` and replace the placeholder with your actual Supabase anonymous key.";
  
  // Display a user-friendly error on the page
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="font-family: sans-serif; padding: 2rem; background-color: #FFFBEB; color: #92400E; border: 1px solid #FBBF24; border-radius: 0.5rem; margin: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Configuration Needed</h2>
        <p>${errorMessage}</p>
        <p style="margin-top: 0.5rem;">This key is safe to be public and is required for the app to communicate with your Supabase backend.</p>
      </div>
    `;
  }
  
  // Also throw an error to stop execution
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);