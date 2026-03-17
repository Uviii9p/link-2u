import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api');
const BASE_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : (typeof window !== 'undefined' ? window.location.origin : '');

export const uploadImages = async (files, collection = 'Uncategorized') => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });
  formData.append('collection', collection);

  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getGallery = async () => {
  const response = await axios.get(`${API_URL}/gallery`);
  return response.data;
};

export const getAnalytics = async () => {
  const response = await axios.get(`${API_URL}/analytics`);
  return response.data;
};

export const deleteImage = async (id) => {
  const response = await axios.post(`${API_URL}/delete`, { id });
  return response.data;
};

export const renameImage = async (id, newName) => {
  const response = await axios.post(`${API_URL}/rename`, { id, newName });
  return response.data;
};

export const moveImage = async (id, collection) => {
  const response = await axios.post(`${API_URL}/move`, { id, collection });
  return response.data;
};

export const getShortLink = (shortId) => {
  return `${BASE_URL}/s/${shortId}`;
};
