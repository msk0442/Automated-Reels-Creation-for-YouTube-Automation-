import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VideoPlan, SocialMediaCaptions } from "../types";

// Ensure the API key is available.
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set. Please add it to your .env file.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a detailed video plan using Gemini.
 * @param userInput The user's topic or idea.
 * @param onProgress A callback function to report progress and retry attempts.
 * @returns A promise that resolves to a VideoPlan object.
 */
export async function generateVideoPlan(userInput: string, onProgress: (message: string) => void): Promise<VideoPlan> {
  const model = 'gemini-2.5-flash';
  const maxRetries = 3;
  const initialDelayMs = 2000;

  const videoPlanSchema = {
    type: Type.OBJECT,
    properties: {
      script: { 
        type: Type.STRING,
        description: "The full voiceover script for the video. It must be breathtaking."
      },
      emotionalBrief: {
        type: Type.STRING,
        description: "A brief on the intended emotional arc for the viewer."
      },
      voiceoverNotes: {
        type: Type.STRING,
        description: "Specific notes for the voiceover artist demanding a realistic, human, and emotionally resonant performance, not a robotic reading."
      },
      scenes: {
        type: Type.ARRAY,
        description: "An array of 5 to 8 scenes that make up the video.",
        items: {
          type: Type.OBJECT,
          properties: {
            imagePrompt: {
              type: Type.STRING,
              description: "A unique, artistic, and evocative prompt in English for an AI image generator to create a 4K, cinematic, photorealistic quality image. No generic or repeated concepts."
            },
            duration: {
              type: Type.NUMBER,
              description: "The duration of the scene in seconds. MUST NOT exceed 5 seconds."
            },
            animation: {
              type: Type.STRING,
              description: "The camera movement for the scene. Must be one of: 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'."
            },
            description: {
              type: Type.STRING,
              description: "A short description of the visual content for this scene."
            }
          },
          required: ['imagePrompt', 'duration', 'animation', 'description']
        }
      },
      captions: {
        type: Type.ARRAY,
        description: "An array of captions synchronized with the script.",
        items: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The caption text."
            },
            start: {
              type: Type.NUMBER,
              description: "The start time of the caption in seconds."
            },
            end: {
              type: Type.NUMBER,
              description: "The end time of the caption in seconds."
            }
          },
          required: ['text', 'start', 'end']
        }
      }
    },
    required: ['script', 'emotionalBrief', 'voiceoverNotes', 'scenes', 'captions']
  };

  const prompt = `
    You are a world-class, visionary video director and creative genius. Your content is known for being captivating, fast-paced, and emotionally resonant. The final product should feel as if the most experienced creator in the world has meticulously crafted it. The quality must be breathtaking and beautiful.

    Your task is to create a comprehensive, production-ready video plan for a 30-60 second vertical video based on the user's topic. The video must be in English. The output must be in JSON format and strictly adhere to the provided schema.

    User Input: "${userInput}"

    **Creative Mandates (Non-Negotiable):**
    1.  **Hook Them Fast:** The first 3 seconds are critical. The script must start with an irresistible hook.
    2.  **Rapid Pacing:** Each scene's duration **MUST NOT** exceed 5 seconds. This is essential for viewer retention.
    3.  **Visual Storytelling:** Generate between 5 and 8 scenes. The images must tell a cohesive visual story.
    4.  **Stunning 4K Imagery:** Image prompts must be unique, artistic, and highly engaging, designed for 4K, cinematic, photorealistic quality. Think metaphorically and avoid generic concepts. All prompts must be in English.
    5.  **Powerful Script:** The script must be concise, impactful, and written in clear, engaging English.
    6.  **Human Voice:** The voiceover notes should guide for a natural, charismatic, and human-sounding performance. Specify tone, pauses, and emotional inflection. Forbid a "robotic" or "announcer" voice. The target voice is English.
    7.  **Image Content Constraint:** The generated images must not contain any female figures. The visual focus should be on concepts, objects, landscapes, abstract representations, or male figures if people are necessary.

    Adhere strictly to the JSON schema.
  `;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: videoPlanSchema,
        },
      });

      const jsonText = response.text.trim();
      const videoPlan: VideoPlan = JSON.parse(jsonText);
      return videoPlan; // Success!
    } catch (e) {
      lastError = e as Error;
      const errString = e.toString().toLowerCase();
      
      if ((errString.includes('429') || errString.includes('resource_exhausted') || errString.includes('503') || errString.includes('unavailable')) && attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        onProgress(`Encountered an issue. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  
  console.error("Error generating video plan after multiple retries:", lastError);
  const errorMessage = lastError instanceof Error ? lastError.message : 'An unknown error occurred.';
  throw new Error(`Failed to generate video plan. The AI model may be temporarily unavailable. Details: ${errorMessage}`);
}

/**
 * Generates social media captions for a video plan.
 * @param videoPlan The video plan containing the script and scene descriptions.
 * @returns A promise that resolves to a SocialMediaCaptions object.
 */
export async function generateSocialMediaCaptions(videoPlan: VideoPlan): Promise<SocialMediaCaptions> {
  const model = 'gemini-2.5-pro'; // Use a more powerful model for creative writing

  const captionsSchema = {
    type: Type.OBJECT,
    properties: {
      instagram: {
        type: Type.STRING,
        description: "A caption for Instagram Reels. Should be engaging, use 3-5 relevant and trending hashtags, a strong call-to-action, and good formatting with line breaks."
      },
      tiktok: {
        type: Type.STRING,
        description: "A caption for TikTok. Must be short, punchy, and trend-aware. Include 3-5 trending hashtags. The tone should be very informal and engaging."
      },
      youtube: {
        type: Type.STRING,
        description: "A caption/title for YouTube Shorts. Should be SEO-friendly. Use relevant keywords and hashtags. Encourage viewers to subscribe or check out related content."
      },
      facebook: {
        type: Type.STRING,
        description: "A caption for Facebook Reels. Can be slightly longer and more descriptive. Should encourage sharing and discussion by posing a question to the audience. Include 3-5 relevant hashtags."
      }
    },
    required: ['instagram', 'tiktok', 'youtube', 'facebook']
  };

  const videoSummary = `The video is about "${videoPlan.scenes[0].description}". It's a short, engaging reel with the following script: "${videoPlan.script}"`;

  const prompt = `
    You are a world-class viral social media marketing expert with a deep understanding of all major platforms. Your task is to generate compelling, platform-specific captions for a short video designed to go viral.

    **Video Context:**
    ${videoSummary}

    **Your Task:**
    Based on the video context, write four distinct captions, one for each of the following platforms: Instagram, TikTok, YouTube Shorts, and Facebook. Each caption must be perfectly tailored to the platform's audience, algorithm, and best practices. You must do deep "research" based on your knowledge of what works on the internet right now.

    **Platform-Specific Instructions:**
    - **Instagram:** Focus on an aesthetic and engaging tone. Use emojis smartly. Prioritize a strong hook in the first line.
    - **TikTok:** Be witty, use Gen-Z slang if appropriate, and tap into current trends or sounds if you can infer them. Keep it very short.
    - **YouTube Shorts:** Create a title that is clickable and searchable (SEO is key). The description can be brief but should contain keywords.
    - **Facebook:** Aim for community engagement. Ask open-ended questions to spark conversation in the comments. The tone can be slightly more informative.

    Generate the output in a JSON format that strictly adheres to the provided schema. Do not add any extra text or explanation outside of the JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: captionsSchema,
      },
    });

    const jsonText = response.text.trim();
    const captions: SocialMediaCaptions = JSON.parse(jsonText);
    return captions;
  } catch (error) {
    console.error("Error generating social media captions:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Failed to generate social media captions. Details: ${errorMessage}`);
  }
}

/**
 * Generates a voiceover from a script using Gemini TTS.
 * @param script The text script to be converted to speech.
 * @returns A promise that resolves to a base64 encoded audio string.
 */
export async function generateVoiceover(script: string): Promise<string> {
  const model = 'gemini-2.5-flash-preview-tts';
  const prompt = `Say this with the tone of a world-class, experienced male narrator. The delivery should be captivating, smooth, and deeply resonant: "${script}"`;
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // A high-quality, clear male voice
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("API did not return audio data.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error generating voiceover:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    throw new Error(`Failed to generate voiceover. Details: ${errorMessage}`);
  }
}

/**
 * Generates images for a list of prompts with retry logic for rate limiting.
 * @param imagePrompts An array of strings, where each string is a prompt for image generation.
 * @param onProgress A callback function to report progress.
 * @returns A promise that resolves to an array of base64 encoded image strings.
 */
export async function generateImages(imagePrompts: string[], onProgress: (message: string) => void): Promise<string[]> {
  const model = 'imagen-4.0-generate-001'; // Switched to highest quality model
  const images: string[] = [];
  const maxRetries = 3;
  const initialDelayMs = 5000; // Imagen can be slower, increase initial delay

  for (let i = 0; i < imagePrompts.length; i++) {
    const userPrompt = imagePrompts[i];
    const finalPrompt = `A breathtaking, 4K resolution, cinematic, photorealistic vertical video frame (9:16 aspect ratio). Style: hyper-realistic, dramatic lighting. Prompt: ${userPrompt}`;
    onProgress(`Generating ultra-quality image ${i + 1} of ${imagePrompts.length}...`);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await ai.models.generateImages({
          model: model,
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '9:16',
          },
        });
        
        const base64ImageBytes = response.generatedImages[0]?.image?.imageBytes;

        if (base64ImageBytes) {
          images.push(base64ImageBytes);
          lastError = null;
          break;
        } else {
          throw new Error('API returned no image data.');
        }
      } catch (error) {
        lastError = error as Error;
        const errString = error.toString().toLowerCase();
        
        if ((errString.includes('429') || errString.includes('resource_exhausted') || errString.includes('503') || errString.includes('unavailable')) && attempt < maxRetries - 1) {
          const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
          onProgress(`Rate limit hit. Retrying image ${i + 1} in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    if (lastError) {
      console.error(`Failed to generate image for prompt "${userPrompt}" after ${maxRetries} attempts:`, lastError);
      throw new Error(`Failed to generate image ${i + 1}. The API may be temporarily unavailable or the prompt may have been blocked. Please check the console for details.`);
    }

    // A longer delay between image generations for this powerful model.
    if (i < imagePrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  return images;
}
