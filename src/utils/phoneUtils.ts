/**
 * Utilities for validating, formatting, and generating contact links (Call & WhatsApp)
 * specifically optimized for Indian mobile numbers (+91).
 */

export interface FormattedPhoneResult {
  raw: string;
  clean10Digit: string;
  formattedDisplay: string;
  telUrl: string;
  whatsappUrl: string;
  isValid: boolean;
}

/**
 * Strips all non-digit characters from an input phone string and returns
 * the canonical 10-digit Indian phone number if valid.
 */
export function sanitizeIndianPhoneNumber(input?: string | null): string | null {
  if (!input) return null;

  // Extract only digits
  let digits = input.replace(/\D/g, '');

  // Strip international prefix +91 or 91 if 12 digits
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // Strip leading 0 if 11 digits
  else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  // If more than 10 digits, take the trailing 10 digits
  else if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  // An Indian mobile number must be exactly 10 digits and start with 6, 7, 8, or 9
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

/**
 * Validates whether an input string is a valid 10-digit Indian mobile number.
 */
export function isValidIndianPhoneNumber(input?: string | null): boolean {
  return sanitizeIndianPhoneNumber(input) !== null;
}

/**
 * Formats an Indian phone number and generates direct Call and WhatsApp action URLs.
 */
export function getPhoneContactDetails(
  phone?: string | null,
  contextTitle?: string
): FormattedPhoneResult | null {
  const clean10Digit = sanitizeIndianPhoneNumber(phone);
  if (!clean10Digit) return null;

  const formattedDisplay = `+91 ${clean10Digit.slice(0, 5)} ${clean10Digit.slice(5)}`;
  const telUrl = `tel:+91${clean10Digit}`;

  const messageText = contextTitle
    ? `Hi, I saw your listing "${contextTitle}" on Rented Thikanaa and would like more details.`
    : `Hi, I saw your listing on Rented Thikanaa and would like more details.`;

  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = `https://wa.me/91${clean10Digit}?text=${encodedText}`;

  return {
    raw: phone || '',
    clean10Digit,
    formattedDisplay,
    telUrl,
    whatsappUrl,
    isValid: true,
  };
}
