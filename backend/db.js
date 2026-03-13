const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Use /tmp for Vercel's read-only environment to prevent deployment crashes
const dbPath = process.env.VERCEL 
  ? path.join(os.tmpdir(), 'analytics.sqlite') 
  : path.join(__dirname, 'analytics.sqlite');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    github_path TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    github_url TEXT,
    cdn_url TEXT,
    preview_url TEXT,
    short_link TEXT UNIQUE,
    collection TEXT DEFAULT 'Uncategorized',
    views INTEGER DEFAULT 0,
    bandwidth_used INTEGER DEFAULT 0,
    palette TEXT,
    tags TEXT,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_images INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_bandwidth INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    uploads INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0
  );
  
  INSERT INTO analytics_stats (id, total_images) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM analytics_stats WHERE id = 1);
`);

const statements = {
  insertImage: db.prepare(`
    INSERT INTO images (id, filename, original_name, github_path, size, mime_type, width, height, github_url, cdn_url, preview_url, short_link, collection, palette, tags, caption)
    VALUES (@id, @filename, @original_name, @github_path, @size, @mime_type, @width, @height, @github_url, @cdn_url, @preview_url, @short_link, @collection, @palette, @tags, @caption)
  `),
  getAllImages: db.prepare(`SELECT * FROM images ORDER BY created_at DESC`),
  getImage: db.prepare(`SELECT * FROM images WHERE id = ?`),
  getImageByShortLink: db.prepare(`SELECT * FROM images WHERE short_link = ?`),
  getImageByFilename: db.prepare(`SELECT * FROM images WHERE filename = ?`),
  updateCollection: db.prepare(`UPDATE images SET collection = ? WHERE id = ?`),
  deleteImage: db.prepare(`DELETE FROM images WHERE id = ?`),
  renameImage: db.prepare(`UPDATE images SET filename = ? WHERE id = ?`),
  incrementView: db.prepare(`
    UPDATE images SET views = views + 1, bandwidth_used = bandwidth_used + size WHERE short_link = ?
  `),
  updateGlobalAnalytics: db.prepare(`
    UPDATE analytics_stats SET 
      total_images = (SELECT COUNT(*) FROM images),
      total_views = (SELECT SUM(views) FROM images),
      total_bandwidth = (SELECT SUM(bandwidth_used) FROM images)
    WHERE id = 1
  `),
  getAnalytics: db.prepare(`SELECT * FROM analytics_stats WHERE id = 1`),
  recordUpload: db.prepare(`
    INSERT INTO daily_stats (date, uploads) 
    VALUES (date('now'), 1) 
    ON CONFLICT(date) DO UPDATE SET uploads = uploads + 1
  `),
  recordView: db.prepare(`
    INSERT INTO daily_stats (date, views) 
    VALUES (date('now'), 1) 
    ON CONFLICT(date) DO UPDATE SET views = views + 1
  `),
  getDailyStats: db.prepare(`
    SELECT * FROM daily_stats 
    WHERE date >= date('now', '-6 days') 
    ORDER BY date ASC
  `)
};

module.exports = { db, ...statements };
