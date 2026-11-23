/**
 * Typed domain exception raised when an entity invariant or security rule is violated.
 */
export class DomainRuleError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainRuleError';
    this.code = code;
  }
}
