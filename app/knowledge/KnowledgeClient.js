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

  const isAdmin = session?.user?.role === 'Admin' || session?.user?.permissions?.includes('manage_knowledge');

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
           <h1> Knowledge Base</h1>
           <p>SOPs, Guides, and Internal Documentation.</p>
        </div>
        <div className="ui-static-af81cc4264" style={{display: 'flex'}}>
           <Link href="/knowledge/new" className="primary-btn" style={{ textDecoration: 'none' }}>+ Write Article</Link>
           {isAdmin && (
              <button className="secondary-btn" onClick={() => setShowCategoryModal(true)}>Manage Categories</button>
           )}
        </div>
      </header>

      <div className="knowledge-layout ui-static-944ed8f778" style={{display: 'flex'}}>
        
        {/* Left Sidebar - Categories */}
        <div className="knowledge-categories">
          <div className="bg-white-card ui-static-0553cdb32c" >
            <h3 className="ui-static-d79b9157e0" >Categories</h3>
            <ul className="ui-static-fc23bed47e" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
              <li 
                onClick={() => { setSearchQuery(''); fetchArticles(); }}
                className="hover-bg ui-static-f668e79162"
                style={{cursor: 'pointer', fontWeight: !selectedCategory && !searchQuery ? 'bold' : 'normal', color: !selectedCategory && !searchQuery ? 'var(--primary-color)' : 'var(--text-color)', background: !selectedCategory && !searchQuery ? 'var(--hover-bg)' : 'transparent'}}
              >
                 All Articles
              </li>
              {categories.map(cat => (
                <li 
                  key={cat.id}
                  onClick={() => { setSearchQuery(''); fetchArticles(cat.id); }}
                  className="hover-bg ui-static-f668e79162"
                  style={{cursor: 'pointer', fontWeight: selectedCategory === cat.id ? 'bold' : 'normal', color: selectedCategory === cat.id ? 'var(--primary-color)' : 'var(--text-color)', background: selectedCategory === cat.id ? 'var(--hover-bg)' : 'transparent', display: 'flex', justifyContent: 'space-between'}}
                >
                  <span>{cat.icon} {cat.name}</span>
                  <span className="ui-static-fc155e091a" style={{opacity: 0.6}}>{cat._count?.articles}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Content - Search & Article List */}
        <div className="knowledge-content">
          <form onSubmit={handleSearch} className="ui-static-d02daea45f" style={{display: 'flex'}}>
            <input 
               type="text" 
               placeholder="Search knowledge base (e.g. BGP Reset, Metro-E)..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="input-field ui-static-478acf0431"
               style={{flexGrow: 1}}
            />
            <button type="submit" className="primary-btn ui-static-2d6f137a15" >Search</button>
          </form>

          {isLoading ? (
            <div className="ui-static-282e36a01f" style={{textAlign: 'center'}}>Loading articles...</div>
          ) : articles.length === 0 ? (
            <div className="bg-light-stripe ui-static-805c42d770" style={{textAlign: 'center'}}>
               <div className="ui-static-917c0011b7" ></div>
               <h3 className="ui-static-ee96dc83fb" >No articles found</h3>
               <p className="ui-static-fade3489ef" >Try adjusting your search query or selecting a different category.</p>
            </div>
          ) : (
            <div className="ui-static-92254f43e7" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'}}>
              {articles.map(article => (
                <Link href={`/knowledge/${article.id}`} key={article.id} style={{ textDecoration: 'none' }}>
                  <div className="bg-white-card hover-lift ui-static-86832ef263" style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                    
                    <div className="ui-static-3e8220669e" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <span className="ui-static-1e8ecc5dda" >
                        {article.category?.icon} {article.category?.name}
                      </span>
                      {!article.isPublished && (
                        <span className="ui-static-12b8a6c2bb" >
                          Draft
                        </span>
                      )}
                    </div>

                    <h3 className="ui-static-64967a091c" >{article.title}</h3>
                    <p className="ui-static-5f31f84f9a" style={{flexGrow: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', whiteSpace: 'pre-wrap'}}>
                      {article.content.replace(/<[^>]*>?/gm, '').replace(/[#*`_]/g, '').trim() || '🖼️ Attached Document Details'}
                    </p>

                    <div className="ui-static-7a5abe318b" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div className="ui-static-30f523173e" style={{display: 'flex', alignItems: 'center'}}>
                         {article.author?.avatarUrl ? (
                            <img src={article.author.avatarUrl} alt="avatar" className="ui-static-30e89704d0" style={{width: '24px', height: '24px', objectFit: 'cover'}} />
                         ) : (
                            <div className="ui-static-835bb5c756" style={{width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                              {article.author?.name?.charAt(0) || 'U'}
                            </div>
                         )}
                         <span className="ui-static-1d95690500" >{article.author?.name}</span>
                      </div>
                      <span className="ui-static-2748f1debd" >
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
        <div className="ui-static-a809d66476" style={{position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'}}>
          <div className="bg-white-card scale-in ui-static-239a0228f6" style={{width: '100%', maxWidth: '400px'}}>
            <h2 className="ui-static-1c88149a3f" >Add New Category</h2>
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
              <div className="ui-static-3e8220669e" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Emoji Icon (Max 2 chars)</label>
                <input type="text" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} required maxLength={2} className="input-field ui-static-5bf46d551d" style={{width: '100%', textAlign: 'center'}} />
              </div>
              <div className="ui-static-a5e927dc66" >
                <label className="ui-static-abe0244be5" style={{display: 'block'}}>Category Name</label>
                <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} required placeholder="e.g. Server Maintenance" className="input-field ui-static-b52e2fe28a" style={{width: '100%'}} />
              </div>
              <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'flex-end'}}>
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
