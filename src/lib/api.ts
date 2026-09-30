// Helper client for communicating with the separate Backend API server
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:5000';

export async function fetchBackendApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Check if user has entered custom API keys in browser localStorage
  let userOpenAiKey = '';
  let userGeminiKey = '';
  try {
    userOpenAiKey = localStorage.getItem('kk_custom_openai_key') || '';
    userGeminiKey = localStorage.getItem('kk_custom_gemini_keys') || '';
  } catch {
    // Ignore localStorage restrictions
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (userOpenAiKey) {
    headers['x-user-openai-key'] = userOpenAiKey;
  }
  if (userGeminiKey) {
    headers['x-user-gemini-key'] = userGeminiKey.split(/[\n,;\s]+/)[0] || userGeminiKey;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}
