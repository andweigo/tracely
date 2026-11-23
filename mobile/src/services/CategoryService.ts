import { DomainRuleError } from '../domain/base/DomainRuleError';
import { DocumentCategory } from '../domain/entities/DocumentCategory';
import type { IDocumentRepository } from '../repositories/contracts/IDocumentRepository';

export class CategoryService {
  private readonly _docRepo: IDocumentRepository;

  constructor(docRepo: IDocumentRepository) {
    this._docRepo = docRepo;
  }

  public async listCategories(): Promise<ReadonlyArray<DocumentCategory>> {
    return this._docRepo.listCategories();
  }

  public findSimilarWarnings(
    categories: ReadonlyArray<DocumentCategory>,
    candidateName: string,
  ): ReadonlyArray<DocumentCategory> {
    return DocumentCategory.findSimilar(categories, candidateName);
  }

  public async declareCategory(
    existing: ReadonlyArray<DocumentCategory>,
    name: string,
    code: string,
  ): Promise<DocumentCategory> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new DomainRuleError('EMPTY_CATEGORY_NAME', 'Category name is required.');
    }

    const exact = existing.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (exact) {
      throw new DomainRuleError(
        'DUPLICATE_CATEGORY',
        `Category "${exact.name}" already exists globally (declared by ${exact.declaredByOfficeCode}).`,
      );
    }

    return this._docRepo.declareCategory(cleanName, code.trim().toUpperCase());
  }
}
