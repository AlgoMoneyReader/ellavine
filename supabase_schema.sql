-- ============================================================
-- 래미안 엘라비네 Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요
-- ============================================================

-- 입주민 등록 테이블
CREATE TABLE IF NOT EXISTS residents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dong text NOT NULL,
  ho text NOT NULL,
  username text UNIQUE,
  password_hash text,
  kakao_nickname text,
  nickname text,
  type text,
  area text,
  floor int,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(dong, ho)
);

-- 기존 테이블에 컬럼 추가 (이미 테이블이 있는 경우)
ALTER TABLE residents ADD COLUMN IF NOT EXISTS username text UNIQUE;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS kakao_nickname text;

-- 커뮤니티 게시글
CREATE TABLE IF NOT EXISTS posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dong text NOT NULL,
  ho text NOT NULL,
  nickname text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 댓글
CREATE TABLE IF NOT EXISTS comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  dong text NOT NULL,
  ho text NOT NULL,
  nickname text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS 활성화
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 모든 사람이 읽기 가능
CREATE POLICY "Public read residents" ON residents FOR SELECT USING (true);
CREATE POLICY "Public read posts"     ON posts     FOR SELECT USING (true);
CREATE POLICY "Public read comments"  ON comments  FOR SELECT USING (true);

-- 누구나 등록/작성 가능 (anon key 사용)
CREATE POLICY "Public insert residents" ON residents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert posts"     ON posts     FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert comments"  ON comments  FOR INSERT WITH CHECK (true);

-- 업데이트/삭제
CREATE POLICY "Owner update posts"    ON posts     FOR UPDATE USING (true);
CREATE POLICY "Owner delete posts"    ON posts     FOR DELETE USING (true);
CREATE POLICY "Owner delete comments" ON comments  FOR DELETE USING (true);
CREATE POLICY "Owner update residents" ON residents FOR UPDATE USING (true);

-- ============================================================
-- 커뮤니티 게시판 업그레이드 (기존 테이블에 컬럼 추가)
-- ============================================================

-- posts: username(소유자 확인용), board(게시판 구분) 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS board text DEFAULT '자유게시판';
-- dong/ho NOT NULL 해제 (관리자 게시글 허용)
ALTER TABLE posts ALTER COLUMN dong DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN ho DROP NOT NULL;

-- comments: username 추가
ALTER TABLE comments ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE comments ALTER COLUMN dong DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN ho DROP NOT NULL;

-- residents: is_admin 컬럼 추가 (없는 경우)
ALTER TABLE residents ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 비밀번호 찾기: 보안 질문/답변
ALTER TABLE residents ADD COLUMN IF NOT EXISTS security_question text;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS security_answer_hash text;

-- 게시글 이미지 URL
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;

-- Storage: post-images 버킷 정책 (Supabase Storage 대시보드에서 설정)
-- Bucket 이름: post-images (Public)
-- 모든 사용자 업로드/읽기 허용

-- ============================================================
-- 푸시 알림 구독 테이블 (Web Push Notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  endpoint    TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT,
  keys_auth   TEXT,
  username    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 인덱스: endpoint 조회 최적화
CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
-- 인덱스: username 기반 조회
CREATE INDEX IF NOT EXISTS push_subscriptions_username_idx ON push_subscriptions (username);
