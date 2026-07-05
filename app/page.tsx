"use client";

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
 
  const [pageCount, setPageCount] = useState<number>(12);
 
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedModelId, setTrainedModelId] = useState<string | null>(null);

  const [charName, setCharacterName] = useState('Simon');
  const [charDesc, setCharacterDescription] = useState('an adult man');
  const [charTrigger, setCharacterTrigger] = useState('SIMONTOK');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  const [panelsLoading, setPanelsLoading] = useState<Record<number, boolean>>({});

  const [companionType, setCompanionType] = useState<'none' | 'dog' | 'cat' | 'friend'>('none');
  const [companionName, setCompanionName] = useState('');
  const [useCustomCompanionAI, setUseCustomCompanionAI] = useState(false);
 
  const [companionFiles, setCompanionFiles] = useState<File[]>([]);
  const [isTrainingCompanion, setIsTrainingCompanion] = useState(false);
  const [companionTrainingStatus, setCompanionTrainingStatus] = useState('');
  const [companionModelId, setCompanionModelId] = useState<string | null>(null);
  const companionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cleanName = charName.replace(/[^a-zA-Z]/g, "").toUpperCase();
    setCharacterTrigger(cleanName ? `${cleanName}TOK` : 'TOK');
  }, [charName]);

  useEffect(() => {
    const savedModel = localStorage.getItem('my_saved_lora_model');
    if (savedModel && savedModel.includes('/')) {
      setTrainedModelId(savedModel);
      setTrainingStatus('🎉 Hittade din sparade AI-modell! Redo att skapa berättelser.');
    }
    const savedCompanionModel = localStorage.getItem('my_saved_companion_lora_model');
    if (savedCompanionModel && savedCompanionModel.includes('/')) {
      setCompanionModelId(savedCompanionModel);
      setCompanionTrainingStatus('🎉 Hittade sparad AI för kompisen!');
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
    if (!uploadRes.ok) throw new Error('Failed
