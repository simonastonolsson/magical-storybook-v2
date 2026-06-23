"use client";

import { useState } from 'react';
import { Inter } from 'next/font/google'; // Importera Inter

const inter = Inter({ subsets: ["latin"] }); // Initiera Inter

export default function Page() {
  const [memory, setMemory] = useState('');
  const [story, setStory] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        body: JSON.stringify({ prompt: memory }),
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
    <main className={`flex min-h-screen flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-purple-50 to-pink-50 ${inter.className}`}>
      {/* Main Headline Section */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-gray-800">
          Turn any idea into a <span className="text-purple-500">magical storybook</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Story Nest helps you write and illustrate personalized books in minutes.
        </p>
      </div>

      {/* New Story Creation Section */}
      <div className="w-full max-w-2xl">
        <div className="relative rounded-[2rem] border-4 border-dashed border-purple-300/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <div className="pointer-events-none absolute -top-5 -left-3 text-4xl">🌟</div>
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
        <button
          type="button"
          onClick={handleCreateStory}
          disabled={isLoading}
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
