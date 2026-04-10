import { customFetch } from "@/lib/api-client/custom-fetch";

export interface FarmerIdentity {
  id: number;
  phoneNumber: string;
  displayName: string | null;
  villageName: string | null;
}

export interface FarmerAuthStatus {
  configured: boolean;
  deliveryMode: "twilio" | "development" | null;
  usingDevelopmentOtp: boolean;
}

export interface RequestOtpResponse {
  requested: boolean;
  phoneNumber: string;
  expiresInSeconds: number;
  deliveryMode: "twilio" | "development";
  devCode?: string;
  auth: FarmerAuthStatus;
}

export interface VerifyOtpResponse {
  authenticated: true;
  token: string;
  farmer: FarmerIdentity;
  expiresAt: string;
  auth: FarmerAuthStatus;
}

export interface FarmerSessionResponse {
  authenticated: boolean;
  farmer?: FarmerIdentity;
  auth: FarmerAuthStatus;
}

export interface UpdateFarmerProfileResponse {
  updated: true;
  farmer: FarmerIdentity;
  auth: FarmerAuthStatus;
}

export async function requestFarmerOtp(input: {
  phoneNumber: string;
  displayName?: string;
}): Promise<RequestOtpResponse> {
  return customFetch<RequestOtpResponse>("/api/auth/request-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
    responseType: "json",
  });
}

export async function verifyFarmerOtp(input: {
  phoneNumber: string;
  code: string;
  displayName?: string;
}): Promise<VerifyOtpResponse> {
  return customFetch<VerifyOtpResponse>("/api/auth/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
    responseType: "json",
  });
}

export async function getFarmerSession(): Promise<FarmerSessionResponse> {
  return customFetch<FarmerSessionResponse>("/api/auth/session", {
    method: "GET",
    responseType: "json",
  });
}

export async function logoutFarmer(): Promise<{ success: boolean }> {
  return customFetch<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
    responseType: "json",
  });
}

export async function updateFarmerProfile(input: {
  displayName?: string;
  villageName?: string;
}): Promise<UpdateFarmerProfileResponse> {
  return customFetch<UpdateFarmerProfileResponse>("/api/auth/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
    responseType: "json",
  });
}
