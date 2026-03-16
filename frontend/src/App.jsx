import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Routes, Route, useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  CloudUpload,
  Image as ImageIcon,
  BarChart3,
  Settings,
  Link,
  Download,
  Trash2,
  Edit2,
  Copy,
  Moon,
  Sun,
  Github,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
  QrCode,
  Share2,
  Eye,
  Info,
  Sparkles,
  Search,
  Move,
  Grid,
  List,
  Filter,
  Tag,
  Zap,
  ArrowRight,
  Layers,
  Video,
  Box
} from 'lucide-react';
import { uploadImages, getGallery, getAnalytics, deleteImage, getShortLink } from './api';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api');
const APP_NAME = "StellarVault";

// Safe JSON Parse Helper
const safeParse = (str, fallback = []) => {
  try {
    if (!str) return fallback;
    const parsed = typeof str === 'string' ? JSON.parse(str) : str;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-10 font-mono">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
          <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">System Malfunction</h1>
          <p className="text-slate-400 mb-8 max-w-md text-center">{this.state.error?.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-4 bg-indigo-600 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20"
          >
            Reboot Systems
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      <Toaster position="bottom-right" />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/i/:filename" element={<PublicPage theme={theme} toggleTheme={toggleTheme} />} />
        </Routes>
      </ErrorBoundary>
      
      {/* Background decoration */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] pointer-events-none z-0" />
    </div>
  );
}

function Logo({ className = "w-10 h-10" }) {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl rotate-12 blur-sm opacity-50"></div>
      <div className="relative bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center p-2 shadow-xl ring-1 ring-white/20">
        <Sparkles className="text-white w-full h-full" />
      </div>
    </div>
  );
}

function Dashboard({ theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [images, setImages] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  
  const navigate = useNavigate();
  const safeImages = useMemo(() => Array.isArray(images) ? images : [], [images]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set(['All']);
    safeImages.forEach(img => {
      safeParse(img.tags).forEach(t => tags.add(t));
    });
    return Array.from(tags);
  }, [safeImages]);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchData = async () => {
    setIsGalleryLoading(true);
    try {
      if (activeTab === 'gallery' || activeTab === 'upload') {
        const data = await getGallery();
        setImages(data.images);
      }
      if (activeTab === 'analytics') {
        const data = await getAnalytics();
        setAnalytics(data);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Sync failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsGalleryLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Purge ${selectedIds.size} fragments from existence?`)) return;
    const toastId = toast.loading(`Wiping data...`);
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteImage(id)));
      toast.success('Assets cleared', { id: toastId });
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      fetchData();
    } catch {
      toast.error('Purge failed', { id: toastId });
    }
  };

  const handleBulkCopy = () => {
    const selectedImages = images.filter(img => selectedIds.has(img.id));
    const links = selectedImages.map(img => img.cdn_url).join('\n');
    navigator.clipboard.writeText(links);
    toast.success(`${selectedIds.size} links copied to pocket!`);
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const handleUpload = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress(10);
    
    const interval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 5, 95));
    }, 100);

    try {
      const response = await uploadImages(acceptedFiles);
      
      if (!response.uploaded || response.uploaded.length === 0) {
        throw new Error('No files could be secured in the vault.');
      }

      const isMultiple = response.uploaded.length > 1;
      
      // Copy the link of the first (or only) uploaded file
      const firstAsset = response.uploaded[0];
      const linkToCopy = getShortLink(firstAsset.short_link);
      navigator.clipboard.writeText(linkToCopy);
      
      toast.success(isMultiple ? 'All fragments secured. First link copied!' : 'Asset secured and link copied!');
      fetchData();
      setActiveTab('gallery');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Process failed');
    } finally {
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const filteredImages = safeImages.filter(img => {
    const matchesSearch = img.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const tags = safeParse(img.tags);
    const matchesTag = selectedTag === 'All' || tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-200 dark:border-slate-800 flex flex-col fixed h-full z-10 hidden md:flex overflow-hidden">
        <div className="p-8 flex items-center gap-4">
          <Logo />
          <div>
            <h1 className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              {APP_NAME}
            </h1>
            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase opacity-80">Media Vault</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <NavItem icon={CloudUpload} label="Direct Upload" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
          <NavItem icon={ImageIcon} label="Asset Gallery" active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} />
          <NavItem icon={BarChart3} label="Vault Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
          
          <div className="pt-8 pb-4">
             <p className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Galaxy Tags</p>
             <div className="px-2 space-y-1">
                {allTags.slice(0, 8).map(tag => (
                  <button 
                    key={tag}
                    onClick={() => { setActiveTab('gallery'); setSelectedTag(tag); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTag === tag ? 'bg-indigo-500/10 text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500'}`}
                  >
                    <Tag className="w-3 h-3" /> {tag}
                  </button>
                ))}
             </div>
          </div>
        </nav>

        <div className="p-4 space-y-2 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20 backdrop-blur-md">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-400 font-bold text-sm"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            <span>Mode Shift</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen relative overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 p-6 lg:p-12 max-w-7xl mx-auto w-full relative z-0">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <Header title="Secure Terminal" subtitle="Upload assets to GitHub Cloud instantly." />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2">
                      <UploadView onUpload={handleUpload} isUploading={isUploading} progress={uploadProgress} />
                   </div>
                   <div className="space-y-6">
                      <FeatureCard icon={Zap} title="Instant CDN" desc="Global edge caching activated by default." />
                      <FeatureCard icon={ArrowRight} title="Direct Link" desc="Copy links instantly after successful upload." />
                      <div className="glass-panel rounded-3xl p-6 border border-indigo-500/10">
                         <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-500"/> Real-time Preview</h3>
                         <div className="aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 italic text-slate-400 text-xs">
                            Awaiting upload...
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'gallery' && (
              <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <Header 
                    title="Asset Vault" 
                    subtitle={`Browsing ${selectedTag === 'All' ? 'global' : `#${selectedTag}`} fragments.`} 
                    className="mb-0"
                  />
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {isSelectionMode && selectedIds.size > 0 && (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleBulkCopy}
                          className="px-4 py-2.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-green-600 hover:text-white transition-all shadow-lg shadow-green-500/10"
                        >
                          <Copy className="w-4 h-4" /> Copy ({selectedIds.size})
                        </button>
                        <button 
                          onClick={handleBulkDelete}
                          className="px-4 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" /> Purge
                        </button>
                      </div>
                    )}
                    
                    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
                       <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-500' : 'text-slate-400'}`}><Grid className="w-4 h-4" /></button>
                       <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-500' : 'text-slate-400'}`}><List className="w-4 h-4" /></button>
                    </div>

                    <button 
                      onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                      className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isSelectionMode ? 'bg-indigo-600 text-white shadow-indigo-600/30 shadow-lg' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
                    >
                      {isSelectionMode ? <CheckCircle2 className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      {isSelectionMode ? 'Finish' : 'Bulk Action'}
                    </button>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search files..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-56 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                <GalleryView 
                   images={filteredImages} 
                   loading={isGalleryLoading}
                   viewMode={viewMode}
                   onImageSelect={(img) => isSelectionMode ? toggleSelection(img.id) : navigate(`/i/${img.filename}`)} 
                   isSelectionMode={isSelectionMode}
                   selectedIds={selectedIds}
                />
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Header title="Stellar Statistics" subtitle="Real-time metrics from the galactic vault." />
                <AnalyticsView analytics={analytics} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function PublicPage({ theme, toggleTheme }) {
  const { filename } = useParams();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await axios.get(`${API_URL}/image/${filename}`);
        setImage(response.data.image);
      } catch {
        toast.error('Asset detached from vault');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchImage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><motion.div animate={{ scale: [1, 1.5, 1], rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }} className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!image) return null;

  const palette = safeParse(image.palette);
  const tags = safeParse(image.tags);
  const shortUrl = getShortLink(image.short_link);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Secured to pocket');
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <header className="glass-panel border-b border-slate-200 dark:border-slate-800 p-4 px-8 flex justify-between items-center sticky top-0 z-20">
        <RouterLink to="/" className="flex items-center gap-3 group">
          <Logo className="w-8 h-8 group-hover:rotate-[360deg] transition-transform duration-700" />
          <h1 className="font-black text-xl tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">{APP_NAME}</h1>
        </RouterLink>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>
          <RouterLink to="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20">Dashboard</RouterLink>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-12 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Image View */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel rounded-[2.5rem] overflow-hidden aspect-video relative flex items-center justify-center bg-slate-50 dark:bg-black/80 border border-slate-200 dark:border-slate-800 group p-4">
            {image.mime_type?.startsWith('video/') ? (
              <video 
                src={image.cdn_url} 
                controls 
                className="max-w-full max-h-full rounded-2xl shadow-2xl z-10"
              />
            ) : image.mime_type === 'application/vnd.android.package-archive' || image.filename.endsWith('.apk') ? (
              <div className="flex flex-col items-center gap-6 z-10">
                 <Box className="w-24 h-24 text-indigo-500 animate-bounce" />
                 <p className="font-black text-xl tracking-widest uppercase italic">Android Core Packet</p>
              </div>
            ) : (
              <img 
                src={image.cdn_url} 
                alt={image.filename} 
                className="max-w-full max-h-full object-contain shadow-2xl z-10 p-4 group-hover:scale-[1.01] transition-transform duration-500" 
              />
            )}
            <div className="absolute inset-0 bg-grid-slate-200 dark:bg-grid-white opacity-5 z-0" />
          </div>

          <div className="glass-panel rounded-[2.5rem] p-10 border border-indigo-500/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-black mb-3 tracking-tighter">{image.filename}</h2>
                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {image.views}</span>
                  <span className="flex items-center gap-1.5"><Info className="w-4 h-4" /> {(image.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => handleCopy(image.cdn_url)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20">
                    <Share2 className="w-5 h-5" /> Share Data
                 </button>
              </div>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-lg mb-10 leading-relaxed font-medium italic border-l-4 border-indigo-500 pl-6">
              "{image.caption}"
            </p>

            <div className="flex flex-wrap gap-2.5 mb-10">
              {tags.map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-500/10">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
               <h3 className="font-black text-xs tracking-[0.2em] text-slate-400 uppercase mb-6 flex items-center gap-3">
                  <div className="w-6 h-1 bg-indigo-500 rounded-full"></div> Spectral Palette
               </h3>
               <div className="flex gap-4">
                  {palette.map(color => (
                    <div 
                      key={color} 
                      className="w-16 h-16 rounded-2xl shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all border-4 border-white dark:border-slate-800 flex items-center justify-center group" 
                      style={{ backgroundColor: color }}
                      onClick={() => handleCopy(color)}
                    >
                      <Copy className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="glass-panel rounded-[2.5rem] p-10 text-center flex flex-col items-center border border-indigo-500/10">
            <QrCode className="w-10 h-10 text-indigo-500 mb-6" />
            <h3 className="font-black text-xl mb-4 tracking-tight">Vault Entry</h3>
            <div className="p-6 bg-white rounded-3xl mb-8 shadow-2xl ring-1 ring-slate-100">
               <QRCodeSVG value={shortUrl} size={180} />
            </div>
            <p className="text-xs text-slate-500 font-bold mb-8 leading-relaxed max-w-[200px] uppercase tracking-widest">Global CDN Access Node Activated</p>
            <button onClick={() => handleCopy(shortUrl)} className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-colors uppercase tracking-widest">
              <Link className="w-5 h-5" /> Copy Short Link
            </button>
          </div>

          <div className="glass-panel rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 space-y-6">
            <h3 className="font-black text-xs tracking-[0.3em] text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-4 italic">Direct Flow</h3>
            <CopyField label="Global CDN URL" value={image.cdn_url} onCopy={handleCopy} />
          </div>
        </div>
      </main>
      
      <footer className="p-12 text-center text-slate-400 text-[10px] font-black tracking-[0.4em] uppercase opacity-40">
        <p>&copy; 2026 // STELLAR VAULT // ALL SYSTEMS NOMINAL</p>
      </footer>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${
      active 
        ? 'bg-indigo-600 text-white font-bold shadow-xl shadow-indigo-600/30' 
        : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-bold'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'animate-pulse' : ''}`} />
    <span className="tracking-tight text-sm">{label}</span>
  </button>
);

// eslint-disable-next-line no-unused-vars
const FeatureCard = ({ icon: Icon, title, desc }) => (
  <div className="glass-panel rounded-3xl p-6 border border-slate-100 dark:border-slate-800/50 flex gap-4 items-start group hover:-translate-y-1 transition-all">
    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-500 group-hover:rotate-12 transition-transform">
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <h4 className="font-black text-sm tracking-tight mb-1 uppercase">{title}</h4>
      <p className="text-xs text-slate-500 font-medium">{desc}</p>
    </div>
  </div>
);

const Header = ({ title, subtitle, className = "mb-10" }) => (
  <div className={className}>
    <h2 className="text-4xl font-black tracking-tighter mb-2 italic underline decoration-indigo-500 decoration-8 underline-offset-[12px]">{title}</h2>
    <p className="text-slate-500 dark:text-indigo-400/60 text-lg font-bold tracking-tight italic mt-6">{subtitle}</p>
  </div>
);

const UploadView = ({ onUpload, isUploading, progress }) => {
  const onDrop = useCallback(acceptedFiles => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/*': [], 
      'video/*': [],
      'application/vnd.android.package-archive': ['.apk']
    },
    maxSize: 100 * 1024 * 1024 // 100MB for clips/apk
  });

  useEffect(() => {
    const handlePaste = (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.includes('image')) {
          onUpload([item.getAsFile()]);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onUpload]);

  return (
    <div 
      {...getRootProps()} 
      className={`relative overflow-hidden glass-panel border-4 border-dashed rounded-[3rem] p-16 flex flex-col items-center justify-center gap-8 cursor-pointer transition-all duration-500 min-h-[500px] shadow-2xl ${
        isDragActive 
          ? 'border-indigo-500 bg-indigo-500/5 rotate-1 scale-[1.01]' 
          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/30'
      }`}
    >
      <input {...getInputProps()} />
      
      {isUploading ? (
        <div className="w-full flex flex-col items-center z-10">
          <motion.div animate={{ scale: [1, 1.1, 1], rotate: 360 }} transition={{ repeat: Infinity, duration: 4 }} className="mb-8">
            <Logo className="w-24 h-24 scale-150" />
          </motion.div>
          <h3 className="text-2xl font-black mb-3 italic">Syncing Flux...</h3>
          <div className="w-full max-w-sm h-3 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden p-0.5">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-4 text-[10px] font-black tracking-widest text-indigo-500 uppercase">{Math.round(progress)}% Secure</p>
        </div>
      ) : (
        <>
          <div className="w-32 h-32 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2 relative scale-110">
             <CloudUpload className="relative w-14 h-14" />
          </div>
          <div className="text-center z-10">
            <h3 className="text-3xl font-black mb-3 tracking-tighter uppercase italic">Ready for Sync</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 max-w-xs leading-relaxed text-sm uppercase tracking-widest mx-auto">
              Drag & Drop // CTRL + V <br/>
              <span className="text-[10px] opacity-60">High frequency assets only</span>
            </p>
            <div className="flex bg-slate-950 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-2xl transition-all active:scale-95 uppercase tracking-[0.3em] inline-block">
              Open Vault
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const GalleryView = ({ images, loading, viewMode, onImageSelect, isSelectionMode, selectedIds }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="aspect-[4/5] rounded-[2.5rem] bg-slate-200 dark:bg-slate-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="glass-panel rounded-[3rem] p-24 text-center flex flex-col items-center justify-center border-4 border-dashed border-slate-200 dark:border-slate-900 mt-10 min-h-[500px]">
        <ImageIcon className="w-16 h-16 text-slate-300 mb-6" />
        <h2 className="text-3xl font-black mb-3 tracking-tighter uppercase italic">Vault Depleted</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Awaiting new data streams.</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {images.map(img => (
          <div 
            key={img.id} 
            onClick={() => onImageSelect(img)}
            className={`flex items-center gap-6 p-4 glass-panel rounded-3xl border transition-all cursor-pointer ${selectedIds?.has(img.id) ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-100 dark:border-slate-800'}`}
          >
            {img.mime_type?.startsWith('video/') ? (
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Video className="w-8 h-8" />
              </div>
            ) : img.mime_type === 'application/vnd.android.package-archive' || img.filename.endsWith('.apk') ? (
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Box className="w-8 h-8" />
              </div>
            ) : (
              <img src={img.preview_url || img.cdn_url} className="w-20 h-20 rounded-2xl object-cover" alt="" />
            )}
            <div className="flex-1 min-w-0">
               <h4 className="font-black text-lg italic tracking-tight mb-1 truncate">{img.filename}</h4>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Eye className="w-3 h-3" /> {img.views} views • {img.size > 1024*1024 ? (img.size/(1024*1024)).toFixed(2)+' MB' : (img.size/1024).toFixed(1)+' KB'}
               </p>
            </div>
            <ArrowRight className="w-5 h-5 text-indigo-500 mr-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
      <AnimatePresence>
        {images.map((img, i) => {
          const isSelected = selectedIds?.has(img.id);
          return (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: isSelected ? 0.96 : 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`group relative aspect-[4/5] rounded-[2.5rem] overflow-hidden glass-panel border cursor-pointer transition-all duration-500 isolate hover:-translate-y-3 ${
                isSelected ? 'border-indigo-500 ring-8 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800'
              }`}
              onClick={() => onImageSelect(img)}
            >
            {img.mime_type?.startsWith('video/') ? (
              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-indigo-400 gap-3">
                 <Video className="w-12 h-12 animate-pulse" />
                 <span className="text-[10px] font-black tracking-widest uppercase">Flux Stream</span>
              </div>
            ) : img.mime_type === 'application/vnd.android.package-archive' || img.filename.endsWith('.apk') ? (
              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-amber-400 gap-3">
                 <Box className="w-12 h-12" />
                 <span className="text-[10px] font-black tracking-widest uppercase">Logic core</span>
              </div>
            ) : (
              <img 
                src={img.preview_url || img.cdn_url} 
                className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isSelected ? 'brightness-50' : ''}`}
                loading="lazy"
              />
            )}
              
              {isSelectionMode && (
                <div className={`absolute top-6 left-6 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 rotate-12 scale-110' : 'bg-black/20 border-white/50'}`}>
                   <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
              )}

              {!isSelectionMode && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(img.cdn_url);
                    toast.success('Link Secured');
                  }}
                  className="absolute bottom-6 right-6 w-12 h-12 bg-white text-indigo-600 hover:bg-slate-900 hover:text-white rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-2xl z-20 active:scale-90"
                >
                  <Copy className="w-5 h-5" />
                </button>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="absolute inset-x-0 bottom-0 p-8 opacity-0 group-hover:opacity-100 translate-y-6 group-hover:translate-y-0 transition-all duration-500">
                 <p className="text-white text-lg font-black italic tracking-tighter mb-1 truncate">{img.filename}</p>
                 <div className="flex items-center gap-3 text-[10px] text-white/50 font-black uppercase tracking-widest">
                    <span>{img.views} views</span>
                 </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const AnalyticsView = ({ analytics }) => {
  const stats = analytics?.stats || null;
  const recent = Array.isArray(analytics?.recent) ? analytics.recent : [];
  const daily = Array.isArray(analytics?.daily) ? analytics.daily : [];
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chartData = useMemo(() => {
    if (daily.length === 0) {
      return [
        { name: 'Node A', views: 0, upload: 0 },
        { name: 'Node B', views: 0, upload: 0 },
        { name: 'Node C', views: 0, upload: 0 },
      ];
    }
    return daily.map(d => {
      const dateObj = new Date(d.date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        name: dayName,
        views: d.views || 0,
        upload: d.uploads || 0
      };
    });
  }, [daily]);

  if (!analytics || !stats) return <div className="animate-pulse h-96 glass-panel rounded-[3rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest">Awaiting Data Streams...</div>;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard title="Total Fragments" value={stats?.total_images || 0} icon={ImageIcon} color="blue" />
        <StatCard title="Global Exposure" value={stats?.total_views || 0} icon={Sparkles} color="purple" />
        <StatCard title="Storage Mass" value={`${((stats?.total_bandwidth || 0) / (1024 * 1024)).toFixed(2)} MB`} icon={CloudUpload} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="glass-panel rounded-[3rem] p-10 border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-black mb-8 italic tracking-tight flex items-center gap-3"><Zap className="w-5 h-5 text-indigo-500" /> Interaction Wave</h3>
            <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorViews)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="glass-panel rounded-[3rem] p-10 border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-black mb-8 italic tracking-tight flex items-center gap-3"><Layers className="w-5 h-5 text-indigo-500" /> Latest Nodes</h3>
            <div className="space-y-4">
               {recent?.map(img => (
                 <div key={img.id} className="flex items-center gap-4 group cursor-pointer">
                    <img src={img.preview_url || img.cdn_url} className="w-12 h-12 rounded-xl object-cover grayscale group-hover:grayscale-0 transition-all" />
                    <div className="flex-1">
                       <p className="font-black text-sm italic truncate">{img.filename}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{img.views} views</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-500" />
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line no-unused-vars
const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorMap = {
    blue: "from-blue-500/20 to-transparent bg-blue-500/5 text-blue-600 border-blue-500/10",
    purple: "from-purple-500/20 to-transparent bg-purple-500/5 text-purple-600 border-purple-500/10",
    indigo: "from-indigo-500/20 to-transparent bg-indigo-500/5 text-indigo-600 border-indigo-500/10",
  };
  return (
    <div className={`glass-panel rounded-[2.5rem] p-10 border transition-all hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-br ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black opacity-60 mb-2 uppercase tracking-[0.4em]">{title}</p>
          <h3 className="text-5xl font-black tracking-tighter italic">{value}</h3>
        </div>
        <Icon className="w-8 h-8 opacity-20" />
      </div>
    </div>
  );
};

const CopyField = ({ label, value, onCopy }) => (
  <div>
    <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.3em] leading-none italic">{label}</p>
    <div className="flex bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
      <input type="text" readOnly value={value} className="flex-1 bg-transparent px-5 py-4 text-sm focus:outline-none font-bold italic" />
      <button onClick={() => onCopy(value)} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-950 hover:text-white transition-all text-slate-600 dark:text-slate-300 font-bold">
        <Copy className="w-5 h-5" />
      </button>
    </div>
  </div>
);
