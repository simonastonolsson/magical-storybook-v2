"use client";

import { useState, useRef, useEffect, forwardRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { signOut } from '@/app/auth/actions';
import type { UserModel } from '@/lib/models';

interface BookPageProps {
  panel: any;
  totalPages: number;
  imageUrl: string | undefined;
  isGeneratingThisPanel: boolean;
  onNarrationChange: (panelNumber: number, value: string) => void;
}

// react-pageflip's clickEventForward only whitelists <a> and <button> tags -
// it calls preventDefault() on mousedown for anything else (including
// <textarea>), which silently blocks them from ever getting focus.
//
// A React onMouseDown/onTouchStart prop can't fix this: page-flip attaches
// its own listener directly to a real DOM node (.stf__block, created via
// raw insertAdjacentHTML, not rendered by React) that sits between the
// textarea and the app's React root. Since React 17+ delegates synthetic
// events to the root container, our prop handler only runs once the event
// has already bubbled past .stf__block in the real DOM - by then
// page-flip's own listener has already fired and already called
// preventDefault(), blocking focus, regardless of what we do afterwards.
//
// A real, native addEventListener call directly on the textarea itself
// runs in actual native bubble order (child before parent), so it can
// call stopPropagation() before the event ever reaches .stf__block.
const BookPage = forwardRef<HTMLDivElement, BookPageProps>(function BookPage(
  { panel, totalPages, imageUrl, isGeneratingThisPanel, onNarrationChange },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const stopNative = (e: Event) => e.stopPropagation();
    el.addEventListener('mousedown', stopNative);
    el.addEventListener('touchstart', stopNative);
    return () => {
      el.removeEventListener('mousedown', stopNative);
      el.removeEventListener('touchstart', stopNative);
    };
  }, []);

  return (
    <div className="book-page" ref={ref}>
      <div className="book-page-image-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt={'Sida ' + panel.panel_number} className="book-page-img" />
        ) : (
          <div className="book-page-placeholder">
            <span style={{fontSize:'2rem'}}>{isGeneratingThisPanel ? '🎨' : '⏳'}</span>
            <span style={{fontSize:'0.8rem', color:'#9ca3af'}}>{isGeneratingThisPanel ? 'Ritar...' : 'Väntar...'}</span>
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="book-page-text"
        rows={3}
        value={panel.narration}
        onChange={(e) => onNarrationChange(panel.panel_number, e.target.value)}
      />
      <div className="book-page-number">{panel.panel_number} / {totalPages}</div>
    </div>
  );
});

interface BookCoverProps {
  variant: 'front' | 'back';
  title: string;
  imageUrl?: string | null;
  isGenerating?: boolean;
  onImageLoad?: () => void;
  onImageError?: () => void;
  editable?: boolean;
  onTitleChange?: (value: string) => void;
}

// Rendered standalone (outside HTMLFlipBook) so the cover/back cover can take
// up the full spread width as one page, instead of react-pageflip's hard-page
// mode, which still reserves a 2-page-wide slot and leaves the other half empty.
// Also reused for print/PDF export (see the print-only block further down) -
// editable/onTitleChange are only passed at the interactive front-cover call
// site, so print output and the back cover stay a plain, static heading.
function BookCoverPage({ variant, title, imageUrl, isGenerating, onImageLoad, onImageError, editable, onTitleChange }: BookCoverProps) {
  if (variant === 'front') {
    return (
      <div className="book-page book-cover book-cover-front">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="book-cover-img" onLoad={onImageLoad} onError={onImageError} />
        ) : isGenerating ? (
          <div className="book-cover-placeholder">
            <span style={{fontSize:'2rem'}}>🎨</span>
            <span style={{fontSize:'0.8rem', color:'rgba(255,255,255,0.65)'}}>Skapar omslag...</span>
          </div>
        ) : null}
        <div className="book-cover-overlay">
          <span className="book-cover-eyebrow">Storylabz</span>
          {editable ? (
            <input
              type="text"
              className="book-cover-title-input"
              value={title}
              placeholder="Boktitel"
              onChange={(e) => onTitleChange?.(e.target.value)}
            />
          ) : (
            <h2 className="book-cover-title">{title}</h2>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="book-page book-cover book-cover-back">
      <span className="book-cover-back-label">Slut</span>
    </div>
  );
}

const BOOK_ASPECT = 1.5; // height / width, matches a 2:3 portrait page
const COVER_ASPECT = 11 / 8; // ~1.375:1, an 8x11in single-page cover/back-cover
const MOBILE_BREAKPOINT = 768;

function computeBookSize() {
  if (typeof window === 'undefined') {
    return { width: 420, height: 630, mobile: false };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < MOBILE_BREAKPOINT;

  let height = vh * 0.85;
  let width = height / BOOK_ASPECT;

  // Reserve room for the overlay nav arrows so the spread never gets clipped.
  const maxContentWidth = mobile ? vw - 64 : vw - 320;
  const pagesWide = mobile ? 1 : 2;
  if (width * pagesWide > maxContentWidth) {
    width = maxContentWidth / pagesWide;
    height = width * BOOK_ASPECT;
  }

  return { width: Math.round(width), height: Math.round(height), mobile };
}

export default function Page() {
  const [step, setStep] = useState(1);
  const [memory, setMemory] = useState('');
  const [comic, setComic] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [pageCount, setPageCount] = useState<number>(8);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSavingReferencePhotos, setIsSavingReferencePhotos] = useState(false);
  const [referencePhotosStatus, setReferencePhotosStatus] = useState('');
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [savedModelDbId, setSavedModelDbId] = useState<string | null>(null);
  const [charDescSaveStatus, setCharDescSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedCharacters, setSavedCharacters] = useState<UserModel[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  const [charName, setCharacterName] = useState('');
  const [charDesc, setCharacterDescription] = useState('an adult man');
  const [charOutfit, setCharOutfit] = useState('');
  const [customOutfit, setCustomOutfit] = useState('');
  const [bookStyle, setBookStyle] = useState('digital_painting');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentlyGeneratingPanel, setCurrentlyGeneratingPanel] = useState<number | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<number, string>>({});
  const [panelsLoading, setPanelsLoading] = useState<Record<number, boolean>>({});
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const [companionType, setCompanionType] = useState<'none' | 'dog' | 'cat' | 'friend'>('none');
  const [companionName, setCompanionName] = useState('');
  const [useCustomCompanionAI, setUseCustomCompanionAI] = useState(false);
  const [companionFiles, setCompanionFiles] = useState<File[]>([]);
  const [isSavingCompanionPhoto, setIsSavingCompanionPhoto] = useState(false);
  const [companionSaveStatus, setCompanionSaveStatus] = useState('');
  const [companionReferenceImageUrl, setCompanionReferenceImageUrl] = useState<string | null>(null);
  const companionFileInputRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<any>(null);

  const [bookView, setBookView] = useState<'cover' | 'reading' | 'back-cover'>('cover');
  const [flipbookStartPage, setFlipbookStartPage] = useState(0);

  const [bookSize, setBookSize] = useState(() => computeBookSize());

  useEffect(() => {
    const handleResize = () => setBookSize(computeBookSize());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectCharacter = (model: UserModel) => {
    setSavedModelDbId(model.id);
    setReferenceImageUrls(model.reference_image_url ? [model.reference_image_url] : []);
    setCharacterName(model.model_name);
    setCharacterDescription(model.char_desc || 'an adult man');
    setReferencePhotosStatus('Karaktär hittad och redo!');
    setShowCharacterPicker(false);
  };

  const handleDeleteCharacter = async (id: string) => {
    try { await fetch('/api/user-models/' + id, { method: 'DELETE' }); }
    catch (err) { console.error('Failed to delete character', err); }
    setSavedCharacters(prev => prev.filter(m => m.id !== id));
    if (savedModelDbId === id) {
      setSavedModelDbId(null);
      setReferenceImageUrls([]);
      setReferencePhotosStatus('');
    }
  };

  const handleAddNewCharacter = () => {
    setSavedModelDbId(null);
    setReferenceImageUrls([]);
    setCharacterName('');
    setCharacterDescription('an adult man');
    setReferencePhotosStatus('');
    setSelectedFiles([]);
  };

  useEffect(() => {
    const loadSavedModels = async () => {
      try {
        const res = await fetch('/api/user-models');
        if (!res.ok) return;
        const { models } = await res.json();
        setSavedCharacters(models || []);
        if (models?.length === 1) {
          selectCharacter(models[0]);
        } else if (models?.length > 1) {
          setShowCharacterPicker(true);
        }
      } catch (err) {
        console.error('Failed to load saved models', err);
      }
    };
    loadSavedModels();

    const savedCompanionRef = localStorage.getItem('my_saved_companion_reference_image');
    if (savedCompanionRef) {
      setCompanionReferenceImageUrl(savedCompanionRef);
      setCompanionSaveStatus('Sparat foto på kompisen hittades!');
    }
    const savedOutfit = localStorage.getItem('my_saved_outfit');
    if (savedOutfit) setCharOutfit(savedOutfit);
  }, []);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length > 8) {
      alert('Max 8 foton - de första 8 används.');
      setSelectedFiles(files.slice(0, 8));
    } else {
      setSelectedFiles(files);
    }
  };

  const handleCharDescChange = async (newDesc: string) => {
    setCharacterDescription(newDesc);
    if (!savedModelDbId) return;
    setCharDescSaveStatus('saving');
    try {
      const res = await fetch(`/api/user-models/${savedModelDbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ char_desc: newDesc }),
      });
      setCharDescSaveStatus(res.ok ? 'saved' : 'error');
    } catch (err) {
      console.error('Failed to update saved character description', err);
      setCharDescSaveStatus('error');
    } finally {
      setTimeout(() => setCharDescSaveStatus('idle'), 2500);
    }
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

  // Gemini needs no training - just the reference photos themselves, saved
  // directly via the same /api/upload-reference path used for a single photo
  // before. Uploads run in parallel since each is an independent request.
  // Not persisted to user_models here (session-only for now) - this new
  // character is fully usable for generating this book, but won't show up
  // in the saved-character picker on a future visit until that persistence
  // path is rebuilt without the LoRA-era model_path/trigger_word fields.
  const handleSaveReferencePhotos = async () => {
    if (selectedFiles.length < 5) { alert('Ladda upp minst 5 foton!'); return; }
    const trimmedName = charName.trim();
    if (savedCharacters.some(m => m.model_name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      alert('Du har redan en karaktär som heter ' + trimmedName + ', välj ett annat namn.');
      return;
    }
    setIsSavingReferencePhotos(true);
    try {
      setReferencePhotosStatus('Sparar foton...');
      const urls = await Promise.all(selectedFiles.map((file) => uploadReferenceImageToBlob(file)));
      setReferenceImageUrls(urls);
      setReferencePhotosStatus('Klart! Din karaktär är redo.');
    } catch (err) {
      console.error(err);
      setReferencePhotosStatus('Fel vid sparande. Försök igen.');
    } finally { setIsSavingReferencePhotos(false); }
  };

  // Gemini has no LoRA/training concept, so the companion's photo just needs
  // to be saved as a plain reference image (same /api/upload-reference path
  // the main character already uses) - no training job, no wait.
  const handleSaveCompanionReferenceImage = async () => {
    if (companionFiles.length < 1) { alert('Ladda upp minst ett foto!'); return; }
    setIsSavingCompanionPhoto(true);
    try {
      const url = await uploadReferenceImageToBlob(companionFiles[0]);
      setCompanionReferenceImageUrl(url);
      localStorage.setItem('my_saved_companion_reference_image', url);
      setCompanionSaveStatus('Klart!');
    } catch (err) {
      console.error(err);
      setCompanionSaveStatus('Kunde inte spara fotot. Försök igen.');
    } finally { setIsSavingCompanionPhoto(false); }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // useCustomCompanionAI/companionReferenceImageUrl being set means the
  // companion feature is enabled for the book, but not that the companion
  // actually appears in a given panel's own prompt. Sending the companion's
  // reference photo on every single generation call (even solo-character
  // scenes) risks interfering with the main character's fidelity, so only
  // include it when the companion is actually mentioned by name in that
  // specific prompt (story/route.ts's companionInstruction requires the
  // companion be referred to by name in every image_prompt they appear in).
  const companionReferenceImageUrlForPrompt = (promptText: string) => {
    if (!useCustomCompanionAI || !companionReferenceImageUrl || !companionName) return null;
    return new RegExp(companionName, 'i').test(promptText || '') ? companionReferenceImageUrl : null;
  };

  const generateImagesForComic = async (comicData: any, baseSeed: number) => {
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
            charDesc,
            charName,
            charOutfit: customOutfit || charOutfit,
            bookStyle,
            referenceImageUrls,
            companionReferenceImageUrl: companionReferenceImageUrlForPrompt(panel.image_prompt),
            companionName: companionName || null,
            seed: baseSeed + i + 1,
            isCover: false
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

  // "the character" here is the fixed reference story/route.ts's COVER SCENE
  // rule says gets added automatically before cover_scene - the character's
  // name/identity is established separately via the IDENTITY LOCK paragraph
  // in generate-image/route.ts, so it isn't repeated here too.
  const buildCoverPrompt = (title: string, coverScene: string) =>
    "Comic book cover art, dramatic graphic novel cover illustration, the character " + (coverScene || "in a dynamic heroic action pose, mid-motion, dramatic angle") + ", waist-up close-up portrait composition with the character large and close in the foreground, the character's entire head and hair fully visible with generous headroom above, never cropped at the top of frame, layered composition with a detailed background scene evoking the story '" + title + "': " + memory + ", cinematic dramatic lighting, high contrast, bold saturated colors, epic composition, title-ready framing with clear space at top and bottom for text, bold attention-grabbing cover illustration";

  const generateCoverImage = async (comicData: any, baseSeed: number) => {
    setIsGeneratingCover(true);
    try {
      const coverPrompt = buildCoverPrompt(comicData.title, comicData.cover_scene);
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: coverPrompt,
          charDesc,
          charName,
          charOutfit: customOutfit || charOutfit,
          bookStyle,
          referenceImageUrls,
          companionReferenceImageUrl: companionReferenceImageUrlForPrompt(coverPrompt),
          companionName: companionName || null,
          seed: baseSeed,
          isCover: true
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCoverImageUrl(data.imageUrl);
      }
    } catch (err) {
      console.error('Failed to generate cover image', err);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleCreateStory = async () => {
    if (!memory.trim()) { alert("Beskriv ett äventyr först!"); return; }
    setIsLoadingScript(true);
    setComic(null);
    setCurrentPage(0);
    setBookView('cover');
    setFlipbookStartPage(0);
    setGeneratedImages({});
    setCoverImageUrl(null);
    let secondaryDescription = "";
    if (companionType === 'dog') secondaryDescription = 'a friendly golden retriever dog named ' + (companionName || "Aston");
    if (companionType === 'cat') secondaryDescription = 'a cute fluffy cat named ' + (companionName || "Misse");
    if (companionType === 'friend') secondaryDescription = 'a close friend named ' + (companionName || "Kompis");
    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: memory,
          characterName: charName,
          characterDescription: charDesc,
          secondaryName: companionName || null,
          secondaryDescription: secondaryDescription || null,
          pageCount,
          charOutfit: customOutfit || charOutfit || null
        }),
      });
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      setComic(data.comic);
      const baseSeed = Math.floor(Math.random() * 2147483647);
      await generateCoverImage(data.comic, baseSeed);
      generateImagesForComic(data.comic, baseSeed);
    } catch (err) {
      console.error(err);
      alert("Något gick snett, försök igen.");
    } finally { setIsLoadingScript(false); }
  };

  const handleRegeneratePanel = async (panelNumber: number, originalPrompt: string) => {
    const instruction = customPrompts[panelNumber];
    if (!instruction?.trim() || referenceImageUrls.length === 0) return;
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
          charDesc,
          charName,
          charOutfit: customOutfit || charOutfit,
          bookStyle,
          referenceImageUrls,
          companionReferenceImageUrl: companionReferenceImageUrlForPrompt(refinedPrompt),
          companionName: companionName || null,
          isCover: false
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

  // Cover uses panel-number key 0 (real panel numbers start at 1) to share the
  // same customPrompts/panelsLoading maps as regular panels instead of adding
  // parallel state just for the cover.
  const handleRegenerateCover = async () => {
    const instruction = customPrompts[0];
    if (!instruction?.trim() || referenceImageUrls.length === 0 || !comic) return;
    setPanelsLoading(prev => ({ ...prev, 0: true }));
    try {
      const refineRes = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalPrompt: buildCoverPrompt(comic.title, comic.cover_scene), instruction }),
      });
      if (!refineRes.ok) throw new Error("Refine failed");
      const { refinedPrompt } = await refineRes.json();
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: refinedPrompt,
          charDesc,
          charName,
          charOutfit: customOutfit || charOutfit,
          bookStyle,
          referenceImageUrls,
          companionReferenceImageUrl: companionReferenceImageUrlForPrompt(refinedPrompt),
          companionName: companionName || null,
          isCover: true
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setCoverImageUrl(data.imageUrl);
        setCustomPrompts(prev => ({ ...prev, 0: '' }));
      }
    } catch (err) { console.error(err); }
    finally { setPanelsLoading(prev => ({ ...prev, 0: false })); }
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
    { value: 'superhero cape and mask, colorful costume', label: 'Superhjälte', emoji: '🦸' },
    { value: 'khaki cargo pants and adventure jacket', label: 'Äventyrare', emoji: '🎒' },
    { value: 'cozy pajamas with star pattern', label: 'Pyjamas', emoji: '🌙' },
  ];

  const outfits = isChild ? childOutfits : adultOutfits;

  const renderPrintPage = (panel: any) => (
    <div key={panel.panel_number} className="print-page print-page-panel">
      <div className="book-page-image-wrap">
        {generatedImages[panel.panel_number] ? (
          <img src={generatedImages[panel.panel_number]} alt={'Sida ' + panel.panel_number} className="book-page-img" />
        ) : (
          <div className="book-page-placeholder">
            <span style={{fontSize:'2rem'}}>⏳</span>
          </div>
        )}
      </div>
      <p className="book-page-text">{panel.narration}</p>
      <div className="print-page-footer">{panel.panel_number}</div>
    </div>
  );

  const handleNarrationChange = (panelNumber: number, value: string) => {
    setComic((prev: any) => ({ ...prev, panels: prev.panels.map((p: any) => p.panel_number === panelNumber ? { ...p, narration: value } : p) }));
  };

  const handleTitleChange = (value: string) => {
    setComic((prev: any) => prev ? { ...prev, title: value } : prev);
  };

  const handleRegenChange = (panelNumber: number, value: string) => {
    setCustomPrompts(prev => ({ ...prev, [panelNumber]: value }));
  };

  // In landscape/spread mode HTMLFlipBook shows two panels side by side, so this
  // is called once per visible panel index (currentPage and currentPage + 1)
  // instead of once for a single shared currentPage.
  const renderRegenField = (panelIndex: number, maxWidth: number) => {
    const panel = comic?.panels?.[panelIndex];
    if (!panel || !generatedImages[panel.panel_number]) return null;
    return (
      <div className="book-external-regen" style={{ maxWidth, flex: 1, minWidth: 0 }} key={panel.panel_number}>
        <input
          type="text"
          placeholder="Ändra något i bilden..."
          value={customPrompts[panel.panel_number] || ''}
          onChange={(e) => handleRegenChange(panel.panel_number, e.target.value)}
          disabled={!!panelsLoading[panel.panel_number]}
        />
        <button
          onClick={() => handleRegeneratePanel(panel.panel_number, panel.image_prompt)}
          disabled={!!panelsLoading[panel.panel_number] || !(customPrompts[panel.panel_number] || '').trim()}
        >
          {panelsLoading[panel.panel_number] ? '...' : 'Uppdatera'}
        </button>
      </div>
    );
  };

  const handleFlip = (e: any) => {
    setCurrentPage(e.data);
  };

  const handleBookNext = () => {
    if (bookView === 'cover') {
      setFlipbookStartPage(0);
      setBookView('reading');
      return;
    }
    if (bookView === 'reading' && comic) {
      const isOnLastSpread = currentPage >= comic.panels.length - 2;
      if (isOnLastSpread) {
        setBookView('back-cover');
      } else {
        bookRef.current?.pageFlip().flipNext();
      }
    }
  };

  const handleBookPrev = () => {
    if (bookView === 'back-cover' && comic) {
      const lastSpreadStart = comic.panels.length % 2 === 0
        ? Math.max(0, comic.panels.length - 2)
        : Math.max(0, comic.panels.length - 1);
      setFlipbookStartPage(lastSpreadStart);
      setBookView('reading');
      return;
    }
    if (bookView === 'reading') {
      if (currentPage === 0) {
        setBookView('cover');
      } else {
        bookRef.current?.pageFlip().flipPrev();
      }
    }
  };

  const preloadImage = (url: string): Promise<void> => {
    const img = new Image();
    img.src = url;
    return img.decode().catch(() => {});
  };

  const handlePrint = async () => {
    setIsPreparingPrint(true);
    try {
      const urls: string[] = [];
      if (coverImageUrl) urls.push(coverImageUrl);
      if (comic) {
        comic.panels.forEach((panel: any) => {
          const url = generatedImages[panel.panel_number];
          if (url) urls.push(url);
        });
      }
      await Promise.all(urls.map(preloadImage));
    } finally {
      setIsPreparingPrint(false);

      // TEMPORARY DIAGNOSTIC LOGGING - remove once the print cover-image bug is confirmed fixed or root-caused.
      const printCoverImg = document.querySelector<HTMLImageElement>('.print-only .book-cover-front .book-cover-img');
      console.log('[PRINT DEBUG] coverImageUrl state right before window.print():', coverImageUrl);
      console.log('[PRINT DEBUG] print-only cover <img> element found in DOM:', !!printCoverImg);
      if (printCoverImg) {
        console.log('[PRINT DEBUG] print-only cover <img>.src:', printCoverImg.src);
        console.log('[PRINT DEBUG] print-only cover <img>.complete:', printCoverImg.complete);
        console.log('[PRINT DEBUG] print-only cover <img>.naturalWidth:', printCoverImg.naturalWidth);
        console.log('[PRINT DEBUG] print-only cover <img>.naturalHeight:', printCoverImg.naturalHeight);
        console.log('[PRINT DEBUG] cover img rect:', JSON.stringify(printCoverImg.getBoundingClientRect()));
        const parentEl = printCoverImg.parentElement;
        console.log('[PRINT DEBUG] parent rect:', parentEl ? JSON.stringify(parentEl.getBoundingClientRect()) : 'no parent found');
        const grandparentEl = parentEl?.parentElement;
        console.log('[PRINT DEBUG] grandparent rect:', grandparentEl ? JSON.stringify(grandparentEl.getBoundingClientRect()) : 'no grandparent found');
      }

      window.print();
    }
  };

  return (
    <main style={{minHeight:'100vh', background:'#faf8f3', fontFamily:'Inter, sans-serif', color:'#1a1a2e'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .wiz-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(250,248,243,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #e5e0d8; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
        .wiz-logo { font-family: 'Playfair Display', serif; font-size: 1.3rem; font-weight: 900; color: #1a1a2e; text-decoration: none; }
        .wiz-logo span { color: #7c3aed; }
        .wiz-step-label { font-size: 0.85rem; color: #6b7280; font-weight: 500; }
        .wiz-logout-btn { padding: 0.5rem 1rem; background: none; color: #6b7280; border: 1.5px solid #e5e0d8; border-radius: 100px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .wiz-logout-btn:hover { border-color: #1a1a2e; color: #1a1a2e; }
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
        .comic-header { max-width: 1000px; margin: 0 auto; padding: 5rem 1.5rem 0; display: none; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .comic-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; }
        .pdf-btn { padding: 0.75rem 1.5rem; background: #1a1a2e; color: white; border: none; border-radius: 100px; font-weight: 700; font-size: 0.9rem; cursor: pointer; }
        .pdf-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .book-stage { background: #f6f2ea; min-height: 88vh; padding: 2rem clamp(24px, 8vw, 140px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem; box-sizing: border-box; }
        .book-wrapper { position: relative; display: inline-flex; align-items: center; justify-content: center; }
        .book-shadow-wrapper { position: relative; box-shadow: 0 30px 70px rgba(26,26,46,0.35), 0 10px 26px rgba(26,26,46,0.22), 0 2px 8px rgba(26,26,46,0.18); border-radius: 6px; animation: bookRevealIn 0.45s ease; }
        .book-shadow-wrapper-single { overflow: hidden; }
        .story-flipbook { border-radius: 6px; }
        @keyframes bookRevealIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .book-shadow-wrapper { animation: none; }
        }
        .book-page { background: #fffdf8; height: 100%; display: flex; flex-direction: column; padding: 14px 14px 10px; position: relative; overflow: hidden; }
        .book-page-image-wrap { flex: 1; min-height: 0; border-radius: 4px; overflow: hidden; background: #f3f0eb; display: flex; }
        .book-page-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .book-page-placeholder { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; }
        .book-page-text { width: 100%; background: transparent; border: none; outline: none; resize: none; font-family: Inter, sans-serif; font-size: 0.85rem; line-height: 1.5; color: #1a1a2e; padding: 0.5rem 0.15rem 0.25rem; flex-shrink: 0; }
        .book-external-regen-row { display: flex; gap: 1rem; width: 100%; justify-content: center; }
        .book-external-regen { display: flex; gap: 0.5rem; width: 100%; }
        .book-external-regen input { flex: 1; min-width: 0; padding: 0.6rem 0.9rem; border: 1.5px solid #e5e0d8; border-radius: 100px; font-size: 0.85rem; outline: none; font-family: Inter, sans-serif; background: white; color: #1a1a2e; }
        .book-external-regen input:focus { border-color: #7c3aed; }
        .book-external-regen input:disabled { opacity: 0.6; cursor: not-allowed; }
        .book-external-regen button { flex-shrink: 0; padding: 0.6rem 1.25rem; background: #7c3aed; color: white; border: none; border-radius: 100px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .book-external-regen button:disabled { opacity: 0.5; cursor: not-allowed; }
        .book-page-number { position: absolute; bottom: 6px; right: 10px; font-size: 0.7rem; color: #9ca3af; font-family: Inter, sans-serif; background: rgba(255,255,255,0.75); padding: 1px 7px; border-radius: 100px; }
        .book-cover { align-items: center; justify-content: center; }
        .book-cover-front { padding: 0; position: relative; background: #1a1a2e; }
        .book-cover-img { flex: 1; min-height: 0; height: 100%; width: 100%; display: block; object-fit: cover; }
        .book-cover-placeholder { flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; }
        .book-cover-overlay { position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; text-align: center; gap: 0.75rem; padding: 2rem 1.75rem 2.25rem; background: linear-gradient(to top, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.78) 32%, rgba(10,10,20,0.4) 58%, rgba(10,10,20,0) 88%); }
        .book-cover-eyebrow { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(232,184,75,0.85); }
        .book-cover-title { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 6.5vw, 4.75rem); font-weight: 900; color: white; line-height: 1.02; letter-spacing: -0.01em; text-wrap: balance; text-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 10px 32px rgba(0,0,0,0.6); }
        .book-cover-title-input { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 6.5vw, 4.75rem); font-weight: 900; color: white; line-height: 1.02; letter-spacing: -0.01em; text-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 10px 32px rgba(0,0,0,0.6); background: transparent; border: none; outline: none; text-align: center; width: 100%; padding: 0; }
        .book-cover-title-input:focus { outline: 2px dashed rgba(255,255,255,0.6); outline-offset: 4px; }
        .book-cover-title-input::placeholder { color: rgba(255,255,255,0.5); }
        .book-cover-back { background: #1a1a2e; }
        .book-cover-back-label { font-family: 'Playfair Display', serif; font-size: 1.2rem; color: rgba(255,255,255,0.6); letter-spacing: 0.08em; }
        .book-spine { position: absolute; top: 3%; bottom: 3%; left: 50%; width: 60px; margin-left: -30px; background: linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.24) 50%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0) 100%); pointer-events: none; z-index: 6; }
        .book-nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 56px; height: 56px; border-radius: 50%; border: none; background: rgba(26,26,46,0.45); color: white; font-size: 1.6rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 1; transition: background 0.2s, transform 0.2s; }
        .book-nav-arrow:hover { background: rgba(26,26,46,0.65); transform: translateY(-50%) scale(1.06); }
        .book-nav-arrow:disabled { opacity: 0.15; cursor: default; pointer-events: none; }
        .book-nav-arrow-left { left: -76px; }
        .book-nav-arrow-right { right: -76px; }
        .print-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
        .print-page { width: 8in; height: 11in; box-sizing: border-box; overflow: hidden; background: white; page-break-after: always; break-after: page; }
        .print-page:last-child { page-break-after: auto; break-after: auto; }
        .print-page-panel { display: flex; flex-direction: column; padding: 0.5in; gap: 0.3in; }
        .print-page-panel .book-page-image-wrap { flex: 1; min-height: 0; }
        .print-page-panel .book-page-text { flex-shrink: 0; font-size: 13pt; padding: 0; }
        .print-page-cover { position: relative; padding: 0; }
        .print-page-footer { text-align: center; font-family: Inter, sans-serif; font-size: 10pt; color: #9ca3af; flex-shrink: 0; }
        @media print {
          @page { size: 8in 11in; margin: 0; }
          .wiz-nav, .wiz-progress, .wiz-footer, .book-stage { display: none !important; }
          .print-only { position: static !important; width: auto !important; height: auto !important; overflow: visible !important; clip: auto !important; white-space: normal !important; display: block !important; }
          .print-only, .print-only * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          /* TEMPORARY DIAGNOSTIC - remove once the Safari print cover-image bug is root-caused. */
          .print-page-cover .book-cover-img { outline: 4px solid red !important; }
          .print-page-cover.print-page { outline: 4px solid blue !important; }
          .print-page-cover .book-cover-front { outline: 4px solid lime !important; }
        }
        @media (max-width: 600px) {
          .wiz-grid-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .book-spine { display: none; }
          .book-nav-arrow { width: 42px; height: 42px; font-size: 1.3rem; background: rgba(26,26,46,0.5); }
          .book-nav-arrow-left { left: 8px; }
          .book-nav-arrow-right { right: 8px; }
          .book-stage { padding: 1.25rem 0.5rem; min-height: 80vh; }
        }
      `}</style>

      <nav className="wiz-nav">
        <a href="/" className="wiz-logo">Story<span>labz</span></a>
        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
          {!comic && <span className="wiz-step-label">Steg {step} av {totalSteps}</span>}
          {comic && <button className="pdf-btn" onClick={handlePrint} disabled={isPreparingPrint}>{isPreparingPrint ? 'Förbereder...' : 'Ladda ner PDF'}</button>}
          <form action={signOut}>
            <button type="submit" className="wiz-logout-btn">Logga ut</button>
          </form>
        </div>
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
              <div className="wiz-title">Vem är stjärnan?</div>
              <p className="wiz-sub">Berätta vem boken ska handla om och ladda upp foton så att AI:n kan skapa din unika karaktär.</p>

              {showCharacterPicker && referenceImageUrls.length === 0 && (
                <div className="wiz-card">
                  <label className="wiz-label">Välj karaktär</label>
                  <p style={{fontSize:'0.85rem', color:'#6b7280', marginBottom:'1rem', lineHeight:'1.5'}}>Du har flera sparade karaktärer - välj en att använda, eller lägg till en ny.</p>
                  <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
                    {savedCharacters.map((m) => (
                      <div key={m.id} style={{display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.9rem', border:'1.5px solid #e5e0d8', borderRadius:'12px'}}>
                        {m.reference_image_url && (
                          <img src={m.reference_image_url} alt={m.model_name} style={{width:40, height:40, borderRadius:'50%', objectFit:'cover'}} />
                        )}
                        <span style={{flex:1, fontWeight:600}}>{m.model_name}</span>
                        <button className="wiz-chip" onClick={() => selectCharacter(m)}>Välj</button>
                        <button className="wiz-delete-link" onClick={() => handleDeleteCharacter(m.id)}>Ta bort</button>
                      </div>
                    ))}
                  </div>
                  <button className="wiz-upload-btn" style={{marginTop:'1rem'}} onClick={() => setShowCharacterPicker(false)}>
                    + Lägg till en ny karaktär istället
                  </button>
                </div>
              )}

              {(!showCharacterPicker || referenceImageUrls.length > 0) && (
              <>
              <div className="wiz-card">
                <div className="wiz-grid-2" style={{marginBottom:'1rem'}}>
                  <div>
                    <label className="wiz-label">Namn</label>
                    <input className="wiz-input" type="text" placeholder="t.ex. Simon" value={charName} onChange={(e) => setCharacterName(e.target.value)} />
                  </div>
                  <div>
                    <label className="wiz-label">Karaktärstyp</label>
                    <select className="wiz-select" value={charDesc} onChange={(e) => handleCharDescChange(e.target.value)}>
                      <option value="an adult man">Vuxen man</option>
                      <option value="an adult woman">Vuxen kvinna</option>
                      <option value="a young boy">Pojke</option>
                      <option value="a young girl">Flicka</option>
                      <option value="a friendly dog">Hund</option>
                      <option value="a cute fluffy cat">Katt</option>
                    </select>
                    {charDescSaveStatus === 'saving' && <span style={{fontSize:'0.75rem', color:'#6b7280', marginTop:'0.35rem', display:'block'}}>Sparar...</span>}
                    {charDescSaveStatus === 'saved' && <span style={{fontSize:'0.75rem', color:'#065f46', marginTop:'0.35rem', display:'block'}}>Sparat!</span>}
                    {charDescSaveStatus === 'error' && <span style={{fontSize:'0.75rem', color:'#ef4444', marginTop:'0.35rem', display:'block'}}>Kunde inte spara, försök igen</span>}
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
                <label className="wiz-label">Foton (5-8 st)</label>
                <ul style={{fontSize:'0.85rem', color:'#6b7280', marginBottom:'1rem', lineHeight:'1.6', paddingLeft:'1.1rem'}}>
                  <li>Ladda upp 5-8 foton av {charName || "karaktären"} från olika vinklar för bästa resultat</li>
                  <li>Variera vinklar: rakt framifrån, tre-kvarts, gärna någon lätt uppifrån/nedifrån</li>
                  <li>Bra, jämn belysning - undvik starka skuggor och bakljus</li>
                  <li>Inga solglasögon, hattar eller annat som döljer ansiktet</li>
                  <li>Samma frisyr/skägg på alla bilder</li>
                  <li>Olika bakgrunder/miljöer, inte bara en plats eller ett tillfälle</li>
                </ul>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelection} className="hidden" accept="image/*" style={{display:'none'}} />
                <div style={{display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap'}}>
                  <button className="wiz-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={isSavingReferencePhotos || referenceImageUrls.length > 0}>
                    📸 Välj foton
                  </button>
                  {selectedFiles.length > 0 && <span style={{fontSize:'0.85rem', color:'#6b7280'}}>{selectedFiles.length} foton valda</span>}
                </div>
                {selectedFiles.length >= 5 && referenceImageUrls.length === 0 && (
                  <button className="wiz-train-btn" onClick={handleSaveReferencePhotos} disabled={isSavingReferencePhotos}>
                    {isSavingReferencePhotos ? 'Sparar...' : 'Spara foton'}
                  </button>
                )}
                {referencePhotosStatus && (
                  <div className={'wiz-status' + (referenceImageUrls.length > 0 ? ' wiz-success' : '')}>{referencePhotosStatus}</div>
                )}
                {referenceImageUrls.length > 0 && (
                  <button className="wiz-upload-btn" onClick={handleAddNewCharacter}>
                    + Lägg till en helt ny karaktär (behåll {charName})
                  </button>
                )}
                {referenceImageUrls.length > 0 && (
                  <button className="wiz-delete-link" onClick={() => {
                    if (savedModelDbId) {
                      handleDeleteCharacter(savedModelDbId);
                    } else {
                      setReferenceImageUrls([]);
                      setReferencePhotosStatus('');
                    }
                  }}>
                    Ta bort och lägg till ny karaktär
                  </button>
                )}
              </div>
              </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="wiz-eyebrow">Steg 2 av 4</div>
              <div className="wiz-title">Ska någon följa med?</div>
              <p className="wiz-sub">Lägg till en kompis, ett husdjur eller gå ensam på äventyret.</p>

              <div className="wiz-card">
                <label className="wiz-label">Följeslagare</label>
                <div className="wiz-chips" style={{marginBottom:'1rem'}}>
                  {[{type:'none',label:'Ingen',emoji:'🧍'},{type:'dog',label:'Hund',emoji:'🐶'},{type:'cat',label:'Katt',emoji:'🐱'},{type:'friend',label:'Kompis',emoji:'🧑'}].map((opt) => (
                    <button key={opt.type} onClick={() => { setCompanionType(opt.type as any); if (opt.type !== 'friend') setUseCustomCompanionAI(false); if (opt.type === 'none') setCompanionName(''); }} className={'wiz-chip' + (companionType === opt.type ? ' active' : '')}>
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>

                {companionType !== 'none' && (
                  <div style={{marginTop:'0.5rem'}}>
                    <label className="wiz-label">Namn på {companionType === 'dog' ? 'hunden' : companionType === 'cat' ? 'katten' : 'kompisen'}</label>
                    <input className="wiz-input" type="text" placeholder="t.ex. Aston" value={companionName} onChange={(e) => setCompanionName(e.target.value)} />
                  </div>
                )}

                {companionType === 'friend' && (
                  <div style={{marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid #f3f0eb'}}>
                    <label style={{display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.9rem', fontWeight:'600'}}>
                      <input type="checkbox" checked={useCustomCompanionAI} onChange={(e) => setUseCustomCompanionAI(e.target.checked)} />
                      Använd {companionName || "kompisens"} riktiga utseende
                    </label>
                    {useCustomCompanionAI && (
                      <div style={{marginTop:'0.75rem'}}>
                        <input type="file" ref={companionFileInputRef} onChange={handleCompanionFileSelection} className="hidden" accept="image/*" style={{display:'none'}} />
                        <button className="wiz-upload-btn" onClick={() => companionFileInputRef.current?.click()} disabled={isSavingCompanionPhoto || companionReferenceImageUrl !== null} style={{fontSize:'0.85rem'}}>
                          Välj foto på {companionName || "kompisen"}
                        </button>
                        {companionFiles.length >= 1 && !companionReferenceImageUrl && (
                          <button className="wiz-train-btn" onClick={handleSaveCompanionReferenceImage} disabled={isSavingCompanionPhoto} style={{fontSize:'0.9rem'}}>
                            {isSavingCompanionPhoto ? 'Sparar...' : 'Spara foto'}
                          </button>
                        )}
                        {companionSaveStatus && <div className={'wiz-status' + (companionReferenceImageUrl ? ' wiz-success' : '')}>{companionSaveStatus}</div>}
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
              <div className="wiz-title">Vad ska hända?</div>
              <p className="wiz-sub">Beskriv äventyret du vill uppleva och välj hur lång boken ska vara.</p>

              <div className="wiz-card">
                <label className="wiz-label">Bokens längd</label>
                <div className="wiz-chips">
                  {[{count:4,label:'4 sidor',desc:'Snabbis'},{count:8,label:'8 sidor',desc:'Lagom'},{count:12,label:'12 sidor',desc:'Fyllig'},{count:16,label:'16 sidor',desc:'Episk'}].map((opt) => (
                    <button key={opt.count} onClick={() => setPageCount(opt.count)} className={'wiz-chip' + (pageCount === opt.count ? ' active-gold' : '')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Beskriv äventyret</label>
                <textarea className="wiz-textarea" rows={5} placeholder={"t.ex. " + (charName || "Huvudpersonen") + " reser till månen och hittar en mystisk robot som behöver hjälp att hitta hem..."} value={memory} onChange={(e) => setMemory(e.target.value)} />
                <p style={{fontSize:'0.8rem', color:'#9ca3af', marginTop:'0.5rem'}}>Tips: ju mer detaljer du ger, desto bättre blir boken.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="wiz-eyebrow">Steg 4 av 4</div>
              <div className="wiz-title">Allt ser bra ut!</div>
              <p className="wiz-sub">Kolla igenom detaljerna och tryck på Skapa bok när du är redo.</p>

              <div className="wiz-card">
                <div className="wiz-summary-row"><span className="wiz-summary-key">Karaktär</span><span className="wiz-summary-val">{charName || 'Ej angett'}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Typ</span><span className="wiz-summary-val">{charDesc}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Outfit</span><span className="wiz-summary-val">{customOutfit || charOutfit || 'Standard'}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Stil</span><span className="wiz-summary-val">{{digital_painting:'Digital Painting',ligne_claire:'Ligne Claire',american_comic:'Amerikansk serie',watercolor:'Akvarell',noir:'Noir',pop_art:'Pop Art'}[bookStyle]}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Följeslagare</span><span className="wiz-summary-val">{companionType === 'none' ? 'Ingen' : (companionName || companionType)}</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Sidor</span><span className="wiz-summary-val">{pageCount} sidor</span></div>
                <div className="wiz-summary-row"><span className="wiz-summary-key">Referensfoton</span><span className="wiz-summary-val">{referenceImageUrls.length > 0 ? 'Redo' : 'Saknas'}</span></div>
              </div>

              <div className="wiz-card">
                <label className="wiz-label">Äventyr</label>
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

          <div className="book-stage">
            <div
              className="book-wrapper"
              style={{
                width: bookView === 'reading' && !bookSize.mobile ? bookSize.width * 2 : bookSize.width,
                height: bookSize.height,
              }}
            >
              {!(bookView === 'cover') && (
                <button
                  className="book-nav-arrow book-nav-arrow-left"
                  onClick={handleBookPrev}
                  aria-label="Föregående sida"
                >
                  ‹
                </button>
              )}

              {bookView === 'cover' && (
                <div
                  className="book-shadow-wrapper book-shadow-wrapper-single"
                  style={{ width: bookSize.width, height: bookSize.width * COVER_ASPECT }}
                >
                  <BookCoverPage variant="front" title={comic.title} imageUrl={coverImageUrl} isGenerating={isGeneratingCover} editable onTitleChange={handleTitleChange} />
                </div>
              )}

              {bookView === 'reading' && (
                <div className="book-shadow-wrapper">
                  <div className="book-spine" />

                  <HTMLFlipBook
                    key={comic.title + '-' + bookSize.width + '-' + flipbookStartPage}
                    width={bookSize.width}
                    height={bookSize.height}
                    size="fixed"
                    minWidth={bookSize.width}
                    maxWidth={bookSize.width}
                    minHeight={bookSize.height}
                    maxHeight={bookSize.height}
                    maxShadowOpacity={0.6}
                    showCover={false}
                    mobileScrollSupport={true}
                    onFlip={handleFlip}
                    className="story-flipbook"
                    style={{}}
                    startPage={flipbookStartPage}
                    drawShadow={true}
                    flippingTime={700}
                    usePortrait={bookSize.mobile}
                    startZIndex={0}
                    autoSize={false}
                    clickEventForward={true}
                    useMouseEvents={true}
                    swipeDistance={30}
                    showPageCorners={true}
                    disableFlipByClick={false}
                    ref={bookRef}
                  >
                    {comic.panels.map((panel: any) => (
                      <BookPage
                        key={panel.panel_number}
                        panel={panel}
                        totalPages={comic.panels.length}
                        imageUrl={generatedImages[panel.panel_number]}
                        isGeneratingThisPanel={currentlyGeneratingPanel === panel.panel_number}
                        onNarrationChange={handleNarrationChange}
                      />
                    ))}
                  </HTMLFlipBook>
                </div>
              )}

              {bookView === 'back-cover' && (
                <div
                  className="book-shadow-wrapper book-shadow-wrapper-single"
                  style={{ width: bookSize.width, height: bookSize.width * COVER_ASPECT }}
                >
                  <BookCoverPage variant="back" title={comic.title} />
                </div>
              )}

              {!(bookView === 'back-cover') && (
                <button
                  className="book-nav-arrow book-nav-arrow-right"
                  onClick={handleBookNext}
                  aria-label="Nästa sida"
                >
                  ›
                </button>
              )}
            </div>

            {bookView === 'reading' && comic.panels[currentPage] && (
              bookSize.mobile ? (
                renderRegenField(currentPage, bookSize.width)
              ) : (
                <div className="book-external-regen-row" style={{ maxWidth: bookSize.width * 2 }}>
                  {renderRegenField(currentPage, bookSize.width)}
                  {renderRegenField(currentPage + 1, bookSize.width)}
                </div>
              )
            )}

            {bookView === 'cover' && coverImageUrl && (
              <div className="book-external-regen" style={{ maxWidth: bookSize.mobile ? bookSize.width : bookSize.width * 2 }}>
                <input
                  type="text"
                  placeholder="Ändra något i bilden..."
                  value={customPrompts[0] || ''}
                  onChange={(e) => handleRegenChange(0, e.target.value)}
                  disabled={!!panelsLoading[0]}
                />
                <button
                  onClick={handleRegenerateCover}
                  disabled={!!panelsLoading[0] || !(customPrompts[0] || '').trim()}
                >
                  {panelsLoading[0] ? '...' : 'Uppdatera'}
                </button>
              </div>
            )}
          </div>

          {/* Full book, one page per printed sheet, only rendered for PDF/print export */}
          <div className="print-only">
            <div className="print-page print-page-cover">
              <BookCoverPage
                variant="front"
                title={comic.title}
                imageUrl={coverImageUrl}
                onImageLoad={() => console.log('[PRINT DEBUG] print-only cover <img> onLoad fired, src=', coverImageUrl)}
                onImageError={() => console.error('[PRINT DEBUG] print-only cover <img> onError fired, src=', coverImageUrl)}
              />
            </div>
            {comic.panels.map((panel: any) => renderPrintPage(panel))}
            <div className="print-page print-page-cover">
              <BookCoverPage variant="back" title={comic.title} />
            </div>
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
            <button className="wiz-btn-next" onClick={() => setStep(s => s + 1)} disabled={step === 1 && referenceImageUrls.length === 0}>
              {step === 1 && referenceImageUrls.length === 0 ? 'Ladda upp foton först' : 'Nästa steg'}
            </button>
          )}
          {step === 4 && (
            <button className="wiz-btn-generate" onClick={handleCreateStory} disabled={isLoadingScript || referenceImageUrls.length === 0 || !memory.trim()}>
              {isLoadingScript ? 'Skapar...' : 'Skapa boken!'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
