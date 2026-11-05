import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Puts the server's field errors next to the matching inputs. Returns the message to show for the
 * form as a whole (when the error is not about a specific field).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  /** field names the server prefixes (`address.city`) but the form does not (`city`) */
  prefix = '',
): string | null {
  if (error instanceof ApiError && error.details) {
    let placed = false;
    for (const [key, messages] of Object.entries(error.details)) {
      const field = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
      if (knownFields.includes(field)) {
        setError(field as Path<T>, { type: 'server', message: messages[0] ?? error.message });
        placed = true;
      }
    }
    if (placed) return null;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
