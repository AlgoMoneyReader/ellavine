import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseReady } from '../../lib/supabase';

const BOARDS = [
  { id: '전체',     name: '전체',     emoji: '📋', adminOnly: false },
  { id: '공지사항', name: '공지사항', emoji: '📢', adminOnly: true  },
  { id: '자유게시판', name: '자유게시판', emoji: '💬', adminOnly: false },
  { id: '인테리어', name: '인테리어', emoji: '🏠', adminOnly: false },
  { id: '입주준비', name: '입주준비', emoji: '📦', adminOnly: false },
  { id: '인근소식', name: '인근소식', emoji: '📍', adminOnly: false },
];

const WRITABLE_BOARDS = BOARDS.filter(b => b.id !== '전체');

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function boardInfo(id) {
  return BOARDS.find(b => b.id === id) || { emoji: '💬', name: id };
}

export default function CommunityTab() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // list | post | write | edit
  const [activeBoard, setActiveBoard] = useState('전체');
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  // 글쓰기/수정 폼
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [writeBoard, setWriteBoard] = useState('자유게시판');
  const [writeErr, setWriteErr] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 이미지 업로드
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (view === 'list') fetchPosts();
  }, [view, activeBoard]);

  useEffect(() => {
    if (view === 'post' && currentPost) fetchComments(currentPost.id);
  }, [view, currentPost]);

  async function fetchPosts() {
    if (!isSupabaseReady) return;
    setLoading(true);
    let q = supabase
      .from('posts')
      .select('id, dong, ho, username, nickname, title, content, board, image_url, views, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (activeBoard !== '전체') q = q.eq('board', activeBoard);
    const { data } = await q;
    if (data) setPosts(data);
    setLoading(false);
  }

  async function fetchComments(postId) {
    if (!isSupabaseReady) return;
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  }

  function onImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setWriteErr('이미지는 10MB 이하만 업로드 가능합니다'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setWriteErr('');
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  async function uploadImageToStorage(file) {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(data.path);
    return publicUrl;
  }

  function canWrite() {
    if (!user) return false;
    const board = BOARDS.find(b => b.id === writeBoard);
    if (board?.adminOnly && !user.isAdmin) return false;
    return true;
  }

  async function submitPost() {
    if (!title.trim() || !content.trim() || !user) return;
    const board = BOARDS.find(b => b.id === writeBoard);
    if (board?.adminOnly && !user.isAdmin) {
      setWriteErr('공지사항은 관리자만 작성할 수 있습니다');
      return;
    }
    setSubmitting(true);
    setWriteErr('');

    // 이미지 업로드 (있을 경우)
    let uploadedImageUrl = null;
    if (imageFile) {
      setImageUploading(true);
      try {
        uploadedImageUrl = await uploadImageToStorage(imageFile);
      } catch (err) {
        setWriteErr('이미지 업로드에 실패했습니다: ' + err.message);
        setSubmitting(false);
        setImageUploading(false);
        return;
      }
      setImageUploading(false);
    }

    const { error } = await supabase.from('posts').insert({
      dong: user.isAdmin ? null : user.dong,
      ho:   user.isAdmin ? null : user.ho,
      username: user.username,
      nickname: user.nickname,
      board: writeBoard,
      title: title.trim(),
      content: content.trim(),
      image_url: uploadedImageUrl,
    });
    setSubmitting(false);
    if (error) {
      setWriteErr('게시글 등록에 실패했습니다: ' + error.message);
      return;
    }
    setTitle(''); setContent(''); setWriteBoard('자유게시판');
    setImageFile(null); setImagePreview(null);
    setView('list');
  }

  async function submitComment() {
    if (!commentInput.trim() || !user || !currentPost) return;
    setSubmitting(true);
    const { error } = await supabase.from('comments').insert({
      post_id: currentPost.id,
      dong: user.isAdmin ? null : user.dong,
      ho:   user.isAdmin ? null : user.ho,
      username: user.username,
      nickname: user.nickname,
      content: commentInput.trim(),
    });
    setSubmitting(false);
    if (!error) {
      setCommentInput('');
      fetchComments(currentPost.id);
    }
  }

  function startEdit(post) {
    setTitle(post.title);
    setContent(post.content);
    setWriteBoard(post.board);
    setImagePreview(post.image_url || null);
    setImageFile(null);
    setWriteErr('');
    setEditingPost(post);
    setView('edit');
  }

  async function submitEdit() {
    if (!title.trim() || !content.trim() || !editingPost) return;
    setSubmitting(true);
    setWriteErr('');

    let imageUrl = imagePreview ? editingPost.image_url : null; // null이면 이미지 제거
    if (imageFile) {
      setImageUploading(true);
      try {
        imageUrl = await uploadImageToStorage(imageFile);
      } catch (err) {
        setWriteErr('이미지 업로드에 실패했습니다: ' + err.message);
        setSubmitting(false); setImageUploading(false);
        return;
      }
      setImageUploading(false);
    }

    const { error } = await supabase.from('posts').update({
      title: title.trim(),
      content: content.trim(),
      board: writeBoard,
      image_url: imageUrl,
    }).eq('id', editingPost.id);

    setSubmitting(false);
    if (error) { setWriteErr('수정에 실패했습니다: ' + error.message); return; }

    const updated = { ...editingPost, title: title.trim(), content: content.trim(), board: writeBoard, image_url: imageUrl };
    setCurrentPost(updated);
    setEditingPost(null);
    setTitle(''); setContent(''); setWriteBoard('자유게시판');
    setImageFile(null); setImagePreview(null);
    setView('post');
  }

  async function openPost(post) {
    setCurrentPost(post);
    setView('post');
    if (isSupabaseReady) {
      const newViews = (post.views || 0) + 1;
      await supabase.from('posts').update({ views: newViews }).eq('id', post.id);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: newViews } : p));
    }
  }

  async function deletePost(postId) {
    if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    setView('list');
  }

  async function deleteComment(commentId) {
    await supabase.from('comments').delete().eq('id', commentId);
    fetchComments(currentPost.id);
  }

  function isOwner(row) {
    if (!user) return false;
    if (user.isAdmin) return true; // 관리자는 모든 글/댓글 삭제 가능
    return user.username && user.username === row.username;
  }

  /* ─ NO SUPABASE ─ */
  if (!isSupabaseReady) {
    return (
      <div style={wrap}>
        <div style={sectionTitle}>입주민 커뮤니티</div>
        <div style={sectionSub}>이웃과 정보를 나눠요</div>
        <div style={goldLine} />
        <div style={notReady}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔧</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:8 }}>Supabase 연결이 필요합니다</div>
          <div style={{ fontSize:12, color:'var(--gray)', lineHeight:1.8, textAlign:'left' }}>
            1. <strong>.env</strong> 파일에 추가:<br/>
            <code style={codeStyle}>VITE_SUPABASE_URL=https://xxxx.supabase.co</code><br/>
            <code style={codeStyle}>VITE_SUPABASE_ANON_KEY=eyJ...</code><br/><br/>
            2. Supabase SQL Editor에서<br/>
            <strong>supabase_schema.sql</strong> 실행
          </div>
        </div>
      </div>
    );
  }

  /* ─ WRITE VIEW ─ */
  if (view === 'write') {
    const availableBoards = user?.isAdmin ? WRITABLE_BOARDS : WRITABLE_BOARDS.filter(b => !b.adminOnly);
    return (
      <div style={wrap}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button style={backBtn} onClick={() => { setView('list'); setWriteErr(''); }}>←</button>
          <div style={sectionTitle}>새 글 작성</div>
        </div>
        <div style={goldLine} />
        <div style={writeForm}>
          <div style={formLabel}>게시판</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {availableBoards.map(b => (
              <button key={b.id} style={{ ...boardChip, ...(writeBoard === b.id ? boardChipActive : {}) }}
                onClick={() => setWriteBoard(b.id)}>
                {b.emoji} {b.name}
              </button>
            ))}
          </div>
          <div style={formLabel}>제목</div>
          <input style={formInput} placeholder="제목을 입력해주세요" value={title}
            onChange={e => { setTitle(e.target.value); setWriteErr(''); }} maxLength={60} />
          <div style={formLabel}>내용</div>
          <textarea style={{ ...formInput, minHeight:160, resize:'vertical' }}
            placeholder="내용을 입력해주세요..." value={content}
            onChange={e => { setContent(e.target.value); setWriteErr(''); }} maxLength={2000} />
          <div style={{ fontSize:10, color:'var(--gray)', textAlign:'right', marginBottom:12 }}>{content.length}/2000</div>

          {/* 이미지 첨부 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'var(--gray)', marginBottom:8 }}>📎 사진 첨부 <span style={{ color:'var(--gray)' }}>(선택, 최대 10MB)</span></div>
            {imagePreview ? (
              <div style={{ position:'relative', display:'inline-block' }}>
                <img src={imagePreview} alt="미리보기" style={{ maxWidth:'100%', maxHeight:200, borderRadius:10, border:'1px solid var(--border)', display:'block' }} />
                <button style={imgRemoveBtn} onClick={removeImage}>✕</button>
              </div>
            ) : (
              <label style={imgUploadLabel}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={onImageSelect} />
                📷 사진 선택
              </label>
            )}
          </div>

          {writeErr && <div style={errTxt}>{writeErr}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ ...submitBtn(false), background:'transparent', border:'1px solid var(--border)', color:'var(--gray)', flex:1 }}
              onClick={() => { setView('list'); setWriteErr(''); }}>취소</button>
            <button style={{ ...submitBtn(!title.trim() || !content.trim() || submitting), flex:2 }}
              disabled={!title.trim() || !content.trim() || submitting} onClick={submitPost}>
              {imageUploading ? '이미지 업로드 중...' : submitting ? '등록 중...' : '게시글 등록'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─ EDIT VIEW ─ */
  if (view === 'edit' && editingPost) {
    const availableBoards = user?.isAdmin ? WRITABLE_BOARDS : WRITABLE_BOARDS.filter(b => !b.adminOnly);
    return (
      <div style={wrap}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button style={backBtn} onClick={() => { setView('post'); setEditingPost(null); setWriteErr(''); }}>←</button>
          <div style={sectionTitle}>게시글 수정</div>
        </div>
        <div style={goldLine} />
        <div style={writeForm}>
          <div style={formLabel}>게시판 <span style={{ color:'var(--cyan)', fontSize:10 }}>(변경하면 게시판 이동)</span></div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {availableBoards.map(b => (
              <button key={b.id} style={{ ...boardChip, ...(writeBoard === b.id ? boardChipActive : {}) }}
                onClick={() => setWriteBoard(b.id)}>
                {b.emoji} {b.name}
              </button>
            ))}
          </div>
          <div style={formLabel}>제목</div>
          <input style={formInput} placeholder="제목을 입력해주세요" value={title}
            onChange={e => { setTitle(e.target.value); setWriteErr(''); }} maxLength={60} />
          <div style={formLabel}>내용</div>
          <textarea style={{ ...formInput, minHeight:160, resize:'vertical' }}
            placeholder="내용을 입력해주세요..." value={content}
            onChange={e => { setContent(e.target.value); setWriteErr(''); }} maxLength={2000} />
          <div style={{ fontSize:10, color:'var(--gray)', textAlign:'right', marginBottom:12 }}>{content.length}/2000</div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'var(--gray)', marginBottom:8 }}>📎 사진 <span style={{ color:'var(--gray)' }}>(선택, 최대 10MB)</span></div>
            {imagePreview ? (
              <div style={{ position:'relative', display:'inline-block' }}>
                <img src={imagePreview} alt="미리보기" style={{ maxWidth:'100%', maxHeight:200, borderRadius:10, border:'1px solid var(--border)', display:'block' }} />
                <button style={imgRemoveBtn} onClick={removeImage}>✕</button>
              </div>
            ) : (
              <label style={imgUploadLabel}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={onImageSelect} />
                📷 사진 선택
              </label>
            )}
          </div>

          {writeErr && <div style={errTxt}>{writeErr}</div>}
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ ...submitBtn(false), background:'transparent', border:'1px solid var(--border)', color:'var(--gray)', flex:1 }}
              onClick={() => { setView('post'); setEditingPost(null); setWriteErr(''); }}>취소</button>
            <button style={{ ...submitBtn(!title.trim() || !content.trim() || submitting), flex:2 }}
              disabled={!title.trim() || !content.trim() || submitting} onClick={submitEdit}>
              {imageUploading ? '이미지 업로드 중...' : submitting ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─ POST DETAIL VIEW ─ */
  if (view === 'post' && currentPost) {
    const bi = boardInfo(currentPost.board);
    return (
      <div style={wrap}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button style={backBtn} onClick={() => { setView('list'); setCurrentPost(null); }}>←</button>
          <div style={{ ...boardTag, background: 'var(--bg)', border:'1px solid var(--border)' }}>
            {bi.emoji} {bi.name}
          </div>
          <div style={{ flex:1 }} />
          {isOwner(currentPost) && (
            <div style={{ display:'flex', gap:6 }}>
              <button style={{ fontSize:11, color:'var(--cyan)', background:'transparent', border:'1px solid rgba(0,143,175,0.3)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
                onClick={() => startEdit(currentPost)}>수정</button>
              <button style={{ fontSize:11, color:'var(--red)', background:'transparent', border:'1px solid rgba(217,69,69,0.3)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
                onClick={() => deletePost(currentPost.id)}>삭제</button>
            </div>
          )}
        </div>
        <div style={postDetail}>
          <div style={{ fontSize:11, color:'var(--gold)', fontWeight:600, marginBottom:8 }}>
            {currentPost.nickname}{!currentPost.username?.startsWith('admin') && currentPost.dong ? ` · ${currentPost.dong}동` : ''}
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:8, lineHeight:1.5 }}>{currentPost.title}</div>
          <div style={{ fontSize:10, color:'var(--gray)', marginBottom:14 }}>{timeAgo(currentPost.created_at)}</div>
          <div style={{ height:1, background:'var(--border)', marginBottom:14 }} />
          <div style={{ fontSize:14, color:'var(--text)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{currentPost.content}</div>
          {currentPost.image_url && (
            <div style={{ marginTop:14 }}>
              <img
                src={currentPost.image_url}
                alt="첨부 이미지"
                style={{ width:'100%', borderRadius:12, border:'1px solid var(--border)', display:'block', cursor:'pointer' }}
                onClick={() => window.open(currentPost.image_url, '_blank')}
              />
              <div style={{ fontSize:9, color:'var(--gray)', marginTop:4, textAlign:'right' }}>이미지를 탭하면 크게 볼 수 있습니다</div>
            </div>
          )}
        </div>

        <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2, fontWeight:600, marginBottom:12 }}>
          💬 댓글 {comments.length}개
        </div>
        {comments.map(c => (
          <div key={c.id} style={commentItem}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'var(--gold)', fontWeight:600 }}>{c.nickname}</span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:10, color:'var(--gray)' }}>{timeAgo(c.created_at)}</span>
                {isOwner(c) && (
                  <button style={{ fontSize:10, color:'var(--red)', background:'transparent', border:'none', cursor:'pointer' }}
                    onClick={() => deleteComment(c.id)}>삭제</button>
                )}
              </div>
            </div>
            <div style={{ fontSize:12, color:'var(--text)', lineHeight:1.6 }}>{c.content}</div>
          </div>
        ))}

        {user ? (
          <div style={{ display:'flex', gap:8, marginTop:8, position:'sticky', bottom:80 }}>
            <input style={commentBox} placeholder="댓글을 입력하세요..." value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()} />
            <button style={commentSendBtn(submitting || !commentInput.trim())}
              disabled={submitting || !commentInput.trim()} onClick={submitComment}>등록</button>
          </div>
        ) : (
          <div style={{ textAlign:'center', fontSize:11, color:'var(--gray)', padding:'12px', background:'var(--bg)', borderRadius:10, marginTop:8 }}>
            댓글을 작성하려면 로그인이 필요합니다
          </div>
        )}
      </div>
    );
  }

  /* ─ LIST VIEW ─ */
  return (
    <div style={wrap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:4 }}>
        <div style={sectionTitle}>입주민 커뮤니티</div>
        {user && (
          <button style={writeBtn} onClick={() => setView('write')}>✏️ 글쓰기</button>
        )}
      </div>
      <div style={sectionSub}>이웃 입주민과 정보를 나눠요</div>
      <div style={goldLine} />

      {/* 게시판 탭 */}
      <div style={boardTabRow}>
        {BOARDS.map(b => (
          <button key={b.id} style={{ ...boardTab, ...(activeBoard === b.id ? boardTabActive : {}) }}
            onClick={() => setActiveBoard(b.id)}>
            {b.emoji} {b.name}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:'30px', color:'var(--gray)', fontSize:12 }}>불러오는 중...</div>}

      {!loading && posts.length === 0 && (
        <div style={emptyBox}>
          <div style={{ fontSize:32, marginBottom:12 }}>✍️</div>
          <div style={{ fontSize:13, color:'var(--gray)' }}>아직 게시글이 없습니다.</div>
          <div style={{ fontSize:11, color:'var(--gray)', marginTop:4 }}>첫 번째 글을 작성해보세요!</div>
        </div>
      )}

      {posts.map(p => {
        const bi = boardInfo(p.board);
        return (
          <div key={p.id} style={postCard} onClick={() => openPost(p)}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={boardTag}>{bi.emoji} {bi.name}</span>
                    <span style={{ fontSize:10, color:'var(--gold)', fontWeight:600 }}>{p.nickname}</span>
                  </div>
                  <span style={{ fontSize:10, color:'var(--gray)' }}>{timeAgo(p.created_at)}</span>
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', lineHeight:1.5 }}>
                  {p.image_url && <span style={{ fontSize:11, marginRight:4 }}>📷</span>}
                  {p.title}
                </div>
                <div style={{ fontSize:10, color:'var(--gray)', marginTop:5 }}>👁 {p.views || 0}</div>
              </div>
              {p.image_url && (
                <img src={p.image_url} alt="" style={{ width:56, height:56, borderRadius:8, objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const wrap = { padding:'16px 16px 120px' };
const sectionTitle = { fontFamily:"'Noto Serif KR',serif", fontSize:20, fontWeight:600, color:'var(--text)', marginBottom:4 };
const sectionSub = { fontSize:12, color:'var(--gray)', marginBottom:12 };
const goldLine = { width:32, height:2, background:'var(--gold)', marginBottom:16, borderRadius:1 };
const notReady = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, padding:'32px 20px', textAlign:'center', boxShadow:'var(--shadow)' };
const codeStyle = { display:'block', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:10, fontFamily:'monospace', marginTop:4, textAlign:'left', color:'var(--navy)' };
const boardTabRow = { display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:16, scrollbarWidth:'none' };
const boardTab = { flexShrink:0, fontSize:11, padding:'6px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:20, color:'var(--gray)', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap' };
const boardTabActive = { background:'var(--navy)', border:'1px solid var(--navy)', color:'#FFFFFF', fontWeight:700 };
const boardTag = { display:'inline-block', fontSize:10, padding:'2px 7px', borderRadius:10, background:'rgba(200,168,64,0.1)', border:'1px solid var(--gold-dim)', color:'var(--gold)', fontWeight:600 };
const postCard = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:8, cursor:'pointer', boxShadow:'var(--shadow-sm)' };
const postDetail = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, padding:'18px 16px', marginBottom:16, boxShadow:'var(--shadow-sm)' };
const commentItem = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', marginBottom:6 };
const writeBtn = { fontSize:11, padding:'6px 12px', background:'var(--navy)', border:'none', borderRadius:10, color:'#FFFFFF', fontWeight:600, cursor:'pointer' };
const backBtn = { width:36, height:36, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, fontSize:16, color:'var(--text)', flexShrink:0, cursor:'pointer' };
const writeForm = { background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, padding:'16px', boxShadow:'var(--shadow-sm)' };
const formLabel = { fontSize:11, color:'var(--gray)', marginBottom:6, letterSpacing:0.5 };
const formInput = { width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', color:'var(--text)', fontSize:13, outline:'none', marginBottom:14, display:'block', boxSizing:'border-box' };
const boardChip = { fontSize:12, padding:'6px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:20, color:'var(--gray)', cursor:'pointer', fontWeight:500 };
const boardChipActive = { background:'var(--navy)', border:'1px solid var(--navy)', color:'#FFFFFF', fontWeight:700 };
const errTxt = { fontSize:11, color:'var(--red)', marginBottom:10 };
const imgUploadLabel = {
  display:'inline-flex', alignItems:'center', gap:6,
  padding:'9px 16px', background:'var(--bg)',
  border:'1px dashed var(--border)', borderRadius:10,
  fontSize:12, color:'var(--text-2)', cursor:'pointer', fontWeight:500,
};
const imgRemoveBtn = {
  position:'absolute', top:-8, right:-8, width:22, height:22,
  borderRadius:'50%', background:'var(--red)', border:'none',
  color:'#FFFFFF', fontSize:11, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
};
const submitBtn = (disabled) => ({ width:'100%', padding:'13px', background: disabled ? 'var(--bg)' : 'var(--navy)', color: disabled ? 'var(--gray)' : '#FFFFFF', border:'1px solid var(--border)', borderRadius:12, fontSize:14, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer' });
const commentBox = { flex:1, background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', color:'var(--text)', fontSize:12, outline:'none' };
const commentSendBtn = (disabled) => ({ padding:'10px 16px', background: disabled ? 'var(--bg)' : 'var(--navy)', color: disabled ? 'var(--gray)' : '#FFFFFF', border:'1px solid var(--border)', borderRadius:10, fontSize:12, fontWeight:600, flexShrink:0, cursor: disabled ? 'not-allowed' : 'pointer' });
const emptyBox = { textAlign:'center', padding:'40px 20px', background:'#FFFFFF', border:'1px solid var(--border)', borderRadius:16, boxShadow:'var(--shadow-sm)' };
