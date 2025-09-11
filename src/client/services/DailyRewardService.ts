/**
 * DailyRewardService - Manages daily wheel spins and rewards
 */

import { WheelPrize } from '../components/WheelOfFortune';

export interface DailyRewardData {
  lastClaimTime: number;
  totalSpins: number;
  lastPrize?: WheelPrize;
  spinTokens: number;
  lastTokenGrant: number;
}

export interface SpinStartResponse {
  spinId: string;
  prizeId: string;
}

export class DailyRewardService {
  private static instance: DailyRewardService;
  
  private constructor() {}
  
  public static getInstance(): DailyRewardService {
    if (!DailyRewardService.instance) {
      DailyRewardService.instance = new DailyRewardService();
    }
    return DailyRewardService.instance;
  }
  
  /**
   * Gets the number of spin tokens available
   */
  public async getSpinTokens(): Promise<number> {
    try {
      const response = await fetch('/api/daily-reward/tokens');
      
      if (!response.ok) {
        // Check if we should grant daily token
        await this.checkDailyToken();
        return 1; // Default to 1 token if API fails
      }
      
      const data = await response.json();
      
      // Check if we should grant daily token
      if (this.shouldGrantDailyToken(data.lastTokenGrant)) {
        await this.grantDailyToken();
        return (data.spinTokens || 0) + 1;
      }
      
      return data.spinTokens || 0;
    } catch (error) {
      console.error('Error getting spin tokens:', error);
      return 1; // Default to 1 token on error
    }
  }
  
  /**
   * Checks if user should get their daily token
   */
  private shouldGrantDailyToken(lastTokenGrant: number): boolean {
    const now = Date.now();
    const timeSinceGrant = now - (lastTokenGrant || 0);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return !lastTokenGrant || timeSinceGrant >= twentyFourHours;
  }
  
  /**
   * Grants a daily token to the user
   */
  private async grantDailyToken(): Promise<void> {
    try {
      await fetch('/api/daily-reward/grant-token', { method: 'POST' });
    } catch (error) {
      console.error('Error granting daily token:', error);
    }
  }
  
  /**
   * Checks for daily token locally
   */
  private async checkDailyToken(): Promise<void> {
    const lastGrant = localStorage.getItem('hexaword_last_token_grant');
    const now = Date.now();
    
    if (!lastGrant || now - parseInt(lastGrant) >= 24 * 60 * 60 * 1000) {
      localStorage.setItem('hexaword_last_token_grant', String(now));
    }
  }
  
  /**
   * Checks if user can claim daily reward
   */
  public async canClaimDaily(): Promise<{ canClaim: boolean; lastClaimTime?: number }> {
    try {
      const response = await fetch('/api/daily-reward/check');
      
      if (!response.ok) {
        return { canClaim: true }; // Allow claim if check fails
      }
      
      const data = await response.json();
      const now = Date.now();
      const timeSinceLastClaim = now - (data.lastClaimTime || 0);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      return {
        canClaim: !data.lastClaimTime || timeSinceLastClaim >= twentyFourHours,
        lastClaimTime: data.lastClaimTime
      };
    } catch (error) {
      console.error('Error checking daily reward:', error);
      return { canClaim: true };
    }
  }
  
  /**
   * Starts a server-authoritative spin and reserves a prize
   */
  public async startSpin(): Promise<SpinStartResponse> {
    const res = await fetch('/api/daily-reward/spin', { method: 'POST' });
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Failed to start spin');
      throw new Error(msg || 'Failed to start spin');
    }
    return res.json();
  }

  /**
   * Claims the daily reward
   */
  public async claimReward(prize: WheelPrize, spinId?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/daily-reward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spinId ? { spinId } : { prize })
      });
      
      if (!response.ok) {
        throw new Error('Failed to claim reward');
      }
      
      return true;
    } catch (error) {
      console.error('Error claiming daily reward:', error);
      return false;
    }
  }
  
  /**
   * Gets the user's daily reward history
   */
  public async getHistory(): Promise<DailyRewardData | null> {
    try {
      const response = await fetch('/api/daily-reward/history');
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting reward history:', error);
      return null;
    }
  }
  
  /**
   * Checks if this is the user's second launch today
   */
  public isSecondLaunch(): boolean {
    const launchKey = 'hexaword_launch_count';
    const lastLaunchKey = 'hexaword_last_launch';
    const today = new Date().toDateString();
    
    const lastLaunch = localStorage.getItem(lastLaunchKey);
    const launchCount = parseInt(localStorage.getItem(launchKey) || '0');
    
    if (lastLaunch !== today) {
      // New day, reset count
      localStorage.setItem(lastLaunchKey, today);
      localStorage.setItem(launchKey, '1');
      return false;
    } else {
      // Same day, increment count
      const newCount = launchCount + 1;
      localStorage.setItem(launchKey, newCount.toString());
      return newCount === 2;
    }
  }
}
