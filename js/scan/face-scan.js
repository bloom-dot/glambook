// ═══════════════════════════════════════════════════
// GlamBook — Scan visage réutilisable (caméra + guide de cadrage
// + auto-détection FaceDetector natif / MediaPipe, capture → dataURL)
// Injecte sa propre UI et ses styles dans un conteneur hôte.
// ═══════════════════════════════════════════════════

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  .fs-cam{position:relative;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:3/4;max-height:360px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;}
  .fs-cam video,.fs-cam img{width:100%;height:100%;object-fit:cover;}
  .fs-ph{color:#777;font-size:.9rem;text-align:center;padding:20px;}
  .fs-actions{display:flex;gap:10px;flex-wrap:wrap;}
  .fs-actions .btn{flex:1;}
  .fs-note{font-size:.74rem;color:var(--gris);text-align:center;margin:8px 0;}
  .fs-guide{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .3s;}
  .fs-cam.on .fs-guide{opacity:1;}
  .fs-oval{position:absolute;inset:0;width:100%;height:100%;}
  .fs-oval ellipse{fill:none;stroke:var(--rose);stroke-width:3;stroke-dasharray:10 12;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(232,84,122,.5));transform-origin:50% 50%;animation:fs-rot 6s linear infinite,fs-pulse 2s ease-in-out infinite;transition:stroke .4s,stroke-dasharray .4s;}
  @keyframes fs-rot{to{stroke-dashoffset:-88;}}
  @keyframes fs-pulse{0%,100%{opacity:.75;}50%{opacity:1;}}
  .fs-corner{position:absolute;width:20px;height:20px;border:3px solid rgba(255,255,255,.55);transition:border-color .4s,transform .4s;}
  .fs-corner.tl{top:12px;left:12px;border-right:0;border-bottom:0;border-radius:6px 0 0 0;}
  .fs-corner.tr{top:12px;right:12px;border-left:0;border-bottom:0;border-radius:0 6px 0 0;}
  .fs-corner.bl{bottom:12px;left:12px;border-right:0;border-top:0;border-radius:0 0 0 6px;}
  .fs-corner.br{bottom:12px;right:12px;border-left:0;border-top:0;border-radius:0 0 6px 0;}
  .fs-scan{position:absolute;left:8%;right:8%;height:2px;top:14%;background:linear-gradient(90deg,transparent,var(--or),transparent);box-shadow:0 0 12px 2px rgba(212,175,55,.5);animation:fs-sweep 2.4s ease-in-out infinite;}
  @keyframes fs-sweep{0%{top:14%;opacity:0;}15%{opacity:1;}85%{opacity:1;}100%{top:86%;opacity:0;}}
  .fs-check{position:absolute;left:50%;top:46%;width:60px;height:60px;transform:translate(-50%,-50%) scale(.4);opacity:0;transition:opacity .3s,transform .3s cubic-bezier(.2,1.4,.4,1);}
  .fs-check circle{fill:none;stroke:#22B573;stroke-width:3;opacity:.25;}
  .fs-check path{fill:none;stroke:#22B573;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:44;stroke-dashoffset:44;transition:stroke-dashoffset .4s ease .1s;}
  .fs-hint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:999px;background:rgba(17,17,17,.6);color:#fff;font-size:.76rem;font-weight:700;white-space:nowrap;backdrop-filter:blur(4px);transition:background .4s;}
  .fs-hint .dot{width:7px;height:7px;border-radius:50%;background:var(--rose);animation:fs-blink 1.2s ease-in-out infinite;}
  @keyframes fs-blink{0%,100%{opacity:.35;}50%{opacity:1;}}
  .fs-cam.detected .fs-oval ellipse{stroke:#22B573;stroke-dasharray:0;opacity:1;filter:drop-shadow(0 0 8px rgba(34,181,115,.55));animation:none;}
  .fs-cam.detected .fs-scan{opacity:0;animation:none;}
  .fs-cam.detected .fs-corner{border-color:#22B573;transform:scale(.92);}
  .fs-cam.detected .fs-check{opacity:1;transform:translate(-50%,-50%) scale(1);}
  .fs-cam.detected .fs-check path{stroke-dashoffset:0;}
  .fs-cam.detected .fs-hint{background:rgba(27,138,75,.85);}
  .fs-cam.detected .fs-hint .dot{background:#fff;animation:none;}
  .fs-cam.no-detect .fs-scan{display:none;}
  .fs-hidden{display:none!important;}
  @media(prefers-reduced-motion:reduce){.fs-oval ellipse,.fs-scan,.fs-hint .dot{animation:none!important;}}
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
}

const TEMPLATE = `
  <div class="fs-cam" data-cam>
    <div class="fs-ph" data-ph>Activez la caméra ou importez une photo</div>
    <video autoplay playsinline class="fs-hidden" data-video></video>
    <img class="fs-hidden" alt="Aperçu" data-shot/>
    <div class="fs-guide">
      <span class="fs-corner tl"></span><span class="fs-corner tr"></span>
      <span class="fs-corner bl"></span><span class="fs-corner br"></span>
      <svg class="fs-oval" viewBox="0 0 200 260"><ellipse cx="100" cy="130" rx="78" ry="104"/></svg>
      <div class="fs-scan"></div>
      <svg class="fs-check" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27 l7 7 l15 -16"/></svg>
      <div class="fs-hint"><span class="dot"></span><span data-hint>Centrez le visage</span></div>
    </div>
  </div>
  <p class="fs-note" data-note></p>
  <div class="fs-actions">
    <button type="button" class="btn btn-secondary" data-cam-btn>📷 Caméra</button>
    <button type="button" class="btn btn-primary fs-hidden" data-capture>Prendre la photo</button>
    <label class="btn btn-ghost" data-import-label style="margin:0;">🖼️ Importer<input type="file" accept="image/*" capture="user" class="fs-hidden" data-file/></label>
    <button type="button" class="btn btn-ghost btn-sm fs-hidden" data-retake>↺ Reprendre</button>
  </div>
  <canvas class="fs-hidden" data-canvas></canvas>
`;

/**
 * Monte un scanner de visage dans hostEl.
 * @param {HTMLElement} hostEl
 * @param {{ onCapture:(dataUrl:string)=>void, maxSize?:number }} opts
 * @returns {{ stop:()=>void, reset:()=>void }}
 */
export function createFaceScan(hostEl, opts = {}) {
  injectStyles();
  hostEl.innerHTML = TEMPLATE;
  const q = (s) => hostEl.querySelector(s);
  const cam = q('[data-cam]'), video = q('[data-video]'), shot = q('[data-shot]'),
        ph = q('[data-ph]'), hint = q('[data-hint]'), note = q('[data-note]'),
        canvas = q('[data-canvas]'), camBtn = q('[data-cam-btn]'),
        captureBtn = q('[data-capture]'), fileInput = q('[data-file]'), retakeBtn = q('[data-retake]');
  const MAX = opts.maxSize || 768;
  const onCapture = opts.onCapture || (() => {});

  let stream = null, detectApi = null, timer = null, stable = 0, autoShot = false;

  const setHint = (t) => { hint.textContent = t; };
  const show = (el) => el.classList.remove('fs-hidden');
  const hide = (el) => el.classList.add('fs-hidden');

  camBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream; show(video); hide(ph); hide(shot);
      captureBtn.style.display = ''; show(captureBtn);
      await startDetection();
    } catch (e) { console.error(e); note.textContent = "Caméra inaccessible. Importez une photo."; }
  };
  captureBtn.onclick = () => capture();
  retakeBtn.onclick = () => reset();
  fileInput.onchange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const img = new Image();
    img.onload = () => usePhoto(frameToDataUrl(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => { note.textContent = 'Image illisible.'; };
    img.src = URL.createObjectURL(file);
  };

  function capture() {
    if (!video.videoWidth) return;
    usePhoto(frameToDataUrl(video, video.videoWidth, video.videoHeight));
  }

  function frameToDataUrl(src, w, h) {
    const scale = Math.min(1, MAX / Math.max(w, h));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    canvas.width = cw; canvas.height = ch;
    canvas.getContext('2d').drawImage(src, 0, 0, cw, ch);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function usePhoto(dataUrl) {
    stopCam();
    hide(video); hide(ph); captureBtn.style.display = 'none';
    shot.src = dataUrl; show(shot); show(retakeBtn);
    onCapture(dataUrl);
  }

  async function startDetection() {
    cam.classList.add('on'); cam.classList.remove('detected');
    stable = 0; autoShot = false;
    setHint('Initialisation…'); note.textContent = 'Préparation de la détection…';
    detectApi = await buildDetector();
    if (!detectApi) {
      cam.classList.add('no-detect');
      setHint('Cadrez le visage dans l’ovale');
      note.textContent = 'Placez le visage dans l’ovale, puis « Prendre la photo ».';
      return;
    }
    cam.classList.remove('no-detect');
    setHint('Centrez le visage dans l’ovale');
    note.textContent = 'Détection automatique : la photo se prend seule une fois le visage bien cadré.';
    timer = setInterval(runDetect, 300);
  }

  async function buildDetector() {
    if ('FaceDetector' in window) {
      try {
        const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        return { async detect(v){ const f = await fd.detect(v); if(!f.length) return null; const b=f[0].boundingBox; return {x:b.x,y:b.y,width:b.width,height:b.height}; }, close(){} };
      } catch (_) {}
    }
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
      const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      const det = await vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
        runningMode: 'VIDEO', minDetectionConfidence: 0.5,
      });
      return { detect(v){ const r=det.detectForVideo(v,performance.now()); const d=r.detections&&r.detections[0]; if(!d) return null; const b=d.boundingBox; return {x:b.originX,y:b.originY,width:b.width,height:b.height}; }, close(){ try{det.close();}catch(_){}} };
    } catch (e) { console.warn('MediaPipe indispo', e); return null; }
  }

  async function runDetect() {
    if (!video.videoWidth || !detectApi) return;
    let box = null;
    try { box = await detectApi.detect(video); } catch { return; }
    const ok = box && wellFramed(box, video.videoWidth, video.videoHeight);
    cam.classList.toggle('detected', ok);
    setHint(ok ? 'Visage bien cadré ✓' : 'Centrez le visage dans l’ovale');
    if (ok) { if (++stable >= 5 && !autoShot) { autoShot = true; setHint('Parfait, on prend la photo…'); setTimeout(capture, 400); } }
    else stable = 0;
  }

  function wellFramed(b, vw, vh) {
    const cx = (b.x + b.width/2)/vw, cy = (b.y + b.height/2)/vh, size = b.width/vw;
    return cx > 0.32 && cx < 0.68 && cy > 0.28 && cy < 0.72 && size > 0.22;
  }

  function stopDetection() {
    if (timer) { clearInterval(timer); timer = null; }
    if (detectApi) { try { detectApi.close(); } catch (_) {} detectApi = null; }
    stable = 0; autoShot = false;
    cam.classList.remove('on', 'detected', 'no-detect');
  }

  function stopCam() {
    stopDetection();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    captureBtn.style.display = 'none';
  }

  function reset() {
    stopCam();
    hide(shot); shot.removeAttribute('src'); hide(retakeBtn);
    show(ph); note.textContent = ''; fileInput.value = '';
  }

  return { stop: stopCam, reset };
}
