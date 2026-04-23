interface JsonFetchOptions {
  method?: "get" | "post";
  headers?: Record<string, string>;
  payload?: unknown;
}

export interface JsonFetchResult<T> {
  data: T;
  statusCode: number;
  responseText: string;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly responseText: string;

  constructor(message: string, statusCode: number, responseText: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.responseText = responseText;
  }
}

export function fetchJsonWithMeta<T>(url: string, options: JsonFetchOptions = {}): JsonFetchResult<T> {
  const response = UrlFetchApp.fetch(url, {
    method: options.method ?? "get",
    headers: options.headers ?? {},
    muteHttpExceptions: true,
    contentType: "application/json",
    payload: options.payload === undefined ? undefined : JSON.stringify(options.payload)
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new HttpError(`Request failed with status ${statusCode}`, statusCode, responseText);
  }

  return {
    data: JSON.parse(responseText) as T,
    statusCode,
    responseText
  };
}

export function fetchJson<T>(url: string, options: JsonFetchOptions = {}): T {
  return fetchJsonWithMeta<T>(url, options).data;
}
