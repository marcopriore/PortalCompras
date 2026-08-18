import { NextResponse } from "next/server"

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  )
}
