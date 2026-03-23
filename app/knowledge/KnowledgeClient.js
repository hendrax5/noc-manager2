'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function KnowledgeClient({ session, initialCategories }) {
  const [categories, setCategories] = useState(initialCategories || []);
  const [articles, setArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  const isAdmin = session?.user?.role === 'Admin' || session?.user?.role === 'Manager';

  const fetchArticles = async (categoryId = null, query = '') => {
    setIsLoading(true);
    try {
      let url = '/api/knowledge/articles?';
      if (categoryId) url += `categoryId=${categoryId}&`;
      if (query) url += `q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      setArticles(data || []);
      setSelectedCategory(categoryId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load: fetch all articles or based on first category
  useEffect(() => {
    fetchArticles();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchArticles(null, searchQuery);
    setSelectedCategory(null);
  };

  return (
    <main className="container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
           <h1>🧠 Knowledge Base</h1>
           <p>SOPs, Guides, and Internal Documentation.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <Link href="/knowledge/new" className="primary-btn" style={{ textDecoration: 'none' }}>+ Write Article</Link>
           {isAdmin && (
              <button className="secondary-btn" onClick={() => setShowCategoryModal(true)}>Manage Categories</button>
           )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Left Sidebar - Categories */}
        <div style={{ width: '250px', flexShrink: 0 }}>
          <div className="bg-white-card" style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-color)' }}>Categories</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li 
                onClick={() => { setSearchQuery(''); fetchArticles(); }}
                className="hover-bg"
                style={{ cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: !selectedCategory && !searchQuery ? 'bold' : 'normal', color: !selectedCategory && !searchQuery ? 'var(--primary-color)' : 'var(--text-color)', background: !selectedCategory && !searchQuery ? 'var(--hover-bg)' : 'transparent' }}
              >
                🏠 All Articles
              </li>
              {categories.map(cat => (
                <li 
                  key={cat.id}
                  onClick={() => { setSearchQuery(''); fetchArticles(cat.id); }}
                  className="hover-bg"
                  style={{ cursor: 'pointer', padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: selectedCategory === cat.id ? 'bold' : 'normal', color: selectedCategory === cat.id ? 'var(--primary-color)' : 'var(--text-color)', background: selectedCategory === cat.id ? 'var(--hover-bg)' : 'transparent', display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{cat.icon} {cat.name}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{cat._count?.articles}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Content - Search & Article List */}
        <div style={{ flexGrow: 1 }}>
          <form onSubmit={handleSearch} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
            <input 
               type="text" 
               placeholder="Search knowledge base (e.g. BGP Reset, Metro-E)..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="input-field"
               style={{ flexGrow: 1, padding: '1rem', fontSize: '1.1rem', borderRadius: '12px' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '0 2rem' }}>Search</button>
          </form>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-color)' }}>Loading articles...</div>
          ) : articles.length === 0 ? (
            <div className="bg-light-stripe" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
               <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
               <h3 style={{ margin: 0, color: 'var(--heading-color)' }}>No articles found</h3>
               <p style={{ color: 'var(--text-color)' }}>Try adjusting your search query or selecting a different category.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {articles.map(article => (
                <Link href={`/knowledge/${article.id}`} key={article.id} style={{ textDecoration: 'none' }}>
                  <div className="bg-white-card hover-lift" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.8rem', background: 'var(--hover-bg)', padding: '0.2rem 0.6rem', borderRadius: '4px', color: 'var(--text-color)', fontWeight: 'bold' }}>
                        {article.category?.icon} {article.category?.name}
                      </span>
                      {!article.isPublished && (
                        <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                          Draft
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--heading-color)', fontSize: '1.2rem', lineHeight: 1.4 }}>{article.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '0.9rem', flexGrow: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {article.content.replace(/<[^>]*>?/gm, '').replace(/[#*`_]/g, '').trim() || '🖼️ Attached Document Details'}
                    </p>

                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         {article.author?.avatarUrl ? (
                            <img src={article.author.avatarUrl} alt="avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                         ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                              {article.author?.name?.charAt(0) || 'U'}
                            </div>
                         )}
                         <span style={{ fontSize: '0.85rem', color: 'var(--text-color)' }}>{article.author?.name}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-color)' }}>
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="bg-white-card scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--heading-color)' }}>Add New Category</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmittingCat(true);
              try {
                const res = await fetch('/api/knowledge/categories', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ name: newCatName, description: '', icon: newCatIcon })
                });
                if (res.ok) {
                   const newCat = await res.json();
                   setCategories(prev => [...prev, newCat].sort((a,b) => a.name.localeCompare(b.name)));
                   setShowCategoryModal(false);
                   setNewCatName('');
                   setNewCatIcon('📁');
                } else {
                   const err = await res.json();
                   alert(err.error || 'Failed to create category');
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsSubmittingCat(false);
              }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Emoji Icon (Max 2 chars)</label>
                <input type="text" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} required maxLength={2} className="input-field" style={{ width: '100%', padding: '0.8rem', fontSize: '1.2rem', textAlign: 'center' }} />
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: 'var(--heading-color)', fontSize: '0.9rem' }}>Category Name</label>
                <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} required placeholder="e.g. Server Maintenance" className="input-field" style={{ width: '100%', padding: '0.8rem' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="secondary-btn">Cancel</button>
                <button type="submit" disabled={isSubmittingCat} className="primary-btn">{isSubmittingCat ? 'Saving...' : 'Create Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
