-- Luma Circle: profiles, posts, membership, and safety records.

create table if not exists profiles (
  user_id text primary key,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  pronouns text not null default '',
  identities text not null default '',
  interests text not null default '',
  avatar_url text not null default '',
  banner_url text not null default '',
  city text not null default '',
  is_creator boolean not null default false,
  is_live boolean not null default false,
  live_viewers integer not null default 0,
  subscription_cents integer not null default 800,
  promote_ok boolean not null default true,
  messages_mode text not null default 'open',
  boundaries text not null default '',
  age_ok boolean not null default false,
  birth_year integer,
  verification_status text not null default 'none',
  tuned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id text primary key,
  author_id text not null,
  caption text not null default '',
  warning text not null default '',
  kind text not null,
  access text not null,
  price_cents integer not null default 0,
  media_url text not null,
  preview_url text not null default '',
  poster_url text not null default '',
  promote_ok boolean not null default true,
  safety text not null default 'clear',
  like_count integer not null default 0,
  tip_cents integer not null default 0,
  rank_penalty boolean not null default false,
  duration_label text not null default '',
  tags text not null default '',
  removed boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists posts_author_idx on posts (author_id, published_at desc);
create index if not exists posts_published_idx on posts (published_at desc);

create table if not exists follows (
  user_id text not null,
  creator_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

create table if not exists subscriptions (
  user_id text not null,
  creator_id text not null,
  status text not null default 'active',
  price_cents integer not null,
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

create table if not exists unlocks (
  user_id text not null,
  post_id text not null,
  price_cents integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists likes (
  user_id text not null,
  post_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists blocks (
  user_id text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

create table if not exists mutes (
  user_id text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

create table if not exists reports (
  id text primary key,
  user_id text not null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  detail text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists reports_user_idx on reports (user_id, created_at desc);

create table if not exists messages (
  id text primary key,
  thread_id text not null,
  sender_id text not null,
  recipient_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on messages (thread_id, created_at);
create index if not exists messages_recipient_idx on messages (recipient_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  href text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists ledger (
  id text primary key,
  user_id text not null,
  creator_id text not null,
  kind text not null,
  amount_cents integer not null,
  ref text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ledger_user_idx on ledger (user_id, created_at desc);
create index if not exists ledger_creator_idx on ledger (creator_id, created_at desc);

create table if not exists engagement_log (
  id text primary key,
  user_id text not null,
  post_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists engagement_user_idx on engagement_log (user_id, created_at desc);

create table if not exists comments (
  id text primary key,
  post_id text not null,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists live_chat (
  id text primary key,
  room_id text not null,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists live_chat_room_idx on live_chat (room_id, created_at);

insert into profiles (
  user_id, handle, display_name, bio, pronouns, identities, interests,
  avatar_url, banner_url, city, is_creator, is_live, live_viewers,
  subscription_cents, promote_ok, messages_mode, boundaries, age_ok, birth_year,
  verification_status, tuned
) values
  ('seed:solene', 'solene', 'Solène Voss', 'Coat weather, low songs, and the long walk home.', 'she/her', 'Trans woman', 'Fashion,Voice', '/media/solene.jpg', '/media/coat.jpg', 'Lyon', true, false, 0, 900, true, 'open', 'No medical questions. Ask before voice notes.', true, 1993, 'approved', true),
  ('seed:juniper', 'juniper', 'Juniper Hale', 'I draw the room I am in. The plants are unpaid.', 'they/them', 'Nonbinary', 'Illustration,Poetry', '/media/juniper.jpg', '/media/desk.jpg', 'Portland', true, false, 0, 600, true, 'open', 'Please no unsolicited photos.', true, 1995, 'none', true),
  ('seed:mateo', 'mateo', 'Mateo Ruiz', 'Strength work without the shouting. Form first.', 'he/him', 'Trans man', 'Fitness', '/media/mateo.jpg', '/media/mateo.jpg', 'Austin', true, false, 0, 1200, true, 'subscribers', 'No comments about my body. Training talk is welcome.', true, 1991, 'none', true),
  ('seed:amari', 'amari', 'Amari Cole', 'Songs for the train ride and the after.', 'she/they', 'Pan', 'Music,Voice', '/media/amari.jpg', '/media/amari.jpg', 'Chicago', true, true, 86, 1100, true, 'open', 'No demo pitches in messages.', true, 1992, 'none', true),
  ('seed:ren', 'ren', 'Ren Okada', 'Color, liner, and the face I choose today.', 'they/he', 'Nonbinary', 'Makeup,Fashion', '/media/ren.jpg', '/media/ren.jpg', 'Los Angeles', true, false, 0, 800, true, 'subscribers', 'Talk about the work, not my bones.', true, 1996, 'none', true),
  ('seed:lior', 'lior', 'Lior Ben-Ami', 'Weeknight food and the good olive oil.', 'he/they', 'Trans masc', 'Food', '/media/lior.jpg', '/media/lior.jpg', 'Brooklyn', true, false, 0, 700, true, 'open', 'Recipes yes. Diet talk no.', true, 1994, 'none', true),
  ('seed:nova', 'nova', 'Nova Pell', 'Rehearsal is the show. Soft shoes, hard counts.', 'she/her', 'Trans woman', 'Dance', '/media/nova.jpg', '/media/nova.jpg', 'Montreal', true, true, 128, 1000, true, 'open', 'No messages about my body. Choreography questions are fine.', true, 1993, 'submitted', true),
  ('seed:cass', 'cass', 'Cass Wilder', 'Trail notes and weather. I leave the loud parts outside.', 'they/them', 'Nonbinary', 'Outdoors,Poetry', '/media/cass.jpg', '/media/cass.jpg', 'Denver', true, true, 41, 500, true, 'open', 'I answer slowly.', true, 1990, 'none', true);

insert into posts (
  id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url, poster_url,
  promote_ok, safety, like_count, tip_cents, rank_penalty, duration_label, tags, removed, published_at
) values
  ('v-nova', 'seed:nova', 'Marked the second section. Soft shoes, hard count.', '', 'video', 'free', 0, '/media/v-nova.mp4', '/media/nova.jpg', '/media/nova.jpg', true, 'clear', 860, 2400, false, '0:06', 'Dance', false, now() - interval '25 minutes'),
  ('v-amari', 'seed:amari', 'New verse into the mic before the train.', '', 'video', 'free', 0, '/media/v-amari.mp4', '/media/amari.jpg', '/media/amari.jpg', true, 'clear', 740, 1800, false, '0:06', 'Music,Voice', false, now() - interval '70 minutes'),
  ('v-solene', 'seed:solene', 'Coat on, city still wet. The long way around the station.', '', 'video', 'free', 0, '/media/v-solene.mp4', '/media/solene.jpg', '/media/solene.jpg', true, 'clear', 690, 900, false, '0:06', 'Fashion,Voice', false, now() - interval '2 hours'),
  ('v-mateo', 'seed:mateo', 'Ten slow minutes. Shoulders down, jaw unclenched.', '', 'video', 'subscriber', 0, '/media/v-mateo.mp4', '/media/preview-mateo.jpg', '/media/mateo.jpg', true, 'clear', 410, 600, false, '0:06', 'Fitness', false, now() - interval '5 hours'),
  ('v-juniper', 'seed:juniper', 'The plant is judging this sketch. Fair.', '', 'video', 'free', 0, '/media/v-juniper.mp4', '/media/juniper.jpg', '/media/juniper.jpg', true, 'clear', 380, 300, false, '0:06', 'Illustration,Poetry', false, now() - interval '8 hours'),
  ('v-ren', 'seed:ren', 'Liner that stays put when the day does not.', '', 'video', 'unlock', 450, '/media/v-ren.mp4', '/media/preview-ren.jpg', '/media/ren.jpg', true, 'clear', 260, 450, false, '0:06', 'Makeup,Fashion', false, now() - interval '14 hours'),
  ('v-lior', 'seed:lior', 'Olive oil, lemon, a pan that is finally hot.', '', 'video', 'free', 0, '/media/v-lior.mp4', '/media/lior.jpg', '/media/lior.jpg', true, 'clear', 300, 200, false, '0:06', 'Food', false, now() - interval '20 hours'),
  ('v-cass', 'seed:cass', 'Wind on the ridge. I left the loud part in the car.', 'Mentions dysphoria, briefly.', 'video', 'free', 0, '/media/v-cass.mp4', '/media/cass.jpg', '/media/cass.jpg', true, 'limited', 140, 100, false, '0:06', 'Outdoors,Poetry', false, now() - interval '28 hours'),
  ('i-coat', 'seed:solene', 'This one has a pocket for a paperback.', '', 'image', 'subscriber', 0, '/media/coat.jpg', '/media/preview-coat.jpg', '/media/coat.jpg', true, 'clear', 220, 400, false, '', 'Fashion', false, now() - interval '36 hours'),
  ('i-desk', 'seed:juniper', 'Tuesday desk. Ink where the coffee should not be.', '', 'image', 'free', 0, '/media/desk.jpg', '/media/desk.jpg', '/media/desk.jpg', true, 'clear', 180, 0, false, '', 'Illustration', false, now() - interval '52 hours'),
  ('held-mateo', 'seed:mateo', 'Form check kept back for a safety review.', '', 'image', 'free', 0, '/media/mateo.jpg', '', '/media/mateo.jpg', false, 'held', 0, 0, true, '', 'Fitness', false, now() - interval '3 days');

insert into comments (id, post_id, user_id, body, created_at) values
  ('c1', 'v-nova', 'seed:amari', 'That turn at the end. Keep it.', now() - interval '20 minutes'),
  ('c2', 'v-solene', 'seed:juniper', 'The wet street light is doing a lot, in a good way.', now() - interval '90 minutes'),
  ('c3', 'v-juniper', 'seed:solene', 'The plant is right, and the sketch is still lovely.', now() - interval '6 hours'),
  ('c4', 'v-lior', 'seed:mateo', 'Saving this for after training.', now() - interval '10 hours'),
  ('c5', 'v-amari', 'seed:cass', 'Played this on the drive back. Thank you.', now() - interval '40 minutes'),
  ('c6', 'v-solene', 'seed:ren', 'The coat collar is a whole decision. Respect.', now() - interval '70 minutes'),
  ('c7', 'v-mateo', 'seed:lior', 'Shoulders down is the whole lesson.', now() - interval '4 hours'),
  ('c8', 'v-cass', 'seed:nova', 'I can hear the wind in this.', now() - interval '3 hours');

insert into live_chat (id, room_id, user_id, body, created_at) values
  ('lc1', 'seed:nova', 'seed:amari', 'Staying for the phrase you marked.', now() - interval '4 minutes'),
  ('lc2', 'seed:nova', 'seed:juniper', 'Hi from the desk. The count is clean.', now() - interval '3 minutes'),
  ('lc3', 'seed:nova', 'seed:cass', 'Watching between trailheads.', now() - interval '2 minutes'),
  ('lc4', 'seed:amari', 'seed:solene', 'This verse feels like the wet street.', now() - interval '6 minutes'),
  ('lc5', 'seed:amari', 'seed:nova', 'Leave the breath in. It is the hook.', now() - interval '5 minutes'),
  ('lc6', 'seed:cass', 'seed:juniper', 'The light up there looks drawable.', now() - interval '8 minutes');
