---
name: database
description: Database CLI for PostgreSQL, SQLite, MySQL, MongoDB, and Redis. Query, inspect schemas, CRUD, export data, and manage databases. Use when the user needs to interact with any database.
---

# Database

Five database engines via Node.js drivers. Each has its own script with consistent commands.

## Setup

```bash
cd {baseDir} && npm install
```

---

## PostgreSQL

```bash
# Connection: DATABASE_URL=postgres://user:pass@host:5432/db
# Or: PGHOST + PGPORT + PGDATABASE + PGUSER + PGPASSWORD
# Or: --host --port --db --user --password flags

node {baseDir}/postgres.js tables                                    # List tables
node {baseDir}/postgres.js describe <table>                          # Schema + PK
node {baseDir}/postgres.js query "SELECT * FROM users LIMIT 10"      # Run SQL
node {baseDir}/postgres.js query "SELECT * FROM users" --format json # JSON output
node {baseDir}/postgres.js count <table>                             # Row count
node {baseDir}/postgres.js indexes <table>                           # Indexes
node {baseDir}/postgres.js export <table> --format csv               # Export
node {baseDir}/postgres.js databases                                 # List databases
node {baseDir}/postgres.js size                                      # DB size
```

---

## SQLite

```bash
# First argument is always the database file path

node {baseDir}/sqlite.js ./data.db tables                            # List tables
node {baseDir}/sqlite.js ./data.db describe <table>                  # Schema + FK
node {baseDir}/sqlite.js ./data.db query "SELECT * FROM users LIMIT 10"
node {baseDir}/sqlite.js ./data.db query "INSERT INTO users VALUES ('John', 30)"
node {baseDir}/sqlite.js ./data.db count <table>
node {baseDir}/sqlite.js ./data.db indexes <table>
node {baseDir}/sqlite.js ./data.db export <table> --format json
node {baseDir}/sqlite.js ./data.db size                              # File size
node {baseDir}/sqlite.js ./data.db vacuum                            # Compact
```

---

## MySQL

```bash
# Connection: MYSQL_URL=mysql://user:pass@host:3306/db
# Or: MYSQL_HOST + MYSQL_PORT + MYSQL_DATABASE + MYSQL_USER + MYSQL_PASSWORD

node {baseDir}/mysql.js tables
node {baseDir}/mysql.js describe <table>
node {baseDir}/mysql.js query "SELECT * FROM users LIMIT 10"
node {baseDir}/mysql.js count <table>
node {baseDir}/mysql.js indexes <table>
node {baseDir}/mysql.js export <table> --format csv
node {baseDir}/mysql.js databases
node {baseDir}/mysql.js size                                         # All DB sizes
```

---

## MongoDB

```bash
# Connection: MONGODB_URL=mongodb://host:27017/dbname (default: localhost/test)

node {baseDir}/mongo.js collections                                  # List collections
node {baseDir}/mongo.js find <coll> --limit 10                       # Find docs
node {baseDir}/mongo.js find <coll> --filter '{"status":"active"}'   # With filter
node {baseDir}/mongo.js findOne <coll> <objectId>                    # Get by _id
node {baseDir}/mongo.js insert <coll> '{"name":"John","age":30}'     # Insert
node {baseDir}/mongo.js update <coll> <id> '{"name":"Jane"}'         # Update ($set)
node {baseDir}/mongo.js delete <coll> <id>                           # Delete
node {baseDir}/mongo.js count <coll>                                 # Count
node {baseDir}/mongo.js aggregate <coll> '[{"$group":{"_id":"$status","count":{"$sum":1}}}]'
node {baseDir}/mongo.js indexes <coll>
node {baseDir}/mongo.js stats                                        # DB stats
```

---

## Redis

```bash
# Connection: REDIS_URL=redis://host:6379 (default: localhost)

node {baseDir}/redis.js get <key>                      # Auto-detects type (string/hash/list/set/zset)
node {baseDir}/redis.js set <key> <value>              # Set string
node {baseDir}/redis.js set <key> <value> --ttl 3600   # Set with expiry
node {baseDir}/redis.js del <key>                      # Delete
node {baseDir}/redis.js scan "user:*" --count 100      # Scan keys (production-safe)
node {baseDir}/redis.js keys "session:*"               # List keys (small DBs only)
node {baseDir}/redis.js hset <key> <field> <value>     # Hash set
node {baseDir}/redis.js hget <key> <field>             # Hash get
node {baseDir}/redis.js hgetall <key>                  # Hash all fields
node {baseDir}/redis.js lpush <key> <value>            # List push
node {baseDir}/redis.js lrange <key> 0 -1              # List range
node {baseDir}/redis.js type <key>                     # Key type
node {baseDir}/redis.js ttl <key>                      # Time to live
node {baseDir}/redis.js info                           # Server info
node {baseDir}/redis.js dbsize                         # Key count
```

---

## Output Formats

PostgreSQL, SQLite, MySQL support `--format` flag:
- `table` (default) — aligned columns with box-drawing borders
- `json` — one JSON object per line (great for piping)
- `csv` — comma-separated with header row
