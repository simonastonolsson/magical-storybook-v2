"use client";

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [step, setStep] = useState(1);
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [pageCount, setPageCount] = useState<number>(8);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedModelId, setTrainedModelId] = useState<string | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);

  const [charName, setCharacterName] = useState('');
  const [charDesc, setCharacterDescription] = useState('an adult man');
  const [charTrigger, setCharacterTrigger] = useState('TOK');
  const [charOutfit, setCharOutfit] = useState('');
  const [customOutfit, setCustomOutfit] = useState('');
  const [bookStyle, setBookStyle] = useState('digital_painting');

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
    setCharacterTrigger(cleanName ? cleanName + 'TOK' : 'TOK');
  }, [charName]);

  useEffect(() => {
    const savedModel = localStorage.getItem('my_saved_lora_model');
    if (savedModel && savedModel.includes('/')) {
      setTrainedModelId(savedModel);
      setTrainingStatus('AI-modell hittad och redo!');
    }
    const savedRef = localStorage.getItem('my_saved_reference_image');
    if (savedRef) setReferenceImageUrl(savedRef);
    const savedCompanion = localStorage.getItem('my_saved_companion_lora_model');
    if (savedCompanion && savedCompanion.includes('/')) {
      setCompanionModelId(savedCompanion);
      setCompanionTrainingStatus('Sparad AI for kompisen hittad!');
    }
    const savedOutfit = localStorage.getItem('my_saved_outfit');
    if (savedOutfit) setCharOutfit(savedOutfit);
  }, []);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  };

  const handleCompanionFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setCompanionFiles(Array.from(e.target.files));
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
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      };
      img.src = url;
    });
  };

  const uploadReferenceImageToBlob = async (file: File): Promise<string> => {
    const resizedBlob = await resizeImage(file);
    const formData = new FormData();
    formData.append('file', resizedBlob, 'reference.jpg');
    const res = await fetch('/api/upload-reference', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Failed to upload reference image');
    const data = await res.json();
    return data.url;
  };

  const startTrainingJob = async (files: File[], onStatusChange: (s: string) => void, triggerWord: string): Promise<string> => {
    onStatusChange('Packar bilderna...');
    const zip = new JSZip();
    for (let i = 0; i < files.length; i++) {
      const resizedBlob = await resizeImage(files[i]);
      zip.file('image_' + i + '.jpg', resizedBlob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const sizeMB = (zipBlob.size / 1024 / 1024).toFixed(2);
    onStatusChange('Laddar upp (' + sizeMB + ' MB)...');
    const formData = new FormData();
    formData.append('file', zipBlob, 'training_data.zip');
    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const uploadData = await uploadRes.json();
    const rawZipUrl = uploadData.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
    onStatusChange('Startar AI-traning... (5-10 min)');
    const trainRes = await fetch('/api/train-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipUrl: rawZipUrl, triggerWord }),
    });
    if (!trainRes.ok) throw new Error('Training failed to start');
    const { trainingId } = await trainRes.json();
    return new Promise((resolve, reject) => {
      onStatusChange('AI:n tranas... Stang inte sidan.');
      const checkInterval = setInterval(async () => {
        try {
          const checkRes = await fetch('/api/check-training?id=' + trainingId);
          const checkData = await checkRes.json();
          if (checkData.status === 'succeeded') { clearInterval(checkInterval); resolve(checkData.fullPath); }
          else if (checkData.status === 'failed' || checkData.status === 'canceled') { clearInterval(checkInterval); reject(new Error('Training failed')); }
          else { onStatusChange('Tranar... (' + checkData.status + ')'); }
        } catch (err) { clearInterval(checkInterval); reject(err); }
      }, 15000);
    });
  };

  const handleStartTraining = async () => {
    if (selectedFiles.length < 5) { alert("Ladda upp minst 5 bilder!"); return; }
    setIsTraining(true);
    try {
      setTrainingStatus('Sparar referensfoto...');
      const refUrl = await uploadReferenceImageToBlob(selectedFiles[0]);
      setReferenceImageUrl(refUrl);
      localStorage.setItem('my_saved_reference_image', refUrl);
      const path = await startTrainingJob(selectedFiles, setTrainingStatus, charTrigger);
      setTrainedModelId(path);
      localStorage.setItem('my_saved_lora_model', path);
      setTrainingStatus('Klart! Din AI-karaktar ar redo.');
    } catch (err) {
      console.error(err);
      setTrainingStatus('Fel vid traning. Forsok igen.');
    } finally { setIsTraining(false); }
  };

  const handleStartCompanionTraining = async () => {
    if (companionFiles.length < 5) { alert('Ladda upp minst 5 bilder!'); return; }
    setIsTrainingCompanion(true);
    try {
      const companionTriggerWord = companionName.replace(/[^a-zA-Z]/g, "").toUpperCase() + 'TOK';
      const path = await startTrainingJob(companionFiles, setCompanionTrainingStatus, companionTriggerWord);
      setCompanionModelId(path);
      localStorage.setItem('my_saved_companion_lora_model', path);
      setCompanionTrainingStatus('Klart!');
    } catch (err) {
      console.error(err);
      setCompanionTrainingStatus('Traning misslyckades.');
    } finally { setIsTrainingCompanion(false); }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateImagesForComic = async (comicData: any) => {
    setIsGeneratingImages(true);
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);
      if (i > 0) await delay(3000);
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: panel.image_prompt,
            trainedModelId,
            triggerWord: charTrigger,
            charDesc,
            charName,
            charOutfit: customOutfit || charOutfit,
            referenceImageUrl,
            extraLoraId: (useCustomCompanionAI && companionModelId) ? companionModelId : null,
            extraLoraScale: 0.8
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setGeneratedImages(prev => ({ ...prev, [panel.panel_number]: data.imageUrl }));
        }
      } catch (err) { console.error('Failed to generate image', err); }
      setCurrentlyGeneratingPanel(null);
    }
    setIsGeneratingImages(false);
  };

  const handleCreateStory = async () => {
    if (!memory.trim()) { alert("Beskriv ett aventyr forst!"); return; }
    setIsLoadingScript(true);
    setComic(null);
    setGeneratedImages({});
    let secondaryDescription = "";
    const companionTriggerWord = companionName.replace(/[^a-zA-Z]/g, "").toUpperCase() + 'TOK';
    if (companionType === 'dog') secondaryDescription = 'a friendly golden retriever dog named ' + (companionName || "Aston");
    if (companionType === 'cat') secondaryDescription = 'a cute fluffy cat named ' + (companionName || "Misse");
    if (companionType === 'friend') {
      if (useCustomCompanionAI && companionModelId) {
        secondaryDescription = 'a close friend named ' + (companionName || "Kompis") + ' represented by ' + companionTriggerWord;
      } else {
        secondaryDescription = 'a close friend named ' + (companionName || "Kompis");
      }
    }
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: memory,
          characterName: charName,
          characterTrigger: charTrigger,
          characterDescription: charDesc,
          secondaryName: companionName || null,
          secondaryTrigger: secondaryDescription || null,
          secondaryTriggerWord: useCustomCompanionAI ? companionTriggerWord : null,
          pageCount
        }),
      });
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      setComic(data.comic);
      generateImagesForComic(data.comic);
    } catch (err) {
      console.error(err);
      alert("Nagot gick snett, forsok igen.");
    } finally { setIsLoadingScript(false); }
  };

  const handleRegeneratePanel = async (panelNumber: number, originalPrompt: string) => {
    const instruction = customPrompts[panelNumber];
    if (!instruction?.trim() || !trainedModelId) return;
    setPanelsLoading(prev => ({ ...prev, [panelNumber]: true }));
    try {
      const refineRes = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalPrompt, instruction }),
      });
      if (!refineRes.ok) throw new Error("Refine failed");
      const { refinedPrompt } = await refineRes.json();
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: refinedPrompt,
          trainedModelId,
          triggerWord: charTrigger,
          charDesc,
          charName,
          charOutfit: customOutfit || charOutfit,
          bookStyle,
          referenceImageUrl,
          extraLoraId: (useCustomCompanionAI && companionModelId) ? companionModelId : null,
          extraLoraScale: 0.8
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedImages(prev => ({ ...prev, [panelNumber]: data.imageUrl }));
        setComic((prev: any) => {
          if (!prev) return prev;
          return { ...prev, panels: prev.panels.map((p: any) => p.panel_number === panelNumber ? { ...p, image_prompt: refinedPrompt } : p) };
        });
        setCustomPrompts(prev => ({ ...prev, [panelNumber]: '' }));
      }
    } catch (err) { console.error(err); }
    finally { setPanelsLoading(prev => ({ ...prev, [panelNumber]: false })); }
  };

  const totalSteps = 4;
  const progressPct = (step / totalSteps) * 100;

  const isChild = charDesc.toLowerCase().includes("boy") || charDesc.toLowerCase().includes("girl") || charDesc.toLowerCase().includes("child");

  const adultOutfits = [
    { value: 'jeans and a plain t-shirt, crew-neck, casual style', label: 'Casual', emoji: '👕' },
    { value: 'chinos and button-up shirt, smart casual style', label: 'Smart casual', emoji: '👔' },
    { value: 'hoodie and jogger pants, streetwear style', label: 'Street', emoji: '🧢' },
    { value: 'suit and tie, elegant formal style', label: 'Elegant', emoji: '🤵' },
  ];

  const childOutfits = [
    { value: 'jeans and a cozy sweater, round neckline', label: 'Vardaglig', emoji: '👕' },
    { value: 'superhero cape and mask, colorful costume', label: 'Superhjalte', emoji: '🦸' },
    { value: 'khaki cargo pants and adventure jacket', label: 'Aventyrare', emoji: '🎒' },
    { value: 'cozy pajamas with star pattern', label: 'Pyjamas', emoji: '🌙' },
  ];

  const outfits = isChild ? childOutfits : adultOutfits;

  return (
    <main style={{minHeight:'100vh', background:'#faf8f3', fontFamily:'Inter, sans-serif', color:'#1a1a2e'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .wiz-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(250,248,243,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #e5e0d8; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
        .wiz-logo { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 900; color: #1a1a2e; text-decoration: none; }
        .wiz-logo span { color: #7c3aed; }
        .wiz-step-label { font-size: 0.85rem; color: #6b7280; font-weight: 500; }
        .wiz-progress { height: 3px; background: #e5e0d8; position: fixed; top: 61px; left: 0; right: 0; z-index: 99; }
        .wiz-progress-bar { height: 100%; background: linear-gradient(90deg, #7c3aed, #f43f8e); transition: width 0.4s ease; }
        .wiz-body { max-width: 600px; margin: 0 auto; padding: 6rem 1.5rem 4rem; }
        .wiz-eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.5rem; }
        .wiz-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
        .wiz-sub { font-size: 0.95rem; color: #6b7280; line-height: 1.6; margin-bottom: 2rem; }
        .wiz-card { background: white; border: 1.5px solid #e5e0d8; border-radius: 20px; padding: 1.75rem; margin-bottom: 1.25rem; }
        .wiz-label { display: block; font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
        .wiz-input { width: 100%; padding: 0.8rem 1rem; border: 1.5px solid #e5e0d8; border-radius: 12px; font-size: 1rem; font-family: Inter, sans-serif; color: #1a1a2e; background: #faf8f3; outline: none; transition: border-color 0.2s; }
        .wiz-input:focus { border-color: #7c3aed; background: white; }
        .wiz-select { width: 100%; padding: 0.8rem 1rem; border: 1.5px solid #e5e0d8; border-radius: 12px; font-size: 1rem; font-family: Inter, sans-serif; color: #1a1a2e; background: #faf8f3; outline: none; cursor: pointer; }
        .wiz-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .wiz-upload-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: #ede9fe; color: #7c3aed; font-weight: 700; font-size: 0.9rem; border-radius: 100px; border: none; cursor: pointer; transition: background 0.2s; }
        .wiz-upload-btn:hover { background: #ddd6fe; }
        .wiz-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .wiz-train-btn { width: 100%; padding: 0.9rem; background: #7c3aed; color: white; font-weight: 700; font-size: 1rem; border-radius: 12px; border: none; cursor: pointer; transition: background 0.2s; margin-top: 1rem; }
        .wiz-train-btn:hover { background: #6d28d9; }
        .wiz-train-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .wiz-status { padding: 0.75rem 1rem; background: #ede9fe; color: #5b21b6; border-radius: 10px; font-size: 0.85rem; font-family: monospace; margin-top: 0.75rem; }
        .wiz-success { background: #d1fae5; color: #065f46; }
        .wiz-chips { display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .wiz-chip { padding: 0.6rem 1.1rem; border-radius: 100px; border: 1.5px solid #e5e0d8; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; background: white; color: #1a1a2e; }
        .wiz-chip:hover { border-color: #7c3aed; background: #ede9fe; color: #7c3aed; }
        .wiz-chip.active { background: #7c3aed; color: white; border-color: #7c3aed; }
        .wiz-chip.active-gold { background: #e8b84b; color: #1a1a2e; border-color: #e8b84b; }
        .wiz-textarea { width: 100%; padding: 1rem; border: 1.5px solid #e5e0d8; border-radius: 12px; font-size: 1rem; font-family: Inter, sans-serif; color: #1a1a2e; background: #faf8f3; outline: none; resize: none; transition: border-color 0.2s; line-height: 1.6; }
        .wiz-textarea:focus { border-color: #7c3aed; background: white; }
        .wiz-footer { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(250,248,243,0.97); backdrop-filter: blur(12px); border-top: 1px solid #e5e0d8; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; z-index: 99; }
        .wiz-btn-back { padding: 0.8rem 1.5rem; border: 1.5px solid #e5e0d8; border-radius: 100px; font-weight: 600; font-size: 0.95rem; background: white; color: #6b7280; cursor: pointer; transition: all 0.15s; }
        .wiz-btn-back:hover { border-color: #1a1a2e; color: #1a1a2e; }
        .wiz-btn-next { padding: 0.8rem 2rem; background: #7c3aed; color: white; border: none; border-radius: 100px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: background 0.2s, transform 0.15s; box-shadow: 0 4px 16px rgba(124,58,237,0.25); }
        .wiz-btn-next:hover { background: #6d28d9; transform: translateY(-1px); }
        .wiz-btn-next:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .wiz-btn-generate { padding: 0.9rem 2.5rem; background: linear-gradient(135deg, #7c3aed, #f43f8e); color: white; border: none; border-radius: 100px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: transform 0.15s; box-shadow: 0 4px 20px rgba(124,58,237,0.3); }
        .wiz-btn-generate:hover { transform: translateY(-2px); }
        .wiz-btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .wiz-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid #f3f0eb; font-size: 0.9rem; }
        .wiz-summary-row:last-child { border-bottom: none; }
        .wiz-summary-key { color: #6b7280; }
        .wiz-summary-val { font-weight: 600; color: #1a1a2e; }
        .wiz-delete-link { font-size: 0.75rem; color: #ef4444; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; margin-top: 0.5rem; }
        .comic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem 6rem; }
        .panel-card { background: white; border: 3px solid #1a1a2e; border-radius: 16px; overflow: hidden; box-shadow: 5px 5px 0 #1a1a2e; }
        .panel-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
        .panel-placeholder { width: 100%; aspect-ratio: 4/3; background: #f3f0eb; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; }
        .panel-num { position: absolute; top: 8px; left: 8px; width: 30px; height: 30px; background: #e8b84b; border: 2px solid #1a1a2e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8rem; z-index: 2; }
        .panel-body { padding: 1rem; background: #fffbeb; }
        .panel-text { width: 100%; background: transparent; border: 1.5px dashed transparent; border-radius: 8px; font-size: 0.95rem; line-height: 1.6; color: #1a1a2e; resize: none; outline: none; font-family: Inter, sans-serif; padding: 0.4rem; transition: all 0.15s; }
        .panel-text:hover { border-color: #ddd6fe; }
        .panel-text:focus { border-color: #7c3aed; background: white; }
        .panel-regen { display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #fde68a; }
        .panel-regen input { flex: 1; padding: 0.5rem 0.75rem; border: 1.5px solid #e5e0d8; border-radius: 8px; font-size: 0.85rem; outline: none; font-family: Inter, sans-serif; }
        .panel-regen input:focus { border-color: #7c3aed; }
        .panel-regen button { padding: 0.5rem 1rem; background: #7c3aed; color: white; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .panel-regen button:disabled { opacity: 0.5; cursor: not-allowed; }
        .comic-header { max-width: 1000px; margin: 0 auto; padding: 5rem 1.5rem 0; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .comic-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; }
        .pdf-btn { padding: 0.75rem 1.5rem; background: #1a1a2e; color: white; border: none; border-radius: 100px; font-weight: 700; font-size: 0.9rem; cursor: pointer; }
        @media print {
          .wiz-nav, .wiz-progress, .wiz-footer, .comic-header .pdf-btn, .panel-regen { display: none !important; }
          .comic-grid { grid-template-columns: 1fr 1fr; gap: 15px; padding: 0; }
          .panel-card { box-shadow: none; border: 3px solid black; break-inside: avoid; }
        }
        @media (max-width: 600px) {
          .wiz-grid-2 { grid-template-columns: 1fr; }
          .comic-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <nav className="wiz-nav">
        <a href="/" className="wiz-logo">Story<span>labz</span></a>
        {!comic && <span className="wiz-step-label">Steg {step} av {totalSteps}</span>}
        {comic && <button className="pdf-btn" onClick={() => window.print()}>Ladda ner PDF</button>}
      </nav>

      {!comic && (
        <div className="wiz-progress">
          <div className="wiz-progress-bar" style={{width: progressPct + '%'}}></div>
        </div>
      )}

      {!comic && (
        <div className="wiz-body">

          {step === 1 && (
            <>
              <div className="wiz-eyebrow">Steg 1 av 4</div>
              <div className="wiz-title">Vem ar stjarnan?</div>
              <p className="wiz-sub">Beratta vem boken ska handla om och ladda upp foton sa att AI:n kan skapa din unika karaktar.</p>

              <div className="wiz-card">
                <div className="wiz-grid-2" style={{marginBottom:'1rem'}}>
                  <div>
                    <label className="wiz-label">Namn</label>
                    <input className="wiz-input" type="text" placeholder="t.ex. Simon" value={charName} onChange={(e) => setCharacterName(e.target.value)} />
                  </div>
                  <div>
                    <label className="wiz-label">Karaktarstyp</label>
                    <select className="wiz-select" value={charDesc} onChange={(e) => setCharacterDescription(e.target.value)}>
                      <option value="an adult man">Vuxen man</option>
                      <option value="an adult woman">Vuxen kvinna</option>
                      <option value="a young boy">Pojke</option>
                      <option value="a young girl">Flicka</option>
                      <option value="a friendly dog">Hund</option>
                      <option value="a cute fluffy cat">Katt</option>
                    </select>
                  </div>
                </div>

                <label className="wiz-label">Outfit genom hela boken</label>
                <div className="wiz-chips" style={{marginBottom:'0.75rem'}}>
                  {outfits.map((o) => (
                    <button key={o.value} onClick={() => { setCharOutfit(o.value); setCustomOutfit(''); localStorage.setItem('my_saved_outfit', o.value); }} className={'wiz-chip' + (charOutfit === o.value && !customOutfit ? ' active' : '')}>
                      {o.emoji} {o.label}
                    </button>
                  ))}
                </div>
                <input className="wiz-input" type="text" placeholder="Eller beskriv din egen outfit..." value={customOutfit} onChange={(e) => { setCustomOutfit(e.target.value); setCharOutfit(''); }} />
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Bokens stil</label>
                <p style={{fontSize:'0.85rem', color:'#6b7280', marginBottom:'1rem', lineHeight:'1.5'}}>Vilken konstnärlig stil ska bilderna ha?</p>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                  {[
                    { value: 'digital_painting', label: 'Digital Painting', desc: 'Varm och cinematic', emoji: '🎨' },
                    { value: 'ligne_claire', label: 'Ligne Claire', desc: 'Tintin-inspirerad', emoji: '✏️' },
                    { value: 'american_comic', label: 'Amerikansk serie', desc: 'Marvel/DC-känsla', emoji: '💥' },
                    { value: 'watercolor', label: 'Akvarell', desc: 'Mjuk barnboksstil', emoji: '🖌️' },
                    { value: 'noir', label: 'Noir', desc: 'Svartvit bläckskiss', emoji: '🌑' },
                    { value: 'pop_art', label: 'Pop Art', desc: 'Lichtenstein-stil', emoji: '🔴' },
                  ].map((s) => (
                    <button key={s.value} onClick={() => setBookStyle(s.value)} style={{
                      padding: '0.9rem 1rem',
                      borderRadius: '12px',
                      border: bookStyle === s.value ? '2px solid #7c3aed' : '1.5px solid #e5e0d8',
                      background: bookStyle === s.value ? '#ede9fe' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column' as const,
                      gap: '0.2rem'
                    }}>
                      <span style={{fontSize:'1.3rem'}}>{s.emoji}</span>
                      <span style={{fontSize:'0.88rem', fontWeight:'700', color: bookStyle === s.value ? '#7c3aed' : '#1a1a2e'}}>{s.label}</span>
                      <span style={{fontSize:'0.75rem', color:'#6b7280'}}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Foton (minst 5)</label>
                <p style={{fontSize:'0.85rem', color:'#6b7280', marginBottom:'1rem', lineHeight:'1.5'}}>Ladda upp selfies eller portrattbilder dar ansiktet syns tydligt. Fler bilder = battre likhet.</p>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" style={{display:'none'}} />
                <div style={{display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap'}}>
                  <button className="wiz-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={isTraining || trainedModelId !== null}>
                    📸 Valj foton
                  </button>
                  {selectedFiles.length > 0 && <span style={{fontSize:'0.85rem', color:'#6b7280'}}>{selectedFiles.length} foton valda</span>}
                </div>
                {selectedFiles.length >= 5 && !trainedModelId && (
                  <button className="wiz-train-btn" onClick={handleStartTraining} disabled={isTraining}>
                    {isTraining ? 'Tranar...' : 'Starta AI-traning'}
                  </button>
                )}
                {trainingStatus && (
                  <div className={'wiz-status' + (trainedModelId ? ' wiz-success' : '')}>{trainingStatus}</div>
                )}
                {trainedModelId && (
                  <button className="wiz-delete-link" onClick={() => { localStorage.removeItem('my_saved_lora_model'); localStorage.removeItem('my_saved_reference_image'); setTrainedModelId(null); setReferenceImageUrl(null); setTrainingStatus(''); }}>
                    Ta bort och trana ny karaktar
                  </button>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="wiz-eyebrow">Steg 2 av 4</div>
              <div className="wiz-title">Ska nagon flja med?</div>
              <p className="wiz-sub">Lagg till en kompis, ett husdjur eller ga ensam pa aventyret.</p>

              <div className="wiz-card">
                <label className="wiz-label">Foljslagare</label>
                <div className="wiz-chips" style={{marginBottom:'1rem'}}>
                  {[{type:'none',label:'Ingen',emoji:'🧍'},{type:'dog',label:'Hund',emoji:'🐶'},{type:'cat',label:'Katt',emoji:'🐱'},{type:'friend',label:'Kompis',emoji:'🧑'}].map((opt) => (
                    <button key={opt.type} onClick={() => { setCompanionType(opt.type as any); if (opt.type !== 'friend') setUseCustomCompanionAI(false); if (opt.type === 'none') setCompanionName(''); }} className={'wiz-chip' + (companionType === opt.type ? ' active' : '')}>
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>

                {companionType !== 'none' && (
                  <div style={{marginTop:'0.5rem'}}>
                    <label className="wiz-label">Namn pa {companionType === 'dog' ? 'hunden' : companionType === 'cat' ? 'katten' : 'kompisen'}</label>
                    <input className="wiz-input" type="text" placeholder="t.ex. Aston" value={companionName} onChange={(e) => setCompanionName(e.target.value)} />
                  </div>
                )}

                {companionType === 'friend' && (
                  <div style={{marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid #f3f0eb'}}>
                    <label style={{display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.9rem', fontWeight:'600'}}>
                      <input type="checkbox" checked={useCustomCompanionAI} onChange={(e) => setUseCustomCompanionAI(e.target.checked)} />
                      Trana AI pa {companionName || "kompisen"}s utseende
                    </label>
                    {useCustomCompanionAI && (
                      <div style={{marginTop:'0.75rem'}}>
                        <input type="file" multiple ref={companionFileInputRef} onChange={handleCompanionFileSelection} className="hidden" accept="image/*" style={{display:'none'}} />
                        <button className="wiz-upload-btn" onClick={() => companionFileInputRef.current?.click()} disabled={isTrainingCompanion || companionModelId !== null} style={{fontSize:'0.85rem'}}>
                          Valj foton pa {companionName || "kompisen"}
                        </button>
                        {companionFiles.length >= 5 && !companionModelId && (
                          <button className="wiz-train-btn" onClick={handleStartCompanionTraining} disabled={isTrainingCompanion} style={{fontSize:'0.9rem'}}>
                            {isTrainingCompanion ? 'Tranar...' : 'Starta traning'}
                          </button>
                        )}
                        {companionTrainingStatus && <div className={'wiz-status' + (companionModelId ? ' wiz-success' : '')}>{companionTrainingStatus}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="wiz-eyebrow">Steg 3 av 4</div>
              <div className="wiz-title">Vad ska handa?</div>
              <p className="wiz-sub">Beskriv aventyret du vill uppleva och valj hur lang boken ska vara.</p>

              <div className="wiz-card">
                <label className="wiz-label">Bokens langd</label>
                <div className="wiz-chips">
                  {[{count:4,label:'4 sidor',desc:'Snabbis'},{count:8,label:'8 sidor',desc:'Lagom'},{count:12,label:'12 sidor',desc:'Fyllig'},{count:16,label:'16 sidor',desc:'Episk'}].map((opt) => (
                    <button key={opt.count} onClick={() => setPageCount(opt.count)} className={'wiz-chip' + (pageCount === opt.count ? ' active-gold' : '')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Beskriv aventyret</label>
                <textarea className="wiz-textarea" rows={5} placeholder={"t.ex. " + (charName || "Huvudpersonen") + " reser till manen och hittar en mystisk robot som behover hjalp att hitta hem..."} value={memory} onChange={(e) => setMemory(e.target.value)} />
                <p style={{fontSize:'0.8rem', color:'#9ca3af', marginTop:'0.5rem'}}>Tips: ju mer detaljer du ger, desto battre blir boken.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="wiz-eyebrow">Steg 4 av 4</div>
              <div className="wiz-title">Allt ser bra ut!</div>
              <p className="wiz-sub">Kolla igenom detaljerna och tryck pa Skapa bok nar du ar redo.</p>

              <div className="wiz-card">
                <div className="wiz-summary-row"><span className="wiz-summary-key">Karaktar</span><span className="wiz-summary-val">{charName || 'Ej angett'}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Typ</span><span className="wiz-summary-val">{charDesc}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Outfit</span><span className="wiz-summary-val">{customOutfit || charOutfit || 'Standard'}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Stil</span><span className="wiz-summary-val">{{digital_painting:'Digital Painting',ligne_claire:'Ligne Claire',american_comic:'Amerikansk serie',watercolor:'Akvarell',noir:'Noir',pop_art:'Pop Art'}[bookStyle]}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Foljslagare</span><span className="wiz-summary-val">{companionType === 'none' ? 'Ingen' : (companionName || companionType)}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Sidor</span><span className="wiz-summary-val">{pageCount} sidor</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">AI-modell</span><span className="wiz-summary-val">{trainedModelId ? 'Redo' : 'Saknas'}</span></div>
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Aventyr</label>
                <p style={{fontSize:'0.95rem', lineHeight:'1.6', color:'#1a1a2e'}}>{memory}</p>
              </div>
            </>
          )}
        </div>
      )}

      {comic && (
        <>
          <div className="comic-header">
            <h1 className="comic-title">{comic.title}</h1>
          </div>
          <div className="comic-grid">
            {comic.panels.map((panel: any) => (
              <div key={panel.panel_number} className="panel-card">
                <div style={{position:'relative'}}>
                  {generatedImages[panel.panel_number] ? (
                    <img src={generatedImages[panel.panel_number]} alt={'Panel ' + panel.panel_number} className="panel-img" />
                  ) : (
                    <div className="panel-placeholder">
                      <span style={{fontSize:'2rem'}}>{currentlyGeneratingPanel === panel.panel_number ? '🎨' : '⏳'}</span>
                      <span style={{fontSize:'0.8rem', color:'#9ca3af'}}>{currentlyGeneratingPanel === panel.panel_number ? 'Ritar...' : 'Vantar...'}</span>
                    </div>
                  )}
                  <div className="panel-num">{panel.panel_number}</div>
                </div>
                <div className="panel-body">
                  <textarea className="panel-text" rows={3} value={panel.narration} onChange={(e) => {
                    const val = e.target.value;
                    setComic((prev: any) => ({ ...prev, panels: prev.panels.map((p: any) => p.panel_number === panel.panel_number ? { ...p, narration: val } : p) }));
                  }} />
                  {generatedImages[panel.panel_number] && (
                    <div className="panel-regen">
                      <input type="text" placeholder="Andra nagot i bilden..." value={customPrompts[panel.panel_number] || ''} onChange={(e) => setCustomPrompts(prev => ({ ...prev, [panel.panel_number]: e.target.value }))} disabled={panelsLoading[panel.panel_number]} />
                      <button onClick={() => handleRegeneratePanel(panel.panel_number, panel.image_prompt)} disabled={panelsLoading[panel.panel_number] || !customPrompts[panel.panel_number]?.trim()}>
                        {panelsLoading[panel.panel_number] ? '...' : 'Uppdatera'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!comic && (
        <div className="wiz-footer">
          {step > 1 ? (
            <button className="wiz-btn-back" onClick={() => setStep(s => s - 1)}>Tillbaka</button>
          ) : (
            <a href="/" style={{fontSize:'0.9rem', color:'#6b7280', textDecoration:'none'}}>Tillbaka till start</a>
          )}
          {step < 4 && (
            <button className="wiz-btn-next" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !trainedModelId}>
              {step === 1 && !trainedModelId ? 'Trana AI forst' : 'Nasta steg'}
            </button>
          )}
          {step === 4 && (
            <button className="wiz-btn-generate" onClick={handleCreateStory} disabled={isLoadingScript || !trainedModelId || !memory.trim()}>
              {isLoadingScript ? 'Skapar...' : 'Skapa boken!'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
