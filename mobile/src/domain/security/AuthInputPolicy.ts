import { DomainRuleError } from '../base/DomainRuleError';

export const AUTH_INPUT_LIMITS = {
  fullNameMin: 2,
  fullNameMax: 50,
  employeeIdMin: 4,
  employeeIdMax: 16,
  emailMin: 6,
  emailMax: 64,
  positionMin: 2,
  positionMax: 50,
  officeCodeMin: 2,
  officeCodeMax: 12,
  customOfficeNameMin: 3,
  customOfficeNameMax: 50,
  identifierMax: 64,
  passwordMin: 8,
  passwordMax: 32,
} as const;

export interface RegistrationValidationInput {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeCode: string;
  readonly isCustomOffice?: boolean;
  readonly customOfficeName?: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface SanitizedRegistrationData {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeCode: string;
  readonly customOfficeName?: string;
}

export interface PasswordRuleEvaluation {
  readonly lengthValid: boolean;
  readonly hasUppercase: boolean;
  readonly hasLowercase: boolean;
  readonly hasDigit: boolean;
  readonly hasSymbol: boolean;
  readonly noEdgeWhitespace: boolean;
  readonly noWeakPattern: boolean;
  readonly allSatisfied: boolean;
}

const FULL_NAME_PATTERN = /^[A-Za-z\u00C0-\u024F .'-]+$/;
const EMPLOYEE_ID_PATTERN = /^[A-Z0-9-]+$/;
const OFFICE_CODE_PATTERN = /^[A-Z0-9_-]+$/;
const POSITION_PATTERN = /^[A-Za-z0-9\u00C0-\u024F ()'.,/&-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEAK_FRAGMENTS = ['password', '123456', 'qwerty', 'admin123', 'letmein', 'tracely123'];

/**
 * Enforces strict authentication input bounds, character allowlists, and password
 * strength rules to prevent credential-stuffing, injection, and long-password DoS.
 */
export class AuthInputPolicy {
  public static sanitizeSingleLine(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
  }

  public static containsUnsafeControlOrMarkup(value: string): boolean {
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code < 32 || code === 127 || code === 60 || code === 62 || code === 96) {
        return true;
      }
    }
    return false;
  }

  public static validateLoginCredentials(
    rawIdentifier: string,
    password: string,
  ): { readonly identifier: string; readonly password: string } {
    const identifier = AuthInputPolicy.sanitizeSingleLine(rawIdentifier);
    if (!identifier || !password) {
      throw new DomainRuleError(
        'MISSING_CREDENTIALS',
        'Employee ID / email and password are required.',
      );
    }
    if (
      identifier.length > AUTH_INPUT_LIMITS.identifierMax ||
      AuthInputPolicy.containsUnsafeControlOrMarkup(identifier)
    ) {
      throw new DomainRuleError(
        'INVALID_IDENTIFIER',
        `Employee ID or email must be ${AUTH_INPUT_LIMITS.identifierMax} characters or fewer without unsafe symbols.`,
      );
    }
    if (
      password.length > AUTH_INPUT_LIMITS.passwordMax ||
      AuthInputPolicy.containsUnsafeControlOrMarkup(password)
    ) {
      throw new DomainRuleError(
        'INVALID_PASSWORD_LENGTH',
        `Password cannot exceed ${AUTH_INPUT_LIMITS.passwordMax} characters.`,
      );
    }
    return { identifier, password };
  }

  public static evaluatePassword(
    password: string,
    excludedHints: ReadonlyArray<string> = [],
  ): PasswordRuleEvaluation {
    const lengthValid =
      password.length >= AUTH_INPUT_LIMITS.passwordMin &&
      password.length <= AUTH_INPUT_LIMITS.passwordMax;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
    const noEdgeWhitespace = password === password.trim();

    const lower = password.toLowerCase();
    const hasWeakWord = WEAK_FRAGMENTS.some((frag) => lower.includes(frag));
    const leaksPersonalHint = excludedHints.some((hint) => {
      const cleanHint = hint.trim().toLowerCase();
      return cleanHint.length >= 4 && lower.includes(cleanHint);
    });
    const noWeakPattern = !hasWeakWord && !leaksPersonalHint;

    const allSatisfied =
      lengthValid &&
      hasUppercase &&
      hasLowercase &&
      hasDigit &&
      hasSymbol &&
      noEdgeWhitespace &&
      noWeakPattern &&
      !AuthInputPolicy.containsUnsafeControlOrMarkup(password);

    return {
      lengthValid,
      hasUppercase,
      hasLowercase,
      hasDigit,
      hasSymbol,
      noEdgeWhitespace,
      noWeakPattern,
      allSatisfied,
    };
  }

  public static assertStrongPassword(
    password: string,
    confirmPassword: string,
    label: string,
    excludedHints: ReadonlyArray<string> = [],
  ): void {
    if (!password) {
      throw new DomainRuleError('EMPTY_PASSWORD', `${label} is required.`);
    }
    if (password.length < AUTH_INPUT_LIMITS.passwordMin) {
      throw new DomainRuleError(
        'WEAK_PASSWORD',
        `${label} must be at least ${AUTH_INPUT_LIMITS.passwordMin} characters long.`,
      );
    }
    if (password.length > AUTH_INPUT_LIMITS.passwordMax) {
      throw new DomainRuleError(
        'PASSWORD_TOO_LONG',
        `${label} must not exceed ${AUTH_INPUT_LIMITS.passwordMax} characters.`,
      );
    }
    if (AuthInputPolicy.containsUnsafeControlOrMarkup(password) || password !== password.trim()) {
      throw new DomainRuleError(
        'INVALID_PASSWORD_FORMAT',
        `${label} cannot start/end with spaces or contain control symbols.`,
      );
    }

    const evaluation = AuthInputPolicy.evaluatePassword(password, excludedHints);
    const missing: string[] = [];
    if (!evaluation.hasUppercase) missing.push('an uppercase letter (A–Z)');
    if (!evaluation.hasLowercase) missing.push('a lowercase letter (a–z)');
    if (!evaluation.hasDigit) missing.push('a number (0–9)');
    if (!evaluation.hasSymbol) missing.push('a symbol (e.g. !@#$%)');
    if (missing.length > 0) {
      const formatted =
        missing.length === 1
          ? missing[0]
          : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
      throw new DomainRuleError('WEAK_PASSWORD', `${label} must include ${formatted}.`);
    }
    if (!evaluation.noWeakPattern) {
      const lower = password.toLowerCase();
      const matchedWeak = WEAK_FRAGMENTS.find((frag) => lower.includes(frag));
      throw new DomainRuleError(
        'WEAK_PASSWORD',
        matchedWeak
          ? `${label} cannot contain the common phrase "${matchedWeak}".`
          : `${label} cannot contain your Employee ID or email.`,
      );
    }
    if (!confirmPassword) {
      throw new DomainRuleError(
        'PASSWORD_MISMATCH',
        `Re-enter your ${label.toLowerCase()} to confirm.`,
      );
    }
    if (password !== confirmPassword) {
      throw new DomainRuleError('PASSWORD_MISMATCH', `${label} confirmation does not match.`);
    }
  }

  public static validateRegistration(
    input: RegistrationValidationInput,
  ): SanitizedRegistrationData {
    const fullName = AuthInputPolicy.sanitizeSingleLine(input.fullName);
    const employeeId = AuthInputPolicy.sanitizeSingleLine(input.employeeId).toUpperCase();
    const email = AuthInputPolicy.sanitizeSingleLine(input.email).toLowerCase();
    const position = AuthInputPolicy.sanitizeSingleLine(input.position);
    const officeCode = AuthInputPolicy.sanitizeSingleLine(input.officeCode).toUpperCase();
    const customOfficeName = input.customOfficeName
      ? AuthInputPolicy.sanitizeSingleLine(input.customOfficeName)
      : '';

    if (!fullName || !employeeId || !email || !position || !officeCode) {
      throw new DomainRuleError(
        'MISSING_REGISTRATION_FIELDS',
        'Complete all required registration fields.',
      );
    }

    AuthInputPolicy.assertLengthRange(
      fullName,
      AUTH_INPUT_LIMITS.fullNameMin,
      AUTH_INPUT_LIMITS.fullNameMax,
      'Full Name',
      'INVALID_FULL_NAME',
    );
    if (AuthInputPolicy.containsUnsafeControlOrMarkup(fullName) || !FULL_NAME_PATTERN.test(fullName)) {
      throw new DomainRuleError(
        'INVALID_FULL_NAME',
        'Full Name may only contain letters, spaces, periods, apostrophes, and hyphens.',
      );
    }

    AuthInputPolicy.assertLengthRange(
      employeeId,
      AUTH_INPUT_LIMITS.employeeIdMin,
      AUTH_INPUT_LIMITS.employeeIdMax,
      'Employee ID',
      'INVALID_EMPLOYEE_ID',
    );
    if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
      throw new DomainRuleError(
        'INVALID_EMPLOYEE_ID',
        'Employee ID may only contain letters, numbers, and hyphens.',
      );
    }

    AuthInputPolicy.assertLengthRange(
      email,
      AUTH_INPUT_LIMITS.emailMin,
      AUTH_INPUT_LIMITS.emailMax,
      'Official Email',
      'INVALID_EMAIL',
    );
    if (AuthInputPolicy.containsUnsafeControlOrMarkup(email) || !EMAIL_PATTERN.test(email)) {
      throw new DomainRuleError('INVALID_EMAIL', 'Enter a valid official email address.');
    }

    AuthInputPolicy.assertLengthRange(
      position,
      AUTH_INPUT_LIMITS.positionMin,
      AUTH_INPUT_LIMITS.positionMax,
      'Position / Designation',
      'INVALID_POSITION',
    );
    if (AuthInputPolicy.containsUnsafeControlOrMarkup(position) || !POSITION_PATTERN.test(position)) {
      throw new DomainRuleError(
        'INVALID_POSITION',
        'Position contains unsupported characters.',
      );
    }

    AuthInputPolicy.assertLengthRange(
      officeCode,
      AUTH_INPUT_LIMITS.officeCodeMin,
      AUTH_INPUT_LIMITS.officeCodeMax,
      'Office / Unit code',
      'INVALID_OFFICE_CODE',
    );
    if (!OFFICE_CODE_PATTERN.test(officeCode)) {
      throw new DomainRuleError(
        'INVALID_OFFICE_CODE',
        'Office / Unit code may only contain uppercase letters, numbers, hyphens, or underscores.',
      );
    }

    if (input.isCustomOffice || customOfficeName.length > 0) {
      if (!customOfficeName) {
        throw new DomainRuleError(
          'MISSING_CUSTOM_OFFICE_NAME',
          'Enter the full name of your unlisted Office / Unit.',
        );
      }
      AuthInputPolicy.assertLengthRange(
        customOfficeName,
        AUTH_INPUT_LIMITS.customOfficeNameMin,
        AUTH_INPUT_LIMITS.customOfficeNameMax,
        'Custom Office / Unit name',
        'INVALID_OFFICE_NAME',
      );
      if (
        AuthInputPolicy.containsUnsafeControlOrMarkup(customOfficeName) ||
        !POSITION_PATTERN.test(customOfficeName)
      ) {
        throw new DomainRuleError(
          'INVALID_OFFICE_NAME',
          'Custom Office / Unit name contains unsupported characters.',
        );
      }
    }

    const emailLocalPart = email.split('@')[0] ?? '';
    AuthInputPolicy.assertStrongPassword(
      input.password,
      input.confirmPassword,
      'Password',
      [employeeId, emailLocalPart],
    );

    return {
      fullName,
      employeeId,
      email,
      position,
      officeCode,
      ...(customOfficeName ? { customOfficeName } : {}),
    };
  }

  private static assertLengthRange(
    value: string,
    min: number,
    max: number,
    fieldLabel: string,
    code: string,
  ): void {
    if (value.length < min || value.length > max) {
      throw new DomainRuleError(
        code,
        `${fieldLabel} must be between ${min} and ${max} characters.`,
      );
    }
  }
}
