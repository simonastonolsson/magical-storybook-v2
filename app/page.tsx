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

  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  const [panelsLoading, setPanelsLoading] = useState<Record<number, boolean>>({});

  // KUNDVÄNLIG MULTI-CHARACTER STATER
  const [companionType, setCompanionType] = useState<'none' | 'dog' | 'cat' | 'friend'>('none');
  const [companionName, setCompanionName] = useState('');

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
      
      setTrainingStatus(`☁️ Laddar upp säkert till molnet (${sizeMB} MB)...`);
      
      const formData = new FormData();
      formData.append('file', zipBlob, 'training_data.zip');

      const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Failed to upload to temporary storage');
      const uploadData = await uploadRes.json();
      const rawZipUrl = uploadData.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');

      setTrainingStatus('🧠 Startar träning hos Replicate... (Detta tar ca 5-10 min)');
      const trainRes = await fetch('/api/train-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipUrl: rawZipUrl }),
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
        } 
