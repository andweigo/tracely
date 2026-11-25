import React, { useMemo, useState } from 'react';
import { ArrowUpRight, FolderKanban, FolderOpen, MapPin, Plus, Search, X } from 'lucide-react';
import { Folder, FolderObjectItem } from '../components/Folder';
import { ModalDialog } from '../components/Modals';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { DocumentCategory, DocumentRecord } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { sortDocumentRecords } from '../utils/inboxFilter';

const CATEGORIES_PER_PAGE = 12;
const CATEGORY_FOLDER_COLORS = ['#0ea5e9', '#f59e0b', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];

interface CategorySheetItem extends FolderObjectItem {
  readonly docId?: string;
  readonly isOverflowSheet?: boolean;
  readonly categoryId?: string;
}

interface CategoryFolderBucket {
  readonly category: DocumentCategory;
  readonly color: string;
  readonly matchingDocs: ReadonlyArray<DocumentRecord>;
  readonly items: ReadonlyArray<CategorySheetItem>;
}

export const CategoriesPage: React.FC = () => {
  const {
    actor,
    categories,
    documents,
    folderAppearance,
    declareCategory,
    openDocument,
    openTrackForDocument,
    isBusy,
  } = useWebApp();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [docFilterQuery, setDocFilterQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (cat) => cat.name.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q),
    );
  }, [categories, query]);

  const buckets = useMemo<ReadonlyArray<CategoryFolderBucket>>(() => {
    return filtered.map((cat, idx) => {
      const matched = sortDocumentRecords(
        documents.filter(
          (doc) =>
            doc.categoryId === cat.id ||
            doc.categoryName.trim().toLowerCase() === cat.name.trim().toLowerCase(),
        ),
        'sla_urgent',
      );
      const total = matched.length;
      const hasOverflow = total > 6;
      const preview = hasOverflow ? matched.slice(0, 5) : matched.slice(0, 6);
      const overflowCount = hasOverflow ? total - 5 : 0;

      const items: CategorySheetItem[] = preview.map((doc) => ({
        id: doc.id,
        docId: doc.id,
        categoryId: cat.id,
        title: doc.isSealed ? 'Sealed Document' : doc.title,
        description: `${doc.currentOffice.name} · ${
          doc.copyFormat === 'hard_copy' ? 'Hard Copy' : 'Soft Copy'
        }`,
      }));

      if (hasOverflow) {
        items.push({
          id: `${cat.id}-overflow`,
          categoryId: cat.id,
          isOverflowSheet: true,
          title: `+${overflowCount.toLocaleString()} more`,
          description: 'Open folder to browse all',
        });
      }

      if (items.length === 0) {
        items.push({
          id: `${cat.id}-empty`,
          categoryId: cat.id,
          title: 'No documents yet',
          description: cat.name,
        });
      }

      return {
        category: cat,
        color: CATEGORY_FOLDER_COLORS[idx % CATEGORY_FOLDER_COLORS.length],
        matchingDocs: matched,
        items,
      };
    });
  }, [filtered, documents]);

  const pagedBuckets = useMemo(
    () => paginateList(buckets, page, CATEGORIES_PER_PAGE),
    [buckets, page],
  );

  const activeBucket = useMemo(
    () => buckets.find((b) => b.category.id === activeCategoryId) ?? null,
    [buckets, activeCategoryId],
  );

  const visibleCategoryDocs = useMemo(() => {
    if (!activeBucket) return [];
    const q = docFilterQuery.trim().toLowerCase();
    if (!q) return activeBucket.matchingDocs;
    return activeBucket.matchingDocs.filter((doc) => {
      const title = doc.isSealed ? 'sealed document' : doc.title.toLowerCase();
      return (
        title.includes(q) ||
        doc.trackingCode.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q) ||
        doc.currentOffice.code.toLowerCase().includes(q)
      );
    });
  }, [activeBucket, docFilterQuery]);

  const similarWarning = useMemo(() => {
    const clean = name.trim().toLowerCase();
    if (clean.length < 3) return [];
    return categories.filter((c) => c.name.toLowerCase().includes(clean));
  }, [categories, name]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="search-filter-row">
        <div className="search-box">
          <Search size={16} />
          <input
            className="search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search categories..."
          />
        </div>
        <button
          type="button"
          data-testid="web-categories-add-btn"
          className="btn btn-amber"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* Quick Action Bar when a document sheet is clicked inside a category folder */}
      {selectedDoc ? (
        <div
          data-testid="web-category-selected-doc"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedDoc.isSealed ? 'Sealed Document' : selectedDoc.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {selectedDoc.categoryName} · {selectedDoc.currentOffice.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
              onClick={() => openTrackForDocument(selectedDoc.trackingCode)}
            >
              <MapPin size={13} /> Track
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
              onClick={() => openDocument(selectedDoc.id)}
            >
              View <ArrowUpRight size={13} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
              onClick={() => setSelectedDoc(null)}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <FolderKanban size={22} />
          </div>
          <h4 className="empty-title">No Categories Yet</h4>
          <p className="empty-desc">Add a category to group documents across offices.</p>
        </div>
      ) : (
        <div
          data-testid="web-categories-folder-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(236px, 1fr))',
            gap: 36,
            padding: '32px 12px 16px',
            justifyItems: 'center',
          }}
        >
          {pagedBuckets.pageItems.map((bucket) => {
            const cat = bucket.category;
            const isOpen = activeCategoryId === cat.id;
            return (
              <div
                key={cat.id}
                data-testid={`web-category-folder-${cat.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Folder
                  label={`${cat.code} (${bucket.matchingDocs.length})`}
                  color={bucket.color}
                  mode={folderAppearance.mode}
                  variant={folderAppearance.variant}
                  layout={folderAppearance.layout}
                  size={0.86}
                  theme="light"
                  intro={false}
                  items={bucket.items}
                  onItemClick={(item) => {
                    if (item && typeof item === 'object') {
                      if ('isOverflowSheet' in item && item.isOverflowSheet) {
                        setActiveCategoryId(cat.id);
                        setDocFilterQuery('');
                        return;
                      }
                      if ('docId' in item && item.docId) {
                        const doc = documents.find((d) => d.id === item.docId) ?? null;
                        setSelectedDoc(doc);
                      }
                    }
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {cat.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {cat.code} · {bucket.matchingDocs.length}{' '}
                    {bucket.matchingDocs.length === 1 ? 'document' : 'documents'}
                  </div>
                  <button
                    type="button"
                    data-testid={`web-open-category-folder-${cat.id}`}
                    onClick={() => {
                      setActiveCategoryId(isOpen ? null : cat.id);
                      setDocFilterQuery('');
                    }}
                    style={{
                      marginTop: 5,
                      background: 'none',
                      border: 'none',
                      padding: '2px 6px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: isOpen ? '#0ea5e9' : 'var(--navy)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <FolderOpen size={13} />
                    {isOpen ? 'Close folder' : `Open folder (${bucket.matchingDocs.length})`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Category Matching Documents Panel */}
      {activeBucket ? (
        <div
          data-testid="web-category-docs-panel"
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeBucket.category.name} ({activeBucket.matchingDocs.length})
              </h4>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {activeBucket.category.code} · Added by {activeBucket.category.declaredByOfficeCode}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
              onClick={() => setActiveCategoryId(null)}
            >
              <X size={13} /> Close
            </button>
          </div>

          {activeBucket.matchingDocs.length > 0 ? (
            <div className="search-box" style={{ maxWidth: 340, minHeight: 36 }}>
              <Search size={14} />
              <input
                className="search-input"
                value={docFilterQuery}
                onChange={(e) => setDocFilterQuery(e.target.value)}
                placeholder={`Filter inside ${activeBucket.category.name}...`}
              />
            </div>
          ) : null}

          {visibleCategoryDocs.length === 0 ? (
            <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--text-muted)' }}>
              No documents in this category yet.
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {visibleCategoryDocs.map((doc) => (
                <div
                  key={doc.id}
                  data-testid={`web-cat-doc-row-${doc.id}`}
                  style={{
                    padding: '10px 4px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.isSealed ? 'Sealed Document' : doc.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {doc.currentOffice.name} ·{' '}
                      {doc.copyFormat === 'hard_copy' ? 'Hard Copy' : 'Soft Copy'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      data-testid={`web-cat-doc-track-${doc.id}`}
                      className="btn btn-soft"
                      style={{ minHeight: 32, padding: '4px 11px', fontSize: 12 }}
                      onClick={() => openTrackForDocument(doc.trackingCode)}
                    >
                      <MapPin size={13} /> Track
                    </button>
                    <button
                      type="button"
                      data-testid={`web-cat-doc-view-${doc.id}`}
                      className="btn btn-primary"
                      style={{ minHeight: 32, padding: '4px 11px', fontSize: 12 }}
                      onClick={() => openDocument(doc.id)}
                    >
                      View <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <PaginationBar
        totalItems={filtered.length}
        page={pagedBuckets.safePage}
        pageSize={CATEGORIES_PER_PAGE}
        itemLabel="categories"
        onPageChange={setPage}
        testId="web-categories-pagination"
      />

      <ModalDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Category"
        subtitle={`Added by ${actor?.office.code ?? 'HQ'}`}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || !code.trim()) return;
            await declareCategory(name.trim(), code.trim().toUpperCase());
            setName('');
            setCode('');
            setShowCreate(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="field-group">
            <label className="field-label" htmlFor="cat-name-input">
              Category Name
            </label>
            <input
              id="cat-name-input"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Purchase Request"
            />
            {similarWarning.length > 0 ? (
              <span style={{ fontSize: 11, color: 'var(--amber-text)' }}>
                Similar category exists: {similarWarning.map((s) => s.name).join(', ')}
              </span>
            ) : null}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="cat-code-input">
              Short Code
            </label>
            <input
              id="cat-code-input"
              className="input mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. PR"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || !code.trim() || isBusy}
            >
              Save Category
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
