export function getTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

export function withTimezoneHeaders(headers?: HeadersInit): HeadersInit {
  return {
    ...headers,
    "x-tz-offset-minutes": String(getTimezoneOffsetMinutes()),
  };
}
