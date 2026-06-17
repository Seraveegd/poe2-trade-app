import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfigService } from './core/config.service';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor(private http: HttpClient, private config: ConfigService) { }

  get_leagues(): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/data/leagues`, {});
  }

  get_trade(league: any, query: any): any {
    // HttpHeaders 是不可變的，必須採用連鎖調用或一次性初始化
    const headers = new HttpHeaders({
      'Accept': 'application/json'
    });

    league = encodeURI(league);
    return this.http.post(`${this.config.api_base_url}/api/trade2/search/poe2/${league}`, query, { headers: headers, withCredentials: true });
  }

  get_trade_fetch(fetchstr: any, fetchQueryID: any, pseudos: any = []): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/fetch/${fetchstr}?query=${fetchQueryID}&realm=poe2` + (pseudos.length > 0 ? `&pseudos[]=${pseudos.join(',')}` : ''), { withCredentials: true });
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
