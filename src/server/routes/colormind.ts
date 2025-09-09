import { Request, Response, Router } from 'express';

const router = Router();

/**
 * Proxy endpoint for Colormind API to avoid CORS issues
 * Note: This may not work in all environments due to network restrictions
 */
router.post('/api/colormind', async (req: Request, res: Response) => {
  try {
    const { model = 'default', input } = req.body;
    
    // Check if fetch is available
    if (typeof fetch === 'undefined') {
      throw new Error('Fetch API not available in this environment');
    }
    
    // Make request to Colormind API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('http://colormind.io/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    if (!response.ok) {
      throw new Error(`Colormind API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error: any) {
    console.error('Colormind proxy error:', error?.message || error);
    
    // Return a fallback response that the client can handle
    res.status(200).json({ 
      error: 'Colormind API unavailable',
      fallback: true,
      message: error?.message || 'Network error'
    });
  }
});

/**
 * Get available Colormind models
 */
router.get('/api/colormind/models', async (req: Request, res: Response) => {
  try {
    const response = await fetch('http://colormind.io/list/');
    
    if (!response.ok) {
      throw new Error(`Colormind API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Colormind models error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      result: ['default', 'ui'] // Fallback models
    });
  }
});

export default router;