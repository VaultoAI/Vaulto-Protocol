"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { GradientAvatar } from "@/components/GradientAvatar";

interface ProfileAvatarProps {
  image: string | null;
  walletAddress: string | null;
  size?: number;
  editable?: boolean;
  onImageChange?: (dataUrl: string | null) => void;
}

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 512;
const QUALITY = 0.8;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to data URL
      const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Create object URL for the file
    img.src = URL.createObjectURL(file);
  });
}

export function ProfileAvatar({
  image,
  walletAddress,
  size = 80,
  editable = false,
  onImageChange,
}: ProfileAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = useCallback(() => {
    if (editable && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [editable]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      // Validate file type
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        setError("Please upload a JPEG, PNG, or WebP image");
        return;
      }

      // Validate file size
      if (file.size > MAX_RAW_SIZE_BYTES) {
        setError("Image must be smaller than 2MB");
        return;
      }

      setIsProcessing(true);
      try {
        const dataUrl = await compressImage(file);
        onImageChange?.(dataUrl);
      } catch (err) {
        setError("Failed to process image");
        console.error("Image processing error:", err);
      } finally {
        setIsProcessing(false);
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onImageChange]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={!editable || isProcessing}
        className={`relative overflow-hidden rounded-full ${
          editable
            ? "cursor-pointer ring-2 ring-transparent transition hover:ring-primary/50 focus:outline-none focus:ring-primary"
            : ""
        }`}
        style={{ width: size, height: size }}
      >
        {image ? (
          <Image
            src={image}
            alt="Profile"
            width={size}
            height={size}
            className="h-full w-full object-cover"
          />
        ) : walletAddress ? (
          <GradientAvatar address={walletAddress} size={size} />
        ) : (
          <div
            className="flex items-center justify-center bg-foreground/10 text-foreground/50"
            style={{ width: size, height: size }}
          >
            <span className="text-2xl">?</span>
          </div>
        )}

        {/* Edit overlay */}
        {editable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition hover:opacity-100">
            {isProcessing ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        )}
      </button>

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept={VALID_IMAGE_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
