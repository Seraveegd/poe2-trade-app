import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, OnDestroy } from '@angular/core';
import { AppService } from '../../app.service';
import { from, concatMap, toArray, Subscription } from 'rxjs';
import { NgbTooltipModule, NgbAlertModule, NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-analyze',
  imports: [NgbTooltipModule, NgbAlertModule, NgbToastModule, NgClass],
  templateUrl: './analyze.component.html',
  styleUrl: './analyze.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyzeComponent implements OnInit, OnChanges, OnDestroy {
  @Output() isCounting = new EventEmitter<any>();
  @Output() statsFilter = new EventEmitter<any>();
  @Output() changeSort = new EventEmitter<any>();
  @Input({ required: true }) searchResult: any = [];
  @Input({ required: true }) isAnalyze: any = true;
  @Input() isSessionValid: boolean = false;
  @Input() currentSortType: string = 'price'; // 改為 Input 接收父組件狀態
  @Input() currentSortDir: 'asc' | 'desc' = 'asc'; // 改為 Input
  @Input() pseudos: any = [];
  @Input() stats: Record<string, Map<string, string[]>> = { default: new Map() };
  @Input() language: string = 'tw';

  public enToTW: any = new Map([
    ['Energy Shield', '能量護盾'],
    ['Armour', '護甲值'],
    ['Evasion Rating', '閃避值'],
    ['Ward', '保護'],
    ['Block Chance', '格擋機率'],
    ['Elemental Damage', '元素傷害'],
    ['Attacks per Second', '每秒攻擊次數'],
    ['Critical Hit Chance', '暴擊率'],
    ['Physical Damage', '物理傷害'],
    ['Quality', '品質'],
    ['Spirit', '精魂'],
    ['Dex', '敏捷'],
    ['Str', '力量'],
    ['Int', '智慧'],
    ['Reload Time', '重新裝填時間'],
    ['Level', '等級'],
  ]);

  public defenceTypes: any = new Map([
    ['能量護盾', 'es'],
    ['護甲值', 'ar'],
    ['閃避值', 'ev'],
    ['保護', 'ward'],
    ['格擋機率', 'block'],
    ['物理傷害', 'pdps'],
    ['元素傷害', 'edps'],
    ['每秒攻擊次數', 'aps'],
    ['暴擊率', 'crit'],
    ['物理傷害', 'pdamage'],
    ['品質', 'quality'],
    ['元素傷害', 'edamage'],
    ['精魂', 'spirit'],
    ['敏捷', 'dex'],
    ['力量', 'str'],
    ['智慧', 'int'],
    ['重新裝填時間', 'reload_time'],
    ['等級', 'gem_level'],
    ['Energy Shield', 'es'],
    ['Armour', 'ar'],
    ['Evasion Rating', 'ev'],
    ['Ward', 'ward'],
    ['Block Chance', 'block'],
    ['Attack Damage', 'pdps'],
    ['Spell Damage', 'edps'],
    ['Attack Speed', 'aps'],
    ['Critical Hit Chance', 'crit'],
    ['Physical Damage', 'pdamage'],
    ['Quality', 'quality'],
    ['Damage', 'edamage'],
    ['Spirit', 'spirit'],
    ['Dexterity', 'dex'],
    ['Strength', 'str'],
    ['Intelligence', 'int'],
    ['Reload Time', 'reload_time'],
    ['Level', 'gem_level']
  ]);

  private rarityColors: any = new Map([
    ['Rare', '#ffff77'],
    ['Unique', '#af6025'],
    ['Magic', '#8888ff'],
    ['Relic', '#82ad6a'],
    ['Normal', '#c8c8c8']
  ]);

  public eDemageColors: any = new Map([
    ['火焰傷害', '#960000'],
    ['閃電傷害', '#ffd700'],
    ['冰冷傷害', '#366492'],
    ['Fire damage', '#960000'],
    ['Lightning damage', '#ffd700'],
    ['Cold damage', '#366492']
  ]);

  public notShowMaxQuality = [
    '品質', 'quality',
    '精魂', 'spirit',
    '傷害', 'Damage',
    '暴擊', 'Critical',
    '每秒', 'per Second',
    '重新', 'Reload',
    '等級', 'Level',
    '保留', '',
    '巢裔', ''
  ];

  public fetchResult: any = []; //回傳結果
  public maxRead = 100; // 最大讀取量改為 100
  public currentRead = 0; // 紀錄目前已從 fetchID 讀取的索引位置
  public isLoading = false; // 讀取鎖定，改為 public 讓模板可存取
  public observ: any = []; //紀錄序列
  public processingTokens = new Set<string>(); // 紀錄正在處理中的交易 Token
  public failedTokens = new Set<string>(); // 紀錄請求失敗的交易 Token
  public successTokens = new Set<string>(); // 紀錄請求成功的交易 Token
  public errorMessages = new Map<string, string>(); // 紀錄每個 Token 的錯誤訊息
  private alertTimeouts = new Map<string, any>(); // 紀錄每個 Token 的計時器
  public toasts: any[] = []; // 存放所有 Toast 訊息
  private fetchSubscription?: Subscription;

  private cancelFetch() {
    if (this.fetchSubscription) {
      this.fetchSubscription.unsubscribe();
      this.fetchSubscription = undefined;
    }
  }

  public showToast(text: string, classname: string = 'bg-danger text-light', delay: number = 5000) {
    this.toasts.push({ text, classname, delay });
    this.cdr.markForCheck();
  }

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
    ["greater-orb-of-transmutation", {
      text: "高階蛻變石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9NYWdpYyIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/2f8e1ff9f8/CurrencyUpgradeToMagic.png"
    }],
    ["perfect-orb-of-transmutation", {
      text: "完美蛻變石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9NYWdpYyIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/2f8e1ff9f8/CurrencyUpgradeToMagic.png"
    }],
    ["aug", {
      text: "增幅石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb01hZ2ljIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c8ad0ddc84/CurrencyAddModToMagic.png"
    }],
    ["greater-orb-of-augmentation", {
      text: "高階增幅石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb01hZ2ljIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c8ad0ddc84/CurrencyAddModToMagic.png"
    }],
    ["perfect-orb-of-augmentation", {
      text: "完美增幅石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb01hZ2ljIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c8ad0ddc84/CurrencyAddModToMagic.png"
    }],
    ["regal", {
      text: "富豪石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlTWFnaWNUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/e8fb148e80/CurrencyUpgradeMagicToRare.png"
    }],
    ["greater-regal-orb", {
      text: "高階富豪石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlTWFnaWNUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/e8fb148e80/CurrencyUpgradeMagicToRare.png"
    }],
    ["perfect-regal-orb", {
      text: "完美富豪石",
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
    ["greater-exalted-orb", {
      text: "高階崇高石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png"
    }],
    ["perfect-exalted-orb", {
      text: "完美崇高石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png"
    }],
    ["chaos", {
      text: "混沌石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png"
    }],
    ["greater-chaos-orb", {
      text: "高階混沌石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png"
    }],
    ["perfect-chaos-orb", {
      text: "完美混沌石",
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
      text: "巧匠石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRFcXVpcG1lbnRTb2NrZXQiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/5131fd4774/CurrencyAddEquipmentSocket.png"
    }],
    ["wisdom", {
      text: "知識卷軸",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lJZGVudGlmaWNhdGlvbiIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/884f7bc58b/CurrencyIdentification.png"
    }],
    ["fracturing-orb", {
      text: "破裂石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvRnJhY3R1cmluZ09yYiIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/8b85ed1dc2/FracturingOrb.png"
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

    // 監聽重試狀態
    this.poe_service.retryStatus$.subscribe(msg => {
      // 先移除舊的重試訊息
      this.toasts = this.toasts.filter(t => t.type !== 'retry');

      if (msg) {
        this.toasts.push({
          type: 'retry',
          text: msg,
          classname: 'bg-warning text-dark',
          autohide: false
        });
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.cancelFetch();
    this.alertTimeouts.forEach(t => clearTimeout(t));
  }

  removeToast(toast: any) {
    this.toasts = this.toasts.filter(t => t !== toast);
    this.cdr.markForCheck();
  }

  //取得每個物品資料
  analyze() {
    this.cancelFetch();
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
      this.currentRead = 0;

      // 初始讀取：分析模式限制 40 筆，搜尋列表模式限制 20 筆
      const limit = this.isAnalyze ? 40 : 20;
      const initialCount = Math.min(this.searchResult.fetchID.length, limit);
      for (let i = 0; i < initialCount; i += 10) {
        const fetchIDs = this.searchResult.fetchID.slice(i, Math.min(i + 10, initialCount));

        this.observ.push(this.poe_service.get_trade_fetch(fetchIDs.join(','), this.searchResult.fetchQueryID, this.pseudos));
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

    this.cancelFetch();
    this.fetchSubscription = from(this.observ).pipe(
      concatMap((obs: any) => obs),
      toArray()
    ).subscribe({
      next: (res: any) => {
        this.fetchResult = [].concat(...res.map((e: any) => { return e.result }));
        this.currentRead = this.fetchResult.length; // 更新目前讀取進度
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
        let msg = '';
        if (error.status === 429) {
          msg = '請求過於頻繁 (429)，請稍候再試。';
        } else {
          msg = error.error?.message || error.message;
        }
        this.toasts.push({ text: msg, classname: 'bg-danger text-light', delay: 5000 });
        console.error(msg);

        // 遭遇錯誤時清除舊資料，避免渲染舊有或錯誤的介面
        this.fetchResult = [];
        this.computed = new Map();

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

    this.cancelFetch();
    this.fetchSubscription = from(this.observ).pipe(
      concatMap((obs: any) => obs),
      toArray()
    ).subscribe({
      next: (res: any) => {
        this.fetchResult = [].concat(...res.map((e: any) => { return e.result }));
        this.currentRead = this.fetchResult.length; // 更新目前讀取進度
        this.isCounting.emit(false);
        this.cdr.markForCheck(); // 非同步作業結束，手動通知 UI 更新

      },
      error: (error: any) => {
        let msg = '';
        if (error.status === 429) {
          msg = '請求過於頻繁 (429)，請稍候再試。';
        } else {
          msg = error.error?.message || error.message;
        }
        this.toasts.push({ text: msg, classname: 'bg-danger text-light', delay: 5000 });
        console.error(msg);

        // 遭遇錯誤時清除舊資料，避免渲染舊有或錯誤的介面
        this.fetchResult = [];

        this.isCounting.emit(false);
        this.cdr.markForCheck();
      }
    });
  }

  // 監聽視窗捲動事件
  @HostListener('window:scroll')
  onWindowScroll() {
    // 1. 如果是價格分析模式（不顯示列表）則不處理
    // 2. 如果正在載入、或已達 100 筆上限、或已載入全部搜尋結果，則不處理
    if (this.isAnalyze || this.isLoading || this.currentRead >= this.maxRead || this.currentRead >= this.searchResult.fetchID.length) {
      return;
    }

    // 計算捲動位置是否接近底部 (緩衝距離 200px)
    const pos = (document.documentElement.scrollTop || document.body.scrollTop) + document.documentElement.clientHeight;
    const max = document.documentElement.scrollHeight;

    if (pos > max - 200) {
      this.loadMore();
    }
  }

  // 載入更多批次 (Lazy Loading)
  loadMore() {
    if (this.isLoading) return;

    const start = this.currentRead;
    const nextCount = 10; // 每次觸發捲動額外加載 10 筆
    const end = Math.min(start + nextCount, this.searchResult.fetchID.length, this.maxRead);

    if (start >= end) return;

    this.isLoading = true;
    this.isCounting.emit(true);

    const moreObserv = [];
    for (let i = start; i < end; i += 10) {
      const fetchIDs = this.searchResult.fetchID.slice(i, Math.min(i + 10, end));
      moreObserv.push(this.poe_service.get_trade_fetch(fetchIDs.join(','), this.searchResult.fetchQueryID, this.pseudos));
    }

    this.cancelFetch();
    this.fetchSubscription = from(moreObserv).pipe(
      concatMap((obs: any) => obs),
      toArray()
    ).subscribe({
      next: (res: any) => {
        const newItems = [].concat(...res.map((e: any) => e.result));
        this.fetchResult = [...this.fetchResult, ...newItems]; // 將新項目附加到現有結果後方
        this.currentRead = end;
        this.isLoading = false;
        this.isCounting.emit(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.isCounting.emit(false);
        this.cdr.markForCheck();
      }
    });
  }

  //取得Tier
  getTierLevel(mods: any) {
    // 1. 安全檢查：確保資料存在且 mods 是陣列
    if (!mods || !Array.isArray(mods)) return '';

    // 2. 透過索引陣列 hashes 從 mods 中提取對應的 tier 
    // 注意：API 回傳的是純物件，直接使用 .tier 存取
    const tiers = mods
      .map((m: any) => {
        return m?.tier ? this.getTierColorSpan(m?.tier) : '';
      })
      .filter((t: any) => t !== undefined && t !== null);

    // 3. 格式化輸出，例如單一詞綴顯示 "T1"，複合詞綴顯示 "T1 + T2"
    return tiers.length > 0 ? tiers.map((t: any) => t).join(' + ') : '';
  }

  getTierLevelDetail(hashes: any, mods: any, statId: any) {
    // 1. 安全檢查：確保資料存在且 hashes 是陣列
    if (!hashes || !mods || !Array.isArray(mods)) return '';

    // 2. 透過索引陣列 hashes 從 mods 中提取對應的 tier 
    // 注意：API 回傳的是純物件，直接使用 .tier 存取
    const tiers = mods
      .map((m: any) => {
        return m?.tier ? m.magnitudes.length === 1 ?
          (this.getTierColorSpan(m?.tier + " [" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "]")) : m?.magnitudes[0].hash === m?.magnitudes[1].hash ?
            (this.getTierColorSpan(m?.tier + " [" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "] 至 [" + (m?.magnitudes[1].min === m?.magnitudes[1].max ? m?.magnitudes[1].min : m?.magnitudes[1].min + "-" + m?.magnitudes[1].max) + "]")) : (statId === m?.magnitudes[0].hash ? (this.getTierColorSpan(m?.tier + " [" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "]")) : (this.getTierColorSpan(m?.tier + " [" + (m?.magnitudes[1].min === m?.magnitudes[1].max ? m?.magnitudes[1].min : m?.magnitudes[1].min + "-" + m?.magnitudes[1].max) + "]"))) :
          m.magnitudes.length === 1 ?
            (this.getTierColorSpan("[" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "]")) : m?.magnitudes[0].hash === m?.magnitudes[1].hash ?
              (this.getTierColorSpan("[" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "] 至 [" + (m?.magnitudes[1].min === m?.magnitudes[1].max ? m?.magnitudes[1].min : m?.magnitudes[1].min + "-" + m?.magnitudes[1].max) + "]")) : (statId === m?.magnitudes[0].hash ? (this.getTierColorSpan("[" + (m?.magnitudes[0].min === m?.magnitudes[0].max ? m?.magnitudes[0].min : m?.magnitudes[0].min + "-" + m?.magnitudes[0].max) + "]")) : (this.getTierColorSpan("[" + (m?.magnitudes[1].min === m?.magnitudes[1].max ? m?.magnitudes[1].min : m?.magnitudes[1].min + "-" + m?.magnitudes[1].max) + "]")))
      })
      .filter((t: any) => t !== undefined && t !== null);

    // 3. 格式化輸出，例如單一詞綴顯示 "T1"，複合詞綴顯示 "T1 + T2"
    return tiers.length > 0 ? tiers.map((t: any) => t).join(' + ') : '';
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

    //For en
    text = text.replaceAll('[', '').replaceAll(']', '');

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

        // 同時彈出 Toast 提示
        this.toasts.push({
          text: `交易失敗: ${msg}`,
          classname: 'bg-danger text-light',
          delay: 5000
        });

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

  /**
   * 根據目前的排序狀態回傳對應的箭頭符號
   */
  getSortArrow(sortType: string | undefined): string {
    if (!sortType || this.currentSortType !== sortType) {
      return '';
    }
    return this.currentSortDir === 'asc' ? ' ↑' : ' ↓';
  }

  filterByProperty(hashs: any, rarity: any) {
    this.statsFilter.emit({ hashs: hashs, rarity: rarity });
  }

  clickToSort(sortType: any) {
    if (sortType) {
      // 根據目前的 Input 狀態計算下一次應該發送的排序
      let nextDir: 'asc' | 'desc' = 'desc';
      if (this.currentSortType === sortType) {
        nextDir = this.currentSortDir === 'asc' ? 'desc' : 'asc';
      }

      // 發送物件給父組件，父組件更新後會透過 @Input 傳回新的 currentSortDir
      this.changeSort.emit({ [sortType]: nextDir });
    }
  }

  shouldShowProperty(p: any) {
    return this.notShowMaxQuality.every((n: string) => !p.includes(n));
  }

  getTW(id: any, text: any) {
    const strs = id.split('.');
    const digs = text.match(/\+?\d+/g);
    return id.startsWith('stat') ? this.replaceDynamic(this.stats[strs[1]].get(strs[1] + '.' + strs[2]), digs) : this.replaceDynamic(this.stats[strs[0]].get(strs[0] + '.' + strs[1]), digs);
  }

  replaceDynamic(inputText: any, replacementArray: any) {
    let index = 0; // 用來追蹤現在走到陣列的第幾個位置

    return inputText.replace(/\+?#/g, () => {
      // 如果陣列裡還有對應的數字，就取出來用並把 index + 1；用完了就保持原樣 '#'
      if (index < replacementArray.length) {
        return replacementArray[index++];
      }
      return "#";
    });
  }
}
