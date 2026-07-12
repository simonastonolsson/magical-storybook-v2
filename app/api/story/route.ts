import { GoogleGenerativeAI } from "@google/generative-ai";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const {
      prompt,
      characterName,
      characterDescription,
      secondaryName,
      secondaryDescription,
      pageCount,
      charOutfit
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);

    const name = characterName || "Simon";
    const desc = characterDescription || "an adult man";
    const finalPageCount = pageCount || 12;

    const isChild = desc.toLowerCase().includes("boy") ||
                    desc.toLowerCase().includes("girl") ||
                    desc.toLowerCase().includes("child") ||
                    desc.toLowerCase().includes("baby");

    // Single source of truth for outfit: previously this was a hardcoded
    // isChild-based default, completely disconnected from whatever outfit
    // the user actually picked in the wizard (charOutfit/customOutfit in
    // app/skapa/page.tsx) - Gemini would invent its own clothing description
    // here, which then contradicted the OUTFIT LOCKING sentence built from
    // the real charOutfit in generate-image/route.ts. Now charOutfit (sent
    // from the client) is used directly when provided, so both the story
    // prompt and the image-generation outfit lock reference the same text.
    const defaultOutfit = isChild
      ? "cozy yellow raincoat and blue denim jeans"
      : "classic navy blue sweater and dark grey trousers";
    const signatureOutfit = "wearing his signature " + (charOutfit || defaultOutfit);

    const companionInstruction = secondaryName && secondaryDescription
      ? `There is also a companion in the story: ${secondaryDescription}.
         The companion's name is "${secondaryName}".
         You MUST include this companion in both the story narration and the image_prompt, referring to them by name ("${secondaryName}") in both. Their described appearance must also remain fixed throughout every panel, with no age, gender, or species drift.`
      : "There are no other main companions in this story.";

    const fullPrompt = `You are an expert comic book director. Create a dynamic comic book script based on the user's idea: "${prompt}".

      CHARACTERS TO PORTRAY:
      - Main Character: Name is "${name}". Appearance is "${desc}".
      - Main Character Signature Outfit (MUST BE USED IN EVERY PANEL): "${signatureOutfit}".
      - ${companionInstruction}

      DIRECTOR RULES FOR WRITING (CRITICAL FOR NARRATIVE FLOW AND RESEMBLANCE CONSISTENCY):
      1. Create exactly ${finalPageCount} panels, numbered strictly 1 to ${finalPageCount}. Do not skip any panel, do not collapse any panels, and output EXACTLY ${finalPageCount} panels total.
      2. Write "title" and panel "narration" in the SAME LANGUAGE as the user's prompt (Swedish in this case).
      3. Write "image_prompt" in ENGLISH.
      4. CAMERA ANGLES FOR PERFECT LIKENESS (STRICT CONSISTENCY RULE):
         - Avoid extreme angles: Do NOT use low-angles looking straight up, do NOT use high-angles looking straight down, and do NOT use strict profile views (side profiles).
         - Always write prompts specifying a "three-quarter face view" or "waist-up three-quarter shot" whenever depicting ${name}'s face. This is the optimal angle for facial resemblance.
         - Ensure characters look active, engaged, and are looking slightly away from the camera into their action, never directly into the lens.
      5. OUTFIT LOCKING (STRICT CONSISTENCY RULE):
         - You MUST include ${name} and his exact signature outfit "${signatureOutfit}" in the image_prompt of EVERY SINGLE PANEL. His clothes must NEVER change, not even for sleeping or active scenes. This is the visual red thread of the book.
      6. SINGLE CHARACTER INSTANCE RULE (CRITICAL - avoids the AI accidentally drawing duplicate copies of the same person):
         - ${name} must appear as exactly ONE single instance of themselves in each image_prompt - never describe or imply two or more copies, a mirror image, a reflection, or a "twin" of ${name} in the same panel, unless the scene explicitly calls for a mirror or reflection as part of the story.
         - The same applies to the companion, if present in the scene: exactly one instance of them as well.
      7. APPEARANCE LOCKING (STRICT CONSISTENCY RULE):
         - The character's appearance is fixed as exactly "${desc}" for the ENTIRE story, in every single panel, with zero exceptions.
         - Do not age the character up or down, do not change their gender, species, or any physical trait, and do not alter this description based on the scene, activity, time of day, or mood - a panel showing them asleep, playing, or in danger must still describe them as exactly "${desc}".
         - This rule applies identically no matter what "${desc}" actually is - whether it describes a child, an adult, or an animal. Never substitute your own assumption about age or appearance for what is explicitly given here.
      8. SECONDARY CHARACTER DISTINCTNESS (STRICT CONSISTENCY RULE - prevents visual
         confusion with the main character):
         - Whenever a secondary character (someone who is NOT the main character and
           NOT the named companion, if any) has close physical interaction or direct
           eye contact with the main character in a scene - e.g. handing them an
           object, sitting right next to them, looking straight at them, shaking
           their hand - and is not just visible in the background, you MUST give
           that secondary character a clear, concrete DIFFERENT appearance in that
           panel's image_prompt.
         - Specify at least one of: different hair color, different skin tone,
           different body type/age, or different gender than the main character.
         - Write it as ordinary descriptive text woven into the scene, e.g. "a
           curly-haired blonde classmate leaning over the desk" - NEVER as a
           generic placeholder like "a different looking person" or "someone who
           looks different".
         - This rule applies independently of any other consistency rule in this
           list - it exists purely to give the illustration a concrete visual
           anchor to tell the two characters apart.
      9. STYLE-NEUTRAL COMPANION DESCRIPTION (STRICT CONSISTENCY RULE - keeps the whole
         book's art style consistent regardless of who is in the scene):
         - You may freely describe the companion's species, color, size, and shape in
           the image_prompt (e.g. "a friendly green dinosaur with a long neck and
           small arms").
         - You must NEVER use words that describe an ART STYLE or rendering technique
           for the companion or anything else in the scene - e.g. "cartoon-style",
           "cartoon", "animated", "vintage hand-drawn", "3D", "Pixar-style", or
           similar. The entire book's art style is already fixed separately and
           applied uniformly to every panel, regardless of which characters appear in
           that scene - it must never be re-described, overridden, or contradicted in
           the image_prompt itself.
         - Example: write "a friendly green dinosaur with a long neck and small arms",
           NOT "a friendly green cartoon-style dinosaur".
      10. EXPRESSION MODERATION RULE (STRICT CONSISTENCY RULE - keeps facial
          rendering close to the reference photos, regardless of book style):
         - Avoid extreme, wide-open facial expressions in image_prompt
           descriptions - e.g. do NOT write "shocked", "wide-eyed", "mouth wide
           open", "surprised but delighted", "laughing joyfully", or similarly
           exaggerated emotional language.
         - Prefer milder, more subtle emotional wording instead - e.g.
           "smiling", "curious", "pleased", "content", "focused", "quietly
           excited" - even when the scene itself is dramatic or exciting. The
           character's actions and the narration can carry the drama; the
           facial expression described in image_prompt should stay
           understated.
         - This rule applies to every panel's image_prompt, regardless of
           which book style is ultimately chosen for the illustration - the
           story is generated before a style is selected downstream (this
           endpoint never receives bookStyle), so this instruction cannot be
           tailored per style here even if it turns out only some styles are
           actually affected.
      11. POSE MODERATION RULE (STRICT CONSISTENCY RULE - keeps body rendering
          close to the reference photos, regardless of book style):
         - Avoid extreme, wide, symmetrical body poses in image_prompt
           descriptions - e.g. do NOT write "arms raised in a triumphant/
           victorious pose", "jumping for joy", "arms thrown up in
           celebration", or similarly large, dramatic, symmetrically
           outstretched body language.
         - Prefer more restrained, natural body language instead - e.g.
           "smiling, one hand raised in a small wave", "standing confidently
           with a slight smile", "giving a thumbs up" - body language that is
           happy/positive but not extreme or symmetrical.
         - Just like EXPRESSION MODERATION RULE: the action or narration can
           still be dramatic (e.g. "he just won the match!"), but the pose
           described in image_prompt should stay understated.
         - This rule applies to every panel's image_prompt, regardless of
           which book style is ultimately chosen for the illustration - the
           story is generated before a style is selected downstream (this
           endpoint never receives bookStyle), so this instruction cannot be
           tailored per style here even if it turns out only some styles are
           actually affected.
      12. COVER SCENE (STRICT SEPARATION RULE - for the book cover illustration):
         - Write a "cover_scene": exactly ONE sentence, in ENGLISH, describing a specific,
           iconic moment or pose that is genuinely representative of the story you just
           wrote in the panels array above - not a generic, unrelated action pose.
         - Base it on the actual plot: pick the moment, activity, or mood that best
           captures what this particular story is about (e.g. a cooking story should show
           the character cooking or presenting a finished dish, a calm bedtime story should
           show a calm, cozy pose, an adventure story can show a dynamic action pose only if
           the story is actually about adventure).
         - Describe ONLY the pose, action, and immediate setting/environment (e.g.
           "standing proudly over a finished gourmet dish in a warmly lit kitchen, holding
           a wooden spoon triumphantly").
         - Do NOT mention or describe ${name}'s physical appearance, age, gender,
           species, body type, or outfit in "cover_scene" - that is handled separately
           elsewhere in the pipeline and must not be repeated, changed, or contradicted here.
           This restriction applies ONLY to ${name} (the main character).
         - EXCEPTION FOR THE COMPANION: if the companion also appears in the cover scene,
           you MUST describe its species/form/appearance just as clearly as you would in a
           regular panel (e.g. "a green dinosaur", not just its name). The companion does
           NOT have the same technical appearance-lock protection that ${name} has
           elsewhere in the pipeline - it depends entirely on you actually describing it
           correctly in every context, including the cover. Never reduce the companion to
           just its name here.
         - Do NOT include ${name}'s name anywhere in "cover_scene" - a fixed reference to
           the character is added automatically immediately before this text when building
           the final cover image prompt.

      CRITICAL IMAGE_PROMPT RULES (Write in English, describing only the scene and action - the illustration's visual style is applied separately later in the pipeline):
      1. Every image_prompt MUST start exactly with: "Comic book panel illustration, graphic novel art, "
      2. CAMERA FRAMING RULE (STRICT CONSISTENCY RULE - facial resemblance depends on this):
         - Prioritize CLOSER compositions that keep the character's face large in frame:
           "waist-up medium shot", "medium close-up", "three-quarter face view, waist-up".
           Use these for the MAJORITY of panels - at least half of the total ${finalPageCount}
           panels in this story.
         - Reserve wide/distant framing ("wide angle", "shot from a distance", "establishing
           shot") for occasional scene-setting panels only - e.g. the first panel introducing
           a new location, or a panel where the character is deliberately small/distant for
           storytelling reasons. Never use it for a panel where the character's face or
           expression is the emotional focus of that moment.
         - Never combine a wide/distant phrase ("wide angle", "shot from a distance",
           "establishing shot") and a close phrase ("waist-up", "medium close-up",
           "three-quarter face view") in the same image_prompt - choose ONE framing per
           panel, they contradict each other.
         - Ensure substantial empty headroom above the character's hair so they are never
           cropped out, regardless of framing choice.
      3. Refer to characters naturally by name inside the actions:
         - If only ${name} is in the scene: include "drawing of ${name}, ${desc}, ${signatureOutfit}, three-quarter face view, looking away from the camera, [DOING SOME SPECIFIC ACTION]".
         - If BOTH are in the scene: include them together, interacting or doing an activity (e.g., "drawing of ${name}, ${desc}, ${signatureOutfit}, and ${secondaryName || "their companion"}, both in three-quarter view, laughing and talking together while [DOING SOME SPECIFIC ACTION]").

      Return ONLY a JSON object with this exact structure:
      {
        "title": "A beautiful title in the prompts language",
        "cover_scene": "One sentence in English describing an iconic pose/setting from THIS story - no appearance, age, gender, or outfit details, and no name mention",
        "panels": [
          {
            "panel_number": 1,
            "narration": "Narration text in the prompts language...",
            "image_prompt": "Comic book panel illustration, graphic novel art, waist-up three-quarter view medium shot of the first subject ${name}, ${desc}, ${signatureOutfit}, with substantial empty headroom, looking away from the camera, engaged in..."
          }
        ]
      }`;

    let result;
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });
        result = await model.generateContent(fullPrompt);
        break;
      } catch (error: any) {
        attempt++;
        console.warn(`Attempt ${attempt} failed with error: ${error.message || error}`);
        if (attempt >= maxRetries) {
          throw error;
        }
        const waitTime = attempt * 1500;
        console.warn(`Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
      }
    }

    if (!result) {
      throw new Error("Failed to generate story after multiple retries");
    }

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    text = text.replace(/\/\/.*$/gm, "");
    text = text.replace(/,\s*([\]}])/g, "$1");

    const comicData = JSON.parse(text);

    return new Response(JSON.stringify({ comic: comicData }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Story error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate story" }), { status: 500 });
  }
}
