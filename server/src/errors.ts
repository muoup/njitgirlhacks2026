export class ApiError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 501 | 502 | 503 | 504,
    public code: string, message: string) {
    super(message);
  }
}
