"use client";

import { useState, useRef } from 'react';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setIsUploading(true);

    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) throw new Error('Failed to upload image.');

      const newBlob = await response.json();
      setImageUrl(newBlob.url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Could not upload your image, please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateImagesForComic = async (comicData: any, uploadedImageUrl: string) => {
    setIsGeneratingImages(true);
    
    for (let i = 0; i < comicData.panels.length; i++) {
      const panel = comicData.panels[i];
      setCurrentlyGeneratingPanel(panel.panel_number);

      if (i > 0) {
        await delay(15000); 
      }

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: panel.image_prompt, imageUrl: uploadedImageUrl }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setGeneratedImages(prev => ({...prev, [panel.panel_number]: data.imageUrl}));
        } else {
          console.error(`Failed to generate panel ${panel.panel_number}: `, response.statusText);
        }
      } catch (err) {
        console.error(`Failed to generate image for panel ${panel.panel_number}`, err);
      }
      setCurrentlyGeneratingPanel(null);
    }
    setIsGeneratingImages(false);
  };

  const handleCreateStory = async () => {
    if (!memory.trim()) {
      alert("Please describe a memory or an idea first!");
      return;
    }
    setIsLoadingScript(true);
    setComic(null);
    setGeneratedImages({});

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: memory, characterImageUrl: imageUrl }),
      });

      if (!response.ok) throw new Error('Something went wrong on the server.');

      const data = await response.json();
      setComic(data.comic);
      
      generateImagesForComic(data.comic, imageUrl);

    } catch (error) {
      console.error("Failed to generate story:", error);
      alert("Sorry, the magic failed this time. Please try again.");
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
          Upload a photo, write an idea, and let AI direct your personal comic.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Upload main character</h3>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50">
              {isUploading ? 'Uploading...' : 'Choose Photo'}
            </button>
            {imageUrl && (
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-bold">✓ Ready!</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Uploaded preview" className="w-12 h-12 rounded-full object-cover border-2 border-purple-300" />
              </div>
            )}
          </div>
        </div>

        <div className="relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📝 Step 2: Describe the adventure</h3>
          <textarea rows={4} className="w-full bg-transparent text-lg placeholder:text-gray-500 focus:outline-none text-gray-800" placeholder="e.g. A space journey to find the missing chocolate chip cookie..." value={memory} onChange={(e) => setMemory(e.target.value)} disabled={isLoadingScript} />
        </div>

        <button type="button" onClick={handleCreateStory} disabled={isLoadingScript} className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 text-xl font-bold text-white hover:scale-105 transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100">
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
                      <span className="text-gray-400 text-5xl mb-2">
                        {currentlyGeneratingPanel === panel.panel_number ? '🎨' : '⏳'}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {currentlyGeneratingPanel === panel.panel_number 
                          ? 'AI is drawing this scene right now...' 
                          : 'In queue...'}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-yellow-400 text-black font-black w-8 h-8 flex items-center justify-center rounded-full border-2 border-black z-10">
                    {panel.panel_number}
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 min-h-[100px] flex items-center">
                  <p className="text-gray-800 font-medium text-lg leading-relaxed">
                    {panel.narration}
                  </p>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
