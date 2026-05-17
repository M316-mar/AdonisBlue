"use client";

import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "adonisblue-onboarding";
const TOTAL_STEPS = 5;
const MAX_PHOTOS = 10;
/** Max size for logo, brand image, and work photos (5 MB). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FILE_TOO_LARGE_MSG = "This file is larger than 5 MB. Please choose a smaller image.";
const LOGO_BRAND_TYPE_MSG = "Please choose a PNG, JPG, JPEG, WEBP, or SVG image.";

const STEP_LABELS = ["Practice", "Services", "Personality", "Photos", "Launch"] as const;

const SERVICES: { id: string; label: string; description: string }[] = [
  { id: "lip-filler", label: "Lip Filler", description: "Shape, volume, and symmetry for natural-looking lips." },
  { id: "botox", label: "Botox", description: "Smooth fine lines and soften expression lines with neuromodulators." },
  { id: "cheek-fillers", label: "Cheek Fillers", description: "Restore mid-face volume and contour for a lifted look." },
  { id: "under-eye-filler", label: "Under-Eye Filler", description: "Improve hollowing and shadows for a fresher, rested appearance." },
  { id: "iv-therapy", label: "IV Therapy", description: "Hydration and vitamin support tailored to how your clients feel." },
  { id: "microneedling", label: "Microneedling", description: "Collagen stimulation for texture, pores, and overall skin quality." },
  { id: "chemical-peels", label: "Chemical Peels", description: "Controlled exfoliation for tone, clarity, and renewal." },
  { id: "skin-boosters", label: "Skin Boosters", description: "Deep hydration and glow for tired or dehydrated skin." },
  { id: "pdo-threads", label: "PDO Threads", description: "Supportive lifting and tightening where clients want definition." },
  { id: "kybella", label: "Kybella", description: "Targeted improvement for submental fullness when it fits your practice." },
  { id: "prp", label: "PRP", description: "Platelet-rich treatments for rejuvenation and natural regeneration." },
  { id: "consultations", label: "Consultations", description: "First visits, education, and personalized treatment planning." },
];

const OTHER_SERVICE_ID = "other";

const OTHER_SERVICE_META = {
  id: OTHER_SERVICE_ID,
  label: "Other",
  description: "Add your own services if they are not listed above.",
} as const;

const GREETING_GENERATOR_TONES: { id: string; title: string; tagline: string }[] = [
  { id: "warm", title: "Warm & Welcoming", tagline: "Feel like a warm hug the moment they say hello" },
  { id: "polished", title: "Professional & Polished", tagline: "Elegant, confident and reassuring" },
  { id: "fun", title: "Fun & Bubbly", tagline: "Bright, energetic and full of personality" },
  { id: "calm", title: "Calm & Reassuring", tagline: "Gentle, safe and trustworthy" },
];

const TONES = ["Warm & friendly", "Professional & polished", "Fun & bubbly", "Calm & reassuring"] as const;

type Tone = (typeof TONES)[number];

type BotNameFontId = "dm-sans" | "playfair" | "inter-bold" | "nunito" | "georgia";

const BOT_NAME_FONT_IDS: BotNameFontId[] = ["dm-sans", "playfair", "inter-bold", "nunito", "georgia"];

const BOT_FONT_CARDS: { id: BotNameFontId; label: string }[] = [
  { id: "dm-sans", label: "Modern & Clean (DM Sans)" },
  { id: "playfair", label: "Elegant & Serif (Playfair Display)" },
  { id: "inter-bold", label: "Bold & Strong (Inter Bold)" },
  { id: "nunito", label: "Soft & Friendly (Nunito)" },
  { id: "georgia", label: "Classic (Georgia)" },
];

const ATTENTION_CHIP_TEXTS = [
  "Need help? Click here! 💬",
  "Need any assistance? ✨",
  "Have a question? I am here! 👋",
  "Hi! How can I help you today? 💙",
] as const;

type Step1Data = {
  fullName: string;
  practiceName: string;
  city: string;
  state: string;
  yearsExperience: string;
  specialSentence: string;
  instagram: string;
};

type Step2Data = {
  serviceIds: string[];
  customServices: { name: string; description: string }[];
};

type Step3Data = {
  botName: string;
  logoImage: string | null;
  logoDataUrl: string | null;
  brandNameImage: string | null;
  botNameFont: BotNameFontId;
  bubbleAttentionMessage: string;
  greeting: string;
  tone: Tone;
  primaryColor: string;
  forwardQuestions: string;
  bookingLink: string;
  cancellationPolicy: string;
  aftercare: string;
};

type PhotoEntry = { name: string; dataUrl: string };

export type Step4Data = {
  photos: PhotoEntry[];
  permissionConfirmed: boolean;
};

type OnboardingPersisted = {
  currentStep: number;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  launched: boolean;
};

function defaultStep1(): Step1Data {
  return {
    fullName: "",
    practiceName: "",
    city: "",
    state: "",
    yearsExperience: "",
    specialSentence: "",
    instagram: "",
  };
}

function defaultStep2(): Step2Data {
  return { serviceIds: [], customServices: [] };
}

function defaultStep3(): Step3Data {
  return {
    botName: "",
    logoImage: null,
    logoDataUrl: null,
    brandNameImage: null,
    botNameFont: "dm-sans",
    bubbleAttentionMessage: "",
    greeting: "",
    tone: "Warm & friendly",
    primaryColor: "#0d9488",
    forwardQuestions: "",
    bookingLink: "",
    cancellationPolicy: "",
    aftercare: "",
  };
}

function defaultStep4(): Step4Data {
  return { photos: [], permissionConfirmed: false };
}

function defaultPersisted(): OnboardingPersisted {
  return {
    currentStep: 1,
    step1: defaultStep1(),
    step2: defaultStep2(),
    step3: defaultStep3(),
    step4: defaultStep4(),
    launched: false,
  };
}

function displayNameFromUser(user: { user_metadata?: { full_name?: string }; email?: string } | null): string {
  if (!user) return "";
  const fromMeta = user.user_metadata?.full_name;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const email = user.email;
  if (email) return email.split("@")[0] ?? "";
  return "";
}

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "my-practice";
}

function isLogoOrBrandImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (
    type === "image/png" ||
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/webp" ||
    type === "image/svg+xml"
  ) {
    return true;
  }
  return /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

function isWorkPhotoFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/jpg" || type === "image/webp") return true;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function readImageAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function getBotNameFontStyle(id: BotNameFontId): CSSProperties {
  switch (id) {
    case "dm-sans":
      return { fontFamily: "var(--font-bot-dm-sans), system-ui, sans-serif" };
    case "playfair":
      return { fontFamily: "var(--font-bot-playfair), Georgia, serif" };
    case "inter-bold":
      return { fontFamily: "var(--font-bot-inter), system-ui, sans-serif", fontWeight: 700 };
    case "nunito":
      return { fontFamily: "var(--font-bot-nunito), system-ui, sans-serif" };
    case "georgia":
    default:
      return { fontFamily: "Georgia, Palatino, serif" };
  }
}

function loadPersisted(): OnboardingPersisted {
  if (typeof window === "undefined") return defaultPersisted();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<OnboardingPersisted>;
    const base = defaultPersisted();
    const toneRaw = parsed.step3?.tone;
    const tone: Tone = TONES.includes(toneRaw as Tone) ? (toneRaw as Tone) : base.step3.tone;
    const fontRaw = parsed.step3?.botNameFont;
    const botNameFont: BotNameFontId = BOT_NAME_FONT_IDS.includes(fontRaw as BotNameFontId) ? (fontRaw as BotNameFontId) : base.step3.botNameFont;
    const logoImageRaw = parsed.step3?.logoImage;
    const logoRaw = parsed.step3?.logoDataUrl;
    const logoDataUrl =
      typeof logoRaw === "string" || logoRaw === null ? (logoRaw as string | null) : base.step3.logoDataUrl;
    const logoImage =
      typeof logoImageRaw === "string" || logoImageRaw === null
        ? (logoImageRaw as string | null)
        : logoDataUrl;
    const brandImgRaw = parsed.step3?.brandNameImage;
    const brandNameImage =
      typeof brandImgRaw === "string" || brandImgRaw === null
        ? (brandImgRaw as string | null)
        : base.step3.brandNameImage;
    const bubbleRaw = parsed.step3?.bubbleAttentionMessage;
    const bubbleAttentionMessage = typeof bubbleRaw === "string" ? bubbleRaw : base.step3.bubbleAttentionMessage;
    return {
      currentStep: typeof parsed.currentStep === "number" && parsed.currentStep >= 1 && parsed.currentStep <= TOTAL_STEPS ? parsed.currentStep : base.currentStep,
      step1: { ...base.step1, ...parsed.step1 },
      step2: {
        serviceIds: Array.isArray(parsed.step2?.serviceIds) ? parsed.step2!.serviceIds : base.step2.serviceIds,
        customServices: (() => {
          const raw = parsed.step2?.customServices;
          if (!Array.isArray(raw)) return base.step2.customServices;
          const cleaned = raw
            .filter((x) => x !== null && typeof x === "object")
            .map((x) => {
              const o = x as Record<string, unknown>;
              return {
                name: typeof o.name === "string" ? o.name : "",
                description: typeof o.description === "string" ? o.description : "",
              };
            })
            .slice(0, 3);
          return cleaned;
        })(),
      },
      step3: {
        ...base.step3,
        ...parsed.step3,
        tone,
        botNameFont,
        logoImage,
        logoDataUrl,
        brandNameImage,
        bubbleAttentionMessage,
      },
      step4: {
        photos: Array.isArray(parsed.step4?.photos) ? parsed.step4!.photos : base.step4.photos,
        permissionConfirmed: Boolean(parsed.step4?.permissionConfirmed),
      },
      launched: Boolean(parsed.launched),
    };
  } catch {
    return defaultPersisted();
  }
}

function savePersisted(data: OnboardingPersisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota or private mode — still allow UX in memory
  }
}

function friendlyBotSaveError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("jwt") || m.includes("session")) {
    return "Your session may have expired. Please sign in again and try launching once more.";
  }
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("policy")) {
    return "We couldn't save your bot due to a permissions issue. Please try again or contact support if this keeps happening.";
  }
  if (m.includes("does not exist") || m.includes("relation")) {
    return "We couldn't reach the bot database. Please try again in a moment.";
  }
  if (m.includes("value too long") || m.includes("payload")) {
    return "Some of your data (often photos) is too large to save. Try removing a few photos or using smaller images.";
  }
  return "Something went wrong while saving your bot. Please check your connection and try again.";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState<OnboardingPersisted>(defaultPersisted);
  const [dragActive, setDragActive] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const brandNameImageFileInputRef = useRef<HTMLInputElement>(null);
  const photosFileInputRef = useRef<HTMLInputElement>(null);
  const [chatInput, setChatInput] = useState("");
  const [launchSaving, setLaunchSaving] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState<string | null>(null);
  const [greetingPanelOpen, setGreetingPanelOpen] = useState(false);
  const [greetingPanelToneId, setGreetingPanelToneId] = useState("warm");
  const [greetingGenerating, setGreetingGenerating] = useState(false);
  const [greetingGenError, setGreetingGenError] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [brandUploadError, setBrandUploadError] = useState<string | null>(null);
  const [workPhotosUploadError, setWorkPhotosUploadError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      const fromAccount = displayNameFromUser(data.session.user);
      const loaded = loadPersisted();
      if (fromAccount && !loaded.step1.fullName.trim()) {
        loaded.step1.fullName = fromAccount;
        savePersisted(loaded);
      }
      setPersisted(loaded);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const updatePersisted = useCallback((patch: Partial<OnboardingPersisted>) => {
    setPersisted((prev) => {
      const next = { ...prev, ...patch };
      savePersisted(next);
      return next;
    });
  }, []);

  const setStep1 = useCallback(
    (patch: Partial<Step1Data>) => {
      setPersisted((prev) => {
        const next = { ...prev, step1: { ...prev.step1, ...patch } };
        savePersisted(next);
        return next;
      });
    },
    []
  );

  const setStep2 = useCallback((patch: Partial<Step2Data>) => {
    setPersisted((prev) => {
      const next = { ...prev, step2: { ...prev.step2, ...patch } };
      savePersisted(next);
      return next;
    });
  }, []);

  const setStep3 = useCallback((patch: Partial<Step3Data>) => {
    setPersisted((prev) => {
      const next = { ...prev, step3: { ...prev.step3, ...patch } };
      savePersisted(next);
      return next;
    });
  }, []);

  const setStep4 = useCallback((patch: Partial<Step4Data>) => {
    setPersisted((prev) => {
      const next = { ...prev, step4: { ...prev.step4, ...patch } };
      savePersisted(next);
      return next;
    });
  }, []);

  const progressPct = useMemo(() => (persisted.currentStep / TOTAL_STEPS) * 100, [persisted.currentStep]);

  const slug = useMemo(() => {
    const raw = persisted.step3.botName.trim() || persisted.step1.practiceName.trim() || "my-bot";
    return slugify(raw);
  }, [persisted.step1.practiceName, persisted.step3.botName]);

  const shareOrigin = typeof window !== "undefined" ? window.location.origin : "https://adonisblue.com";

  const previewBubbleAttention = useMemo(
    () => persisted.step3.bubbleAttentionMessage.trim() || ATTENTION_CHIP_TEXTS[0],
    [persisted.step3.bubbleAttentionMessage]
  );

  const addPhotoFiles = useCallback(
    (files: FileList | File[]) => {
      const countAtOpen = persisted.step4.photos.length;
      void (async () => {
        setWorkPhotosUploadError(null);
        const problems: string[] = [];
        const newEntries: PhotoEntry[] = [];

        for (const file of Array.from(files)) {
          if (!isWorkPhotoFile(file)) {
            problems.push(`“${file.name}” is not a supported type — use PNG, JPG, JPEG, or WEBP.`);
            continue;
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            problems.push(`“${file.name}” is larger than 5 MB.`);
            continue;
          }
          const dataUrl = await readImageAsDataUrl(file);
          if (!dataUrl) {
            problems.push(`“${file.name}” could not be read. Try another file.`);
            continue;
          }
          newEntries.push({ name: file.name, dataUrl });
        }

        const space = MAX_PHOTOS - countAtOpen;
        const slice = newEntries.slice(0, Math.max(0, space));
        if (countAtOpen >= MAX_PHOTOS && newEntries.length > 0) {
          problems.push("You already have 10 work photos. Remove one to add more.");
        } else if (newEntries.length > slice.length && newEntries.length > 0) {
          problems.push("Only some photos were added — you can upload up to 10 work photos.");
        }

        if (slice.length > 0) {
          setPersisted((p) => {
            const take = newEntries.slice(0, MAX_PHOTOS - p.step4.photos.length);
            if (take.length === 0) return p;
            const next = { ...p, step4: { ...p.step4, photos: [...p.step4.photos, ...take] } };
            savePersisted(next);
            return next;
          });
        }

        if (problems.length) setWorkPhotosUploadError(problems.slice(0, 4).join(" "));
      })();
    },
    [persisted.step4.photos.length]
  );

  const removePhoto = useCallback((index: number) => {
    setPersisted((prev) => {
      const photos = prev.step4.photos.filter((_, i) => i !== index);
      const next = { ...prev, step4: { ...prev.step4, photos } };
      savePersisted(next);
      return next;
    });
  }, []);

  function getStepValidationErrors(step: number): string[] {
    const { step1, step2, step3, step4 } = persisted;
    const errors: string[] = [];
    if (step === 1) {
      if (!step1.fullName.trim()) errors.push("Please add your full name");
      if (!step1.practiceName.trim()) errors.push("Please add your practice name");
      if (!step1.city.trim()) errors.push("Please add your city");
      if (!step1.state.trim()) errors.push("Please add your state");
      if (!step1.yearsExperience.trim()) errors.push("Please tell us how many years of experience you have");
      if (!step1.specialSentence.trim()) errors.push("Please tell us what you never compromise on with your clients");
      return errors;
    }
    if (step === 2) {
      const nonOther = step2.serviceIds.filter((id) => id !== OTHER_SERVICE_ID);
      const hasOther = step2.serviceIds.includes(OTHER_SERVICE_ID);
      const hasCustomName = step2.customServices.some((c) => c.name.trim().length > 0);
      if (nonOther.length === 0 && (!hasOther || !hasCustomName)) errors.push("Please select at least one service you offer");
      return errors;
    }
    if (step === 3) {
      if (!step3.botName.trim()) errors.push("Please give your bot a name");
      if (!step3.greeting.trim()) errors.push("Please add a greeting message for your clients");
      return errors;
    }
    if (step === 4) {
      if (step4.photos.length === 0) errors.push("Please upload at least one photo");
      if (!step4.permissionConfirmed) errors.push("Please confirm you have permission to use these photos");
      return errors;
    }
    return errors;
  }

  function validateStep(step: number): boolean {
    return getStepValidationErrors(step).length === 0;
  }

  function goNext() {
    if (!validateStep(persisted.currentStep)) {
      setShowValidationErrors(true);
      return;
    }
    setShowValidationErrors(false);
    if (persisted.currentStep < TOTAL_STEPS) {
      updatePersisted({ currentStep: persisted.currentStep + 1 });
    }
  }

  function goBack() {
    if (persisted.currentStep > 1) {
      updatePersisted({ currentStep: persisted.currentStep - 1 });
    }
  }

  function updateCustomService(index: number, patch: Partial<{ name: string; description: string }>) {
    setPersisted((prev) => {
      const nextCs = [...prev.step2.customServices];
      if (!nextCs[index]) return prev;
      nextCs[index] = { ...nextCs[index], ...patch };
      const next = { ...prev, step2: { ...prev.step2, customServices: nextCs } };
      savePersisted(next);
      return next;
    });
  }

  function addCustomServiceRow() {
    setPersisted((prev) => {
      if (prev.step2.customServices.length >= 3) return prev;
      const next = {
        ...prev,
        step2: {
          ...prev.step2,
          customServices: [...prev.step2.customServices, { name: "", description: "" }],
        },
      };
      savePersisted(next);
      return next;
    });
  }

  function removeCustomServiceRow(index: number) {
    setPersisted((prev) => {
      const cs = prev.step2.customServices.filter((_, i) => i !== index);
      const nextCs = cs.length > 0 ? cs : [{ name: "", description: "" }];
      const next = { ...prev, step2: { ...prev.step2, customServices: nextCs } };
      savePersisted(next);
      return next;
    });
  }

  function toggleService(id: string) {
    setPersisted((prev) => {
      const set = new Set(prev.step2.serviceIds);
      let customServices = prev.step2.customServices;
      if (set.has(id)) {
        set.delete(id);
        if (id === OTHER_SERVICE_ID) {
          customServices = [];
        }
      } else {
        set.add(id);
        if (id === OTHER_SERVICE_ID && customServices.length === 0) {
          customServices = [{ name: "", description: "" }];
        }
      }
      const next = { ...prev, step2: { ...prev.step2, serviceIds: [...set], customServices } };
      savePersisted(next);
      return next;
    });
  }

  const handleLaunch = useCallback(async () => {
    setLaunchError(null);
    setLaunchSuccess(null);
    setLaunchSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setLaunchError(userError?.message || "Please log in to save your bot");
        router.replace("/auth");
        return;
      }
      const p = persisted;
      const row = {
        nurse_id: userData.user.id,
        practice_name: p.step1.practiceName.trim(),
        city: p.step1.city.trim(),
        state: p.step1.state.trim(),
        years_experience: p.step1.yearsExperience.trim(),
        never_compromise: p.step1.specialSentence.trim(),
        instagram: p.step1.instagram.trim() || null,
        services: [
          ...p.step2.serviceIds.filter((id) => id !== OTHER_SERVICE_ID),
          ...p.step2.customServices.filter((c) => c.name.trim()).map((c) => c.name.trim()),
        ],
        bot_name: p.step3.botName.trim(),
        bot_name_font: p.step3.botNameFont,
        bubble_attention_message: p.step3.bubbleAttentionMessage,
        greeting: p.step3.greeting.trim(),
        tone: p.step3.tone,
        primary_color: p.step3.primaryColor,
        forward_questions: p.step3.forwardQuestions.trim() || null,
        booking_link: p.step3.bookingLink.trim() || null,
        cancellation_policy: p.step3.cancellationPolicy.trim() || null,
        aftercare: p.step3.aftercare.trim() || null,
        launched: true,
      };
      const blockedText = ["valentinamartinez", "git add", "git commit", "git push"];
      const sanitizedFields: string[] = [];
      for (const [field, value] of Object.entries(row)) {
        if (typeof value === "string" && blockedText.some((text) => value.includes(text))) {
          row[field as keyof typeof row] = "" as never;
          sanitizedFields.push(field);
        }
      }
      console.log("Sanitized bot fields:", sanitizedFields);

      const res = await fetch("/api/savebot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row),
      });
      const raw = await res.text();
      let result: { success?: boolean; error?: string; data?: unknown } = {};
      try {
        result = raw ? (JSON.parse(raw) as { success?: boolean; error?: string; data?: unknown }) : {};
      } catch {
        result = { error: raw };
      }
      if (!res.ok || !result.success) {
        setLaunchError(result.error || "We could not save your bot. Please try again.");
        return;
      }

      updatePersisted({ launched: true });
      setLaunchSuccess("Your bot is saved — you're all set to share it with your clients.");
    } catch (error) {
      console.log("Unexpected bot save error:", error);
      setLaunchError(error instanceof Error ? error.message : "We could not save your bot. Please try again.");
      router.replace("/auth");
    } finally {
      setLaunchSaving(false);
    }
  }, [persisted, router, updatePersisted]);

  const handleGenerateGreeting = useCallback(async () => {
    setGreetingGenError(null);
    setGreetingGenerating(true);
    try {
      const toneCard = GREETING_GENERATOR_TONES.find((t) => t.id === greetingPanelToneId) ?? GREETING_GENERATOR_TONES[0];
      const serviceLabels = [
        ...persisted.step2.serviceIds
          .filter((id) => id !== OTHER_SERVICE_ID)
          .map((id) => SERVICES.find((s) => s.id === id)?.label)
          .filter((label): label is string => Boolean(label)),
        ...persisted.step2.customServices.filter((c) => c.name.trim()).map((c) => c.name.trim()),
      ];
      const tone = `${toneCard.title} — ${toneCard.tagline}. Bot personality (tone step): ${persisted.step3.tone}.`;
      const res = await fetch("/api/generate-greeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceName: persisted.step1.practiceName.trim(),
          services: serviceLabels,
          tone,
        }),
      });
      const data = (await res.json()) as { greeting?: string; error?: string };
      if (!res.ok) {
        setGreetingGenError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        return;
      }
      if (typeof data.greeting === "string" && data.greeting.trim()) {
        setStep3({ greeting: data.greeting.trim() });
      } else {
        setGreetingGenError("Something went wrong. Please try again.");
      }
    } catch {
      setGreetingGenError("Something went wrong. Please try again.");
    } finally {
      setGreetingGenerating(false);
    }
  }, [greetingPanelToneId, persisted.step1.practiceName, persisted.step2.customServices, persisted.step2.serviceIds, persisted.step3.tone, setStep3]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) addPhotoFiles(e.dataTransfer.files);
    },
    [addPhotoFiles]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm font-medium text-[#1a2744]/80">Loading onboarding…</p>
      </div>
    );
  }

  const s1 = persisted.step1;
  const s2 = persisted.step2;
  const s3 = persisted.step3;
  const s4 = persisted.step4;
  const previewLogoImage = s3.logoImage || s3.logoDataUrl;
  const currentValidationErrors = showValidationErrors ? getStepValidationErrors(persisted.currentStep) : [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <header className="border-b border-sky-100 bg-white shadow-sm shadow-sky-100/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:max-w-4xl lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image src="/Alona.png" alt="AdonisBlue" width={48} height={48} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
            <span className="truncate text-base font-semibold tracking-tight text-[#1a2744] sm:text-lg">AdonisBlue</span>
          </Link>
          <Link href="/dashboard" className="text-sm font-semibold text-[#0d9488] hover:text-teal-700">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-4xl lg:px-8 lg:py-10">
        <div className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0d9488]">Set up your chatbot</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1a2744] sm:text-3xl">Onboarding</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Step {persisted.currentStep} of {TOTAL_STEPS}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = persisted.currentStep === n;
              const done = persisted.currentStep > n;
              return (
                <span
                  key={label}
                  className={`rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${
                    active ? "bg-[#0d9488] text-white" : done ? "bg-teal-100 text-[#0d9488]" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {n}. {label}
                </span>
              );
            })}
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#0d9488] transition-[width] duration-300 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-md shadow-slate-900/5 sm:p-6 lg:p-8">
          {persisted.currentStep === 1 ? (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">About your practice</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">Full name</span>
                  <input
                    value={s1.fullName}
                    onChange={(e) => setStep1({ fullName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">Practice name</span>
                  <input
                    value={s1.practiceName}
                    onChange={(e) => setStep1({ practiceName: e.target.value })}
                    placeholder="e.g. Glow by Jessica"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">City</span>
                  <input
                    value={s1.city}
                    onChange={(e) => setStep1({ city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">State</span>
                  <input
                    value={s1.state}
                    onChange={(e) => setStep1({ state: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">Years of experience</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={s1.yearsExperience}
                    onChange={(e) => setStep1({ yearsExperience: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">What is the one thing you never compromise on with your clients?</span>
                  <textarea
                    value={s1.specialSentence}
                    onChange={(e) => setStep1({ specialSentence: e.target.value })}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-[#1a2744]">Your Instagram handle (optional)</span>
                  <input
                    value={s1.instagram}
                    onChange={(e) => setStep1({ instagram: e.target.value })}
                    placeholder="@yourhandle"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {persisted.currentStep === 2 ? (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">Your services</h2>
              <p className="text-sm text-slate-600">Select all that apply.</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {SERVICES.map((svc) => {
                  const checked = s2.serviceIds.includes(svc.id);
                  return (
                    <li key={svc.id}>
                      <label
                        className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition sm:min-h-[7.5rem] ${
                          checked ? "border-[#0d9488] bg-teal-50/60 ring-1 ring-[#0d9488]/30" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(svc.id)}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                          />
                          <span className="font-semibold text-[#1a2744]">{svc.label}</span>
                        </span>
                        <span className="pl-7 text-xs leading-relaxed text-slate-600 sm:text-sm">{svc.description}</span>
                      </label>
                    </li>
                  );
                })}
                <li key={OTHER_SERVICE_ID}>
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition sm:min-h-[7.5rem] ${
                      s2.serviceIds.includes(OTHER_SERVICE_ID)
                        ? "border-[#0d9488] bg-teal-50/60 ring-1 ring-[#0d9488]/30"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={s2.serviceIds.includes(OTHER_SERVICE_ID)}
                        onChange={() => toggleService(OTHER_SERVICE_ID)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                      />
                      <span className="font-semibold text-[#1a2744]">{OTHER_SERVICE_META.label}</span>
                    </span>
                    <span className="pl-7 text-xs leading-relaxed text-slate-600 sm:text-sm">{OTHER_SERVICE_META.description}</span>
                  </label>
                </li>
              </ul>
              {s2.serviceIds.includes(OTHER_SERVICE_ID) ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                  <p className="text-sm font-medium text-[#1a2744]">Custom services (up to 3)</p>
                  {s2.customServices.map((row, index) => (
                    <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service {index + 1}</span>
                        {s2.customServices.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeCustomServiceRow(index)}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-[#1a2744]">Service name</span>
                        <input
                          value={row.name}
                          onChange={(e) => updateCustomService(index, { name: e.target.value })}
                          placeholder="e.g. Body contouring"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#0d9488]/30 focus:border-[#0d9488] focus:ring-2"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-[#1a2744]">Description</span>
                        <textarea
                          value={row.description}
                          onChange={(e) => updateCustomService(index, { description: e.target.value })}
                          rows={2}
                          placeholder="Brief description for your clients"
                          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#0d9488]/30 focus:border-[#0d9488] focus:ring-2"
                        />
                      </label>
                    </div>
                  ))}
                  {s2.customServices.length < 3 ? (
                    <button
                      type="button"
                      onClick={addCustomServiceRow}
                      className="text-sm font-semibold text-[#0d9488] hover:text-teal-700"
                    >
                      + Add another custom service
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {persisted.currentStep === 3 ? (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">Your bot personality</h2>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1a2744]">Bot name</span>
                <input
                  value={s3.botName}
                  onChange={(e) => setStep3({ botName: e.target.value })}
                  placeholder="e.g. Glow Assistant"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </label>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-[#1a2744]">Your logo (optional)</span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUploadError(null);
                      logoFileInputRef.current?.click();
                    }}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1a2744] transition hover:bg-slate-50"
                  >
                    Upload logo
                  </button>
                  <input
                    id="onboarding-logo-upload"
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Upload logo image"
                    onChange={(e) => {
                      void (async () => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        setLogoUploadError(null);
                        if (!file) return;
                        if (file.size > MAX_UPLOAD_BYTES) {
                          setLogoUploadError(FILE_TOO_LARGE_MSG);
                          return;
                        }
                        if (!isLogoOrBrandImageFile(file)) {
                          setLogoUploadError(LOGO_BRAND_TYPE_MSG);
                          return;
                        }
                        const dataUrl = await readImageAsDataUrl(file);
                        if (!dataUrl) {
                          setLogoUploadError("We could not read that file. Try another image.");
                          return;
                        }
                        setStep3({ logoImage: dataUrl, logoDataUrl: dataUrl });
                      })();
                    }}
                  />
                </div>
                {logoUploadError ? <p className="text-xs font-medium text-red-600">{logoUploadError}</p> : null}
                {previewLogoImage ? (
                  <div className="flex flex-wrap items-end gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewLogoImage} alt="" className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUploadError(null);
                        setStep3({ logoImage: null, logoDataUrl: null });
                      }}
                      className="text-xs font-medium text-red-600 underline decoration-red-600/30 underline-offset-2 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <p className="text-xs text-slate-500">Accepted: PNG, JPG, JPEG, WEBP, SVG. Maximum file size 5 MB.</p>
                <p className="text-xs leading-relaxed text-slate-600">
                  Upload your own logo — from Canva, your phone, or anywhere. If you skip this we will use the AdonisBlue butterfly.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-[#1a2744]">Have a custom logo or brand name image? Upload it here</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBrandUploadError(null);
                      brandNameImageFileInputRef.current?.click();
                    }}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a2744] transition hover:bg-slate-50"
                  >
                    Upload
                  </button>
                  <input
                    id="onboarding-brand-name-image-upload"
                    ref={brandNameImageFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Upload brand name image"
                    onChange={(e) => {
                      void (async () => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        setBrandUploadError(null);
                        if (!file) return;
                        if (file.size > MAX_UPLOAD_BYTES) {
                          setBrandUploadError(FILE_TOO_LARGE_MSG);
                          return;
                        }
                        if (!isLogoOrBrandImageFile(file)) {
                          setBrandUploadError(LOGO_BRAND_TYPE_MSG);
                          return;
                        }
                        const dataUrl = await readImageAsDataUrl(file);
                        if (!dataUrl) {
                          setBrandUploadError("We could not read that file. Try another image.");
                          return;
                        }
                        setStep3({ brandNameImage: dataUrl });
                      })();
                    }}
                  />
                </div>
                {brandUploadError ? <p className="text-xs font-medium text-red-600">{brandUploadError}</p> : null}
                {s3.brandNameImage ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-end gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s3.brandNameImage}
                        alt=""
                        className="max-h-16 max-w-full rounded-lg border border-slate-200 bg-white object-contain p-1 sm:max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBrandUploadError(null);
                          setStep3({ brandNameImage: null });
                        }}
                        className="text-xs font-medium text-red-600 underline decoration-red-600/30 underline-offset-2 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Your uploaded brand name will appear in your chat widget instead of the text name
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-slate-500">Accepted: PNG, JPG, JPEG, WEBP, SVG. Maximum file size 5 MB.</p>
              </div>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px min-w-0 flex-1 bg-slate-200" aria-hidden />
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">OR choose a font below</span>
                <div className="h-px min-w-0 flex-1 bg-slate-200" aria-hidden />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[#1a2744]">Choose a font for your bot name</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {BOT_FONT_CARDS.map((f) => {
                    const selected = s3.botNameFont === f.id;
                    const fontPreviewName = s3.botName.trim() || "Your Bot Name";
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStep3({ botNameFont: f.id })}
                        className={`rounded-xl border p-3 text-left transition sm:p-4 ${
                          selected ? "border-[#0d9488] bg-teal-50/80 ring-1 ring-[#0d9488]/30" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-xs font-medium text-slate-600">{f.label}</span>
                        <span className="mt-2 block truncate text-lg text-[#1a2744]" style={getBotNameFontStyle(f.id)}>
                          {fontPreviewName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <span className="mb-2 block text-sm font-medium text-[#1a2744]">What should the chat bubble say to grab attention?</span>
                <div className="mb-3 flex flex-wrap gap-2">
                  {ATTENTION_CHIP_TEXTS.map((chip) => {
                    const selected = s3.bubbleAttentionMessage === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setStep3({ bubbleAttentionMessage: chip })}
                        className={`rounded-full border px-3 py-1.5 text-left text-xs font-medium transition sm:text-sm ${
                          selected ? "border-[#0d9488] bg-teal-50 text-[#0d9488]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Or type your own message</span>
                  <input
                    type="text"
                    value={s3.bubbleAttentionMessage}
                    onChange={(e) => setStep3({ bubbleAttentionMessage: e.target.value })}
                    placeholder="Your custom attention message"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                  />
                </label>
              </div>
              <div className="block">
                <label htmlFor="bot-greeting" className="mb-1 block text-sm font-medium text-[#1a2744]">
                  Bot greeting message
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setGreetingPanelOpen(true);
                    setGreetingGenError(null);
                  }}
                  className="mb-2 text-left text-sm font-semibold text-[#0d9488] transition hover:text-teal-700"
                >
                  ✨ Click here to generate your greeting
                </button>
                {greetingPanelOpen ? (
                  <div className="mb-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold leading-snug text-[#1a2744] sm:text-lg">Let us create your perfect greeting</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setGreetingPanelOpen(false);
                          setGreetingGenError(null);
                        }}
                        className="shrink-0 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {GREETING_GENERATOR_TONES.map((tone) => {
                        const selected = greetingPanelToneId === tone.id;
                        return (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => setGreetingPanelToneId(tone.id)}
                            className={`rounded-xl border p-3 text-left text-sm transition sm:p-4 ${
                              selected ? "border-[#0d9488] bg-teal-50/80 ring-1 ring-[#0d9488]/30" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <span className="font-semibold text-[#1a2744]">{tone.title}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-600">— {tone.tagline}</span>
                          </button>
                        );
                      })}
                    </div>
                    {greetingGenerating ? (
                      <p className="text-sm font-medium text-[#0d9488]">Creating your perfect greeting...</p>
                    ) : null}
                    {greetingGenError ? <p className="text-sm text-red-600">{greetingGenError}</p> : null}
                    <button
                      type="button"
                      disabled={greetingGenerating}
                      onClick={() => void handleGenerateGreeting()}
                      className="w-full rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      Generate my greeting
                    </button>
                    <p className="text-xs text-slate-500">You can edit this anytime</p>
                  </div>
                ) : null}
                <textarea
                  id="bot-greeting"
                  value={s3.greeting}
                  onChange={(e) => setStep3({ greeting: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[#1a2744]">Tone</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TONES.map((tone) => (
                    <label
                      key={tone}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                        s3.tone === tone ? "border-[#0d9488] bg-teal-50 text-[#1a2744]" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tone"
                        value={tone}
                        checked={s3.tone === tone}
                        onChange={() => setStep3({ tone })}
                        className="h-4 w-4 border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                      />
                      {tone}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-[#1a2744] sm:min-w-[10rem]">Primary chat bubble color</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="color"
                    value={s3.primaryColor}
                    onChange={(e) => setStep3({ primaryColor: e.target.value })}
                    className="h-11 w-16 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white p-0"
                  />
                  <span className="text-xs font-mono text-slate-500">{s3.primaryColor}</span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1a2744]">What questions should always be forwarded directly to you?</span>
                <textarea
                  value={s3.forwardQuestions}
                  onChange={(e) => setStep3({ forwardQuestions: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1a2744]">Your booking link</span>
                <input
                  type="url"
                  value={s3.bookingLink}
                  onChange={(e) => setStep3({ bookingLink: e.target.value })}
                  placeholder="https://"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1a2744]">Your cancellation policy</span>
                <textarea
                  value={s3.cancellationPolicy}
                  onChange={(e) => setStep3({ cancellationPolicy: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#1a2744]">Your aftercare instructions</span>
                <textarea
                  value={s3.aftercare}
                  onChange={(e) => setStep3({ aftercare: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-[#0d9488]/30 transition focus:border-[#0d9488] focus:ring-2"
                />
              </label>
            </div>
          ) : null}

          {persisted.currentStep === 4 ? (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">Upload your work photos</h2>
              <p className="text-sm text-slate-600">
                Up to {MAX_PHOTOS} images. Each file can be up to 5 MB.
              </p>
              {workPhotosUploadError ? (
                <p className="text-xs font-medium text-red-600">{workPhotosUploadError}</p>
              ) : null}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`rounded-2xl border-2 border-dashed px-4 py-10 text-center transition sm:py-14 ${
                  dragActive ? "border-[#0d9488] bg-teal-50/50" : "border-slate-300 bg-slate-50/80"
                }`}
              >
                <p className="text-sm font-medium text-[#1a2744]">Drag and drop images here</p>
                <p className="mt-1 text-xs text-slate-500">or</p>
                <button
                  type="button"
                  onClick={() => {
                    setWorkPhotosUploadError(null);
                    photosFileInputRef.current?.click();
                  }}
                  className="mt-3 rounded-full bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Browse files
                </button>
                <input
                  ref={photosFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Browse work photos"
                  onChange={(e) => {
                    if (e.target.files?.length) addPhotoFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">Accepted: PNG, JPG, JPEG, WEBP. Maximum file size 5 MB per image.</p>
              <p className="text-xs leading-relaxed text-slate-600">
                Only upload photos you have permission to share. Your clients may see these during conversations.
              </p>
              {s4.photos.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {s4.photos.map((photo, idx) => (
                    <li key={`${photo.name}-${idx}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute right-1 top-1 rounded-full bg-[#1a2744]/85 px-2 py-0.5 text-xs font-semibold text-white shadow-sm sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <input
                  type="checkbox"
                  checked={s4.permissionConfirmed}
                  onChange={(e) => setStep4({ permissionConfirmed: e.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]"
                />
                <span className="text-sm font-medium text-[#1a2744]">I confirm I have permission to use these photos</span>
              </label>
            </div>
          ) : null}

          {persisted.currentStep === 5 ? (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-[#1a2744] sm:text-xl">Preview and launch</h2>
                <p className="mt-1 text-sm text-slate-600">Review your setup, try the preview, then launch when you are ready.</p>
              </div>

              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0d9488]">Summary</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Your name</dt>
                    <dd className="text-slate-700">{s1.fullName || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Practice</dt>
                    <dd className="text-slate-700">{s1.practiceName || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Location</dt>
                    <dd className="text-slate-700">
                      {s1.city || "—"}, {s1.state || "—"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Experience</dt>
                    <dd className="text-slate-700">{s1.yearsExperience || "—"} years</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">You</dt>
                    <dd className="text-slate-700">{s1.specialSentence || "—"}</dd>
                  </div>
                  {s1.instagram ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Instagram</dt>
                      <dd className="text-slate-700">{s1.instagram}</dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Services</dt>
                    <dd className="text-slate-700">
                      {(() => {
                        const parts = [
                          ...s2.serviceIds
                            .filter((id) => id !== OTHER_SERVICE_ID)
                            .map((id) => SERVICES.find((x) => x.id === id)?.label ?? id),
                          ...s2.customServices
                            .filter((c) => c.name.trim())
                            .map((c) => (c.description.trim() ? `${c.name.trim()} (${c.description.trim()})` : c.name.trim())),
                        ];
                        return parts.length ? parts.join(", ") : "—";
                      })()}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Bot</dt>
                    <dd className="text-slate-700">
                      {s3.botName} · {s3.tone}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Greeting</dt>
                    <dd className="whitespace-pre-wrap text-slate-700">{s3.greeting || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Bubble color</dt>
                    <dd className="flex items-center gap-2 text-slate-700">
                      <span className="inline-block h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: s3.primaryColor }} aria-hidden />
                      <span className="font-mono text-xs">{s3.primaryColor}</span>
                    </dd>
                  </div>
                  {s3.forwardQuestions.trim() ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Forward to you</dt>
                      <dd className="whitespace-pre-wrap text-slate-700">{s3.forwardQuestions}</dd>
                    </div>
                  ) : null}
                  {s3.bookingLink ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Booking</dt>
                      <dd className="break-all text-slate-700">{s3.bookingLink}</dd>
                    </div>
                  ) : null}
                  {s3.cancellationPolicy.trim() ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Cancellation</dt>
                      <dd className="whitespace-pre-wrap text-slate-700">{s3.cancellationPolicy}</dd>
                    </div>
                  ) : null}
                  {s3.aftercare.trim() ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Aftercare</dt>
                      <dd className="whitespace-pre-wrap text-slate-700">{s3.aftercare}</dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="font-medium text-[#1a2744] sm:min-w-[8rem]">Photos</dt>
                    <dd className="text-slate-700">{s4.photos.length} uploaded</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-[#1a2744]">Live chat preview</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                  <div
                    className="flex items-center justify-between border-b border-white/20 px-4 py-3 text-white"
                    style={{ backgroundColor: s3.primaryColor }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {s3.logoImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s3.logoImage}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-lg bg-white/10 object-contain p-0.5"
                        />
                      ) : null}
                      <span
                        className="truncate text-sm font-semibold text-white"
                        style={getBotNameFontStyle(s3.botNameFont)}
                      >
                        {s3.botName || "Your bot"}
                      </span>
                    </div>
                    <span className="text-xs text-white/90">Preview</span>
                  </div>
                  <div className="relative space-y-3 bg-slate-50 px-3 py-4 pb-28 sm:px-4 sm:pb-32">
                    <div className="flex justify-start">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-bl-md px-3 py-2.5 text-sm leading-relaxed text-white shadow-sm"
                        style={{ backgroundColor: s3.primaryColor }}
                      >
                        {s3.greeting || "Your greeting will appear here."}
                      </div>
                    </div>
                    {chatInput.trim() ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm">
                          {chatInput}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2 pt-1">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type a test message…"
                        className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none ring-[#0d9488]/20 focus:ring-2"
                      />
                      <button
                        type="button"
                        style={{ backgroundColor: s3.primaryColor }}
                        className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                      >
                        Send
                      </button>
                    </div>
                    <p className="text-center text-xs text-slate-500">Preview only — messages are not saved.</p>
                    <div className="pointer-events-none absolute bottom-4 right-3 left-3 z-10 flex justify-end sm:left-auto">
                      <div
                        className="max-w-[min(100%,16rem)] rounded-2xl px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-lg"
                        style={{ backgroundColor: s3.primaryColor }}
                      >
                        {previewBubbleAttention}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {!persisted.launched ? (
                <div className="space-y-3">
                  {launchError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm leading-relaxed text-red-800">{launchError}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={launchSaving}
                    onClick={() => void handleLaunch()}
                    className="w-full rounded-full bg-[#0d9488] py-4 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5"
                  >
                    {launchSaving ? "Saving your bot…" : "Launch my bot"}
                  </button>
                </div>
              ) : null}

              {persisted.launched ? (
                <section className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 sm:p-6">
                  {launchSuccess ? (
                    <p className="text-sm font-medium text-[#0d9488]">{launchSuccess}</p>
                  ) : null}
                  <h3 className="text-lg font-semibold text-[#1a2744]">You are live</h3>
                  <p className="text-sm text-slate-700">Share this link or embed the widget on your site.</p>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0d9488]">Direct share link</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1a2744] sm:text-sm">
                        {`${shareOrigin}/chat/${slug}`}
                      </code>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(`${shareOrigin}/chat/${slug}`)}
                        className="shrink-0 rounded-full border border-[#0d9488] bg-white px-4 py-2 text-sm font-semibold text-[#0d9488] hover:bg-teal-50"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0d9488]">Embed code</p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-[#1a2744] p-3 text-xs text-teal-100 sm:text-sm">
{`<script async src="${shareOrigin}/embed.js" data-bot-slug="${slug}"></script>`}
                    </pre>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `<script async src="${shareOrigin}/embed.js" data-bot-slug="${slug}"></script>`
                        )
                      }
                      className="mt-2 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      Copy embed code
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {currentValidationErrors.length > 0 ? (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
              <p className="font-semibold">Please finish these before continuing:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {currentValidationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={persisted.currentStep <= 1}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-[#1a2744] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {persisted.currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-[#0d9488] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-700"
              >
                Next
              </button>
            ) : persisted.launched ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-[#1a2744] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#243552]"
              >
                Go to dashboard
              </Link>
            ) : (
              <span className="text-center text-sm text-slate-500 sm:self-center">Use Launch my bot above when you are ready.</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
