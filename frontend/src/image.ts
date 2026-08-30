import * as FileSystem from 'expo-file-system/legacy';

export async function toBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    // web fallback
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject; r.onload = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  }
}
