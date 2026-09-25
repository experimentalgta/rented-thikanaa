/**
 * India Post Postal Pincode Service
 * Source: Postal Pincode API (public-apis directory)
 * Endpoint: https://api.postalpincode.in/pincode/{PINCODE}
 * 100% Free, No API key, CORS supported
 */

export interface PincodeInfo {
  pincode: string;
  district: string;
  state: string;
  postOffices: string[];
}

const pincodeCache = new Map<string, PincodeInfo>();

export async function lookupIndianPincode(
  pincodeStr: string,
  signal?: AbortSignal
): Promise<PincodeInfo | null> {
  const cleanPin = pincodeStr.trim().replace(/\D/g, '');
  if (cleanPin.length !== 6 || !/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return null;
  }

  if (pincodeCache.has(cleanPin)) {
    return pincodeCache.get(cleanPin)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const url = `https://api.postalpincode.in/pincode/${cleanPin}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || data[0].Status !== 'Success') {
      return null;
    }

    const rawPostOffices: Array<{ Name?: string; District?: string; State?: string }> =
      data[0].PostOffice || [];

    if (rawPostOffices.length === 0) return null;

    const district = rawPostOffices[0].District || '';
    const state = rawPostOffices[0].State || '';

    // Extract unique post office names
    const namesSet = new Set<string>();
    for (const po of rawPostOffices) {
      if (po.Name) {
        namesSet.add(po.Name.replace(/\s+(S\.O|B\.O|H\.O)$/i, '').trim());
      }
    }

    const info: PincodeInfo = {
      pincode: cleanPin,
      district,
      state,
      postOffices: Array.from(namesSet).slice(0, 8),
    };

    pincodeCache.set(cleanPin, info);
    return info;
  } catch {
    // Return null on network or timeout failure without breaking user form
    return null;
  }
}
