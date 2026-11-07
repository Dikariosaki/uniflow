declare global {
  interface Window {
    UNIFLOW_CONFIG?: { apiBaseUrl?: string; supabaseUrl?: string; supabaseAnonKey?: string };
  }
}

export const runtimeConfig = {
  apiBaseUrl: window.UNIFLOW_CONFIG?.apiBaseUrl ?? '/api',
  supabaseUrl: window.UNIFLOW_CONFIG?.supabaseUrl ?? '',
  supabaseAnonKey: window.UNIFLOW_CONFIG?.supabaseAnonKey ?? '',
};
