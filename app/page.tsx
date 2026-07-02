"use client";

import { useState, useRef, useEffect } from 'react';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  // PRIMÄR KARAKTÄR STATE (DIG)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [mainImageUrls, setMainImageUrls] = useState<string[]>([]);

  // DYNAMISKA KARAKTÄRSINSTÄLLNINGAR
  const [charName, setCharacterName] = useState('Simon');
  const [charDesc, setCharacterDescription] = useState('an adult man');

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
  
  // SEKUNDÄR KARAKTÄR STATE (KOMPISEN)
  const [companionFiles, setCompanionFiles] = useState<File[]>([]);
  const [isUploadingCompanion, setIsUploadingCompanion] = useState(false);
  const [companionUploadStatus, setCompanionUploadStatus] = useState('');
  const [companionImageUrls, setCompanionImageUrls] = useState<string[]>([]);
  const companionFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Rensar bort gamla LoRA-inställningar från webbläsaren för att undvika konflikter
    localStorage.removeItem('my_saved_lora_model');
    localStorage.removeItem('my_saved_companion_lora_model');
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

  const uploadImagesToBlob = async (files: File[], onStatusChange: (status: string) => void): Promise<string[]> => {
    onStatusChange('📦 Optimerar och laddar upp referensbilder...');
    const urls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      onStatusChange(`☁️ Laddar upp bild ${i + 1} av ${files.length}...`);
      const file = files[i];
      const resizedBlob = await resizeImage(file);
      
      const formData = new FormData();
      formData.append('file', resizedBlob, `reference_${i}.jpg`);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error(`Kunde inte ladda upp bild ${i + 1}`);
      const data = await uploadRes.json();
      urls.push(data.url);
    }
    
    return urls;
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length < 3) {
      alert("Ladda upp minst 3-5 bilder för bästa resultat!");
      return;
    }
    setIsUploading(true);
    try {
      const urls = await uploadImagesToBlob(selectedFiles, setUploadStatus);
      setMainImageUrls(urls);
      setUploadStatus('✅ Bilderna uppladdade! Redo att skapa berättelser.');
    } catch (error) {
      console.error(error);
      setUploadStatus('❌ Uppladdningen misslyckades.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartCompanionUpload = async () => {
    if (companionFiles.length < 3) {
      alert(`Ladda upp minst 3-5 bilder på ${companionName || "din kompis"}!`);
      return;
    }
    setIsUploadingCompanion(true);
    try {
      const urls = await uploadImagesToBlob(companionFiles, setCompanionUploadStatus);
      setCompanionImageUrls(urls);
      setCompanionUploadStatus('✅ Kompisens bilder uppladdade!');
    } catch (error) {
      console.error(error);
      setCompanionUploadStatus('❌ Uppladdningen misslyckades.');
    } finally {
      setIsUploadingCompanion(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateImagesForComic = async (comicData: any) => {
    setIsGeneratingImages(true);
    
    // Samla alla referensbilder för både Simon och kompisen
    const combinedReferences = [...mainImageUrls];
    if (useCustomCompanionAI) {
      combinedReferences.push(...companionImageUrls);
    }

    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      if (i > 0) await delay(4000); // Nano Banana 2 genererar på 3 sekunder, så 4s delay är perfekt!

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: panel.image_prompt, 
            imageInputs: combinedReferences,
            aspect_ratio: "4:3"
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
    if (companionType === 'friend') {
      if (useCustomCompanionAI && companionImageUrls.length > 0) {
        secondaryDescription = `a close friend named ${companionName || "Lovisa"} represented by COMPANIONTOK, an adult man`;
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
          characterTrigger: 'TOK',
          characterDescription: charDesc,
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
    if (!instruction || !instruction.trim()) return;

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

      const combinedReferences = [...mainImageUrls];
      if (useCustomCompanionAI) {
        combinedReferences.push(...companionImageUrls);
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: newPrompt, 
          imageInputs: combinedReferences,
          aspect_ratio: "4:3"
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
          Step 1: Upload photos of your character. Step 2: Write a story!
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        
        {/* STEG 1: BILDUPPLADDNING OCH DYNAMISKA INSTÄLLNINGAR */}
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left space-y-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Add Main Character</h3>
          
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
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading || mainImageUrls.length > 0} className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50">
                Choose Photos
              </button>
              {selectedFiles.length > 0 && (
                <span className="text-gray-700 font-medium">{selectedFiles.length} photos selected</span>
              )}
            </div>

            {selectedFiles.length >= 3 && mainImageUrls.length === 0 && (
              <button onClick={handleStartUpload} disabled={isUploading} className="mt-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition disabled:opacity-50">
                {isUploading ? 'Uploading...' : '🚀 Ladda upp bilder'}
              </button>
            )}

            {uploadStatus && (
              <div className="mt-2 p-3 bg-blue-50 text-blue-800 rounded-lg font-mono text-sm">
                {uploadStatus}
              </div>
            )}
            
            {mainImageUrls.length > 0 && (
              <button onClick={() => { setMainImageUrls([]); setUploadStatus(''); setSelectedFiles([]); }} className="text-xs text-red-500 hover:underline text-left mt-1">
                🗑️ Ta bort sparade bilder och ladda upp nya
              </button>
            )}
          </div>
        </div>

        {/* HYBRID VÄLJARE FÖR FÖLJESLAGARE */}
        <div className={`rounded-[2rem] border-4 border-dashed border-blue-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left transition-opacity ${mainImageUrls.length === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
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
                onClick={() => { setCompanionType(opt.type as any); if (opt.type !== 'friend') { setUseCustomCompanionAI(false); } if (opt.type === 'none') setCompanionName(''); }}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-xl border-2 transition ${companionType === opt.type ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {companionType !== 'none' && (
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder={`Vad heter din ${companionType === 'dog' ? 'hund' : companionType === 'cat' ? 'katt' : 'kompis'}?`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
                value={companionName}
                onChange={(e) => setCompanionName(e.target.value)}
              />

              {companionType === 'friend' && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-blue-500 focus:ring-blue-400"
                      checked={useCustomCompanionAI}
                      onChange={(e) => setUseCustomCompanionAI(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-blue-900">Anpassa AI-ansikte för {companionName || "kompisen"}? (Kräver foton)</span>
                  </label>

                  {useCustomCompanionAI && (
                    <div className="space-y-3 pt-2 border-t border-blue-100/50">
                      <p className="text-xs text-gray-500">Ladda upp 3-5 bilder på {companionName || "kompisen"} för perfekta detaljer!</p>
                      <input type="file" multiple ref={companionFileInputRef} onChange={handleCompanionFileSelection} className="hidden" accept="image/*" />
                      
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => companionFileInputRef.current?.click()} disabled={isUploadingCompanion || companionImageUrls.length > 0} className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg text-xs transition disabled:opacity-50">
                          Välj foton på {companionName || "kompisen"}
                        </button>
                        {companionFiles.length > 0 && (
                          <span className="text-xs text-gray-600 font-medium">{companionFiles.length} foton valda</span>
                        )}
                      </div>

                      {companionFiles.length >= 3 && companionImageUrls.length === 0 && (
                        <button onClick={handleStartCompanionUpload} disabled={isUploadingCompanion} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition disabled:opacity-50">
                          {isUploadingCompanion ? 'Laddar upp...' : `🚀 Ladda upp bilder för ${companionName || "kompisen"}`}
                        </button>
                      )}

                      {companionUploadStatus && (
                        <div className="p-2 bg-white border border-blue-200 text-blue-800 rounded-lg font-mono text-xs">
                          {companionUploadStatus}
                        </div>
                      )}

                      {companionImageUrls.length > 0 && (
                        <button onClick={() => { setCompanionImageUrls([]); setCompanionUploadStatus(''); setCompanionFiles([]); }} className="text-[10px] text-red-500 hover:underline block">
                          🗑️ Ta bort bilder på {companionName || "kompisen"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left transition-opacity ${mainImageUrls.length === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <h3 className="text-lg font-bold text-gray-800 mb-2">📝 Step 2: Describe the adventure</h3>
          <textarea rows={4} className="w-full bg-transparent text-lg placeholder:text-gray-500 focus:outline-none text-gray-800" placeholder="e.g. Simon and Aston going on an exciting flight simulator ride..." value={memory} onChange={(e) => setMemory(e.target.value)} disabled={isLoadingScript || mainImageUrls.length === 0} />
        </div>

        <button type="button" onClick={handleCreateStory} disabled={isLoadingScript || mainImageUrls.length === 0} className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 text-xl font-bold text-white hover:scale-105 transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100">
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
