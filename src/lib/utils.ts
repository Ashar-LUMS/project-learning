import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
/**
 * Development-only logging utility
 * Logs are stripped in production builds
 */
export const devLog = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (import.meta.env.DEV) console.warn(...args);
  },
  error: (...args: any[]) => {
    // Errors always logged
    console.error(...args);
  },
};

/**
 * Show user-friendly error messages
 * @param error - The error object or message
 * @param fallbackMessage - Message to show if error message is unavailable
 */
export function formatErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return fallbackMessage;
}