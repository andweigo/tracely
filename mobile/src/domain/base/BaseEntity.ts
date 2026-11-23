import { DomainRuleError } from './DomainRuleError';

/**
 * Abstract base entity enforcing immutable UUID identity and invariant validation
 * across all domain models (Abstraction + Inheritance + Encapsulation).
 */
export abstract class BaseEntity {
  private readonly _id: string;
  private readonly _createdAt: string;

  protected constructor(id: string, createdAt?: string) {
    this._id = BaseEntity.requireNonEmpty(id, 'id');
    this._createdAt = createdAt ?? new Date().toISOString();
  }

  public get id(): string {
    return this._id;
  }

  public get createdAt(): string {
    return this._createdAt;
  }

  public equals(other: BaseEntity | null | undefined): boolean {
    if (!other) return false;
    return this._id === other._id;
  }

  protected static requireNonEmpty(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new DomainRuleError('VALIDATION_EMPTY_FIELD', `${fieldName} must not be empty.`);
    }
    return trimmed;
  }
}
