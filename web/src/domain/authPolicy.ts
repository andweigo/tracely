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

export interface PasswordRuleEvaluation {
  readonly lengthValid: boolean;
  readonly hasUppercase: boolean;
  readonly hasLowercase: boolean;
  readonly hasDigit: boolean;
  readonly hasSymbol: boolean;
  readonly noEdgeWhitespace: boolean;
  readonly noUnsafeChars: boolean;
  readonly noWeakPattern: boolean;
  readonly matchedWeakPhrase: string | null;
  readonly leaksPersonalHint: boolean;
  readonly allSatisfied: boolean;
}

const FULL_NAME_PATTERN = /^[A-Za-z\u00C0-\u024F .'-]+$/;
const EMPLOYEE_ID_PATTERN = /^[A-Z0-9-]+$/;
const OFFICE_CODE_PATTERN = /^[A-Z0-9_-]+$/;
const POSITION_PATTERN = /^[A-Za-z0-9\u00C0-\u024F ()'.,/&-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEAK_FRAGMENTS = ['password', '123456', 'qwerty', 'admin123', 'letmein', 'tracely123'];

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

function formatMissingList(items: ReadonlyArray<string>): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export class AuthInputPolicy {
  public static sanitizeSingleLine(raw: string): string {
    return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
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

  public static evaluatePasswordRules(
    password: string,
    excludedHints: ReadonlyArray<string> = [],
  ): PasswordRuleEvaluation {
    const lengthValid =
      password.length >= AUTH_INPUT_LIMITS.passwordMin &&
      password.length <= AUTH_INPUT_LIMITS.passwordMax;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
    const noEdgeWhitespace = password === password.trim() && password.length > 0;
    const noUnsafeChars = !AuthInputPolicy.containsUnsafeControlOrMarkup(password);
    const lower = password.toLowerCase();
    const matchedWeakPhrase = WEAK_FRAGMENTS.find((frag) => lower.includes(frag)) ?? null;
    const leaksPersonalHint = excludedHints.some((hint) => {
      const cleanHint = hint.trim().toLowerCase();
      return cleanHint.length >= 4 && lower.includes(cleanHint);
    });
    const noWeakPattern = !matchedWeakPhrase && !leaksPersonalHint;

    return {
      lengthValid,
      hasUppercase,
      hasLowercase,
      hasDigit,
      hasSymbol,
      noEdgeWhitespace,
      noUnsafeChars,
      noWeakPattern,
      matchedWeakPhrase,
      leaksPersonalHint,
      allSatisfied:
        lengthValid &&
        hasUppercase &&
        hasLowercase &&
        hasDigit &&
        hasSymbol &&
        noEdgeWhitespace &&
        noUnsafeChars &&
        noWeakPattern,
    };
  }

  public static getPasswordError(
    password: string,
    label = 'Password',
    excludedHints: ReadonlyArray<string> = [],
  ): string | null {
    if (!password) {
      return `${label} is required.`;
    }
    if (password !== password.trim()) {
      return `${label} cannot start or end with spaces.`;
    }
    if (AuthInputPolicy.containsUnsafeControlOrMarkup(password)) {
      return `${label} cannot contain control characters or < > \` symbols.`;
    }
    if (password.length < AUTH_INPUT_LIMITS.passwordMin) {
      return `${label} is too short — use at least ${AUTH_INPUT_LIMITS.passwordMin} characters (currently ${password.length}).`;
    }
    if (password.length > AUTH_INPUT_LIMITS.passwordMax) {
      return `${label} is too long — use at most ${AUTH_INPUT_LIMITS.passwordMax} characters (currently ${password.length}).`;
    }

    const rules = AuthInputPolicy.evaluatePasswordRules(password, excludedHints);
    const missing: string[] = [];
    if (!rules.hasUppercase) missing.push('an uppercase letter (A–Z)');
    if (!rules.hasLowercase) missing.push('a lowercase letter (a–z)');
    if (!rules.hasDigit) missing.push('a number (0–9)');
    if (!rules.hasSymbol) missing.push('a symbol (e.g. !@#$%)');
    if (missing.length > 0) {
      return `${label} must include ${formatMissingList(missing)}.`;
    }

    if (rules.matchedWeakPhrase) {
      return `${label} cannot contain the common phrase "${rules.matchedWeakPhrase}".`;
    }
    if (rules.leaksPersonalHint) {
      return `${label} cannot contain your Employee ID or email.`;
    }
    return null;
  }

  public static getConfirmPasswordError(
    password: string,
    confirmPassword: string,
    label = 'Password',
  ): string | null {
    if (!confirmPassword) {
      return `Re-enter your ${label.toLowerCase()} to confirm.`;
    }
    if (password !== confirmPassword) {
      return `${label} confirmation does not match.`;
    }
    return null;
  }

  public static validateLogin(rawIdentifier: string, password: string): {
    identifier: string;
    password: string;
  } {
    const identifier = AuthInputPolicy.sanitizeSingleLine(rawIdentifier);
    if (!identifier || identifier.length > AUTH_INPUT_LIMITS.identifierMax) {
      throw new Error('Enter your Employee ID or official email.');
    }
    if (!password) {
      throw new Error('Enter your account password.');
    }
    return { identifier, password };
  }

  public static validateRegistration(input: RegistrationValidationInput) {
    const fullName = AuthInputPolicy.sanitizeSingleLine(input.fullName);
    const employeeId = AuthInputPolicy.sanitizeSingleLine(input.employeeId).toUpperCase();
    const email = AuthInputPolicy.sanitizeSingleLine(input.email).toLowerCase();
    const position = AuthInputPolicy.sanitizeSingleLine(input.position);
    const officeCode = AuthInputPolicy.sanitizeSingleLine(input.officeCode).toUpperCase();
    const customOfficeName = input.customOfficeName
      ? AuthInputPolicy.sanitizeSingleLine(input.customOfficeName)
      : undefined;

    if (
      fullName.length < AUTH_INPUT_LIMITS.fullNameMin ||
      fullName.length > AUTH_INPUT_LIMITS.fullNameMax ||
      !FULL_NAME_PATTERN.test(fullName)
    ) {
      throw new Error('Enter a valid full name (2–50 letters).');
    }
    if (
      employeeId.length < AUTH_INPUT_LIMITS.employeeIdMin ||
      employeeId.length > AUTH_INPUT_LIMITS.employeeIdMax ||
      !EMPLOYEE_ID_PATTERN.test(employeeId)
    ) {
      throw new Error('Employee ID must be 4–16 alphanumeric/hyphen characters.');
    }
    if (
      email.length < AUTH_INPUT_LIMITS.emailMin ||
      email.length > AUTH_INPUT_LIMITS.emailMax ||
      !EMAIL_PATTERN.test(email)
    ) {
      throw new Error('Enter a valid work email address (e.g. name@tracely.app).');
    }
    if (
      position.length < AUTH_INPUT_LIMITS.positionMin ||
      position.length > AUTH_INPUT_LIMITS.positionMax ||
      !POSITION_PATTERN.test(position)
    ) {
      throw new Error('Enter a valid position or designation.');
    }
    if (
      officeCode.length < AUTH_INPUT_LIMITS.officeCodeMin ||
      officeCode.length > AUTH_INPUT_LIMITS.officeCodeMax ||
      !OFFICE_CODE_PATTERN.test(officeCode)
    ) {
      throw new Error('Office code must be 2–12 uppercase letters/numbers.');
    }
    if (
      input.isCustomOffice &&
      (!customOfficeName ||
        customOfficeName.length < AUTH_INPUT_LIMITS.customOfficeNameMin ||
        customOfficeName.length > AUTH_INPUT_LIMITS.customOfficeNameMax)
    ) {
      throw new Error('Provide the full name of your unlisted office / unit.');
    }

    const emailLocalPart = email.split('@')[0] ?? '';
    const passwordError = AuthInputPolicy.getPasswordError(input.password, 'Password', [
      employeeId,
      emailLocalPart,
    ]);
    if (passwordError) {
      throw new Error(passwordError);
    }
    const confirmError = AuthInputPolicy.getConfirmPasswordError(
      input.password,
      input.confirmPassword,
      'Password',
    );
    if (confirmError) {
      throw new Error(confirmError);
    }

    return {
      fullName,
      employeeId,
      email,
      position,
      officeCode,
      customOfficeName,
    };
  }
}
