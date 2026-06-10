/**
 * Utility functions for handling image uploads, parsing comma-separated URLs,
 * and robust Base64 data string processing.
 */

/**
 * Splits image URLs by commas, but preserves base64 strings (which contain commas).
 * This ensures that a base64 encoded image string like "data:image/jpeg;base64,..." is
 * parsed as a single item instead of being split into separate entities.
 */
export function parseImageUrls(imageUrlString: string | undefined | null): string[] {
  if (!imageUrlString) return [];
  
  const parts = imageUrlString.split(',');
  const result: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    // If this part is a data URL prefix (e.g., data:image/jpeg;base64)
    if (part.startsWith('data:image/') && part.includes(';base64')) {
      // Look ahead and merge it back with the actual base64 content
      if (i + 1 < parts.length) {
        const nextPart = parts[i + 1].trim();
        result.push(`${part},${nextPart}`);
        i++; // skip next part
      } else {
        result.push(part);
      }
    } else {
      result.push(part);
    }
  }
  
  // De-duplicate results & filter only valid, loadable images to prevent duplications or broken boxes
  return Array.from(new Set(result)).filter(url => {
    if (!url) return false;
    const isBase64 = url.startsWith('data:image/');
    const isUrl = url.startsWith('http://') || url.startsWith('https://');
    const isRawBase64 = url.startsWith('/9j/') || url.startsWith('iVBORw0K') || url.startsWith('R0lGOD') || (url.length > 500 && !url.includes(' ') && !url.includes('http') && !url.includes('.'));
    const isLocalCached = url.startsWith('TASK_') && typeof window !== 'undefined' && !!window.localStorage?.getItem('local_img_' + url);
    const isTaskFile = url.startsWith('TASK_');
    return isBase64 || isUrl || isRawBase64 || isLocalCached || isTaskFile;
  });
}

/**
 * Normalizes a single URL or Base64 string to a format that can be easily loaded by standard <img> tags.
 * Converts Google Drive sharing links in format /file/d/ID/view or ?id=ID into direct stream URLs.
 */
export function getDirectDriveUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  
  // 1. Check exact cache match first (e.g. for complete direct URLs cached locally)
  if (typeof window !== 'undefined') {
    const cached = window.localStorage?.getItem('local_img_' + trimmed);
    if (cached) return cached;
  }

  // 2. Support blob: and data: URLs natively
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  
  if (trimmed.startsWith('TASK_')) {
    if (typeof window !== 'undefined') {
      const cached = window.localStorage?.getItem('local_img_' + trimmed);
      if (cached) return cached;
    }
    return `https://script.google.com/macros/s/AKfycbzgygKvfwKLM6CU4FEe0tIxwupi9Aw_K-LtEjSS2SrbFWgFkK-5IPD0oHeAS_Emfsrr_Q/exec?file=${trimmed}`;
  }

  // Check if the URL is an Apps Script URL containing a file parameter with local cached data
  if (typeof window !== 'undefined' && (trimmed.includes('?file=') || trimmed.includes('&file='))) {
    const fileParam = trimmed.split('file=')[1]?.split('&')[0];
    if (fileParam) {
      const cached = window.localStorage?.getItem('local_img_' + fileParam);
      if (cached) return cached;
    }
  }
  
  const isRawBase64 = trimmed.startsWith('/9j/') || 
                      trimmed.startsWith('iVBORw0K') || 
                      trimmed.startsWith('R0lGOD') || 
                      (trimmed.length > 500 && !trimmed.includes(' ') && !trimmed.includes('http') && !trimmed.includes('.'));
  
  if (isRawBase64) {
    const isPng = trimmed.startsWith('iVBORw0K');
    const mime = isPng ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${trimmed}`;
  }

  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    let fileId = '';
    const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dDirectMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    if (dMatch) fileId = dMatch[1];
    else if (idMatch) fileId = idMatch[1];
    else if (dDirectMatch) fileId = dDirectMatch[1];
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // Jika berupa nama file atau ID file pendek (data lama), bungkus dengan CDN Google Drive langsung
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://lh3.googleusercontent.com/d/${trimmed}`;
  }

  return trimmed;
}

/**
 * Returns the first valid direct image URL or base64 from a comma-separated list
 * to be used as a singular thumbnail in lists.
 */
export function getThumbnailUrl(imageUrlString: string | undefined | null): string {
  if (!imageUrlString) {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  const urls = parseImageUrls(imageUrlString);
  if (urls.length === 0) {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  return getDirectDriveUrl(urls[0]);
}
