-- apt_coordinates 테이블: 단지별 지도 좌표
CREATE TABLE IF NOT EXISTS apt_coordinates (
  id          SERIAL PRIMARY KEY,
  lawd_cd     TEXT    NOT NULL,
  apt_name    TEXT    NOT NULL,
  dong        TEXT,
  lat         FLOAT8  NOT NULL,
  lng         FLOAT8  NOT NULL,
  kakao_place_id TEXT,
  kakao_name  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lawd_cd, apt_name)
);

-- 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_apt_coords_lawd ON apt_coordinates(lawd_cd);
