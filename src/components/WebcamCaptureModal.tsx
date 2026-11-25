import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { ATTACHMENT_CATEGORY_LABELS, type AttachmentCategory, type DealAttachment } from '../types';

interface Props {
  dealId: number;
  defaultCategory?: AttachmentCategory;
  defaultLabel?: string;
  onClose: () => void;
  onSaved: (attachment: DealAttachment) => void;
}

export default function WebcamCaptureModal({
  dealId,
  defaultCategory = 'CNIC_FRONT',
  defaultLabel = '',
  onClose,
  onSaved,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [category, setCategory] = useState<AttachmentCategory>(defaultCategory);
  const [label, setLabel] = useState(defaultLabel);

  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [highContrast, setHighContrast] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera(deviceId?: string) {
      setError('');
      setCameraReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          if (active) setCameraReady(true);
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        if (active) {
          setDevices(videoInputs);
          if (!deviceId && videoInputs.length > 0) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? `Camera error: ${err.message}`
              : 'Could not access webcam. Please check camera permissions.',
          );
        }
      }
    }

    if (!capturedUrl) {
      void startCamera(selectedDeviceId || undefined);
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [selectedDeviceId, capturedUrl]);

  function handleSnap() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (width === 0 || height === 0) {
      setError('Camera frame is still initializing. Wait a second and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    setRotation(0);
    setCapturedUrl(canvas.toDataURL('image/jpeg', 0.92));
  }

  function renderProcessedDataUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!capturedUrl) return reject(new Error('No image captured'));
      const img = new Image();
      img.onload = () => {
        const swap = rotation === 90 || rotation === 270;
        const canvas = document.createElement('canvas');
        canvas.width = swap ? img.height : img.width;
        canvas.height = swap ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));

        if (highContrast) {
          ctx.filter = 'contrast(1.35) brightness(1.05) grayscale(0.25)';
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Failed to process image'));
      img.src = capturedUrl;
    });
  }

  async function handleSave() {
    if (!window.api || !capturedUrl || saving) return;
    setSaving(true);
    setError('');
    try {
      const processed = await renderProcessedDataUrl();
      const docLabel = label.trim() || ATTACHMENT_CATEGORY_LABELS[category];
      const saved = await window.api.saveWebcamAttachment(dealId, category, docLabel, processed);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Modal
        title="Capture Document via Webcam"
        subtitle="Snap CNIC, Smart Card, Registration Book, or Biometric Slip"
        onClose={onClose}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {!capturedUrl ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSnap}
                disabled={!!error || !cameraReady}
              >
                📸 Snap Photo
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setCapturedUrl(null)}>
                  Retake
                </button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? 'Saving…' : 'Save Attachment'}
                </button>
              </>
            )}
          </>
        }
      >
        <div
          className="space-y-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Document Type, Label & Camera Selector */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Document Type</label>
              <select
                className="input text-xs"
                value={category}
                onChange={(e) => {
                  e.stopPropagation();
                  setCategory(e.target.value as AttachmentCategory);
                }}
              >
                {(Object.keys(ATTACHMENT_CATEGORY_LABELS) as AttachmentCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {ATTACHMENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Label (Optional)</label>
              <input
                type="text"
                className="input text-xs"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Buyer CNIC Front"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Camera</label>
              <select
                className="input text-xs"
                value={selectedDeviceId}
                disabled={devices.length <= 1 || !!capturedUrl}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedDeviceId(e.target.value);
                }}
              >
                {devices.length === 0 ? (
                  <option value="">Default Camera</option>
                ) : (
                  devices.map((d, idx) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Camera Viewport / Captured Preview */}
          <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
            {error ? (
              <div className="px-6 text-center text-xs text-red-300">{error}</div>
            ) : !capturedUrl ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setCameraReady(true)}
                  className="max-h-[380px] w-full object-contain"
                />
                {/* ID / Smart Card Alignment Frame Overlay */}
                <div className="pointer-events-none absolute inset-6 flex items-center justify-center">
                  <div className="h-4/5 w-4/5 max-w-md rounded-xl border-2 border-dashed border-emerald-400/75 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]">
                    <div className="mt-2 text-center text-[11px] font-semibold text-emerald-300 drop-shadow">
                      Align CNIC / Smart Card / Book inside frame
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <img
                src={capturedUrl}
                alt="Captured document preview"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  filter: highContrast ? 'contrast(1.35) brightness(1.05) grayscale(0.25)' : 'none',
                }}
                className="max-h-[360px] object-contain transition-transform"
              />
            )}
          </div>

          {/* Post-Snap Enhancement Toolbar */}
          {capturedUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
              <span className="font-semibold text-slate-600">Adjust before saving:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm text-xs"
                  onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
                >
                  ↻ Rotate 90°
                </button>
                <button
                  type="button"
                  onClick={() => setHighContrast((h) => !h)}
                  className={`btn btn-sm text-xs ${
                    highContrast ? 'bg-brand-600 text-white' : 'btn-secondary'
                  }`}
                >
                  {highContrast ? '✓ High-Contrast Text On' : 'Enhance Document Text'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}