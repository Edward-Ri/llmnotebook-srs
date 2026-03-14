import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch, type ErrorType, type BodyType } from "./custom-fetch";

type AuthUser = { id: string; email: string };

type LoginRequest = {
  email: string;
  password: string;
};

type RegisterRequest = {
  email: string;
  password: string;
};

type AuthResponse = { user: AuthUser };

export const login = async (
  loginRequest: LoginRequest,
  options?: RequestInit,
): Promise<AuthResponse> => {
  return customFetch<AuthResponse>("/api/auth/login", {
    ...options,
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(loginRequest),
  });
};

export const register = async (
  registerRequest: RegisterRequest,
  options?: RequestInit,
): Promise<AuthResponse> => {
  return customFetch<AuthResponse>("/api/auth/register", {
    ...options,
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(registerRequest),
  });
};

export function useLogin(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof login>>,
      ErrorType<unknown>,
      { data: BodyType<LoginRequest> }
    >;
    request?: RequestInit;
  },
) {
  const mutationOptions = options?.mutation;
  return useMutation({
    mutationFn: ({ data }) => login(data, options?.request),
    ...mutationOptions,
  });
}

export function useRegister(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof register>>,
      ErrorType<unknown>,
      { data: BodyType<RegisterRequest> }
    >;
    request?: RequestInit;
  },
) {
  const mutationOptions = options?.mutation;
  return useMutation({
    mutationFn: ({ data }) => register(data, options?.request),
    ...mutationOptions,
  });
}
