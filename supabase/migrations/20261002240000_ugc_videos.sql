-- UGC marketing videos. Staff type a one-line brief in Admin → Marketing; the Worker
-- wraps it in the (server-side) creative prompt and hands it to the external video
-- pipeline, which reports back via /api/ugc-videos/callback.
create type ugc_video_status as enum ('queued', 'generating', 'ready', 'failed');

create table ugc_videos (
  id uuid primary key default gen_random_uuid(),
  brief text not null check (length(brief) between 1 and 500),
  status ugc_video_status not null default 'queued',
  video_url text,
  thumbnail_url text,
  error text,
  external_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ugc_videos_created_at_idx on ugc_videos (created_at desc);

alter table ugc_videos enable row level security;
create policy "staff full access" on ugc_videos for all to authenticated using (is_staff()) with check (is_staff());

alter publication supabase_realtime add table ugc_videos;
