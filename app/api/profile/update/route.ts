import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

// Validation constants
const USERNAME_REGEX = /^[a-zA-Z0-9_\s]+$/;
const USERNAME_MIN_LENGTH = 1;
const USERNAME_MAX_LENGTH = 50;
const IMAGE_MAX_SIZE_BYTES = 500 * 1024; // ~500KB
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface UpdateProfileBody {
  name?: string;
  image?: string | null;
}

function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} character`;
  }
  if (name.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_REGEX.test(name)) {
    return "Username can only contain letters, numbers, spaces, and underscores";
  }
  return null;
}

function validateImage(image: string): string | null {
  // Check if it's a valid data URL
  const dataUrlMatch = image.match(/^data:(image\/[a-z+]+);base64,/);
  if (!dataUrlMatch) {
    return "Invalid image format. Must be a data URL";
  }

  const mimeType = dataUrlMatch[1];
  if (!VALID_IMAGE_TYPES.includes(mimeType)) {
    return `Invalid image type. Allowed types: ${VALID_IMAGE_TYPES.join(", ")}`;
  }

  // Check size (base64 is ~33% larger than binary)
  const base64Data = image.split(",")[1];
  const approximateSize = (base64Data.length * 3) / 4;
  if (approximateSize > IMAGE_MAX_SIZE_BYTES) {
    return `Image is too large. Maximum size is ${IMAGE_MAX_SIZE_BYTES / 1024}KB`;
  }

  return null;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Parse and validate body
    let body: UpdateProfileBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: { name?: string; image?: string | null } = {};

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return NextResponse.json(
          { error: "Name must be a string" },
          { status: 400 }
        );
      }
      const trimmedName = body.name.trim();
      const nameError = validateUsername(trimmedName);
      if (nameError) {
        return NextResponse.json({ error: nameError }, { status: 400 });
      }
      updateData.name = trimmedName;
    }

    // Validate image if provided
    if (body.image !== undefined) {
      if (body.image === null) {
        // Allow clearing the image
        updateData.image = null;
      } else if (typeof body.image === "string") {
        const imageError = validateImage(body.image);
        if (imageError) {
          return NextResponse.json({ error: imageError }, { status: 400 });
        }
        updateData.image = body.image;
      } else {
        return NextResponse.json(
          { error: "Image must be a string or null" },
          { status: 400 }
        );
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        name: true,
        image: true,
        email: true,
        tradingWallet: {
          select: {
            address: true,
          },
        },
      },
    });

    return NextResponse.json({
      name: updatedUser.name,
      image: updatedUser.image,
      email: updatedUser.email,
      walletAddress: updatedUser.tradingWallet?.address ?? null,
    });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
