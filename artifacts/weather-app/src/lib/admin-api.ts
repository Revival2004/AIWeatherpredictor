export interface AdminIdentity {
  email: string;
  role: "admin";
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminIdentity;
  expiresAt: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
  admin?: AdminIdentity;
  expiresAt?: string;
}

export interface AdminWeatherRecord {
  id: number;
  latitude: number;
  longitude: number;
  temperature: number;
  windspeed: number;
  humidity: number;
  pressure: number;
  weathercode: number;
  prediction: string;
  confidence: number;
  reasoning: string;
  createdAt: string;
}

export interface AdminWeatherStats {
  totalReadings: number;
  avgTemperature: number | null;
  avgWindspeed: number | null;
  avgHumidity: number | null;
  predictionBreakdown: Record<string, number>;
  lastReading: string | null;
  store: {
    mode: "memory" | "postgres";
    ready: boolean;
    configured: boolean;
    error: string | null;
  };
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

function buildUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.error || data.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export function loginAdmin(email: string, password: string): Promise<AdminLoginResponse> {
  return request<AdminLoginResponse>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getAdminSession(token: string): Promise<AdminSessionResponse> {
  return request<AdminSessionResponse>("/api/admin/session", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function logoutAdmin(token: string | null): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/api/admin/logout", {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
}

export function getAdminHistory(token: string, limit = 50): Promise<AdminWeatherRecord[]> {
  return request<AdminWeatherRecord[]>(`/api/admin/history?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getAdminStats(token: string): Promise<AdminWeatherStats> {
  return request<AdminWeatherStats>("/api/admin/stats", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
