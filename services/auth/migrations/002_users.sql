CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
