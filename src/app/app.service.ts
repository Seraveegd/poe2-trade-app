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
    let headers: HttpHeaders = new HttpHeaders();
    headers.set('Accept', '	application/json');

    league = encodeURI(league);

    return this.http.post(`${this.config.api_base_url}/api/trade2/search/poe2/${league}`, query, { headers: headers });
  }

  get_trade_fetch(fetchstr: any, fetchQueryID: any): any {
    return this.http.get(`${this.config.api_base_url}/api/trade2/fetch/${fetchstr}?query=${fetchQueryID}&realm=poe2`, {})
  }

  getItemData(): any {
    return this.http.get<any[]>('poe2/items.json');
  }

  getStatsData(): any {
    return this.http.get<any[]>('poe2/stats.json');
  }

  getpNodesData(): any {
    return this.http.get<any[]>('poe2/pNodes.json');
  }

  getrnpNodesData(): any {
    return this.http.get<any[]>('poe2/rnpNodes.json');
  }
}
