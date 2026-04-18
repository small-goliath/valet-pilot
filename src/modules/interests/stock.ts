import axios from 'axios';
import type { Interest } from '../../types/config.js';

interface FinnhubQuote {
  c: number;   // 현재가
  d: number;   // 전일 대비 변동
  dp: number;  // 전일 대비 변동률(%)
  pc: number;  // 전일 종가
}

export interface StockData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
}

export async function fetchStocks(interest: Interest): Promise<StockData[]> {
  const { api_key, tickers } = interest.auth;
  const tickerList = tickers.split(',').map((t) => t.trim()).filter(Boolean);

  const results: StockData[] = [];

  for (const ticker of tickerList) {
    try {
      const res = await axios.get<FinnhubQuote>('https://finnhub.io/api/v1/quote', {
        params: { symbol: ticker, token: api_key },
        timeout: 8000,
      });

      results.push({
        ticker,
        price: res.data.c,
        change: res.data.d,
        changePercent: res.data.dp,
      });
    } catch {
      // 개별 티커 실패는 무시하고 계속
    }
  }

  return results;
}
