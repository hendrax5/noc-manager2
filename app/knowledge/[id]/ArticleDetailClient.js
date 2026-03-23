'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArticleForm from '../new/ArticleForm';
import dynamic from 'next/dynamic';

const MDPreview = dynamic(() => import('@uiw/react-md-editor').then(mod => mod.default.Markdown), { ssr: false });

export default function ArticleDetailClient({ article, session, categories }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const canEdit = session.user.role === 'Admin' || session.user.role === 'Manager' || session.user.id === article.authorId;

  const handleDelete = async () => {
    if (!confirm('Are you certain you want to permanently delete this KB Article?')) return;
    try {
      const res = await fetch(`/api/knowledge/articles/${article.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/knowledge');
        router.refresh();
      } else {
        alert('Failed to delete');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isEditing) {
    return <ArticleForm categories={categories} session={session} existingArticle={article} />;
  }

  return (
    <main className="container" style={{ maxWidth: '900px' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/knowledge" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '1rem', display: 'inline-block' }}>← Back to Knowledge Base</Link>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', background: 'var(--hover-bg)', padding: '0.3rem 0.8rem', borderRadius: '4px', color: 'var(--text-color)', fontWeight: 'bold' }}>
            {article.category?.icon} {article.category?.name}
          </span>
          {!article.isPublished && (
            <span style={{ fontSize: '0.85rem', background: '#fef3c7', color: '#92400e', padding: '0.3rem 0.8rem', borderRadius: '4px', fontWeight: 'bold' }}>
              Draft (Not Public)
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 1.5rem 0', color: 'var(--heading-color)', lineHeight: 1.2 }}>{article.title}</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
             {article.author?.avatarUrl ? (
                <img src={article.author.avatarUrl} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
             ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                  {article.author?.name?.charAt(0) || 'U'}
                </div>
             )}
             <div>
               <div style={{ fontWeight: 'bold', color: 'var(--heading-color)', fontSize: '1.05rem' }}>{article.author?.name}</div>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-color)' }}>{article.author?.role?.name} • Last updated {mounted ? new Date(article.updatedAt).toLocaleString() : new Date(article.updatedAt).toISOString().split('T')[0]}</div>
             </div>
          </div>
          
          {canEdit && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setIsEditing(true)} className="secondary-btn" style={{ padding: '0.5rem 1rem' }}>Edit Article</button>
              {(session.user.role === 'Admin' || session.user.role === 'Manager') && (
                <button onClick={handleDelete} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white-card" style={{ padding: '2.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', minHeight: '400px' }}>
        <div data-color-mode="light">
           <MDPreview source={article.content} style={{ backgroundColor: 'transparent', color: 'var(--heading-color)', fontSize: '1.05rem', lineHeight: 1.7 }} />
        </div>
      </div>

    </main>
  );
}
