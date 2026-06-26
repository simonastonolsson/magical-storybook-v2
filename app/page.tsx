"use client";

import { useState, useRef } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);

  // Nya states för LoRA-träningen
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedLoraUrl, setTrainedLoraUrl] = useState('');

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // När användaren väljer 5-15 bilder
  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  // Den stora träningsprocessen!
  const startTraining = async () => {
    if (selectedFiles.length < 3) {
      alert("Please select at least 3 photos of the character for good results!");
      return;
    }

    try {
      // 1. Packa bilderna i en ZIP-fil
      setTrainingStatus("Zipping images... 📦");
      const zip = new JSZip();
      selectedFiles.forEach((file, index) => {
        const extension = file.name.split('.').pop();
        zip.file(`image_${index}.${extension}`, file);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 2. Ladda upp ZIP-filen till Vercel
      setTrainingStatus("Uploading to server... ☁️");
      const uploadResponse = await fetch(`/api/upload?filename=training_images.zip`, {
        method: 'POST',
        body: zipBlob,
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");
      const { url: zipUrl } = await uploadResponse.json();

      // 3. Skicka ZIP-länken till vårt nya API som startar Replicate-träningen
      setTrainingStatus("Starting AI training... 🚀");
      const trainResponse = await fetch('/api/train-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipUrl }),
      });
      if (!trainResponse.ok) throw new Error("Failed to start training");
      const { trainingId } = await trainResponse.json();

      setTrainingStatus("Training AI... ⏳ (Please leave this tab open! Takes ~10-15 mins)");

      // 4. Fråga var 15:e sekund om träningen är klar
      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/check-training?id=${trainingId}`);
          const checkData = await checkRes.json();

          if (checkData.status === 'succeeded') {
            clearInterval(pollInterval);
            // Replicate skickar tillbaka en URL (en .tar-fil) med modellens "hjärna"
            setTrainedLoraUrl(checkData.output?.weights || checkData.output || "ready");
            setTrainingStatus("✅ Training Complete! Your AI is ready.");
          } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
            clearInterval(pollInterval);
            setTrainingStatus("❌ Training failed. Please try again.");
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 15000);

    } catch (error) {
      console.error("Training error:", error);
      setTrainingStatus("❌ Something went wrong.");
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Denna anropas i nästa steg när du klickar på Generate Comic Book
  const generateImagesForComic = async (comicData: any, loraUrl: string) => {
    setIsGeneratingImages(true);
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      if (i > 0) await delay(15000);

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: panel.image_prompt, loraUrl }), 
        });
        if (response.ok) {
          const data = await response.json();
          setGeneratedImages(prev => ({...prev, [panel.panel_number]: data.imageUrl}));
        }
      } catch (err) {
        console.error(`Failed to generate image`, err);
      }
      setCurrentlyGeneratingPanel(null);
    }
    setIsGeneratingImages(false);
  };

  const handleCreateStory = async () => {
    if (!memory.trim()) {
      alert("Please describe a memory or an idea first!");
