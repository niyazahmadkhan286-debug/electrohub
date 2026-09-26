import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json({ success: true, data }, typeof init === 'number' ? { status: init } : init)
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * Maps a Postgres/PostgREST error to a safe HTTP response - never leaks
 * the raw database error (stack traces, connection strings, internal
 * detail) to the client, just a human-readable message and correct
 * status code.
 */
export function fromDbError(error: { code?: string; message: string } | null): NextResponse {
  if (!error) return fail('Unknown database error', 500)

  // RLS denied the operation (not authenticated / not permitted).
  if (error.code === '42501' || error.code === 'PGRST301') {
    return fail('You must be signed in to do that', 401)
  }
  // Check constraint violation (e.g. negative price/stock, bad category).
  if (error.code === '23514') {
    return fail('Invalid product data', 422)
  }
  // Not-null violation.
  if (error.code === '23502') {
    return fail('Missing required field', 422)
  }
  // Row not found for a single-row query.
  if (error.code === 'PGRST116') {
    return fail('Product not found', 404)
  }

  console.error('Database error:', error)
  return fail('Something went wrong on our end. Please try again.', 500)
}
