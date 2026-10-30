import { supabase } from './supabase';

/**
 * Checks whether a banner URL or data URL corresponds to a video format (.mp4 or .webm).
 */
export function isVideoBanner(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    url.startsWith('data:video/mp4') ||
    url.startsWith('data:video/webm')
  );
}

/**
 * Uploads a profile banner image or video to Supabase Storage 'profile_assets' bucket,
 * with graceful fallback to base64 data URL when offline or storage is unconfigured.
 */
export async function uploadBannerImage(
  file: File,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!file) {
    return { url: null, error: 'No file provided' };
  }

  // Enforce 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return { url: null, error: 'Banner file size must be under 10MB' };
  }

  try {
    const rawExt = file.name ? file.name.split('.').pop()?.toLowerCase() : null;
    let fileExt = rawExt && rawExt.length <= 5 && rawExt !== 'blob' ? rawExt : null;

    if (!fileExt) {
      if (file.type === 'video/mp4') fileExt = 'mp4';
      else if (file.type === 'video/webm') fileExt = 'webm';
      else if (file.type === 'image/gif') fileExt = 'gif';
      else if (file.type === 'image/png') fileExt = 'png';
      else if (file.type === 'image/webp') fileExt = 'webp';
      else fileExt = 'jpg';
    }

    const filePath = `banners/${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile_assets')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || undefined,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from('profile_assets').getPublicUrl(filePath);
      if (data?.publicUrl) {
        return { url: data.publicUrl, error: null };
      }
    }
  } catch {
    // Supabase storage bucket unavailable or offline -> fallback to Base64
  }

  // Fallback: Read as Base64 Data URL for instantaneous local display and persistence
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ url: reader.result as string, error: null });
    };
    reader.onerror = () => {
      resolve({ url: null, error: 'Failed to read media file' });
    };
    reader.readAsDataURL(file);
  });
}
