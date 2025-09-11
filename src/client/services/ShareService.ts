/**
 * ShareService - Handles sharing game state to Reddit community
 */
export class ShareService {
  private static instance: ShareService;
  
  private constructor() {}
  
  public static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }
  
  /**
   * Opens share modal with game state
   */
  public openShareModal(gameData: {
    level: number;
    clue: string;
    letters: string[];
    foundWords: number;
    totalWords: number;
    canvas?: HTMLCanvasElement;
  }): void {
    // Create modal overlay
    const modal = this.createShareModal(gameData);
    document.body.appendChild(modal);
  }
  
  /**
   * Creates the share modal element
   */
  private createShareModal(gameData: any): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'share-modal';
    
    const content = document.createElement('div');
    content.className = 'modal-content max-w-lg panel-hex';
    
    // Generate share text
    const shareText = this.generateShareText(gameData);
    
    // Capture screenshot if canvas is provided
    let screenshotUrl = '';
    if (gameData.canvas) {
      screenshotUrl = this.captureCanvas(gameData.canvas);
    }
    
    content.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gradient">Share Puzzle</h2>
        <button id="close-share" class="text-hw-text-secondary hover:text-hw-text-primary">✕</button>
      </div>
      
      <div class="mb-4">
        <p class="text-sm text-hw-text-secondary mb-2">Share this puzzle with the community!</p>
      </div>
      
      <div class="mb-4">
        <textarea 
          id="share-text" 
          class="w-full h-32 p-3 bg-hw-surface-secondary rounded-lg text-hw-text-primary resize-none"
          readonly
        >${shareText}</textarea>
      </div>
      
      ${screenshotUrl ? `
        <div class="mb-4 flex items-center">
          <input type="checkbox" id="include-screenshot" class="mr-2" checked>
          <label for="include-screenshot" class="text-sm text-hw-text-primary cursor-pointer">
            📸 Include screenshot
          </label>
        </div>
      ` : ''}
      
      <div class="flex gap-2">
        <button id="copy-share" class="btn-glass-primary flex-1">
          📋 Copy to Clipboard
        </button>
        <button id="post-reddit" class="btn-glass-accent flex-1">
          📮 Post to Reddit
        </button>
      </div>
      
      <div id="share-status" class="mt-2 text-sm text-center text-hw-accent-success hidden">
        ✓ Copied to clipboard!
      </div>
    `;
    
    overlay.appendChild(content);
    
    // Store screenshot URL for later use
    (overlay as any).screenshotUrl = screenshotUrl;
    
    // Add event listeners
    this.setupModalListeners(overlay, gameData);
    
    return overlay;
  }
  
  /**
   * Generates shareable text for the puzzle
   */
  private generateShareText(gameData: any): string {
    const { level, clue, letters, foundWords, totalWords } = gameData;
    
    // Format letters in a grid-like pattern
    const letterGrid = this.formatLetterGrid(letters);
    
    return `🎯 HexaWord Puzzle - Level ${level}

📝 Clue: ${clue}

🔤 Letters:
${letterGrid}

❓ Can you find all ${totalWords} words?

Progress: ${foundWords}/${totalWords} words found

Play HexaWord on Reddit! 🎮`;
  }
  
  /**
   * Formats letters into a visual grid
   */
  private formatLetterGrid(letters: string[]): string {
    if (!letters || letters.length === 0) return '';
    
    // Create a hexagonal-like display
    const rows = [];
    let rowSizes = [4, 5, 6, 5, 4]; // Hexagonal pattern
    let letterIndex = 0;
    
    for (let rowSize of rowSizes) {
      if (letterIndex >= letters.length) break;
      
      const row = [];
      for (let i = 0; i < rowSize && letterIndex < letters.length; i++) {
        row.push(letters[letterIndex++]);
      }
      
      // Center the row with spaces
      const spacing = ' '.repeat(6 - rowSize);
      rows.push(spacing + row.join(' '));
    }
    
    return rows.join('\n');
  }
  
  /**
   * Sets up modal event listeners
   */
  private setupModalListeners(overlay: HTMLElement, gameData: any): void {
    const screenshotUrl = (overlay as any).screenshotUrl;
    
    // Close button
    const closeBtn = overlay.querySelector('#close-share');
    closeBtn?.addEventListener('click', () => {
      overlay.remove();
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // Copy to clipboard
    const copyBtn = overlay.querySelector('#copy-share');
    copyBtn?.addEventListener('click', async () => {
      const textArea = overlay.querySelector('#share-text') as HTMLTextAreaElement;
      const includeScreenshot = (overlay.querySelector('#include-screenshot') as HTMLInputElement)?.checked;
      
      if (textArea) {
        // Check if we should include screenshot
        if (includeScreenshot && screenshotUrl) {
          try {
            // Try to copy both image and text using Clipboard API
            const response = await fetch(screenshotUrl);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/plain': new Blob([textArea.value], { type: 'text/plain' }),
                'image/png': blob
              })
            ]);
            
            this.showStatus(overlay, 'Text and screenshot copied!');
          } catch (error) {
            // Fallback to just text if clipboard API doesn't support images
            navigator.clipboard.writeText(textArea.value).then(() => {
              this.showStatus(overlay, 'Text copied! (Screenshot saved separately)');
              // Also trigger download as fallback
              const link = document.createElement('a');
              link.download = `hexaword-level-${gameData.level}.png`;
              link.href = screenshotUrl;
              link.click();
            });
          }
        } else {
          // Just copy text
          navigator.clipboard.writeText(textArea.value).then(() => {
            this.showStatus(overlay, 'Text copied to clipboard!');
          });
        }
      }
    });
    
    // Post to Reddit
    const postBtn = overlay.querySelector('#post-reddit');
    postBtn?.addEventListener('click', () => {
      const includeScreenshot = (overlay.querySelector('#include-screenshot') as HTMLInputElement)?.checked;
      this.postToReddit(gameData, includeScreenshot ? screenshotUrl : undefined);
    });
  }
  
  /**
   * Shows status message in the modal
   */
  private showStatus(overlay: HTMLElement, message: string): void {
    const status = overlay.querySelector('#share-status');
    if (status) {
      status.textContent = `✓ ${message}`;
      status.classList.remove('hidden');
      setTimeout(() => {
        status.classList.add('hidden');
      }, 2000);
    }
  }
  
  /**
   * Posts the puzzle to Reddit
   */
  private async postToReddit(gameData: any, screenshotUrl?: string): Promise<void> {
    try {
      // Prepare the post body with text and optional image link
      let postContent = this.generateShareText(gameData);
      
      // If we have a screenshot, we can mention it in the post
      if (screenshotUrl) {
        postContent += '\n\n📸 [View Screenshot]';
      }
      
      // Call the share API endpoint
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `HexaWord Puzzle - Level ${gameData.level}: ${gameData.clue}`,
          text: postContent,
          flair: 'Puzzle',
          imageUrl: screenshotUrl // Include screenshot URL if available
        })
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        // Close modal after posting
        const modal = document.getElementById('share-modal');
        if (modal) {
          modal.remove();
        }
        
        // Show success message
        this.showSuccessToast('Puzzle shared to community!');
      } else {
        throw new Error(result.message || 'Failed to create post');
      }
    } catch (error) {
      console.error('Failed to post to Reddit:', error);
      this.showErrorToast('Failed to share. Please try again.');
    }
  }
  
  /**
   * Shows a success toast message
   */
  private showSuccessToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-hw-accent-success text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  /**
   * Shows an error toast message
   */
  private showErrorToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  /**
   * Captures canvas as image data URL
   */
  public captureCanvas(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/png');
  }
}