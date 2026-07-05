// app/api/generate-image/route.ts
export async function POST(request: Request) {
  const { 
    prompt, 
    trainedModelId, 
    triggerWord,        // ← lägg till
    charDesc,           // ← lägg till  
    charName,           // ← lägg till
    extraLoraId, 
    extraLoraScale 
  } = await request.json();

  const isChild = charDesc?.toLowerCase().includes("boy") || 
                  charDesc?.toLowerCase().includes("girl");

  const signatureOutfit = isChild
    ? "wearing a cozy yellow raincoat and blue denim jeans"
    : "wearing a classic navy blue sweater and dark grey trousers";

  // Bygg dynamisk anchor-beskrivning från karaktärsdata
  const characterAnchor = `${triggerWord}, ${charDesc}, ${signatureOutfit}`;
  
  const finalPrompt = `Cozy heartwarming 2D hand-drawn watercolor storybook illustration, 
soft pencil sketch details, warm pastel colors, gentle sunlit lighting.
Main subject: highly recognizable portrait of ${characterAnchor}, 
natural realistic facial features, actual hair color and eye color from training photos.
Scene: ${prompt}
Negative: blue eyes, anime face, chibi, 3D CGI, photorealism, duplicates, clones.`;
