import "server-only";

const API_BASE_URL = process.env.EVENT_LOG_API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EVENT_LOG_API_URL environment variable is not set");
  }

  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(
      response.status,
      `API ${response.status}: ${url.toString()}`,
    );
  }

  return response.json() as Promise<T>;
}
