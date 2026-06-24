"use client";

import { useState, useRef } from 'react';

export default function Page() {
  const [memory, setMemory] = useState('');
  const [story, setStory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Bild-states
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hantera uppladdning till Vercel Blob
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setIsUploading(true);

    try {
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image.');
      }

      const newBlob = await response.json();
      setImageUrl(newBlob.url); // Här sparar vi länken till den uppladdade bilden!
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Could not upload your image, please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateStory = async () => {
    if (!memory.trim()) {
      alert("Please describe a memory or an idea first!");
      return;
    }
    setIsLoading(true);
    setStory('');

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: memory,
          characterImageUrl: imageUrl // Vi skickar med bildlänken till vårt API här!
        }),
      });

      if (!response.ok) {
        throw new Error('Something went wrong on the server.');
      }

      const data = await response.json();
      setStory(data.story);

    } catch (error) {
      console.error("Failed to generate story:", error);
      alert("Sorry, the magic failed this time. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50">
      {/* Main Headline Section */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <span className="text-purple-500">magical storybook</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Story Nest helps you write and illustrate personalized books using your children's own photos.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Step A: Upload Child's Photo */}
        <div className="rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur text-left">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📸 Step 1: Upload a photo of the main character</h3>
          <p className="text-sm text-gray-600 mb-4">This photo will be used to keep the character consistent across the book.</p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*"
          />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-full transition disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Choose Photo'}
            </button>

            {imageUrl && (
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-bold">✓ Uploaded successfully!</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imageUrl} 
                  alt="Uploaded preview" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-purple-300"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step B: Describe the story */}
        <div className="relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <div className="pointer-events-none absolute -top-5 -left-3 text-4xl">🌟</div>
          <h3 className="text-lg font-bold text-gray-800 mb-2 text-left">📝 Step 2: Describe your idea or memory</h3>
          <textarea
            id="memory"
            name="memory"
            rows={5}
            className="w-full bg-transparent text-lg placeholder:text-gray-500 focus:outline-none text-gray-800"
            placeholder="For example: The day we built a fort in the woods..."
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Magic Submit Button */}
        <button
          type="button"
          onClick={handleCreateStory}
          disabled={isLoading || isUploading}
          className="group mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 px-8 py-4 text-xl font-bold text-white transition-transform duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 shadow-md"
        >
          {isLoading ? 'Creating magic...' : ( <> <span className="transition group-hover:rotate-12">🪄</span> Create my magical story </> )}
        </button>
      </div>

      {/* Story Result Section */}
      {story && (
        <div className="mt-12 w-full max-w-2xl rounded-xl bg-white/80 p-8 shadow-lg text-left">
          <h2 className="text-2xl font-bold text-gray-800">Your Magical Story:</h2>
          <p className="mt-4 whitespace-pre-wrap text-lg text-gray-700 leading-relaxed">{story}</p>
        </div>
      )}
    </main>
  );
}
