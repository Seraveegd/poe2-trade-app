import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfigService } from './core/config.service';
import { timer, throwError, retry, BehaviorSubject, finalize } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  // 用於通知 UI 目前的重試狀態
  public retryStatus$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient, private config: ConfigService) { }

  /**
   * 指數退避重試策略 (Exponential Backoff)
   * 專門針對 429 Too Many Requests 錯誤進行自動重試
   */
  private retryStrategy = {
    count: 3, // 最大重試次數
    delay: (error: any, retryCount: number) => {
      if (error.status === 429) {
        // 取得官方的回傳重試時間，預設為指數退避
        const retryAfter = error.headers?.get('Retry-After');
        let delayTime = Math.pow(2, retryCount - 1) * 1000;
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            delayTime = seconds * 1000;
          }
        }
        this.retryStatus$.next(`偵測到流量限制，正在等待 ${delayTime / 1000} 秒後嘗試第 ${retryCount} 次重新連線...`);
        return timer(delayTime);
      }
      // 如果是其他錯誤 (如 400, 404)，則不重試，直接拋出錯誤
      return throwError(() => error);
    }
  };

  get_leagues(): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/data/leagues`, {});
  }

  get_trade(league: any, query: any): any {
    // HttpHeaders 是不可變的，必須採用連鎖調用或一次性初始化
    const headers = new HttpHeaders({
      'Accept': 'application/json'
    });

    league = encodeURI(league);
    return this.http.post(`${this.config.api_base_url}/api/trade2/search/poe2/${league}`, query, { headers: headers, withCredentials: true }).pipe(
      retry(this.retryStrategy),
      finalize(() => this.retryStatus$.next(null)) // 請求結束後清除訊息
    );
  }

  get_trade_fetch(fetchstr: any, fetchQueryID: any, pseudos: any = []): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/fetch/${fetchstr}?query=${fetchQueryID}&realm=poe2` + (pseudos.length > 0 ? `&pseudos[]=${pseudos.join(',')}` : ''), { withCredentials: true }).pipe(
      retry(this.retryStrategy),
      finalize(() => this.retryStatus$.next(null)) // 請求結束後清除訊息
    );
  }

  getOfficialItemData(): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/data/items`, {});
  }

  getOfficialStatesData(): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/data/stats`, {});
  }

  getItemData(): any {
    return this.http.get<any[]>('poe2/items.json');
  }

  getStatsData(): any {
    return this.http.get<any[]>('poe2/stats.json');
  }

  getStatsRangesData(): any {
    return this.http.get<any[]>('poe2/ranges.json');
  }

  // 驗證目前的 Session 是否有效
  validateSession(): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/data/stats`, { withCredentials: true });
  }

  goToHideoutTrade(token: any): any {
    return this.http.post(`${this.config.api_base_url}/api/trade2/whisper`, { token: token }, { withCredentials: true });
  }
}
