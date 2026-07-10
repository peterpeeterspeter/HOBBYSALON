import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  getFileFromFormData,
  uploadImageFile,
} from "@/lib/storage/upload-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = getFileFromFormData(formData, "file");
    const pathPrefix =
      formData.get("path_prefix")?.toString().trim() ||
      `uploads/${user.id}`;

    if (!pathPrefix || pathPrefix.includes("..")) {
      return NextResponse.json({ error: "Ongeldig uploadpad." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Kies een afbeelding." }, { status: 400 });
    }

    const url = await uploadImageFile(file, pathPrefix);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload mislukt. Probeer een kleinere JPEG of PNG.",
      },
      { status: 400 }
    );
  }
}
