import React, { useMemo, useState } from 'react';
import { FolderKanban, Globe2, Plus, Search } from 'lucide-react';
import { useWebApp } from '../state/WebAppContext';
import { ModalDialog } from '../components/Modals';
import { paginateList, PaginationBar } from '../components/PaginationBar';

const CATEGORIES_PER_PAGE = 12;

export const CategoriesPage: React.FC = () => {
  const { actor, categories, declareCategory, isBusy } = useWebApp();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (cat) => cat.name.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q),
    );
  }, [categories, query]);

  const pagedCategories = useMemo(
    () => paginateList(filtered, page, CATEGORIES_PER_PAGE),
    [filtered, page],
  );

  const similarWarning = useMemo(() => {
    const clean = name.trim().toLowerCase();
    if (clean.length < 3) return [];
    return categories.filter((c) => c.name.toLowerCase().includes(clean));
  }, [categories, name]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
            placeholder="Search shared document types"
          />
        </div>
        <button type="button" className="btn btn-amber" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Declare Shared Category
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <FolderKanban size={22} />
          </div>
          <h4 className="empty-title">Shared Document Categories</h4>
          <p className="empty-desc">
            Declare a category once to make it globally selectable across all offices.
          </p>
        </div>
      ) : (
        <div className="category-grid">
          {pagedCategories.pageItems.map((cat) => (
            <div key={cat.id} className="card" style={{ gap: 6, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono doc-tracking-code">{cat.code}</span>
                {cat.isGlobal ? (
                  <span className="pill pill-emerald">
                    <Globe2 size={11} /> Global
                  </span>
                ) : null}
              </div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{cat.name}</h4>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Declared by {cat.declaredByOfficeCode}
              </span>
            </div>
          ))}
        </div>
      )}

      <PaginationBar
        totalItems={filtered.length}
        page={pagedCategories.safePage}
        pageSize={CATEGORIES_PER_PAGE}
        itemLabel="categories"
        onPageChange={setPage}
        testId="web-categories-pagination"
      />

      <ModalDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Declare Shared Category"
        subtitle={`Declared by ${actor?.office.code ?? 'HQ'} · Globally selectable once saved`}
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
