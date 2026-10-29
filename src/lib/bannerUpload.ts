import { supabase } from './supabase';

/**
 * Uploads a profile banner image to Supabase Storage 'profile_assets' bucket,
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
    return { url: null, error: 'Banner image size must be under 10MB' };
  }

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `banners/${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile_assets')
      .upload(filePath, file, { upsert: true });

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
      resolve({ url: null, error: 'Failed to read image file' });
    };
    reader.readAsDataURL(file);
  });
}
