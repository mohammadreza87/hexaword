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
    console.log('LevelCreator.show() called');
    // Initialize color service
    this.colorPaletteService = ColorPaletteService.getInstance();
    // Use a random level for preview colors (1-20)
    this.previewLevel = Math.floor(Math.random() * 20) + 1;
    
    this.buildUI();
    console.log('UI built, appending to body...');
    document.body.appendChild(this.overlay);
    
    // Ensure visibility
    this.overlay.style.display = 'flex';
    this.overlay.style.zIndex = '10001';
    if (this.panel) {
      this.panel.style.display = 'block';
      this.panel.style.zIndex = '10002';
    }
    console.log('Overlay appended, binding events...');
    this.bindEvents();
    console.log('Events bound, returning promise...');
    return new Promise<CreateResult>((resolve) => {
      const onClose = (r: CreateResult) => { this.overlay.remove(); resolve(r); };
      
      // Close button handler (header)
      const closeBtn = this.panel.querySelector('#lc-close-header') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.addEventListener('click', () => onClose(null));
      }
      
      // Cancel button handler (step 2)
      const cancelBtn = this.panel.querySelector('#lc-cancel') as HTMLButtonElement;
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => onClose(null));
      }
      
      // Step navigation
      const nextBtn = this.panel.querySelector('#lc-next') as HTMLButtonElement;
      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
        const payload = this.collect();
        const valid = this.validate(payload);
        if (!valid.ok) { this.showError(valid.msg); return; }
        this.step = 'preview';
        await this.renderPreview(payload.words);
          this.showPreviewPage();
        });
      }
      
      const backBtn = this.panel.querySelector('#lc-back') as HTMLButtonElement;
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          this.step = 'form';
          this.showFormPage();
        });
      }
      
      const saveBtn = this.panel.querySelector('#lc-save') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
        const payload = this.collect();
        const valid = this.validate(payload);
        if (!valid.ok) { this.showError(valid.msg); return; }
        
        // Log the payload being sent
        // console.log('Sending level data:', payload);
        
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
        });
      }
    });
  }

  private buildUI(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 z-[10000]';
    this.overlay.style.display = 'block';
    
    this.panel = document.createElement('div');
    this.panel.className = 'absolute inset-0 bg-gradient-to-br from-hw-surface-primary to-hw-surface-secondary overflow-hidden';
    
    this.panel.innerHTML = `
      <!-- Header -->
      <div class="bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white">✏️ Create Level</h2>
            <p class="text-purple-200 text-xs mt-0.5">Step 1: Enter level details</p>
          </div>
          <button id="lc-close-header" class="text-white/80 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 5L5 15M5 5l10 10"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Content Area -->
      <div class="overflow-y-auto" style="height: calc(100vh - 80px);">
        <div class="max-w-2xl mx-auto p-6">
          <div id="lc-error" class="text-red-400 text-sm mb-3 text-center" style="min-height:20px;"></div>
          
          <!-- Step 1: Form -->
          <div id="lc-step-form">
            <div class="space-y-4">
              <!-- Name Input -->
              <div class="bg-black/20 rounded-lg p-4">
                <label class="block text-sm text-purple-200 mb-2">Level Name (Optional)</label>
                <div class="relative">
                  <input id="lc-name" placeholder="Enter level name" maxlength="30" 
                         class="w-full bg-black/30 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-purple-500 focus:outline-none text-sm uppercase" />
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    <span id="lc-name-count">0</span>/30
                  </div>
                </div>
              </div>
              
              <!-- Clue Input -->
              <div class="bg-black/20 rounded-lg p-4">
                <label class="block text-sm text-purple-200 mb-2">Theme or Clue (Required)</label>
                <div class="relative">
                  <input id="lc-clue" placeholder="Enter theme or clue" maxlength="30" 
                         class="w-full bg-black/30 text-white px-4 py-3 rounded-lg border border-white/10 focus:border-purple-500 focus:outline-none text-sm uppercase" />
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    <span id="lc-clue-count">0</span>/30
                  </div>
                </div>
              </div>
              
              <!-- Words Section -->
              <div class="bg-black/20 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm text-purple-200">Words</label>
                  <span class="text-xs text-gray-500">Min 1, Max 6</span>
                </div>
                <div id="lc-words" class="space-y-2 mb-3" style="max-height: 300px; overflow-y: auto;"></div>
                <button id="lc-add" class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-2.5 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-sm">
                  <span class="text-lg">+</span>
                  <span>Add Word</span>
                </button>
              </div>
              
              <!-- Action Buttons -->
              <div class="flex gap-3 justify-end pt-4">
                <button id="lc-cancel" class="px-6 py-2.5 rounded-lg bg-gray-600/50 hover:bg-gray-600/70 text-white font-semibold text-sm transition-colors">
                  Cancel
                </button>
                <button id="lc-next" class="px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-sm transition-all transform hover:scale-105">
                  Next →
                </button>
              </div>
            </div>
          </div>
          
          <!-- Step 2: Preview -->
          <div id="lc-step-preview" class="hidden">
            <div class="bg-black/20 rounded-lg p-4 mb-4" style="height: calc(100vh - 240px);">
              <div class="text-sm text-purple-200 mb-3">Preview your level</div>
              <div class="relative bg-black rounded-lg overflow-hidden" style="height: calc(100% - 40px);">
                <canvas id="lc-canvas" width="600" height="500" style="width:100%;height:100%;object-fit:contain;"></canvas>
                <div id="lc-clue-preview" class="absolute top-4 left-0 right-0 text-center" style="pointer-events:none;"></div>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 justify-end">
              <button id="lc-back" class="px-6 py-2.5 rounded-lg bg-gray-600/50 hover:bg-gray-600/70 text-white font-semibold text-sm transition-colors">
                ← Back
              </button>
              <button id="lc-cancel" class="px-6 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm transition-colors">
                Cancel
              </button>
              <button id="lc-save" class="px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold text-sm transition-all transform hover:scale-105">
                Save Level
              </button>
            </div>
          </div>
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
    
    const addWordBtn = this.panel.querySelector('#lc-add') as HTMLButtonElement;
    if (addWordBtn) {
      addWordBtn.addEventListener('click', () => {
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
        removeBtn.addEventListener('click', () => {
          wrapper.remove();
          const idx = this.wordInputs.indexOf(inp);
          if (idx > -1) this.wordInputs.splice(idx, 1);
          // Check if scroll indicators are still needed
          setTimeout(checkScrollIndicators, 100);
        });
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
      });
    }
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
        25,
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
    
    // Update header subtitle
    const subtitle = this.panel.querySelector('.text-purple-200.text-xs');
    if (subtitle) {
      subtitle.textContent = 'Step 1: Enter level details';
    }
  }

  private showPreviewPage(): void {
    const form = this.panel.querySelector('#lc-step-form') as HTMLDivElement;
    const prev = this.panel.querySelector('#lc-step-preview') as HTMLDivElement;
    form.classList.add('hidden');
    prev.classList.remove('hidden');
    
    // Update header subtitle
    const subtitle = this.panel.querySelector('.text-purple-200.text-xs');
    if (subtitle) {
      subtitle.textContent = 'Step 2: Preview and save';
    }
  }
}
