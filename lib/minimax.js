import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client pointing to MiniMax API
// Base URL depends on region, defaulting to International
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic';

export const minimaxClient = new Anthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: MINIMAX_BASE_URL,
});

export const MINIMAX_MODEL = 'MiniMax-M2'; // Or MiniMax-M2-Stable
