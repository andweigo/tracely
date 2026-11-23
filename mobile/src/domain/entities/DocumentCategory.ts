import { BaseEntity } from '../base/BaseEntity';

export interface DocumentCategoryProps {
  id: string;
  name: string;
  code: string;
  declaredByOfficeCode: string;
  declaredByOfficeName: string;
  usageCount: number;
  isVerifiedGlobal?: boolean;
  createdAt?: string;
}

/**
 * Shared Office-Declared Document Category with similarity checking to prevent duplicates.
 */
export class DocumentCategory extends BaseEntity {
  private readonly _name: string;
  private readonly _code: string;
  private readonly _declaredByOfficeCode: string;
  private readonly _declaredByOfficeName: string;
  private _usageCount: number;
  private readonly _isVerifiedGlobal: boolean;

  constructor(props: DocumentCategoryProps) {
    super(props.id, props.createdAt);
    this._name = BaseEntity.requireNonEmpty(props.name, 'category name');
    this._code = BaseEntity.requireNonEmpty(props.code, 'category code').toUpperCase();
    this._declaredByOfficeCode = BaseEntity.requireNonEmpty(
      props.declaredByOfficeCode,
      'declaredByOfficeCode',
    );
    this._declaredByOfficeName = BaseEntity.requireNonEmpty(
      props.declaredByOfficeName,
      'declaredByOfficeName',
    );
    this._usageCount = Math.max(0, props.usageCount);
    this._isVerifiedGlobal = props.isVerifiedGlobal ?? true;
  }

  public get name(): string {
    return this._name;
  }
  public get code(): string {
    return this._code;
  }
  public get declaredByOfficeCode(): string {
    return this._declaredByOfficeCode;
  }
  public get declaredByOfficeName(): string {
    return this._declaredByOfficeName;
  }
  public get usageCount(): number {
    return this._usageCount;
  }
  public get isVerifiedGlobal(): boolean {
    return this._isVerifiedGlobal;
  }

  public incrementUsage(): void {
    this._usageCount += 1;
  }

  public similarityScoreTo(candidateName: string): number {
    const tokenize = (text: string): Set<string> =>
      new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2),
      );

    const a = tokenize(this._name);
    const b = tokenize(candidateName);
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const token of a) {
      if (b.has(token)) intersection += 1;
    }

    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  public static findSimilar(
    categories: ReadonlyArray<DocumentCategory>,
    candidateName: string,
    threshold = 0.35,
  ): DocumentCategory[] {
    const trimmed = candidateName.trim().toLowerCase();
    if (!trimmed) return [];

    return categories.filter((category) => {
      const lower = category.name.toLowerCase();
      if (lower.includes(trimmed) || trimmed.includes(lower)) return true;
      return category.similarityScoreTo(candidateName) >= threshold;
    });
  }
}
