const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  return `${BASE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
