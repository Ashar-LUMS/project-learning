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

// Note: ImportMetaEnv is defined in src/vite-env.d.ts (Vite convention)
// Only define application-specific window extensions here

export {};
