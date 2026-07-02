"use client";

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  // PRIMÄR KARAKTÄR STATE (DIG)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedModelId, setTrainedModelId] = useState<string | null>(null);

  // DYNAMISKA KARAKTÄRSINSTÄLLNINGAR
  const [charName, setCharacterName] = useState('Simon');
  const [charDesc, setCharacterDescription] = useState('an adult man');
  const [charTrigger, setCharacterTrigger] = useState('SIMONTOK');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // BILD-GENERERING STATE
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  const [panelsLoading, setPanelsLoading] = useState<Record<number, boolean>>({});

  // KUNDVÄNLIG COMPANION-VÄLJARE
  const [companionType, setCompanionType] = useState<'none' | 'dog' | 'cat' | 'friend'>('none');
  const [companionName, setCompanionName] = useState('');
  const [useCustomCompanionAI, setUseCustomCompanionAI] = useState(false);
  
  // SEKUNDÄR KARAKTÄR AI STATE (KOMPISEN)
  const [companionFiles, setCompanionFiles] = useState<File[]>([]);
  const [isTrainingCompanion, setIsTrainingCompanion] = useState(false);
  const [companionTrainingStatus, setCompanionTrainingStatus] = useState('');
  const [companionModelId, setCompanionModelId] = useState<string | null>(null);
  const companionFileInputRef = useRef<HTMLInputElement>(null);

  // Generera unikt triggerord baserat på namn
  useEffect(() => {
    const cleanName = charName.replace(/[^a-zA-Z]/g, "").toUpperCase();
    setCharacterTrigger(cleanName ? `${cleanName}TOK` : 'TOK');
  }, [charName]);

  useEffect(() => {
    const savedModel = localStorage.getItem('my_saved_lora_model');
    if (savedModel && savedModel.includes('/')) {
      setTrainedModelId(savedModel);
      setTrainingStatus(`🎉 Hittade din sparade AI-modell! Redo att skapa berättelser.`);
    }
    const savedCompanionModel = localStorage.getItem('my_saved_companion_lora_model');
    if (savedCompanionModel && savedCompanionModel.includes('/')) {
      setCompanionModelId(savedCompanionModel);
      setCompanionTrainingStatus(`🎉 Hittade sparad AI för kompisen!`);
    }
  }, []);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleCompanionFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setCompanionFiles(Array.from(event.target.files));
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

  const startTrainingJob = async (files: File[], onStatusChange: (status: string) => void, triggerWord: string): Promise<string> => {
    onStatusChange('📦 Optimerar och packar bilderna...');
    const zip = new JSZip();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const resizedBlob = await resizeImage(file);
      zip.file(`image_${i}.jpg`, resizedBlob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
    
    onStatusChange(`☁️ Laddar upp säkert till molnet (${sizeMB} MB)...`);
    
    const formData = new FormData();
    formData.append('file', zipBlob, 'training_data.zip');

    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) throw new Error('Failed to upload to temporary storage');
    const uploadData = await uploadRes.json();
    const rawZipUrl = uploadData.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');

    onStatusChange(`🧠 Startar träning hos Replicate med triggerord ${triggerWord}... (Detta tar ca 5-10 min)`);
    const trainRes = await fetch('/api/train-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipUrl: rawZipUrl, triggerWord: triggerWord }),
    });
    
    if (!trainRes.ok) throw new Error('Failed to start training');
    const { trainingId } = await trainRes.json();

    return new Promise((resolve, reject) => {
      onStatusChange('⏳ AI:n lär sig... Du kan följa framstegen. Stäng inte sidan.');
      const checkInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/check-training?id=${trainingId}`);
          const checkData = await checkRes.json();

          if (checkData.status === 'succeeded') {
            clearInterval(checkInterval);
            resolve(checkData.fullPath);
          } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
            clearInterval(checkInterval);
            reject(new Error('Training failed or was canceled'));
          } else {
            onStatusChange(`⏳ AI:n tränar... (Status: ${checkData.status})`);
          }
        } catch (err) {
          clearInterval(checkInterval);
          reject(err);
        }
      }, 15000);
    });
  };

  const handleStartTraining = async () => {
    if (selectedFiles.length < 5) {
      alert("Ladda upp minst 5 bilder för bästa AI-resultat!");
      return;
    }
    setIsTraining(true);
    try {
      const path = await startTrainingJob(selectedFiles, setTrainingStatus, charTrigger);
      setTrainedModelId(path);
      localStorage.setItem('my_saved_lora_model', path);
      setTrainingStatus('✅ Träningen är klar! Din unika AI-karaktär är sparad och redo.');
    } catch (error) {
      console.error(error);
      setTrainingStatus('❌ Ett fel uppstod vid start av träningen.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleStartCompanionTraining = async () => {
    if (companionFiles.length < 5) {
      alert(`Ladda upp minst 5 bilder på ${companionName || "din kompis"}!`);
      return;
    }
    setIsTrainingCompanion(true);
    try {
      const companionTriggerWord = `${companionName.replace(/[^a-zA-Z]/g, "").toUpperCase()}TOK`;
      const path = await startTrainingJob(companionFiles, setCompanionTrainingStatus, companionTriggerWord);
      setCompanionModelId(path);
      localStorage.setItem('my_saved_companion_lora_model', path);
      setCompanionTrainingStatus('✅ Träningen klar! Kompisens AI är redo.');
    } catch (error) {
      console.error(error);
      setCompanionTrainingStatus('❌ Träningen misslyckades.');
    } finally {
      setIsTrainingCompanion(false);
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
            trainedModelId: trainedModelId,
            extraLoraId: (useCustomCompanionAI && companionModelId) ? companionModelId : null,
            extraLoraScale: 0.8
   
