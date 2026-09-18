"use client";

import { useRef, useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";

import { savePhotoPath } from "./actions";

const BUCKET = "profile-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function PhotoUpload({
  userId,
  businessName,
  initialPath,
}: {
  userId: string;
  businessName: string;
  initialPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const publicUrl = path
    ? createClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    : null;

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 5MB. Try a smaller one.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const previousPath = path;

      // Storage policy only lets her write inside a folder named for her id.
      const objectPath = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await savePhotoPath(objectPath);

      if (result.status === "error") {
        // The row never picked it up, so do not leave the file behind.
        await supabase.storage.from(BUCKET).remove([objectPath]);
        setError(result.message ?? "Couldn't save that photo.");
        return;
      }

      setPath(objectPath);

      if (previousPath) {
        await supabase.storage.from(BUCKET).remove([previousPath]);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't upload that photo.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove() {
    const current = path;
    if (!current) return;

    setBusy(true);
    setError(null);

    startTransition(async () => {
      const result = await savePhotoPath(null);

      if (result.status === "error") {
        setError(result.message ?? "Couldn't remove that photo.");
        setBusy(false);
        return;
      }

      setPath(null);
      await createClient().storage.from(BUCKET).remove([current]);
      setBusy(false);
    });
  }

  const initial = businessName.trim().charAt(0).toUpperCase() || "B";

  return (
    <div>
      <p className="label">Profile photo</p>

      <div className="flex items-center gap-4">
        {publicUrl ? (
          // Storage host is only known at runtime, so next/image would need
          // remotePatterns configured per project. A plain img keeps setup to
          // two env vars.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicUrl}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] flex-none rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-[72px] w-[72px] flex-none place-items-center rounded-full bg-cherry font-display text-[20px] text-cherry-ink"
            aria-hidden
          >
            {initial}
          </span>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : path ? "Replace" : "Upload photo"}
          </button>

          {path && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onRemove}
              disabled={busy}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={onPick}
        aria-label="Choose a profile photo"
      />

      {error && (
        <p className="hint font-semibold text-cherry" role="alert">
          {error}
        </p>
      )}
      <p className="hint">JPG, PNG or WebP, up to 5MB.</p>
    </div>
  );
}
