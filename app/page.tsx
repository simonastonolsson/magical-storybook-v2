"use client";

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  // DYNAMISKT SIDANTAL STATE (4, 8, 12, 16)
  const [pageCount, setPageCount] = useState<number>(12); // Standard är 12 sidor
  
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

    let secondaryDescription = "";
    const companionTriggerWord = `${companionName.replace(/[^a-zA-Z]/g, "").toUpperCase()}TOK`;
    
    if (companionType === 'dog') secondaryDescription = `a friendly golden retriever dog named ${companionName || "Aston"}`;
    if (companionType === 'cat') secondaryDescription = `a cute fluffy cat named ${companionName || "Misse"}`;
    if (companionType === 'friend') {
      if (useCustomCompanionAI && companionModelId) {
        secondaryDescription = `a close friend named ${companionName || "Lovisa"} represented by ${companionTriggerWord}, an adult man`;
      } else {
        secondaryDescription = `a close friend named ${companionName || "Lovisa"}, an adult man`;
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
          pageCount: pageCount // Skicka med det dynamiska sidantalet till backend!
        }),
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

  const handleRegeneratePanel = async (panelNumber: number, originalPrompt: string) => {
    const instruction = customPrompts[panelNumber];
    if (!instruction || !instruction.trim() || !trainedModelId) return;

    setPanelsLoading(prev => ({ ...prev, [panelNumber]: true }));
    try {
      const refineRes = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalPrompt, instruction }),
      });
      if (!refineRes.ok) throw new Error("Failed to refine prompt");
      const refineData = await refineRes.json();
      const newPrompt = refineData.refinedPrompt;

      console.log(`Ny raffinerad prompt för panel ${panelNumber}: ${newPrompt}`);

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: newPrompt, 
          trainedModelId: trainedModelId,
          extraLoraId: (useCustomCompanionAI && companionModelId) ? companionModelId : null,
          extraLoraScale: 0.8
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedImages(prev => ({...prev, [panelNumber]: data.imageUrl}));
        
        setComic((prevComic: any) => {
          if (!prevComic) return prevComic;
          const updatedPanels = prevComic.panels.map((p: any) => {
            if (p.panel_number === panelNumber) {
              return { ...p, image_prompt: newPrompt };
            }
            return p;
          });
          return { ...prevComic, panels: updatedPanels };
        });

        setCustomPrompts(prev => ({ ...prev, [panelNumber]: '' }));
      } else {
        alert("Något gick snett när bilden skulle ritas om.");
      }
    } catch (err) {
      console.error(err);
      alert("Det gick inte att uppdatera bilden.");
    } finally {
      setPanelsLoading(prev => ({ ...prev, [panelNumber]: false }));
    }
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50 font-sans">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          main > div:first-of-type,
          main > .w-full.max-w-2xl,
          .mt-2.flex,
          .border-t,
          .pdf-btn,
          footer, header {
            display: none !important;
          }
          .mt-16 {
            margin-top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .grid {
            display: grid !important;
            grid-template-cols: 1fr 1fr !important;
            gap: 20px !important;
          }
          .grid > div {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
            border: 4px solid black !important;
          }
        }
      `}</style>

      <div className="mb-12 max-w-3xl mt-10">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <span className="text-purple-500">comic book</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Step 1: Train the AI on your character. Step 2: Write a story!
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left space-y-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Train Main AI Character</h3>
          <div className="grid grid-cols-2 gap-3 p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">Namn</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none"
                value={charName}
                onChange={(e) => setCharacterName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">Typ / Ålder / Kön</label>
              <select 
                className="w-full px-3 py-2 text-sm bg-white border border-purple-200 rounded-lg text-gray-800 focus:outline-none"
                value={charDesc}
                onChange={(e) => setCharacterDescription(e.target.value)}
              >
                <option value="an adult man">Vuxen Man 👤</option>
                <option value="an adult woman">Vuxen Kvinna 👩</option>
                <option value="a young boy">Ung Pojke 👦</option>
                <option value="a young girl">Ung Flicka 👧</option>
                <option value="a friendly dog">Hund 🐶</option>
                <option value="a cute fluffy cat">Katt 🐱</option>
              </select>
            </div>
          </div>

          <input type="file" multiple ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" />
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTraining || trainedModelId !== null} className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50">
                Choose Photos
             
