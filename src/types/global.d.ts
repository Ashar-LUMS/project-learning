/**
 * Global type declarations for the application
 */

// Window extensions
declare global {
  interface Window {
    Plotly?: any;
    __networkEditorPageRenderCount?: number;
  }
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
