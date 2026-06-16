import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { AppService } from '../../app.service';
import { forkJoin } from 'rxjs';
import { NgbTooltipModule, NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-analyze',
  imports: [NgbTooltipModule, NgbAlertModule],
  templateUrl: './analyze.component.html',
  styleUrl: './analyze.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyzeComponent implements OnInit, OnChanges {
  @Output() isCounting = new EventEmitter<any>();
  @Output() statsFilter = new EventEmitter<any>();
  @Input({ required: true }) searchResult: any = [];
  @Input({ required: true }) isAnalyze: any = true;
  @Input() isSessionValid: boolean = false;

  public defenceTypes: any = new Map([
    ['能量護盾', 'es'],
    ['護甲值', 'ar'],
    ['閃避值', 'ev'],
    ['保護', 'ward'],
    ['格擋機率', 'block'],
    ['物理傷害', 'pdps'],
    ['元素傷害', 'edps']
  ]);

  private rarityColors: any = new Map([
    ['Rare', '#ffff77'],
    ['Unique', '#af6025'],
    ['Magic', '#8888ff'],
    ['Relic', '#82ad6a'],
    ['Normal', '#c8c8c8']
  ]);

  public fetchResult: any = []; //回傳結果
  public maxRead = 40; //每次讀取
  public observ: any = []; //紀錄序列
  public processingTokens = new Set<string>(); // 紀錄正在處理中的交易 Token
  public failedTokens = new Set<string>(); // 紀錄請求失敗的交易 Token
  public successTokens = new Set<string>(); // 紀錄請求成功的交易 Token
  public errorMessages = new Map<string, string>(); // 紀錄每個 Token 的錯誤訊息
  private alertTimeouts = new Map<string, any>(); // 紀錄每個 Token 的計時器

  //價格分析
  public computed: any = new Map(); //價格統計  
  public itemImage = ''; //物品圖示  
  public corruptedCount: number = 0; //汙染統計
  public extraFilterCount: number = 0; //額外過濾統計

  public currencysList: any = new Map([
    ["transmute", {
      text: "蛻變石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9NYWdpYyIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/2f8e1ff9f8/CurrencyUpgradeToMagic.png"
    }],
    ["aug", {
      text: "增幅石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb01hZ2ljIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c8ad0ddc84/CurrencyAddModToMagic.png"
    }],
    ["regal", {
      text: "富豪石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlTWFnaWNUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/e8fb148e80/CurrencyUpgradeMagicToRare.png"
    }],
    ["annul", {
      text: "無效石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQW5udWxsT3JiIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/2daba8ccca/AnnullOrb.png"
    }],
    ["exalted", {
      text: "崇高石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png"
    }],
    ["chaos", {
      text: "混沌石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png"
    }],
    ["vaal", {
      text: "瓦爾寶珠",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lWYWFsIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/72bc84396c/CurrencyVaal.png"
    }],
    ["alch", {
      text: "點金石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9SYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9b80b44821/CurrencyUpgradeToRare.png"
    }],
    ["divine", {
      text: "神聖石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png"
    }],
    ["mirror", {
      text: "卡蘭德魔鏡",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lEdXBsaWNhdGUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/26bc31680e/CurrencyDuplicate.png"
    }],
    ["chance", {
      text: "機會石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9VbmlxdWUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/93c6cc8d5b/CurrencyUpgradeToUnique.png"
    }],
    ["artificers", {
      text: "工匠石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRFcXVpcG1lbnRTb2NrZXQiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/5131fd4774/CurrencyAddEquipmentSocket.png"
    }],
    ["wisdom", {
      text: "知識卷軸",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lJZGVudGlmaWNhdGlvbiIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/884f7bc58b/CurrencyIdentification.png"
    }]]);

  constructor(private poe_service: AppService, private cdr: ChangeDetectorRef) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    // 當父元件傳入的 searchResult 參考改變時，重新執行分析
    if (changes['searchResult'] && !changes['searchResult'].firstChange) {
      this.analyze();
    }
  }

  ngOnInit(): void {
    if (this.searchResult?.fetchID?.length > 0) {
      this.analyze();
    }
  }

  //取得每個物品資料
  analyze() {
    if (this.searchResult && this.searchResult.searchTotal > 0 && this.searchResult.fetchID?.length > 0) {
      // 初始化分析狀態
      this.fetchResult = [];
      this.observ = [];
      this.processingTokens.clear();
      this.failedTokens.clear();
      this.successTokens.clear();
      this.errorMessages.clear();
      this.alertTimeouts.forEach(t => clearTimeout(t));
      this.alertTimeouts.clear();

      for (let i = 0; i < this.searchResult.fetchID.length && i < this.maxRead; i += 10) {
        const fetchIDs = this.searchResult.fetchID.slice(i, i + 10);

        this.observ.push(this.poe_service.get_trade_fetch(fetchIDs.join(','), this.searchResult.fetchQueryID));
      }

      //價格分析
      if (this.isAnalyze) {
        this.computed = new Map();
        this.corruptedCount = 0;
        this.extraFilterCount = 0;

        this.fetchResultPrice();
      } else {//輸出物品清單

        this.fetchItemList();
      }
    } else {
      // 若無結果，確保結束父元件的讀取狀態
      this.isCounting.emit(false);
    }
  }

  //輸出分析價格結果
  fetchResultPrice() {
    if (this.observ.length === 0) {
      this.isCounting.emit(false);
      return;
    }

    forkJoin([...this.observ]).subscribe({
      next: (res: any) => {
        this.fetchResult = [].concat(...res.map((e: any) => { return e.result }));
        if (this.fetchResult.length > 0) this.itemImage = this.fetchResult[0].item.icon;

        this.fetchResult.forEach((item: any) => {
          if (this.searchResult.extraFilterStr !== '' && item.item.explicitMods[0] !== this.searchResult.extraFilterStr) {
            return;
          }

          if (item.listing.price) {
            if (this.computed.has(item.listing.price.currency)) {
              if (!this.computed.get(item.listing.price.currency).has(item.listing.price.amount)) {
                this.computed.get(item.listing.price.currency).set(item.listing.price.amount, [1, 0]);
              } else {
                this.computed.get(item.listing.price.currency).set(item.listing.price.amount, [this.computed.get(item.listing.price.currency).get(item.listing.price.amount)[0] + 1, this.computed.get(item.listing.price.currency).get(item.listing.price.amount)[1]]);
              }
            } else {
              this.computed.set(item.listing.price.currency, new Map([
                [item.listing.price.amount, [1, 0]]
              ]));
            }
          }

          if (item.item.corrupted) {
            this.computed.get(item.listing.price.currency).set(item.listing.price.amount, [this.computed.get(item.listing.price.currency).get(item.listing.price.amount)[0], this.computed.get(item.listing.price.currency).get(item.listing.price.amount)[1] + 1]);
            this.corruptedCount += 1;
          }

          this.extraFilterCount += 1;
        });

        this.isCounting.emit(false);
        this.cdr.markForCheck(); // 非同步作業結束，手動通知 UI 更新
      },
      error: (error: any) => {
        console.error(error.error?.message || error.message);
        this.isCounting.emit(false);
        this.cdr.markForCheck();
      }
    });
  }

  //輸出物品清單
  fetchItemList() {
    if (this.observ.length === 0) {
      this.isCounting.emit(false);
      return;
    }

    forkJoin([...this.observ]).subscribe({
      next: (res: any) => {
        this.fetchResult = [].concat(...res.map((e: any) => { return e.result }));

        this.isCounting.emit(false);
        this.cdr.markForCheck(); // 非同步作業結束，手動通知 UI 更新

      },
      error: (error: any) => {
        console.error(error.error?.message || error.message);
        this.isCounting.emit(false);
        this.cdr.markForCheck();
      }
    });
  }

  //取得Tier
  getTierLevel(hashes: any, mods: any) {
    // 1. 安全檢查：確保資料存在且 hashes 是陣列
    if (!hashes || !mods || !Array.isArray(hashes)) return '';

    // 2. 透過索引陣列 hashes 從 mods 中提取對應的 tier 
    // 注意：API 回傳的是純物件，直接使用 .tier 存取
    const tiers = hashes
      .map(index => this.getTierColorSpan(mods[index]?.tier))
      .filter(t => t !== undefined && t !== null);

    // 3. 格式化輸出，例如單一詞綴顯示 "T1"，複合詞綴顯示 "T1 + T2"
    return tiers.length > 0 ? tiers.map(t => t).join(' + ') : '';
  }

  getTierLevelDetail(hashes: any, mods: any) {
    // 1. 安全檢查：確保資料存在且 hashes 是陣列
    if (!hashes || !mods || !Array.isArray(hashes)) return '';

    // 2. 透過索引陣列 hashes 從 mods 中提取對應的 tier 
    // 注意：API 回傳的是純物件，直接使用 .tier 存取
    const tiers = hashes
      .map(index => this.getTierColorSpan(mods[index]?.tier + " [" + (mods[index]?.magnitudes[0].min === mods[index]?.magnitudes[0].max ? mods[index]?.magnitudes[0].min : mods[index]?.magnitudes[0].min + "-" + mods[index]?.magnitudes[0].max) + "]"))
      .filter(t => t !== undefined && t !== null);

    // 3. 格式化輸出，例如單一詞綴顯示 "T1"，複合詞綴顯示 "T1 + T2"
    return tiers.length > 0 ? tiers.map(t => t).join(' + ') : '';
  }

  //取得Tier顏色
  getTierColorSpan(t: any) {
    return `<span class='` + (t.includes('P') ? 'pr' : 'su') + `'>${t}</span>`
  }

  //取代說明字樣
  replaceIllustrate(text: any) {
    let count = (text.match(/\|/g) || []).length;

    for (let i = 0; i < count; i++) {
      let poS = text.indexOf("[");
      let poM = text.indexOf("|");
      let poE = text.indexOf("]");

      if (poM !== -1 && poE > poM && (poM - poS < 40)) {
        let fullText = text.substring(poS, poE + 1);
        let replace = text.substring(poM + 1, poE);

        // console.log(poS, poM, poE, fullText, replace);

        text = text.replace(fullText, replace);
      }
    }

    return text;
  }

  //取得稀有度顏色
  getRarityColor(rarity: any, isRelic: any) {
    rarity = isRelic ? 'Relic' : rarity;
    return this.rarityColors.get(rarity);
  }

  //前往藏身處交易
  goToHideout(token: any) {
    // 防止重複點擊：如果 token 不存在或正在處理中，則不執行
    if (!token || this.processingTokens.has(token)) return;

    this.processingTokens.add(token);
    this.failedTokens.delete(token); // 開始重試時移除先前的失敗紀錄
    this.successTokens.delete(token); // 開始請求時清除先前的成功紀錄
    this.cdr.markForCheck();

    this.poe_service.goToHideoutTrade(token).subscribe({
      next: (res: any) => {
        if (res.success) {
          console.log("成功前往藏身處");
          this.successTokens.add(token); // 標記成功
        }
        this.processingTokens.delete(token);
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        const msg = error.error?.message || error.message;
        console.error(msg);
        this.errorMessages.set(token, msg);
        this.failedTokens.add(token);

        // 設定 5 秒後自動移除該筆錯誤
        if (this.alertTimeouts.has(token)) clearTimeout(this.alertTimeouts.get(token));
        const timeout = setTimeout(() => {
          this.closeAlert(token);
        }, 5000);
        this.alertTimeouts.set(token, timeout);

        this.processingTokens.delete(token);
        this.cdr.markForCheck();
      }
    });
  }

  closeAlert(token: string) {
    this.errorMessages.delete(token);
    if (this.alertTimeouts.has(token)) {
      clearTimeout(this.alertTimeouts.get(token));
      this.alertTimeouts.delete(token);
    }
    this.cdr.markForCheck();
  }

  filterByProperty(hashs: any, rarity: any) {
    this.statsFilter.emit({ hashs: hashs, rarity: rarity });
  }
}
