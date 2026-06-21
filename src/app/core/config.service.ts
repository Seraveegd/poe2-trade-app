import { Injectable, Optional } from '@angular/core';

export class Config {
  api_base_url: string = 'https://pathofexile.tw';
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private config: Config = new Config();

  constructor(@Optional() config: Config) {
    if (config) {
      this.config = config;
    }
  }

  get api_base_url(): string | undefined {
    return this.config.api_base_url;
  }

  set api_base_url(config: Config) {
    this.config = config;
  }
}
