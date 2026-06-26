"use client";

import { useState, useRef } from 'react';
import JSZip from 'jszip'; // Det nya biblioteket vi lade till för att packa zip-filer!

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  // Nya states för LoRA-träning
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainedModelId, setTrainedModelId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  // 1. Hantera när användaren väljer flera bilder
  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setSelectedFiles(Array.from(event.target.files));
  };

  // 2. Koden som zippar bilderna, laddar upp, och startar träningen!
  const startTraining = async () => {
    if (selectedFiles.length < 5) {
      alert("Ladda upp minst 5 bilder för att få ett bra resultat!");
      return;
    }

    setIsTraining(true);
    try {
      setTrainingStatus('📦 Packar bilderna till en zip-fil...');
      const zip = new JSZip();
      selectedFiles.forEach((file, index) => {
        zip.file(`image_${index}.jpg`, file);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      setTrainingStatus('☁️ Laddar upp till servern...');
      const uploadRes = await fetch(`/api/upload?filename=training_${Date.now()}.zip`, {
        method: 'POST',
        body: zipBlob,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url: zipUrl } = await uploadRes.json();

      setTrainingStatus('🧠 Startar AI-träningen på Replicate...');
      const trainRes = await fetch('/api/train-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipUrl }),
      });
      if (!trainRes.ok) throw new Error('Training start failed');
      const { trainingId } = await trainRes.json();

      setTrainingStatus('⏳ AI:n lär sig ansiktet! Detta tar ca 10-15 minuter. Stäng inte fliken...');

      // En loop som frågar servern var 15:e sekund om träningen är klar
      const pollInterval = setInterval(async () => {
        const checkRes = await fetch(`/api/check-training?id=${trainingId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
          clearInterval(pollInterval);
          // Replicate skickar tillbaka ID:t för din nya, färdiga modell
          setTrainedModelId("trained_model_ready"); 
          setTrainingStatus('✅ Träningen är klar! Din AI-karaktär är redo.');
          setIsTraining(false);
        } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
          clearInterval(pollInterval);
          setTrainingStatus('❌ Träningen misslyckades. Kolla Replicate-loggarna.');
          setIsTraining(false);
        } else {
          setTrainingStatus(`⏳ Tränar... (Status på Replicate: ${checkData.status})`);
        }
      }, 15000);

    } catch (error) {
      console.error(error);
      setTrainingStatus('❌ Något gick fel.');
      setIsTraining(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateImagesForComic = async (comicData: any) => {
    setIsGeneratingImages(true);
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      if (i > 0) await delay(15000); 

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Just nu skickar vi tomt på imageUrl eftersom vi ska bygga om backend att använda din NYA modell istället
          body: JSON.stringify({ prompt: panel.image_prompt, imageUrl: "" }), 
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
      alert("Please describe an adventure!");
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
      alert("Sorry, the magic failed. Please try again.");
    } finally {
      setIsLoadingScript(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50 font-sans">
      <div className="mb-12 max-w-3xl mt-10">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <span className="text-purple-500">comic book</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Step 1: Train the AI on your face. Step 2: Write a story!
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        
        {/* NYA STEG 1: Ladda upp OCH TRÄNA */}
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Train AI Character (Upload 5-15 photos)</h3>
          
          {/* MULTIPLE är tillagt här! */}
          <input type="file" multiple ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" />
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTraining} className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50">
                Choose Photos
              </button>
              {selectedFiles.length > 0 && (
                <span className="text-gray-700 font-medium">{selectedFiles.length} photos selected</span>
              )}
            </div>

            {selectedFiles.length >= 5 && !trainedModelId && (
              <button onClick={startTraining} disabled={isTraining} className="mt-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition disabled:opacity-50">
                {isTraining ? 'Training in progress...' : '🚀 Start AI Training'}
              </button>
            )}

            {trainingStatus && (
              <div className="mt-2 p-3 bg-blue-50 text-blue-800 rounded-lg font-mono text-sm">
                {trainingStatus}
              </div>
            )}
          </div>
        </div>

        {/* STEG 2: Berättelsen (Visas bara om träningen är klar, eller om man vill testa direkt) */}
        <div className={`relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left ${!trainedModelId ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-lg font-bold text-gray-800 mb-2">📝 Step 2: Describe the adventure</h3>
          <textarea rows={4} className="w-full bg-transparent text-lg placeholder:text-gray-500 focus:outline-none text-gray-800" placeholder="e.g. A space journey to find the missing chocolate chip cookie..." value={memory} onChange={(e) => setMemory(e.target.value)} disabled={isLoadingScript || !trainedModelId} />
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
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={generatedImages[panel.panel_number]} alt={`Panel ${panel.panel_number}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-gray-400 text-5xl mb-2">{currentlyGeneratingPanel === panel.panel_number ? '🎨' : '⏳'}</span>
                      <span className="text-xs text-gray-500 font-mono">{currentlyGeneratingPanel === panel.panel_number ? 'AI is drawing...' : 'In queue...'}</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-yellow-400 text-black font-black w-8 h-8 flex items-center justify-center rounded-full border-2 border-black z-10">{panel.panel_number}</div>
                </div>
                <div className="p-4 bg-yellow-50 min-h-[100px] flex items-center">
                  <p className="text-gray-800 font-medium text-lg leading-relaxed">{panel.narration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
