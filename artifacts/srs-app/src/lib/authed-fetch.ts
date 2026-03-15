import { getTimezoneOffsetMinutes } from "./timezone";

export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);

  if (!headers.has("x-tz-offset-minutes")) {
    headers.set("x-tz-offset-minutes", String(getTimezoneOffsetMinutes()));
  }

  if (!headers.has("authorization") && typeof sessionStorage !== "undefined") {
    const token = sessionStorage.getItem("guest_token");
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
