export interface Caption {
  text: string;
  start: number;
  end: number;
}

export interface Scene {
  imagePrompt: string;
  duration: number; // in seconds
  animation: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  description: string;
}

export interface VideoPlan {
  script: string;
  emotionalBrief: string;
  voiceoverNotes: string;
  scenes: Scene[];
  captions: Caption[];
}

export interface SocialMediaCaptions {
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
}
