CREATE TABLE chat.conversations (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type = 'private'),
  private_key text NOT NULL UNIQUE,
  name text,
  position bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chat.participants (
  conversation_id uuid NOT NULL REFERENCES chat.conversations(id),
  user_id uuid NOT NULL,
  PRIMARY KEY (conversation_id,user_id)
);
CREATE TABLE chat.messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES chat.conversations(id),
  sender_id uuid NOT NULL,
  client_message_id uuid NOT NULL,
  content text NOT NULL,
  position bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id,position),
  UNIQUE (sender_id,client_message_id),
  FOREIGN KEY (conversation_id,sender_id) REFERENCES chat.participants(conversation_id,user_id)
);
