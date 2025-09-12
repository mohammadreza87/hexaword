import { CrosswordGenerator } from '../../web-view/services/CrosswordGenerator';
import { HexRenderer } from '../../web-view/engine/HexRenderer';
import { ColorPaletteService } from '../../web-view/services/ColorPaletteService';
import { getPaletteForLevel } from '../../web-view/config/ColorPalettes';
import { ShareDialog } from './ShareDialog';
import { loadingOverlay } from '../utils/LoadingOverlay';
import type { HexCell } from '../../shared/types/hexaword';

type CreateResult = { playNowId?: string } | null;

export class LevelCreator {
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private renderer!: HexRenderer;
  private clueInput!: HTMLInputElement;
  private nameInput!: HTMLInputElement;
  private wordInputs: HTMLInputElement[] = [];
  private errorEl!: HTMLDivElement;
  private previewSeed: string = `draft_${Date.now()}`;
  private generator = new CrosswordGenerator({ gridRadius: 10, seed: this.previewSeed });
  private step: 'form' | 'preview' = 'form';
  private colorPaletteService: ColorPaletteService;
  private previewLevel: number = 1;

  async show(): Promise<CreateResult> {
    // Initialize color service
    this.colorPaletteService = ColorPaletteService.getInstance();
    // Use a random level for preview colors (1-20)
    this.previewLevel = Math.floor(Math.random() * 20) + 1;
    
    this.buildUI();
    document.body.appendChild(this.overlay);
    this.bindEvents();
    return new Promise<CreateResult>((resolve) => {
      const onClose = (r: CreateResult) => { this.overlay.remove(); resolve(r); };
      // Bind all cancel buttons (both steps)
      this.panel.querySelectorAll('#lc-cancel').forEach((el) => {
        (el as HTMLButtonElement).onclick = () => onClose(null);
      });
      // Step navigation
      (this.panel.querySelector('#lc-next') as HTMLButtonElement).onclick = async () => {
        const payload = this.collect();
        const valid = this.validate(payload);
        if (!valid.ok) { this.showError(valid.msg); return; }
        this.step = 'preview';
        await this.renderPreview(payload.words);
        this.showPreviewPage();
      };
      (this.panel.querySelector('#lc-back') as HTMLButtonElement).onclick = () => {
        this.step = 'form';
        this.showFormPage();
      };
      (this.panel.querySelector('#lc-save') as HTMLButtonElement).onclick = async () => {
        const payload = this.collect();
        const valid = this.validate(payload);
        if (!valid.ok) { this.showError(valid.msg); return; }
        
        // Log the payload being sent
        console.log('Sending level data:', payload);
        
        loadingOverlay.show('Saving your level...');
        
        try {
          const res = await fetch('/api/user-levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!res.ok) {
            const data = await res.json().catch(() => ({} as any));
            console.error('Save failed:', res.status, data);
            this.showError(data?.error?.message || `Failed to save level (${res.status})`);
            
            // Show validation details if available
            if (data?.error?.details) {
              console.error('Validation errors:', data.error.details);
            }
            loadingOverlay.hide();
            return;
          }
          const data = await res.json();
          
          loadingOverlay.hide();
          
          // Close the creator overlay first
          this.overlay.remove();
          
          // Show share dialog
          const shareDialog = new ShareDialog(data.id, payload.name, payload.clue);
          const shareResult = await shareDialog.show();
          
          if (shareResult.action === 'play') {
            // User wants to play the level
            resolve({ playNowId: data.id });
          } else {
            // User closed or went back to levels
            resolve(null);
          }
        } catch (e) {
          loadingOverlay.hide();
          this.showError('Network error while saving');
        }
      };
      // No shuffle on step 2 per requirements
    });
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.panel = document.createElement('div');
    this.panel.className = 'modal-content panel-hex max-w-xl';
    this.panel.style.maxHeight = '70vh';
    this.panel.style.overflowY = 'auto';
    this.panel.style.transform = 'scale(0.85)';
    this.panel.innerHTML = `
      <div class="text-center mb-2">
        <div class="text-xl tracking-wide text-hw-text-primary">Create Level</div>
        <div class="text-xs text-hw-text-secondary">Step 1: Enter level details</div>
      </div>
      <div id="lc-error" class="text-red-400 text-xs mb-2" style="min-height:16px;"></div>
      <div id="lc-step-form">
        <div class="grid gap-2 mb-3">
          <div class="relative">
            <input id="lc-name" placeholder="Level name" maxlength="30" class="input text-sm py-2" style="text-transform: uppercase;" />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-hw-text-secondary/50" style="font-size: 10px;">
              <span id="lc-name-count">0</span>/30
            </div>
          </div>
          <div class="relative">
            <input id="lc-clue" placeholder="Theme or clue" maxlength="30" class="input text-sm py-2" style="text-transform: uppercase;" />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-hw-text-secondary/50" style="font-size: 10px;">
              <span id="lc-clue-count">0</span>/30
            </div>
          </div>
          <div class="border-t border-hw-surface-tertiary/30 pt-2">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs text-hw-text-secondary">Words</span>
              <span class="text-xs text-hw-text-secondary/60" style="font-size: 10px;">Min 1, Max 6</span>
            </div>
            <div id="lc-words" class="grid gap-1.5" style="max-height: 200px; overflow-y: auto; padding-right: 4px;"></div>
          </div>
          <button id="lc-add" class="btn-add-word w-full sticky bottom-0 bg-opacity-95 py-2 text-sm">
            <span style="font-size: 14px;">+</span>
            <span>Add Word</span>
          </button>
        </div>
        <div class="flex gap-2 justify-end sticky bottom-0 bg-opacity-95" style="background: inherit; padding-top: 6px; margin-top: -4px;">
          <button id="lc-next" class="btn-glass-primary py-1.5 text-sm">Next</button>
          <button id="lc-cancel" class="btn-glass py-1.5 text-sm">Cancel</button>
        </div>
      </div>
      <div id="lc-step-preview" class="hidden">
        <div class="text-xs text-hw-text-secondary mb-2">Step 2: Preview & Confirm</div>
        <div class="mb-2 relative" style="max-height: calc(70vh - 160px); overflow-y: auto;">
          <canvas id="lc-canvas" width="480" height="340" style="width:100%;height:200px;background:#0F1115;border:1px solid rgba(255,255,255,.08);border-radius:8px;"></canvas>
          <div id="lc-clue-preview" class="absolute top-2 left-0 right-0 text-center" style="pointer-events:none;"></div>
        </div>
        <div class="flex gap-2 justify-end sticky bottom-0" style="background: inherit; padding-top: 6px;">
          <button id="lc-save" class="btn-glass-primary py-1.5 text-sm">Save</button>
          <button id="lc-back" class="btn-glass py-1.5 text-sm">Back</button>
          <button id="lc-cancel" class="btn-glass py-1.5 text-sm">Cancel</button>
        </div>
      </div>
    `;
    this.overlay.appendChild(this.panel);
    this.clueInput = this.panel.querySelector('#lc-clue') as HTMLInputElement;
    this.nameInput = this.panel.querySelector('#lc-name') as HTMLInputElement;
    this.errorEl = this.panel.querySelector('#lc-error') as HTMLDivElement;
    // prepare renderer lazily in preview step
    // Seed with 3 inputs with simple placeholders
    const wordsWrap = this.panel.querySelector('#lc-words') as HTMLDivElement;
    const placeholders = [
      'First word',
      'Second word',
      'Third word'
    ];
    for (let i = 0; i < 3; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative';
      
      const inp = document.createElement('input');
      inp.placeholder = placeholders[i];
      inp.maxLength = 12;
      inp.className = 'input-word text-sm py-2';
      inp.dataset.index = String(i);
      
      const counter = document.createElement('div');
      counter.className = 'absolute right-2 top-1/2 -translate-y-1/2 text-xs text-hw-text-secondary/50';
      counter.style.fontSize = '10px';
      counter.innerHTML = `<span class="word-count" data-index="${i}">0</span>/12`;
      
      wrapper.appendChild(inp);
      wrapper.appendChild(counter);
      wordsWrap.appendChild(wrapper);
      this.wordInputs.push(inp);
    }
  }

  private bindEvents(): void {
    // Character counter for name and clue
    this.nameInput?.addEventListener('input', () => {
      const counter = this.panel.querySelector('#lc-name-count');
      if (counter) counter.textContent = String(this.nameInput.value.length);
    });
    
    this.clueInput?.addEventListener('input', () => {
      const counter = this.panel.querySelector('#lc-clue-count');
      if (counter) counter.textContent = String(this.clueInput.value.length);
    });
    
    // Check if words container needs scroll indicators
    const checkScrollIndicators = () => {
      const wordsContainer = this.panel.querySelector('#lc-words') as HTMLDivElement;
      if (wordsContainer) {
        if (wordsContainer.scrollHeight > wordsContainer.clientHeight) {
          wordsContainer.classList.add('has-scroll');
        } else {
          wordsContainer.classList.remove('has-scroll');
        }
      }
    };
    
    (this.panel.querySelector('#lc-add') as HTMLButtonElement).onclick = () => {
      if (this.wordInputs.length >= 6) {
        this.showError('⚠️ Maximum 6 words allowed');
        return;
      }
      const wrap = this.panel.querySelector('#lc-words') as HTMLDivElement;
      const index = this.wordInputs.length;
      
      const wrapper = document.createElement('div');
      wrapper.className = 'relative animate-fade-in';
      
      const inp = document.createElement('input');
      inp.placeholder = `Word ${index + 1}`;
      inp.maxLength = 12;
      inp.className = 'input-word text-sm py-2';
      inp.dataset.index = String(index);
      
      const counter = document.createElement('div');
      counter.className = 'absolute right-2 top-1/2 -translate-y-1/2 text-xs text-hw-text-secondary/50';
      counter.style.fontSize = '10px';
      counter.innerHTML = `<span class="word-count" data-index="${index}">0</span>/12`;
      
      // Add remove button for words beyond the initial 3
      if (index >= 3) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'absolute right-8 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 transition-colors';
        removeBtn.style.fontSize = '14px';
        removeBtn.innerHTML = '✕';
        removeBtn.onclick = () => {
          wrapper.remove();
          const idx = this.wordInputs.indexOf(inp);
          if (idx > -1) this.wordInputs.splice(idx, 1);
          // Check if scroll indicators are still needed
          setTimeout(checkScrollIndicators, 100);
        };
        wrapper.appendChild(removeBtn);
      }
      
      wrapper.appendChild(inp);
      wrapper.appendChild(counter);
      wrap.appendChild(wrapper);
      this.wordInputs.push(inp);
      
      // Add input listener for character counter
      inp.addEventListener('input', () => {
        const wordCounter = wrapper.querySelector('.word-count');
        if (wordCounter) wordCounter.textContent = String(inp.value.length);
      });
      
      // Apply uppercase enforcement
      this.enforceUppercase(inp, false);
      
      // Focus the new input and scroll into view
      inp.focus();
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Check if scroll indicators are needed
      setTimeout(checkScrollIndicators, 100);
    };
    // Enforce uppercase letters
    this.nameInput && this.enforceUppercase(this.nameInput, true);
    this.clueInput && this.enforceUppercase(this.clueInput, true);
    
    // Existing word inputs
    this.wordInputs.forEach((w) => {
      this.enforceUppercase(w, false);
      // Add input listener for character counter
      w.addEventListener('input', () => {
        const index = w.dataset.index;
        const counter = this.panel.querySelector(`.word-count[data-index="${index}"]`);
        if (counter) counter.textContent = String(w.value.length);
      });
    });
  }

  private collect(): { name?: string; clue: string; words: string[] } {
    const name = (this.nameInput.value || '').trim();
    const clue = (this.clueInput.value || '').trim();
    const words = this.wordInputs
      .map((w) => (w.value || '').trim().toUpperCase().replace(/[^A-Z]/g, ''))
      .filter((w) => w.length >= 2);
    // Deduplicate
    const uniq: string[] = [];
    for (const w of words) if (!uniq.includes(w)) uniq.push(w);
    return { 
      name: name.length > 0 ? name : undefined,
      clue, 
      words: uniq.slice(0, 6) 
    };
  }

  private validate(payload: { clue: string; words: string[] }): { ok: boolean; msg?: string } {
    // More detailed error messages
    if (payload.clue.length < 3) {
      return { ok: false, msg: '❌ Clue too short - needs at least 3 characters' };
    }
    if (payload.clue.length > 30) {
      return { ok: false, msg: '❌ Clue too long - maximum 30 characters' };
    }
    if (payload.words.length < 1) {
      return { ok: false, msg: '❌ No words entered - add at least 1 word to create a puzzle' };
    }
    if (payload.words.length > 6) {
      return { ok: false, msg: '❌ Too many words - maximum 6 words allowed' };
    }
    
    // Check each word with specific error messages
    for (let i = 0; i < payload.words.length; i++) {
      const w = payload.words[i];
      if (w.length < 2) {
        return { ok: false, msg: `❌ Word ${i + 1} "${w}" is too short - needs at least 2 letters` };
      }
      if (w.length > 12) {
        return { ok: false, msg: `❌ Word ${i + 1} "${w}" is too long - maximum 12 letters` };
      }
      if (!/^[A-Z]+$/.test(w)) {
        return { ok: false, msg: `❌ Word ${i + 1} contains invalid characters - use only A-Z` };
      }
    }
    
    // Check for duplicates
    const uniqueWords = new Set(payload.words);
    if (uniqueWords.size !== payload.words.length) {
      return { ok: false, msg: '❌ Duplicate words found - each word must be unique' };
    }
    
    // Check if words share letters for intersections
    const letterSets = payload.words.map(w => new Set(w.split('')));
    let hasSharedLetters = false;
    
    for (let i = 0; i < letterSets.length; i++) {
      for (let j = i + 1; j < letterSets.length; j++) {
        for (const letter of letterSets[i]) {
          if (letterSets[j].has(letter)) {
            hasSharedLetters = true;
            break;
          }
        }
        if (hasSharedLetters) break;
      }
      if (hasSharedLetters) break;
    }
    
    if (!hasSharedLetters && payload.words.length > 1) {
      return { ok: false, msg: '⚠️ Words don\'t share any letters - puzzle may not connect properly' };
    }
    
    return { ok: true };
  }

  private async renderPreview(words: string[]): Promise<void> {
    try {
      const result = await this.generator.generate(words);
      
      // Init canvas/renderer on first preview
      if (!this.canvas) this.canvas = this.panel.querySelector('#lc-canvas') as HTMLCanvasElement;
      if (!this.ctx) {
        const ctx = this.canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Canvas 2D context failed');
        this.ctx = ctx;
        this.renderer = new HexRenderer(this.ctx);
      }
      
      // Apply color theme to renderer
      await this.colorPaletteService.setLevel(this.previewLevel);
      await this.renderer.setLevel(this.previewLevel);
      
      // Get current color scheme for background
      const colors = await this.colorPaletteService.getCurrentScheme();
      this.canvas.style.backgroundColor = colors.background;
      
      // Clear and render using game renderer with proper colors
      const rect = { width: this.canvas.width, height: this.canvas.height };
      this.renderer.clear(rect.width, rect.height);
      
      // Calculate dynamic hex size for better fit
      const bounds = this.calculateBounds(result.board);
      const padding = 40;
      const availableWidth = rect.width - padding * 2;
      const availableHeight = rect.height - padding * 2;
      
      // Calculate hex size based on board dimensions
      const boardWidth = (bounds.maxQ - bounds.minQ + 1) * 1.5;
      const boardHeight = (bounds.maxR - bounds.minR + 1) * 1.732;
      const hexSize = Math.min(
        20,
        Math.floor(Math.min(availableWidth / boardWidth, availableHeight / boardHeight))
      );
      
      // Center grid
      const centerX = rect.width / 2;
      const centerY = rect.height / 2 + 20; // Offset down for clue
      const board: Map<string, HexCell> = result.board as any;
      
      this.renderer.updateConfig({ hexSize });
      this.renderer.renderGrid(board, centerX, centerY, new Set());
      
      // Render the clue at the top with theme colors
      this.renderCluePreview(colors);
      
      // Update error message with better feedback
      this.errorEl.textContent = '';
      if (!result.success) {
        const placedCount = result.placedWords.length;
        const totalCount = words.length;
        if (placedCount === 0) {
          this.showError('⚠️ Could not place any words. Words may not share enough letters.');
        } else if (placedCount < totalCount) {
          this.showError(`⚠️ Only ${placedCount} of ${totalCount} words could be placed. Some words may not connect well.`);
        }
      } else {
        // Show success message
        this.errorEl.textContent = '✅ All words placed successfully!';
        this.errorEl.style.color = '#4ade80';
        setTimeout(() => {
          this.errorEl.style.color = '';
        }, 100);
      }
    } catch (e) {
      this.showError('❌ Failed to generate preview. Please check your words.');
      console.error('Preview generation error:', e);
    }
  }
  
  private calculateBounds(board: Map<string, HexCell>): { minQ: number; maxQ: number; minR: number; maxR: number } {
    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;
    
    board.forEach(cell => {
      if (cell.letter) {
        minQ = Math.min(minQ, cell.q);
        maxQ = Math.max(maxQ, cell.q);
        minR = Math.min(minR, cell.r);
        maxR = Math.max(maxR, cell.r);
      }
    });
    
    return { minQ, maxQ, minR, maxR };
  }
  
  private renderCluePreview(colors: any): void {
    const clueEl = this.panel.querySelector('#lc-clue-preview') as HTMLDivElement;
    if (!clueEl) return;
    
    const clue = (this.clueInput.value || '').trim().toUpperCase();
    if (!clue) {
      clueEl.textContent = '';
      return;
    }
    
    // Get palette colors for gradient
    const palette = getPaletteForLevel(this.previewLevel);
    const gradient = `linear-gradient(90deg, ${palette.colors[0]}, ${palette.colors[1]})`;
    
    clueEl.innerHTML = `
      <div style="
        font-size: 18px;
        font-weight: 900;
        font-family: 'Inter', Arial, sans-serif;
        background: ${gradient};
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-transform: uppercase;
        letter-spacing: 1px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${clue}</div>
    `;
  }

  private drawHex(cx: number, cy: number, r: number, fill: string, stroke: string, letter?: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
    if (letter) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(10, Math.floor(r))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, cy);
    }
    ctx.restore();
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg;
    this.errorEl.style.color = '#ef4444'; // Red color for errors
    // Add subtle animation
    this.errorEl.style.animation = 'shake 0.3s';
    setTimeout(() => {
      this.errorEl.style.animation = '';
    }, 300);
  }
  
  private enforceUppercase(el: HTMLInputElement, allowSpace: boolean): void {
    el.addEventListener('input', () => {
      let v = (el.value || '').toUpperCase();
      v = v.replace(allowSpace ? /[^A-Z ]+/g : /[^A-Z]+/g, '');
      el.value = v;
    });
  }

  private showFormPage(): void {
    const form = this.panel.querySelector('#lc-step-form') as HTMLDivElement;
    const prev = this.panel.querySelector('#lc-step-preview') as HTMLDivElement;
    form.classList.remove('hidden');
    prev.classList.add('hidden');
  }

  private showPreviewPage(): void {
    const form = this.panel.querySelector('#lc-step-form') as HTMLDivElement;
    const prev = this.panel.querySelector('#lc-step-preview') as HTMLDivElement;
    form.classList.add('hidden');
    prev.classList.remove('hidden');
  }
}
