"use client";

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedModelId, setTrainedModelId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  useEffect(() => {
    const savedModel = localStorage.getItem('my_saved_lora_model');
    if (savedModel && savedModel.includes('/')) {
      setTrainedModelId(savedModel);
      setTrainingStatus(`🎉 Hittade din sparade AI-modell! Redo att skapa berättelser.`);
    }
  }, []);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 768; 
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      };
      img.src = url;
    });
  };

  const handleStartTraining = async () => {
    if (selectedFiles.length < 5) {
      alert("Ladda upp minst 5 bilder för bästa AI-resultat!");
      return;
    }

    setIsTraining(true);
    try {
      setTrainingStatus('📦 Optimerar och packar bilderna...');
      const zip = new JSZip();
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const resizedBlob = await resizeImage(file);
        zip.file(`image_${i}.jpg`, resizedBlob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
      
      setTrainingStatus(`🚀 Kringgår molnet... omvandlar filen till text (${sizeMB} MB)...`);
      
      const reader = new FileReader();
      reader.readAsDataURL(zipBlob);
      reader.onloadend = async () => {
        const base64Zip = reader.result;
        
        try {
          setTrainingStatus('🧠 Startar träning hos Replicate... (Detta tar ca 5-10 min)');
          const trainRes = await fetch('/api/train-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zipUrl: base64Zip }),
          });
          
          if (!trainRes.ok) throw new Error('Failed to start training');
          const { trainingId } = await trainRes.json();

          setTrainingStatus('⏳ AI:n lär sig... Du kan följa framstegen. Stäng inte sidan.');
          
          const checkInterval = setInterval(async () => {
            const checkRes = await fetch(`/api/check-training?id=${trainingId}`);
            const checkData = await checkRes.json();

            if (checkData.status === 'succeeded') {
              clearInterval(checkInterval);
              const perfectModelPath = checkData.fullPath;
              setTrainedModelId(perfectModelPath);
              localStorage.setItem('my_saved_lora_model', perfectModelPath);
              setTrainingStatus('✅ Träningen är klar! Din unika AI-karaktär är sparad och redo.');
              setIsTraining(false);
            } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
              clearInterval(checkInterval);
              setTrainingStatus('❌ Träningen misslyckades. Försök igen.');
              setIsTraining(false);
            } else {
              setTrainingStatus(`⏳ AI:n tränar... (Status: ${checkData.status})`);
            }
          }, 15000);
          
        } catch (error) {
          console.error(error);
          setTrainingStatus('❌ Ett fel uppstod vid start av träningen.');
          setIsTraining(false);
        }
      };

    } catch (error) {
      console.error(error);
      setTrainingStatus('❌ Ett fel uppstod när bilderna skulle packas.');
      setIsTraining(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateImagesForComic = async (comicData: any) => {
    setIsGeneratingImages(true);
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      if (i > 0) await delay(10000); 

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: panel.image_prompt, 
            trainedModelId: trainedModelId 
          }),
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
      alert("Beskriv ett äventyr först!");
      return;
    }
    setIsLoadingScript(true);
    setComic(null);
    setGeneratedImages({});

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: memory }),
      });

      if (!response.ok) throw new Error('Something went wrong on the server.');

      const data = await response.json();
      setComic(data.comic);
      generateImagesForComic(data.comic);

    } catch (error) {
      console.error("Story error:", error);
      alert("Något gick snett med manuset, försök igen.");
    } finally {
      setIsLoadingScript(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50 font-sans">
      <div className="mb-12 max-w-3xl mt-10">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <sp
