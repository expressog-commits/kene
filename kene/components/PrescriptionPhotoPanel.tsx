"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchMedicinesFromText } from "@/lib/engine";
import type { AppState } from "@/lib/types";
import {
  IconCamera,
  IconCheck,
  IconClose,
  IconImage,
  IconPlus,
  IconRotate,
  IconShield,
  IconTrash,
  IconZoomIn,
} from "./icons";
import { cn } from "./ui";

export interface PrescriptionPhotoData {
  dataUrl: string;
  file: File;
  recognizedText: string;
}

export interface PrescriptionPhotoPanelProps {
  medicinesState: AppState;
  selectedMedicineIds: string[];
  photo: PrescriptionPhotoData | null;
  autoOpenCameraTrigger?: number;
  onPhotoChange: (photo: PrescriptionPhotoData | null) => void;
  onAddMedicines: (medicineIds: string[]) => void;
  onNotify: (message: string) => void;
}

interface OcrApiResponse {
  available?: boolean;
  text?: string;
}

interface TextDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

interface WindowWithTextDetector extends Window {
  TextDetector?: new () => TextDetectorInstance;
}

interface TesseractRecognizeResult {
  data?: {
    text?: string;
  };
}

interface TesseractGlobal {
  recognize: (
    image: string | File | Blob,
    langs?: string,
  ) => Promise<TesseractRecognizeResult>;
}

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const TESSERACT_CDN_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const TESSERACT_TIMEOUT_MS = 15_000;

let tesseractLoaderPromise: Promise<TesseractGlobal | null> | null = null;

function loadTesseractScript(): Promise<TesseractGlobal | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const win = window as unknown as { Tesseract?: TesseractGlobal };
  if (win.Tesseract) return Promise.resolve(win.Tesseract);
  if (tesseractLoaderPromise) return tesseractLoaderPromise;

  tesseractLoaderPromise = new Promise<TesseractGlobal | null>((resolve) => {
    let settled = false;
    const finish = (instance: TesseractGlobal | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (!instance) {
        tesseractLoaderPromise = null;
      }
      resolve(instance);
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, TESSERACT_TIMEOUT_MS);

    const handleLoad = () => {
      const loaded = (window as unknown as { Tesseract?: TesseractGlobal })
        .Tesseract;
      finish(loaded ?? null);
    };

    const handleError = () => {
      finish(null);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kene-tesseract="1"]',
    );
    if (existing) {
      if (win.Tesseract) {
        finish(win.Tesseract);
        return;
      }
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TESSERACT_CDN_URL;
    script.async = true;
    script.dataset.keneTesseract = "1";
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return tesseractLoaderPromise;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header ?? "");
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function canvasToJpegOutput(
  canvas: HTMLCanvasElement,
): Promise<{ dataUrl: string; file: File }> {
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  const finalBlob = blob ?? dataUrlToBlob(dataUrl);
  const file = new File([finalBlob], "ordonnance-kene.jpg", {
    type: "image/jpeg",
  });
  return { dataUrl, file };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Impossible de décoder cette image."));
    img.src = src;
  });
}

async function resizeImageFileToJpeg(
  file: File,
): Promise<{ dataUrl: string; file: File }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Contexte graphique indisponible.");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return await canvasToJpegOutput(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function rotateDataUrl90Clockwise(
  dataUrl: string,
): Promise<{ dataUrl: string; file: File }> {
  const img = await loadImage(dataUrl);
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalW, naturalH));
  const drawW = Math.max(1, Math.round(naturalW * scale));
  const drawH = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = drawH;
  canvas.height = drawW;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexte graphique indisponible.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  return await canvasToJpegOutput(canvas);
}

async function captureVideoFrameToJpeg(
  video: HTMLVideoElement,
): Promise<{ dataUrl: string; file: File }> {
  const videoW = video.videoWidth || 1280;
  const videoH = video.videoHeight || 720;
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(videoW, videoH));
  const targetW = Math.max(1, Math.round(videoW * scale));
  const targetH = Math.max(1, Math.round(videoH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexte graphique indisponible.");
  }
  ctx.drawImage(video, 0, 0, targetW, targetH);
  return await canvasToJpegOutput(canvas);
}

export default function PrescriptionPhotoPanel({
  medicinesState,
  selectedMedicineIds,
  photo,
  autoOpenCameraTrigger = 0,
  onPhotoChange,
  onAddMedicines,
  onNotify,
}: PrescriptionPhotoPanelProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unmountedRef = useRef(false);
  const cameraSessionRef = useRef(0);
  const analysisIdRef = useRef(0);
  const lastAutoTriggerRef = useRef(0);

  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [cameraStarting, setCameraStarting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<
    "idle" | "matched" | "unreadable"
  >("idle");
  const [detectedCount, setDetectedCount] = useState(0);
  const [manualTextOpen, setManualTextOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  const stopCameraStream = useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      cameraSessionRef.current += 1;
      analysisIdRef.current += 1;
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const closeCameraModal = useCallback(() => {
    cameraSessionRef.current += 1;
    stopCameraStream();
    setCameraStarting(false);
    setCameraModalOpen(false);
  }, [stopCameraStream]);

  useEffect(() => {
    if (!lightboxOpen && !cameraModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (lightboxOpen) setLightboxOpen(false);
      if (cameraModalOpen) closeCameraModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, cameraModalOpen, closeCameraModal]);

  const analyzePrescriptionImage = useCallback(
    async (imageDataUrl: string, file: File) => {
      const currentAnalysisId = ++analysisIdRef.current;
      setAnalyzing(true);
      setOcrStatus("idle");
      setDetectedCount(0);

      let extractedText = "";

      // Étape A : API OCR serveur (sans stockage ni journalisation)
      try {
        const response = await fetch("/api/ocr-prescription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl }),
        });
        if (response.ok) {
          const payload = (await response.json()) as OcrApiResponse;
          if (payload.available && typeof payload.text === "string" && payload.text.trim()) {
            extractedText = payload.text.trim();
          }
        }
      } catch {
        // Repli automatique vers la détection locale
      }

      // Étape B : TextDetector natif du navigateur
      if (!extractedText && typeof window !== "undefined") {
        const Detector = (window as WindowWithTextDetector).TextDetector;
        if (Detector && typeof createImageBitmap === "function") {
          try {
            const bitmap = await createImageBitmap(dataUrlToBlob(imageDataUrl));
            try {
              const detector = new Detector();
              const blocks = await detector.detect(bitmap);
              const joined = blocks
                .map((block) => block.rawValue?.trim() ?? "")
                .filter(Boolean)
                .join("\n")
                .trim();
              if (joined) {
                extractedText = joined;
              }
            } finally {
              bitmap.close?.();
            }
          } catch {
            // Repli vers Tesseract.js
          }
        }
      }

      // Étape C : Tesseract.js côté client (si en ligne)
      if (
        !extractedText &&
        typeof navigator !== "undefined" &&
        navigator.onLine !== false
      ) {
        try {
          const tesseract = await loadTesseractScript();
          if (tesseract) {
            const result = await tesseract.recognize(imageDataUrl, "fra");
            const text = result?.data?.text?.trim() ?? "";
            if (text) {
              extractedText = text;
            }
          }
        } catch {
          // L'utilisateur conserve la photo affichée pour saisie manuelle
        }
      }

      if (unmountedRef.current || analysisIdRef.current !== currentAnalysisId) {
        return;
      }

      onPhotoChange({
        dataUrl: imageDataUrl,
        file,
        recognizedText: extractedText,
      });

      const matches = extractedText
        ? matchMedicinesFromText(medicinesState, extractedText, 8)
        : [];

      setAnalyzing(false);

      if (matches.length > 0) {
        setOcrStatus("matched");
        setDetectedCount(matches.length);
        onAddMedicines(matches.map((medicine) => medicine.id));
      } else {
        setOcrStatus("unreadable");
        setDetectedCount(0);
      }
    },
    [medicinesState, onAddMedicines, onPhotoChange],
  );

  const openLiveCamera = useCallback(
    async (requestedFacing: "environment" | "user") => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        galleryInputRef.current?.click();
        return;
      }

      const sessionId = ++cameraSessionRef.current;
      stopCameraStream();
      setFacingMode(requestedFacing);
      setCameraModalOpen(true);
      setCameraStarting(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: requestedFacing } },
          audio: false,
        });

        if (unmountedRef.current || cameraSessionRef.current !== sessionId) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            // La lecture automatique est déjà demandée via autoPlay
          });
        }
        setCameraStarting(false);
      } catch {
        if (unmountedRef.current || cameraSessionRef.current !== sessionId) {
          return;
        }
        stopCameraStream();
        setCameraStarting(false);
        setCameraModalOpen(false);
        onNotify(
          "Caméra indisponible : sélectionnez une photo depuis vos fichiers.",
        );
        galleryInputRef.current?.click();
      }
    },
    [onNotify, stopCameraStream],
  );

  const triggerPhotoCapture = useCallback(() => {
    const isCoarsePointer =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (isCoarsePointer) {
      cameraInputRef.current?.click();
      return;
    }

    void openLiveCamera("environment");
  }, [openLiveCamera]);

  useEffect(() => {
    if (
      autoOpenCameraTrigger > 0 &&
      autoOpenCameraTrigger > lastAutoTriggerRef.current
    ) {
      lastAutoTriggerRef.current = autoOpenCameraTrigger;
      triggerPhotoCapture();
    }
  }, [autoOpenCameraTrigger, triggerPhotoCapture]);

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      onNotify("Veuillez sélectionner une image (JPEG, PNG ou WebP).");
      return;
    }

    try {
      const processed = await resizeImageFileToJpeg(selectedFile);
      const nextPhoto: PrescriptionPhotoData = {
        dataUrl: processed.dataUrl,
        file: processed.file,
        recognizedText: "",
      };
      onPhotoChange(nextPhoto);
      void analyzePrescriptionImage(processed.dataUrl, processed.file);
    } catch {
      onNotify("Impossible de lire cette photo d'ordonnance.");
    }
  };

  const handleCaptureFromModal = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      onNotify("Patientez une seconde que la caméra soit prête.");
      return;
    }
    try {
      const captured = await captureVideoFrameToJpeg(video);
      closeCameraModal();
      const nextPhoto: PrescriptionPhotoData = {
        dataUrl: captured.dataUrl,
        file: captured.file,
        recognizedText: "",
      };
      onPhotoChange(nextPhoto);
      void analyzePrescriptionImage(captured.dataUrl, captured.file);
    } catch {
      onNotify("La capture photo a échoué, réessayez.");
    }
  };

  const handleRotatePhoto = async () => {
    if (!photo || analyzing) return;
    try {
      const rotated = await rotateDataUrl90Clockwise(photo.dataUrl);
      onPhotoChange({
        dataUrl: rotated.dataUrl,
        file: rotated.file,
        recognizedText: photo.recognizedText,
      });
    } catch {
      onNotify("Impossible de pivoter la photo.");
    }
  };

  const handleRemovePhoto = () => {
    analysisIdRef.current += 1;
    setAnalyzing(false);
    setOcrStatus("idle");
    setDetectedCount(0);
    setLightboxOpen(false);
    onPhotoChange(null);
  };

  const manualMatches = useMemo(() => {
    if (!manualText.trim()) return [];
    return matchMedicinesFromText(medicinesState, manualText, 8);
  }, [medicinesState, manualText]);

  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3.5">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void handleFileSelected(event)}
        className="sr-only"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => void handleFileSelected(event)}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            Photo de l&apos;ordonnance
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <IconShield className="h-3.5 w-3.5 shrink-0 text-brand-700" />
            <span>
              Confidentialité : la photo reste sur votre appareil et n&apos;est
              jamais enregistrée.
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={triggerPhotoCapture}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98]"
          >
            <IconCamera className="h-4 w-4 shrink-0" />
            <span>Prendre en photo</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            <IconImage className="h-4 w-4 shrink-0 text-slate-500" />
            <span>Importer</span>
          </button>
        </div>
      </div>

      {photo ? (
        <div className="mt-3 space-y-2.5">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="Agrandir la photo de l'ordonnance"
              className="block w-full focus:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt="Ordonnance chargée"
                className="mx-auto max-h-56 w-full object-contain bg-slate-900/5"
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleRotatePhoto()}
              disabled={analyzing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <IconRotate className="h-3.5 w-3.5 shrink-0" />
              <span>Pivoter 90°</span>
            </button>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconZoomIn className="h-3.5 w-3.5 shrink-0" />
              <span>Agrandir</span>
            </button>
            <button
              type="button"
              onClick={() => void analyzePrescriptionImage(photo.dataUrl, photo.file)}
              disabled={analyzing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
            >
              <span>Relire</span>
            </button>
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <IconTrash className="h-3.5 w-3.5 shrink-0" />
              <span>Retirer</span>
            </button>
          </div>

          {analyzing ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-xs font-semibold text-brand-800"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
              />
              <span>Lecture automatique de l&apos;ordonnance…</span>
            </div>
          ) : ocrStatus === "matched" && detectedCount > 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
              <p className="font-bold">
                {detectedCount} médicament{detectedCount > 1 ? "s" : ""} détecté
                {detectedCount > 1 ? "s" : ""} automatiquement sur la photo.
              </p>
              <p className="mt-0.5 text-emerald-800">
                Vérifiez toujours les médicaments détectés avec votre ordonnance
                papier et votre pharmacien.
              </p>
            </div>
          ) : ocrStatus === "unreadable" ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
              <p className="font-medium leading-relaxed">
                Écriture manuscrite ou peu lisible : gardez votre photo sous les
                yeux ci-dessus et touchez ou dictez les médicaments ci-dessous.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 border-t border-brand-100/80 pt-2.5">
        <button
          type="button"
          onClick={() => setManualTextOpen((prev) => !prev)}
          aria-expanded={manualTextOpen}
          className="text-xs font-semibold text-brand-700 transition hover:text-brand-800"
        >
          {manualTextOpen
            ? "Masquer la saisie de texte"
            : "Coller ou saisir le texte de l'ordonnance"}
        </button>

        {manualTextOpen ? (
          <div className="mt-2 space-y-2">
            <textarea
              rows={3}
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="Ex. : Doliprane 500 mg, Clamoxyl 500, Coartem..."
              aria-label="Texte de l'ordonnance"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
            />
            {manualText.trim() ? (
              manualMatches.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-emerald-900">
                      {manualMatches.length} médicament
                      {manualMatches.length > 1 ? "s" : ""} reconnu
                      {manualMatches.length > 1 ? "s" : ""} :
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onAddMedicines(manualMatches.map((m) => m.id));
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-[11px] font-bold text-white transition hover:bg-emerald-800"
                    >
                      <IconPlus className="h-3 w-3" />
                      <span>Tout ajouter</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {manualMatches.map((medicine) => {
                      const alreadySelected = selectedMedicineIds.includes(
                        medicine.id,
                      );
                      return (
                        <button
                          key={medicine.id}
                          type="button"
                          disabled={alreadySelected}
                          onClick={() => onAddMedicines([medicine.id])}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition",
                            alreadySelected
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-white text-slate-800 ring-1 ring-emerald-200 hover:bg-emerald-100/60",
                          )}
                        >
                          {alreadySelected ? (
                            <IconCheck className="h-3 w-3" />
                          ) : (
                            <IconPlus className="h-3 w-3" />
                          )}
                          <span>{medicine.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Vérifiez toujours les médicaments détectés avec votre
                    ordonnance papier et votre pharmacien.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Aucun médicament du catalogue identifié dans ce texte pour
                  l&apos;instant.
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </div>

      {cameraModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prendre une photo de l'ordonnance"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-bold">
                Photographier l&apos;ordonnance
              </p>
              <button
                type="button"
                onClick={closeCameraModal}
                aria-label="Fermer la caméra"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-[4/3] w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Cadre viseur */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-brand-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
              />
              {cameraStarting ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white">
                  Ouverture de la caméra…
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  void openLiveCamera(
                    facingMode === "environment" ? "user" : "environment",
                  )
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                <IconRotate className="h-4 w-4" />
                <span>
                  {facingMode === "environment"
                    ? "Caméra avant"
                    : "Caméra arrière"}
                </span>
              </button>

              <button
                type="button"
                disabled={cameraStarting}
                onClick={() => void handleCaptureFromModal()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                <IconCamera className="h-4 w-4" />
                <span>Capturer la photo</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxOpen && photo ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu agrandi de l'ordonnance"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-4"
        >
          <div className="flex items-center justify-between pb-3">
            <p className="text-xs font-semibold text-white/90">
              Confidentialité : la photo reste sur votre appareil et n&apos;est
              jamais enregistrée.
            </p>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-bold text-white transition hover:bg-white/25"
            >
              <IconClose className="h-4 w-4" />
              <span>Fermer</span>
            </button>
          </div>
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex min-h-0 flex-1 items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.dataUrl}
              alt="Ordonnance agrandie"
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
