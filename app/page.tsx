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

    let secondaryDescription = "";
    if (companionType === 'dog') secondaryDescription = `a friendly golden retriever dog named ${companionName || "Aston"}`;
    if (companionType === 'cat') secondaryDescription = `a cute fluffy cat named ${companionName || "Misse"}`;
    if (companionType === 'friend') secondaryDescription = `a close friend named ${companionName || "Lovisa"}`;

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: memory,
          secondaryName: companionName || null,
          secondaryTrigger: secondaryDescription || null
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
          trainedModelId: trainedModelId
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

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50 font-sans">
      <div className="mb-12 max-w-3xl mt-10">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <span className="text-purple-500">comic book</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Step 1: Train the AI on your character. Step 2: Write a story!
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Train Main AI Character</h3>
          <input type="file" multiple ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" />
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTraining || trainedModelId !== null} className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50">
                Choose Photos
              </button>
              {selectedFiles.length > 0 && (
                <span className="text-gray-700 font-medium">{selectedFiles.length} photos selected</span>
              )}
            </div>

            {selectedFiles.length >= 5 && !trainedModelId && (
              <button onClick={handleStartTraining} disabled={isTraining} className="mt-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition disabled:opacity-50">
                {isTraining ? 'Training in progress...' : '🚀 Start AI Training'}
              </button>
            )}

            {trainingStatus && (
              <div className="mt-2 p-3 bg-blue-50 text-blue-800 rounded-lg font-mono text-sm">
                {trainingStatus}
              </div>
            )}
            
            {trainedModelId && (
              <button onClick={() => { localStorage.removeItem('my_saved_lora_model'); setTrainedModelId(null); setTrainingStatus(''); }} className="text-xs text-red-500 hover:underline text-left mt-1">
                🗑️ Ta bort sparad AI och träna en ny karaktär
              </button>
            )}
          </div>
        </div>

        <div className={`rounded-[2rem] border-4 border-dashed border-blue-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left transition-opacity ${!trainedModelId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <h3 className="text-lg font-bold text-gray-800 mb-1">🐕 Lägg till en kompis eller ett husdjur</h3>
          <p className="text-xs text-gray-500 mb-4">Vem vill du ska följa med på äventyret?</p>
          
          <div className="flex gap-2 mb-4">
            {[
              { type: 'none', label: 'Bara jag 👤' },
              { type: 'dog', label: 'En hund 🐶' },
              { type: 'cat', label: 'En katt 🐱' },
              { type: 'friend', label: 'En kompis 🧑' }
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => { setCompanionType(opt.type as any); if (opt.type === 'none') setCompanionName(''); }}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl border-2 transition ${companionType === opt.type ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {companionType !== 'none' && (
            <input 
              type="text" 
              placeholder={`Vad heter din ${companionType === 'dog' ? 'hund' : companionType === 'cat' ? 'katt' : 'kompis'}?`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
            />
          )}
        </div>

        <div className={`relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left transition-opacity ${!trainedModelId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <h3 className="text-lg font-bold text-gray-800 mb-2">📝 Step 2: Describe the adventure</h3>
          <textarea rows={4} className="w-full bg-transparent text-lg placeholder:text-gray-500 focus:outline-none text-gray-800" placeholder="e.g. Simon and Aston going on an exciting flight simulator ride..." value={memory} onChange={(e) => setMemory(e.target.value)} disabled={isLoadingScript || !trainedModelId} />
        </div>

        <button type="button" onClick={handleCreateStory} disabled={isLoadingScript || !trainedModelId} className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 text-xl font-bold text-white hover:scale-105 transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100">
          {isLoadingScript ? 'Directing comic script...' : '🪄 Generate Comic Book'}
        </button>
      </div>

      {comic && (
        <div className="mt-16 w-full max-w-5xl">
          <h2 className="text-4xl font-black text-gray-800 mb-8 uppercase tracking-wide">{comic.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {comic.panels.map((panel: any) => (
              <div key={panel.panel_number} className="bg-white border-4 border-gray-900 rounded-xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col text-left">
                <div className="bg-gray-200 w-full h-64 flex flex-col items-center justify-center p-0 border-b-4 border-gray-900 relative overflow-hidden">
                  {generatedImages[panel.panel_number] ? (
                    <img src={generatedImages[panel.panel_number]} alt={`Panel ${panel.panel_number}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-gray-400 text-5xl mb-2">
                        {currentlyGeneratingPanel === panel.panel_number || panelsLoading[panel.panel_number] ? '🎨' : '⏳'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {currentlyGeneratingPanel === panel.panel_number || panelsLoading[panel.panel_number] ? 'AI is drawing...' : 'In queue...'}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-yellow-400 text-black font-black w-8 h-8 flex items-center justify-center rounded-full border-2 border-black z-10">{panel.panel_number}</div>
                </div>
                <div className="p-4 bg-yellow-50 min-h-[100px] flex flex-col justify-between">
                  <p className="text-gray-800 font-medium text-lg leading-relaxed mb-4">{panel.narration}</p>
                  
                  {generatedImages[panel.panel_number] && (
                    <div className="mt-2 flex gap-2 pt-4 border-t border-yellow-200/50">
                      <input
                        type="text"
                        placeholder="Ändra något med denna bild"
                        className="flex-1 px-3 py-2 text-sm bg-white/80 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-800"
                        value={customPrompts[panel.panel_number] || ''}
                        onChange={(e) => setCustomPrompts(prev => ({ ...prev, [panel.panel_number]: e.target.value }))}
                        disabled={panelsLoading[panel.panel_number]}
                      />
                      <button
                        onClick={() => handleRegeneratePanel(panel.panel_number, panel.image_prompt)}
                        disabled={panelsLoading[panel.panel_number] || !customPrompts[panel.panel_number]?.trim()}
                        className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50"
                      >
                        {panelsLoading[panel.panel_number] ? 'Ritar...' : 'Uppdatera'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
