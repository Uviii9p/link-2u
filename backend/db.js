import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localDbPath = path.join(__dirname, 'analytics.json');
const dbPath = process.env.VERCEL
  ? path.join(os.tmpdir(), 'analytics.json')
  : localDbPath;

let data = {
  images: [],
  analytics_stats: { id: 1, total_images: 0, total_views: 0, total_bandwidth: 0, updated_at: new Date().toISOString() },
  daily_stats: {}
};

const loadDB = () => {
  try {
    if (fs.existsSync(dbPath)) {
      data = fs.readJsonSync(dbPath);
    } else if (process.env.VERCEL && fs.existsSync(localDbPath)) {
      data = fs.readJsonSync(localDbPath);
      saveDB();
    } else {
      saveDB();
    }
  } catch (err) {
    console.error('Failed to load DB:', err);
  }
};

const saveDB = () => {
  try {
    fs.writeJsonSync(dbPath, data, { spaces: 2 });
  } catch (err) {
    console.error('Failed to save DB:', err);
  }
};

const getState = () => data;
const setState = (newData) => {
  data = { ...data, ...newData };
  saveDB();
};

loadDB();

const statements = {
  insertImage: {
    run: (img) => {
      img.created_at = img.created_at || new Date().toISOString();
      img.views = img.views || 0;
      img.bandwidth_used = img.bandwidth_used || 0;
      data.images.push(img);
      saveDB();
    }
  },
  getAllImages: {
    all: () => [...data.images].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
  },
  getImage: {
    get: (id) => data.images.find(i => i.id === id) || null
  },
  getImageByShortLink: {
    get: (short) => data.images.find(i => i.short_link === short) || null
  },
  getImageByFilename: {
    get: (name) => data.images.find(i => i.filename === name) || null
  },
  updateCollection: {
    run: (col, id) => {
      const img = data.images.find(i => i.id === id);
      if (img) { img.collection = col; saveDB(); }
    }
  },
  deleteImage: {
    run: (id) => {
      data.images = data.images.filter(i => i.id !== id);
      saveDB();
    }
  },
  renameImage: {
    run: (name, id) => {
      const img = data.images.find(i => i.id === id);
      if (img) { img.filename = name; saveDB(); }
    }
  },
  incrementView: {
    run: (short) => {
      const img = data.images.find(i => i.short_link === short);
      if (img) {
        img.views = (img.views || 0) + 1;
        img.bandwidth_used = (img.bandwidth_used || 0) + (img.size || 0);
        saveDB();
      }
    }
  },
  updateGlobalAnalytics: {
    run: () => {
      data.analytics_stats.total_images = data.images.length;
      data.analytics_stats.total_views = data.images.reduce((sum, img) => sum + (img.views || 0), 0);
      data.analytics_stats.total_bandwidth = data.images.reduce((sum, img) => sum + (img.bandwidth_used || 0), 0);
      data.analytics_stats.updated_at = new Date().toISOString();
      saveDB();
    }
  },
  getAnalytics: {
    get: () => data.analytics_stats
  },
  recordUpload: {
    run: () => {
      const today = new Date().toISOString().split('T')[0];
      if (!data.daily_stats[today]) data.daily_stats[today] = { date: today, uploads: 0, views: 0 };
      data.daily_stats[today].uploads++;
      saveDB();
    }
  },
  recordView: {
    run: () => {
      const today = new Date().toISOString().split('T')[0];
      if (!data.daily_stats[today]) data.daily_stats[today] = { date: today, uploads: 0, views: 0 };
      data.daily_stats[today].views++;
      saveDB();
    }
  },
  getDailyStats: {
    all: () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const limitDate = sixDaysAgo.toISOString().split('T')[0];
      
      return Object.values(data.daily_stats)
        .filter(d => d.date >= limitDate)
        .sort((a,b) => a.date.localeCompare(b.date));
    }
  }
};

export default { ...statements, getState, setState };
