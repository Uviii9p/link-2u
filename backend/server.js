require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const dbHandler = require('./db');
const fs = require('fs-extra');
const os = require('os');

// Optional native dependencies (may fail on Vercel)
let sharp, Vibrant;
try { sharp = require('sharp'); } catch (e) { console.warn('sharp not available, image processing disabled'); }
try { Vibrant = require('node-vibrant'); } catch (e) { console.warn('node-vibrant not available, palette extraction disabled'); }

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.get('/api/ping', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Set up Multer (Disk storage for stability with large files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.VERCEL 
      ? path.join(os.tmpdir(), 'temp_uploads') 
      : path.join(__dirname, 'temp_uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/vnd.android.package-archive'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ext === '.apk') {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type (${file.mimetype}). Images, Videos, and APKs only.`));
    }
  }
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'Uviii9p';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ima';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const uploadToGitHub = async (base64Content, gitPath, message) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${gitPath}`;
    const response = await axios.put(url, {
      message: message || "Upload image from GitHub Image Cloud",
      content: base64Content,
      branch: BRANCH
    }, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return response.data;
  } catch (err) {
    if (err.response?.data?.message === 'this exceeds the maximum allowed size of 25 MB') {
      throw new Error('GitHub limit reached: File exceeds 25 MB limit for REST API.');
    }
    throw err;
  }
};

const deleteFromGitHub = async (gitPath, sha, message) => {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${gitPath}`;
  await axios.delete(url, {
    data: {
      message: message || "Delete image from GitHub Image Cloud",
      sha: sha,
      branch: BRANCH
    },
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
};

const getFileSha = async (gitPath) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${gitPath}?ref=${BRANCH}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    return response.data.sha;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
};

const generateShortLink = () => {
  return crypto.randomBytes(4).toString('hex');
};

app.post('/api/upload', upload.array('images', 50), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub token not configured.' });
  }

  const results = [];

  for (const file of req.files) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      const fileId = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase();
      const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
      const filename = (isImage && sharp)
        ? `photo-${Date.now()}-${crypto.randomBytes(2).toString('hex')}.webp`
        : `file-${Date.now()}-${crypto.randomBytes(2).toString('hex')}${ext || '.bin'}`;
      
      const gitPath = `${isImage ? 'images' : 'files'}/${year}/${month}/${filename}`;
      const thumbGitPath = `thumbnails/${year}/${month}/${filename}`;

      // File Classification
      const isVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
      const isApk = file.originalname.toLowerCase().endsWith('.apk') || file.mimetype === 'application/vnd.android.package-archive';

      // Read file from disk
      const fileBuffer = await fs.readFile(file.path);
      
      let processedBuffer = fileBuffer;
      let thumbBuffer = Buffer.alloc(0);
      let finalMetadata = { width: 0, height: 0 };
      let palette = [];

      if (isImage && sharp) {
        // Image processing (sharp available)
        let processedImage = sharp(fileBuffer);
        const metadata = await processedImage.metadata();
        
        if (metadata.width > 3000 || metadata.height > 3000) {
          processedImage = processedImage.resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true });
        }
        
        processedImage = processedImage.webp({ quality: 80 });
        processedBuffer = await processedImage.toBuffer();
        finalMetadata = await sharp(processedBuffer).metadata();
        
        // Thumbnail
        thumbBuffer = await sharp(processedBuffer)
          .resize({ width: 400, height: 400, fit: 'cover' })
          .webp({ quality: 60 })
          .toBuffer();

        // Palette Extraction
        if (Vibrant) {
          try {
            const swatches = await Vibrant.from(fileBuffer).getPalette();
            palette = Object.keys(swatches)
              .filter(k => swatches[k])
              .map(k => swatches[k].getHex());
          } catch (err) {
            console.error("Palette extraction failed:", err.message);
          }
        }
      }

      // AI Tags & Caption (Cosmic Logic)
      const cosmicTags = ['void', 'fragment', 'stellar', 'data-cluster', 'nebula'];
      const randomTags = cosmicTags.sort(() => 0.5 - Math.random()).slice(0, 2);
      let typeTag = 'binary';
      if (isImage) typeTag = 'vision';
      if (isVideo) typeTag = 'flux-stream';
      if (isApk) typeTag = 'logic-core';
      
      const tags = [...new Set([typeTag, ext.replace('.', ''), ...randomTags])];
      const caption = `[Node ${Math.floor(Math.random()*9999)}] A secured ${typeTag} fragment discovered. Origin: ${cleanOriginalName}.`;

      // Upload main image
      const base64Image = processedBuffer.toString('base64');
      await uploadToGitHub(base64Image, gitPath, `Upload ${typeTag} ${filename}`);
      
      // Upload thumbnail (only for images)
      if (isImage && thumbBuffer.length > 0) {
        const base64Thumb = thumbBuffer.toString('base64');
        try {
          await uploadToGitHub(base64Thumb, thumbGitPath, `Upload thumbnail ${filename}`);
        } catch (err) {
          console.error("Failed to upload thumbnail:", err.message);
        }
      }

      const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${BRANCH}/${gitPath}`;
      const cdnUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${GITHUB_REPO}/${gitPath}`;
      const previewUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${GITHUB_REPO}/${thumbGitPath}`;
      const shortLink = generateShortLink();

      const imageRecord = {
        id: fileId,
        filename: cleanOriginalName,
        original_name: file.originalname,
        github_path: gitPath,
        size: processedBuffer.length,
        mime_type: file.mimetype,
        width: finalMetadata.width || 0,
        height: finalMetadata.height || 0,
        github_url: rawUrl,
        cdn_url: cdnUrl,
        preview_url: previewUrl,
        short_link: shortLink,
        collection: req.body.collection || 'Uncategorized',
        palette: JSON.stringify(palette),
        tags: JSON.stringify(tags),
        caption: caption
      };

      dbHandler.insertImage.run(imageRecord);
      dbHandler.updateGlobalAnalytics.run();
      dbHandler.recordUpload.run();

      results.push(imageRecord);

    } catch (err) {
      console.error('Upload Error for file', file.originalname, err);
      // Skip failed file, continue with next
    } finally {
      // Clean up temp file
      if (file.path && fs.existsSync(file.path)) {
        await fs.remove(file.path).catch(e => console.error('Cleanup failed:', e));
      }
    }
  }

  res.json({ success: true, uploaded: results });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[System Error]', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max limit is 100MB.' });
    }
    return res.status(400).json({ error: `Upload Error: ${err.message}` });
  }
  
  // If it's an error from our fileFilter or other business logic
  const status = (err.message && err.message.includes('Only Images')) ? 400 : 500;
  res.status(status).json({ 
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.get('/api/gallery', (req, res) => {
  const images = dbHandler.getAllImages.all();
  res.json({ images });
});

app.get('/api/image/:filename', (req, res) => {
  const { filename } = req.params;
  const image = dbHandler.getImageByFilename.get(filename);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  res.json({ image });
});

app.get('/api/analytics', (req, res) => {
  dbHandler.updateGlobalAnalytics.run();
  const stats = dbHandler.getAnalytics.get();
  const recent = dbHandler.getAllImages.all().slice(0, 5);
  const daily = dbHandler.getDailyStats.all();
  res.json({ stats, recent, daily });
});

app.post('/api/delete', async (req, res) => {
  const { id } = req.body;
  const image = dbHandler.getImage.get(id);
  
  if (!image) return res.status(404).json({ error: 'Image not found' });
  
  if (GITHUB_TOKEN) {
    try {
      console.log(`[GitHub] Initiating sync-delete for image ${id}...`);
      
      // 1. Double check the file exists and get current SHA
      const sha = await getFileSha(image.github_path);
      if (sha) {
        console.log(`[GitHub] Found main file SHA: ${sha}. Deleting...`);
        await deleteFromGitHub(image.github_path, sha);
      } else {
        console.warn(`[GitHub] Main file not found or already deleted from repo.`);
      }
      
      // 2. Repeat for thumbnail
      const thumbPath = image.github_path.replace('images/', 'thumbnails/');
      const thumbSha = await getFileSha(thumbPath);
      if (thumbSha) {
        console.log(`[GitHub] Found thumbnail SHA: ${thumbSha}. Deleting...`);
        await deleteFromGitHub(thumbPath, thumbSha);
      }
      
      console.log(`[GitHub] Sync-delete completed for ${image.filename}`);
    } catch (err) {
      console.error("[GitHub] Deletion Error:", err.response?.data?.message || err.message);
      // We continue even if GitHub fails so the DB stays in sync
    }
  }

  dbHandler.deleteImage.run(id);
  dbHandler.updateGlobalAnalytics.run();
  res.json({ success: true, message: 'Image removed from vault and GitHub' });
});

app.post('/api/rename', (req, res) => {
  const { id, newName } = req.body;
  if (!id || !newName) return res.status(400).json({ error: 'Missing parameters' });
  
  const cleanName = newName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  dbHandler.renameImage.run(cleanName, id);
  res.json({ success: true });
});

app.get('/s/:shortId', (req, res) => {
  const { shortId } = req.params;
  const image = dbHandler.getImageByShortLink.get(shortId);
  
  if (!image) return res.status(404).send('Image not found');
  
  dbHandler.incrementView.run(shortId);
  dbHandler.updateGlobalAnalytics.run();
  dbHandler.recordView.run();
  
  // Set caching headers
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.redirect(image.cdn_url);
});

// Start server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

module.exports = app;
