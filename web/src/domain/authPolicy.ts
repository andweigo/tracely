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
  readonly noWeakPattern: boolean;
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

export class AuthInputPolicy {
  public static sanitizeSingleLine(raw: string): string {
    return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  public static evaluatePasswordRules(password: string): PasswordRuleEvaluation {
    const lengthValid =
      password.length >= AUTH_INPUT_LIMITS.passwordMin &&
      password.length <= AUTH_INPUT_LIMITS.passwordMax;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
    const noEdgeWhitespace = password === password.trim() && password.length > 0;
    const lower = password.toLowerCase();
    const noWeakPattern = !WEAK_FRAGMENTS.some((frag) => lower.includes(frag));

    return {
      lengthValid,
      hasUppercase,
      hasLowercase,
      hasDigit,
      hasSymbol,
      noEdgeWhitespace,
      noWeakPattern,
      allSatisfied:
        lengthValid &&
        hasUppercase &&
        hasLowercase &&
        hasDigit &&
        hasSymbol &&
        noEdgeWhitespace &&
        noWeakPattern,
    };
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

    const rules = AuthInputPolicy.evaluatePasswordRules(input.password);
    if (!rules.allSatisfied) {
      throw new Error(
        'Password must be 8–32 chars with uppercase, lowercase, number, and symbol.',
      );
    }
    if (input.password !== input.confirmPassword) {
      throw new Error('Password confirmation does not match.');
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
