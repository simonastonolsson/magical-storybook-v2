"use client";

import { useState, useRef } from 'react';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setIsUploading(true);

    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) throw new Error('Failed to upload image.');

      const newBlob = await response.json();
      setImageUrl(newBlob.url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Could not upload your image, please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // En liten hjälpfunktion för att pausa koden
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // KÖ-SYSTEM MED PAUS
  const generateImagesForComic = async (comicData: any, uploadedImageUrl: string) => {
    setIsGeneratingImages(true);
    
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      // Om det inte är första bilden, vänta i 15 sekunder först!
      if (i > 0) {
        await delay(15000); 
      }

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: panel.image_prompt, imageUrl: uploadedImageUrl }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setG
