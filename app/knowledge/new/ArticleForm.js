'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export default function ArticleForm({ categories, session, existingArticle = null }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: existingArticle?.title || '',
    categoryId: existingArticle?.categoryId || (categories[0]?.id || ''),
    content: existingArticle?.content || '',
    isPublished: existingArticle ? existingArticle.isPublished : true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = existingArticle ? `/api/knowledge/articles/${existingArticle.id}` : '/api/knowledge/articles';
      const method = existingArticle ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        router.push(`/knowledge/${data.id}`);
        router.refresh();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save article');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: '800px' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
           <Link href="/knowledge" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'inline-block' }}>← Back to Knowledge Base</Link>
           <h1 style={{ marginTop: '0.5rem' }}>{existingArticle ? 'Edit Article' : 'Draft New Article'}</h1>
        </div>
      </header>

      <div className="bg-white-card" style={{ padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--heading-color)' }}>Title</label>
            <input 
              type="text" 
              required 
              className="input-field" 
              placeholder="e.g. Standard Operating Procedure: BGP Configuration"
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--heading-color)' }}>Category</label>
            <select 
              required
              className="input-field" 
              value={formData.categoryId} 
              onChange={e => setFormData({...formData, categoryId: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          <div data-color-mode="light">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', color: 'var(--heading-color)' }}>Content (Markdown Editor)</label>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <label style={{ background: 'var(--hover-bg)', border: '1px dashed var(--border-color)', color: 'var(--primary-color)', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {isSubmitting ? '...' : '✍️ Extract Plain Text'}
                  <input 
                    type="file" 
                    accept=".pdf" 
                    disabled={isSubmitting}
                    style={{ display: 'none' }} 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        setIsSubmitting(true);
                        const res = await fetch('/api/knowledge/articles/import-pdf', { method: 'POST', body: fd });
                        if (res.ok) {
                          const json = await res.json();
                          setFormData(prev => ({ ...prev, content: (prev.content ? prev.content + '\n\n' : '') + json.text }));
                        } else {
                          const errText = await res.text();
                          alert('PDF Extraction Failed Server-Side:\n' + errText);
                        }
                      } catch (err) {
                        console.error(err);
                        alert('An error occurred during extraction:\n' + err.message);
                      } finally {
                        setIsSubmitting(false);
                        e.target.value = '';
                      }
                    }} 
                  />
                </label>

                <label style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                  {isSubmitting ? '...' : '🖼️ Attach Visual PDF'}
                  <input 
                    type="file" 
                    accept=".pdf" 
                    disabled={isSubmitting}
                    style={{ display: 'none' }} 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        setIsSubmitting(true);
                        const res = await fetch('/api/upload', { method: 'POST', body: fd });
                        if (res.ok) {
                          const json = await res.json();
                          const embedHtml = `\n\n<div style="background: var(--white-color); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); margin: 2rem 0;">\n  <div style="background: var(--hover-bg); padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">\n    <div style="display: flex; align-items: center; gap: 0.8rem;">\n      <span style="font-size: 1.4rem;">📄</span>\n      <div>\n        <div style="font-weight: bold; color: var(--heading-color); font-size: 0.95rem;">Attached Document</div>\n        <div style="font-size: 0.75rem; color: var(--text-color);">${json.filename || 'PDF Preview'}</div>\n      </div>\n    </div>\n    <a href="${json.url}" target="_blank" style="background: var(--primary-color); color: white; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.85rem; text-decoration: none; font-weight: bold; transition: all 0.2s;">↗ Open Fullscreen</a>\n  </div>\n  <iframe src="${json.url}#view=FitH" width="100%" height="800px" style="border: none; display: block; background: #525659;"></iframe>\n</div>\n\n`;
                          setFormData(prev => ({ ...prev, content: (prev.content ? prev.content : '') + embedHtml }));
                        } else {
                          alert('File upload failed.');
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSubmitting(false);
                        e.target.value = '';
                      }
                    }} 
                  />
                </label>
              </div>
            </div>
            <MDEditor
              value={formData.content}
              onChange={val => setFormData({...formData, content: val || ''})}
              height={500}
              preview="edit"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="isPublished"
              checked={formData.isPublished} 
              onChange={e => setFormData({...formData, isPublished: e.target.checked})} 
            />
            <label htmlFor="isPublished" style={{ color: 'var(--heading-color)', fontWeight: 'bold' }}>Publish Immediately</label>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-color)', marginTop: '-1rem', marginLeft: '1.5rem' }}>If unchecked, this article will be saved as a Draft visible only to Admins/Managers and yourself.</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <Link href={existingArticle ? `/knowledge/${existingArticle.id}` : "/knowledge"} className="secondary-btn" style={{ textDecoration: 'none' }}>Cancel</Link>
            <button type="submit" disabled={isSubmitting} className="primary-btn">
              {isSubmitting ? 'Saving...' : (existingArticle ? 'Update Article' : 'Publish Article')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
