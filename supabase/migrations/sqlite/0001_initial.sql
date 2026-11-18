CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password TEXT NOT NULL, recovery TEXT NOT NULL, profile TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (
      owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(owner,table_name,id)
    );
    CREATE TABLE IF NOT EXISTS files (
      owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(owner,id)
    );
    CREATE TABLE IF NOT EXISTS attempts (key TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS attempts_lookup ON attempts(key,at);
    CREATE TABLE IF NOT EXISTS ai_usage (owner TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS ai_usage_lookup ON ai_usage(owner,at);
    CREATE UNIQUE INDEX IF NOT EXISTS session_client ON records(owner,json_extract(data,'$.client_id')) WHERE table_name='study_sessions';
    CREATE UNIQUE INDEX IF NOT EXISTS message_client ON records(owner,json_extract(data,'$.conversation_id'),json_extract(data,'$.client_id')) WHERE table_name='study_messages';
    CREATE UNIQUE INDEX IF NOT EXISTS feedback_message ON records(owner,json_extract(data,'$.message_id')) WHERE table_name='study_message_feedback';
    CREATE UNIQUE INDEX IF NOT EXISTS question_position ON records(owner,json_extract(data,'$.set_id'),json_extract(data,'$.position')) WHERE table_name='generated_questions';
    CREATE UNIQUE INDEX IF NOT EXISTS option_position ON records(owner,json_extract(data,'$.question_id'),json_extract(data,'$.position')) WHERE table_name='generated_question_options';
    CREATE UNIQUE INDEX IF NOT EXISTS attempt_client ON records(owner,json_extract(data,'$.client_id')) WHERE table_name='question_attempts';
    CREATE UNIQUE INDEX IF NOT EXISTS answer_question ON records(owner,json_extract(data,'$.attempt_id'),json_extract(data,'$.question_id')) WHERE table_name='question_attempt_answers';
PRAGMA user_version=1;
