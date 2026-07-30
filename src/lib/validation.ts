// ========================================================
// SuvarnaLoan ERP - Data Validation & Identity Suite
// Location: src/lib/validation.ts
// ========================================================

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Strong';
  isValid: boolean;
  errors: string[];
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

/**
 * 1A. Password Strength & Scoring
 */
export function passwordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      label: 'Weak',
      isValid: false,
      errors: ['Password cannot be empty'],
    };
  }

  const errors: string[] = [];
  let score = 0;

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasMinLength) errors.push('At least 8 characters');
  if (!hasUppercase) errors.push('At least one uppercase letter');
  if (!hasLowercase) errors.push('At least one lowercase letter');
  if (!hasNumber) errors.push('At least one number');

  if (hasMinLength) score += 1;
  if (hasMinLength && hasUppercase && hasLowercase) score += 1;
  if (hasMinLength && hasUppercase && hasLowercase && hasNumber) score += 1;
  if (hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial) score += 1;

  let label: 'Weak' | 'Fair' | 'Strong' = 'Weak';
  if (score >= 4) {
    label = 'Strong';
  } else if (score >= 2) {
    label = 'Fair';
  }

  const isValid = score >= 4 && errors.length === 0;

  return {
    score,
    label,
    isValid,
    errors: errors.length > 0 ? [`Password must have: ${errors.join(', ')}`] : [],
  };
}

/**
 * 1B. Email Validation
 */

/**
 * 1B. Phone Number Validation (Mandatory 10 Digits)
 */
export function validatePhone(phone: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(cleaned)) {
    return { isValid: false, error: 'Phone Number must be exactly 10 digits', cleaned };
  }
  return { isValid: true, cleaned };
}

/**
 * 1B. Emergency Phone Validation (Optional, but if provided must be 10 digits)
 */
export function validateEmergencyPhone(phone?: string): { isValid: boolean; error?: string; cleaned: string } {
  if (!phone || !phone.trim()) {
    return { isValid: true, cleaned: '' };
  }
  const cleaned = phone.replace(/\D/g, '');
  if (!/^\d{10}$/.test(cleaned)) {
    return { isValid: false, error: 'Emergency phone must be exactly 10 digits', cleaned };
  }
  return { isValid: true, cleaned };
}

/**
 * 2. Full Name / Owner Name Validation
 */
export function validateFullName(name: string, fieldLabel: string = 'Full Name'): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, error: `${fieldLabel} is required` };
  }
  if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    return { isValid: false, error: `${fieldLabel} must only contain letters and spaces` };
  }
  return { isValid: true };
}

/**
 * 2. Street Address Validation
 */
export function validateStreetAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || !address.trim()) {
    return { isValid: false, error: 'Street Address is required' };
  }
  return { isValid: true };
}

/**
 * 2. City / State / Country Validation
 */
export function validateGeoField(value: string, fieldName: string): { isValid: boolean; error?: string } {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  if (!/^[a-zA-Z\s]+$/.test(value.trim())) {
    return { isValid: false, error: `${fieldName} must only contain letters and spaces` };
  }
  return { isValid: true };
}

// ========================================================
// Official Indian UIDAI Verhoeff Checksum Matrices
// ========================================================
const verhoeffD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 1, 2, 3, 4],
  [6, 5, 9, 8, 7, 1, 0, 3, 2, 4],
  [7, 6, 5, 9, 8, 2, 1, 4, 3, 0],
  [8, 7, 6, 5, 9, 3, 2, 1, 4, 0],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const verhoeffP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 4, 9, 0],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates a 12-digit number against the UIDAI Verhoeff algorithm
 */
export function validateVerhoeffChecksum(num: string): boolean {
  let c = 0;
  const myArray = num.split('').map(Number).reverse();

  for (let i = 0; i < myArray.length; i++) {
    c = verhoeffD[c][verhoeffP[i % 8][myArray[i]]];
  }

  return c === 0;
}

/**
 * 3. Government Identity Verification - PAN Card (Income Tax Department Formation)
 * Format: 3 letters, 4th char entity type (P/C/H/F/A/T/B/L/J/G), 5th char surname initial, 4 digits, 1 check letter
 */
export function validatePanCard(pan: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (pan || '').trim().toUpperCase().replace(/[\s-]/g, '');

  if (!cleaned) {
    return { isValid: false, error: 'PAN Card number is required', cleaned: '' };
  }

  if (cleaned.length !== 10) {
    return {
      isValid: false,
      error: 'PAN Card must be exactly 10 characters (e.g. ABCDE1234F)',
      cleaned,
    };
  }

  // Official Income Tax PAN Formation:
  // 1-3: Alphabetic series (AAA to ZZZ)
  // 4: Status (P: Person/Individual, C: Company, H: HUF, F: Firm, A: AOP, T: Trust, B: BOI, L: Local Auth, J: Artificial Person, G: Govt)
  // 5: Initial of Last Name / Entity Name
  // 6-9: 4 sequential digits (0001-9999)
  // 10: Alphabetic check digit
  const panRegex = /^[A-Z]{3}[PCHAFABGJLT][A-Z]\d{4}[A-Z]$/;
  if (!panRegex.test(cleaned)) {
    return {
      isValid: false,
      error: 'Invalid PAN Card formation. Must follow Income Tax format: 5 letters (4th char valid entity P/C/H/F/A/T/B/L/J/G), 4 digits, 1 letter (e.g. ABCDE1234F)',
      cleaned,
    };
  }

  return { isValid: true, cleaned };
}

/**
 * 3. Government Identity Verification - Aadhaar Card (12 Digits Standard Format)
 */
export function validateAadhaar(aadhaar: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (aadhaar || '').replace(/[\s-]/g, '');

  if (!cleaned) {
    return { isValid: false, error: 'Aadhaar Card number is required', cleaned: '' };
  }

  if (!/^\d{12}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Aadhaar Card must be exactly 12 digits (e.g. 2345 6789 0123)',
      cleaned,
    };
  }

  if (cleaned.startsWith('0') || cleaned.startsWith('1')) {
    return {
      isValid: false,
      error: 'Invalid Aadhaar Card number: Aadhaar numbers issued by UIDAI cannot start with 0 or 1',
      cleaned,
    };
  }

  return { isValid: true, cleaned };
}

/**
 * 3. Government Identity Verification - Passport
 */
export function validatePassport(passport: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (passport || '').trim().toUpperCase().replace(/[\s-]/g, '');
  const pattern1 = /^[A-Z]{1}[0-9]{7}$/;
  const pattern2 = /^[A-Z]{2}[0-9]{6}$/;

  if (!pattern1.test(cleaned) && !pattern2.test(cleaned)) {
    return {
      isValid: false,
      error: 'Passport must be 8 characters: 1 letter and 7 digits (e.g. K1234567) or 2 letters and 6 digits (e.g. AB123456)',
      cleaned,
    };
  }
  return { isValid: true, cleaned };
}

/**
 * 3. Government Identity Verification - Driving License (DL)
 */
export function validateDrivingLicense(dl: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (dl || '').trim().toUpperCase().replace(/[\s-]/g, '');
  // Format: 2 letters state + 2 digits RTO + 4 digits year + 7 digits number = 15 chars
  if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Driving Licence must be a valid 15-character Indian DL: e.g. MH-0420150034761',
      cleaned,
    };
  }
  return { isValid: true, cleaned };
}

/**
 * 3. Government Identity Verification - Voter ID (EPIC Card)
 */
export function validateVoterId(voterId: string): { isValid: boolean; error?: string; cleaned: string } {
  const cleaned = (voterId || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z]{3}[0-9]{7}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Voter ID must be 10 characters: 3 uppercase letters followed by 7 digits (e.g. YCV0164822)',
      cleaned,
    };
  }
  return { isValid: true, cleaned };
}

/**
 * 3. ID Document Upload & Image File Validation
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  if (!file || !file.type.startsWith('image/')) {
    return { isValid: false, error: 'Only image files are allowed' };
  }
  return { isValid: true };
}

/**
 * Client-Side Canvas WebP Image Compression
 */
export async function compressImageToWebP(file: File, maxWidth: number = 800, quality: number = 0.35): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Only image files are allowed'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
