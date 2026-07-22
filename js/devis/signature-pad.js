// ═══════════════════════════════════════════════════
// GlamBook — Pad de signature (Canvas HTML5, tactile + souris)
// Sans dépendance externe. Gère le HiDPI, le redimensionnement,
// et l'export en PNG dataURL (fond transparent).
// ═══════════════════════════════════════════════════

export class SignaturePad {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ penColor?:string, lineWidth?:number, onChange?:()=>void }} [opts]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.penColor = opts.penColor || '#111111';
    this.lineWidth = opts.lineWidth || 2.4;
    this.onChange = opts.onChange || (() => {});
    this._drawing = false;
    this._empty = true;
    this._last = null;

    this._bind();
    this.resize();
  }

  _bind() {
    const c = this.canvas;
    // Pointer events couvrent souris + tactile + stylet
    this._onDown = (e) => this._start(e);
    this._onMove = (e) => this._move(e);
    this._onUp   = () => this._end();

    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    // Empêche le scroll/zoom pendant qu'on signe sur mobile
    c.style.touchAction = 'none';

    this._onResize = () => this.resize(true);
    window.addEventListener('resize', this._onResize);
  }

  /** Coordonnées relatives au canvas, en pixels CSS. */
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _start(e) {
    e.preventDefault();
    this._drawing = true;
    this._last = this._pos(e);
    // point initial (permet de signer un simple point)
    const { x, y } = this._last;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.lineWidth / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = this.penColor;
    this.ctx.fill();
    if (this._empty) { this._empty = false; this.onChange(); }
  }

  _move(e) {
    if (!this._drawing) return;
    e.preventDefault();
    const p = this._pos(e);
    const ctx = this.ctx;
    ctx.strokeStyle = this.penColor;
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this._last.x, this._last.y);
    // courbe quadratique lissée
    const mid = { x: (this._last.x + p.x) / 2, y: (this._last.y + p.y) / 2 };
    ctx.quadraticCurveTo(this._last.x, this._last.y, mid.x, mid.y);
    ctx.stroke();
    this._last = p;
  }

  _end() {
    if (this._drawing) { this._drawing = false; this._last = null; }
  }

  /** Redimensionne le canvas à son conteneur en respectant le HiDPI. */
  resize(preserve = false) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const prev = preserve && !this._empty ? this.canvas.toDataURL('image/png') : null;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.scale(ratio, ratio);
    if (prev) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prev;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._empty = true;
    this.onChange();
  }

  isEmpty() { return this._empty; }

  /** Exporte la signature (PNG transparent). '' si vide. */
  toDataURL() {
    return this._empty ? '' : this.canvas.toDataURL('image/png');
  }

  /** Détache les écouteurs. */
  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('resize', this._onResize);
  }
}
