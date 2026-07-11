import { useEffect, useState } from 'react';
import { fetchPhotoUrl as fetchVillaPhotoUrl } from '../api/villa.js';
import { getPhoto } from '../utils/localPhotoStore.js';

/**
 * Renders a server-stored photo by id, fetched as an authenticated blob.
 * `fetchUrl` lets other modules (e.g. WV) point this at their own photo
 * endpoint; defaults to Villa's for existing callers.
 */
export default function PhotoThumb({ id, onClick, fetchUrl = fetchVillaPhotoUrl }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl;
    setUrl(null);
    setFailed(false);

    if (typeof id === 'string' && id.startsWith('local-')) {
      getPhoto(id)
        .then((fileOrBlob) => {
          if (!active) return;
          if (fileOrBlob) {
            objectUrl = URL.createObjectURL(fileOrBlob);
            setUrl(objectUrl);
          } else {
            setFailed(true);
          }
        })
        .catch((err) => {
          console.error('Error fetching local photo from store:', err);
          if (active) setFailed(true);
        });
    } else {
      fetchUrl(id)
        .then((u) => {
          if (!active) {
            URL.revokeObjectURL(u);
            return;
          }
          objectUrl = u;
          setUrl(u);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, fetchUrl]);

  if (failed) {
    return (
      <div className="photo-preview photo-preview-error" title="Photo failed to load" aria-label="Photo failed to load">
        !
      </div>
    );
  }

  if (!url) {
    return <div className="photo-preview photo-preview-skeleton" aria-hidden="true" />;
  }

  return (
    <img 
      className="photo-preview" 
      src={url} 
      alt="Defect photo" 
      onClick={() => onClick?.(url)} 
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(url);
        }
      }}
      role="button"
      tabIndex={0}
    />
  );
}
