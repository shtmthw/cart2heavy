import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and resolves Tailwind conflicts (`cn('p-2', cond && 'p-4')` -> `p-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

export const pluralize = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
