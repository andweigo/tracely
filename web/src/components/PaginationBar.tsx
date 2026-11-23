import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginatedSlice<T> {
  readonly pageItems: ReadonlyArray<T>;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly safePage: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export function paginateList<T>(
  items: ReadonlyArray<T>,
  page: number,
  pageSize: number,
): PaginatedSlice<T> {
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * safeSize;
  const pageItems = items.slice(offset, offset + safeSize);
  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(offset + safeSize, totalItems);

  return {
    pageItems,
    totalItems,
    totalPages,
    safePage,
    startIndex,
    endIndex,
  };
}

interface PaginationBarProps {
  readonly totalItems: number;
  readonly page: number;
  readonly pageSize: number;
  readonly itemLabel: string;
  readonly onPageChange: (nextPage: number) => void;
  readonly testId?: string;
  readonly compact?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  totalItems,
  page,
  pageSize,
  itemLabel,
  onPageChange,
  testId,
  compact = false,
}) => {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * safeSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(safePage * safeSize, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = compact ? 3 : 5;
    const half = Math.floor(maxButtons / 2);
    const start = Math.max(1, safePage - half);
    const end = Math.min(totalPages, start + maxButtons - 1);
    for (let p = Math.max(1, end - (maxButtons - 1)); p <= end; p += 1) {
      pages.push(p);
    }
    return pages;
  }, [safePage, totalPages, compact]);

  return (
    <div
      className={`pagination-bar no-print${compact ? ' pagination-bar-compact' : ''}`}
      data-testid={testId}
    >
      <span className="pagination-summary tabular">
        {totalItems === 0
          ? `Showing 0 of 0 ${itemLabel} · Page 1 of 1`
          : `Showing ${startIndex}–${endIndex} of ${totalItems} ${itemLabel} · Page ${safePage} of ${totalPages}`}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-outline pagination-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        {pageNumbers.map((num) => (
          <button
            key={num}
            type="button"
            aria-current={num === safePage ? 'page' : undefined}
            className={`btn pagination-page-btn ${
              num === safePage ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => onPageChange(num)}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-outline pagination-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
