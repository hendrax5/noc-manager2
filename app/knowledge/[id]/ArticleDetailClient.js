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
  
  const canEdit = session.user.role === 'Admin' || session.user.permissions?.includes('manage_knowledge') || session.user.id === article.authorId;

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
      
      <div className="ui-static-a5e927dc66" >
        <Link href="/knowledge" className="ui-static-37b8c17cf4" style={{textDecoration: 'none', display: 'inline-block'}}>← Back to Knowledge Base</Link>
        <div className="ui-static-9f3a956920" style={{display: 'flex', alignItems: 'center'}}>
          <span className="ui-static-ab4d7e2c3c" >
            {article.category?.icon} {article.category?.name}
          </span>
          {!article.isPublished && (
            <span className="ui-static-a292956bd7" >
              Draft (Not Public)
            </span>
          )}
        </div>
        <h1 className="ui-static-b1ee677670" >{article.title}</h1>
        
        <div className="ui-static-26afef260e" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div className="ui-static-e59a73fd03" style={{display: 'flex', alignItems: 'center'}}>
             {article.author?.avatarUrl ? (
                <img src={article.author.avatarUrl} alt="avatar" className="ui-static-1fe1125b86" style={{width: '40px', height: '40px', objectFit: 'cover'}} />
             ) : (
                <div className="ui-static-a39bc21992" style={{width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  {article.author?.name?.charAt(0) || 'U'}
                </div>
             )}
             <div>
               <div className="ui-static-26536ead24" >{article.author?.name}</div>
               <div className="ui-static-1d95690500" >{article.author?.role?.name} • Last updated {mounted ? new Date(article.updatedAt).toLocaleString() : new Date(article.updatedAt).toISOString().split('T')[0]}</div>
             </div>
          </div>
          
          {canEdit && (
            <div className="ui-static-30f523173e" style={{display: 'flex'}}>
              <button onClick={() => setIsEditing(true)} className="secondary-btn ui-static-7f62800e8e" >Edit Article</button>
              {(session.user.role === 'Admin' || session.user.permissions?.includes('manage_knowledge')) && (
                <button onClick={handleDelete} className="ui-static-ec5dee5ff6" style={{cursor: 'pointer'}}>Delete</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white-card ui-static-27c20d2d81" style={{minHeight: '400px'}}>
        <div data-color-mode="light">
           <MDPreview source={article.content} className="ui-static-39e15bd634"  />
        </div>
      </div>

    </main>
  );
}
