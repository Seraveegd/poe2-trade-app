import { Component, OnInit, inject, effect, OnDestroy, NgZone, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { NgbCollapseModule, NgbTooltipModule, NgbAlertModule, NgbTypeaheadModule, NgbTypeahead, NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppService } from '../app.service';
import { AnalyzeComponent } from "./analyze/analyze.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Shell } from 'electron';
import { ClipboardService } from './clipboard.service';

import { debounceTime, distinctUntilChanged, filter, map, merge, Observable, OperatorFunction, Subject, Subscription } from 'rxjs';
import { Data } from './data';

@Component({
  selector: 'app-home',
  imports: [
    NgbTypeaheadModule,
    NgbDropdownModule,
    NgbCollapseModule,
    NgbTooltipModule,
    NgbAlertModule,
    FormsModule,
    CommonModule,
    AnalyzeComponent
  ],
  providers: [AppService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  states: any = [];
  itemBasics: any = [];
  public savedSearches: any[] = [];
  public selectedSavedSearchIndex: any = null;
  public currentLoadedName: string | null = null;

  public isPoeSessionVisible: boolean = false;
  public poeSessionStatus: 'valid' | 'invalid' | 'checking' | null = null;
  public poeSessionId: string = '';
  public tempRenameValue: string = '';
  customStat: any;
  public currentSortType: string = 'price'; // 提升排序種類狀態
  public currentSortDir: 'asc' | 'desc' = 'asc'; // 提升排序方向狀態
  public selectedFilterMethod: string = 'and'; // 紀錄目前選擇的過濾方式 (and 或 count)
  private sessionCheckSubject = new Subject<string>();

  @ViewChild('instance') instance!: NgbTypeahead;
  @ViewChild('instance2') instance2!: NgbTypeahead;

  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  focus2$ = new Subject<string>();
  click2$ = new Subject<string>();

  search: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    const clicksWithClosedPopup$ = this.click$.pipe(filter(() => this.instance && !this.instance.isPopupOpen()));
    const inputFocus$ = this.focus$;

    return merge(debouncedText$, inputFocus$, clicksWithClosedPopup$).pipe(
      map((term) =>
        (term === '' ? this.states.slice(0, 10) : this.states.filter((v: any) => v.toLowerCase().indexOf(term.toLowerCase()) > -1)),
      ),
    );
  };

  search2: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    const clicksWithClosedPopup$ = this.click2$.pipe(filter(() => this.instance2 && !this.instance2.isPopupOpen()));
    const inputFocus$ = this.focus2$;

    return merge(debouncedText$, inputFocus$, clicksWithClosedPopup$).pipe(
      map((term) =>
        (term === '' ? this.itemBasics.slice(0, 10) : this.itemBasics.filter((v: any) => v.toLowerCase().indexOf(term.toLowerCase()) > -1)),
      ),
    );
  };

  public clipboard = inject(ClipboardService);
  private modalService = inject(NgbModal);
  private shell!: Shell;
  private subscriptions = new Subscription();

  //篩選器方法
  public filterMethods: any = [
    {
      label: "和",
      prop: 'and'
    },
    {
      label: "總計",
      prop: 'count'
    }
  ]

  public isCollapsed: boolean = false;
  public typeColors: any = new Map([
    ['技能', '#BFBC2E'],
    ['固定', '#BD5A5A'],
    ['增幅', '#85A1A5'],
    ['附魔', '#F8E169'],
    ['隨機', '#665DAE'],
    ['汙染', '#C62A29'],
    ['傳奇', '#AB4C11'],
    ['防禦', '#E6CA81'],
    ['插槽', '#8A8A8A'],
    ['聖所', '#A1422E'],
    ['褻瀆', '#68A80B'],
    ['破裂', '#8E7F54'],
    ['偽屬性', '#545454'],
    ['工藝', '#0260BD']
  ]);

  private categoryLabels: any = {
    pseudo: '偽屬性',
    explicit: '隨機',
    implicit: '固定',
    fractured: '破裂',
    crafted: '工藝',
    enchant: '附魔',
    rune: '增幅',
    desecrated: '褻瀆',
    sanctum: '聖所',
    skill: '技能'
  };

  private defenceTypes: any = new Map([
    ['能量護盾', 'es'],
    ['護甲值', 'ar'],
    ['閃避值', 'ev'],
    ['保護', 'ward'],
    ['格擋機率', 'block']
  ]);

  public newLine = navigator.userAgent.indexOf('Mac OS X') > -1 ? `\n` : `\r\n`; // Mac 與 Windows 換行符號差異(\r\n之後修)

  private weaponTypes: any = new Map([
    ['weapon.onemelee', '單手近戰武器'],
    ['weapon.caster', '法術武器'],
    ['weapon.ranged', '遠程武器'],
    ['weapon.twomelee', '雙手近戰武器']
  ]);

  public pseudos: any = [];

  //目前相關狀態
  public app: any = {
    baseUrl: 'https://pathofexile.tw',
    isTwServer: true,
    onReady: false,
    isCounting: false,
    isApiError: false,
    apiErrorStr: '',
    isSaveSuccess: false,
    saveSuccessStr: '',
    // issueText: '',
    countTime: 0,
    preCopyText: ''
  };

  //介面開關
  public ui: any = {
    collapse: {
      custom: true,
      item: true,
      map: true,
      gem: true,
      stats: true,
      mapArea: false,
      price: true
    }
  }

  private data: any;

  //查詢物品資料
  public item: any = {
    name: '', //物品名稱
    category: '', //物品種類
    type: '', //物品分類
    basic: '', //物品基底
    supported: true,
    copyText: '',
    searchStats: [], // 分析方法:AND
    searchStatsCount: [], // 分析方法:COUNT
    searchDefences: []
  };

  public methodCount = {
    min: '',
    max: ''
  }

  //搜尋相關設定
  public searchOptions: any = {
    serverOptions: ['台服'],
    raritySet: { // 稀有度設定
      option: [{
        label: "任何",
        prop: ""
      }, {
        label: "一般",
        prop: 'normal'
      }, {
        label: "魔法",
        prop: 'magic'
      }, {
        label: "稀有",
        prop: 'rare'
      }, {
        label: "傳奇",
        prop: 'unique'
      }, {
        label: "傳奇 (貼模)",
        prop: 'uniquefoil'
      }, {
        label: "非傳奇",
        prop: 'nonunique'
      }],
      chosenObj: "",
      isSearch: false
    },
    itemLevel: { // 搜尋設定->物品等級
      min: 0,
      max: '',
      isSearch: false
    },
    itemSocket: { // 搜尋設定->物品插槽
      min: 0,
      max: '',
      isSearch: false
    },
    mapLevel: { // 搜尋設定->地圖階級
      min: 0,
      max: 0,
      isSearch: false
    },
    mapAreaLevel: { // 搜尋設定->地圖區域等級
      min: 0,
      max: 0,
      isSearch: false
    },
    itemBasic: { // 搜尋設定->物品基底
      text: '',
      isSearch: false
    },
    gemLevel: { // 搜尋設定->技能寶石等級
      min: 0,
      max: '',
      isSearch: false
    },
    gemQuality: { // 搜尋設定->技能寶石品質
      min: 0,
      max: '',
      isSearch: false
    },
    gemSocket: { // 搜尋設定->技能寶石插槽
      min: 0,
      max: '',
      isSearch: false
    },
    corruptedSet: { // 搜尋設定->汙染設定
      options: [{
        label: "是",
        prop: 'true'
      }, {
        label: "否",
        prop: 'false'
      }, {
        label: "任何",
        prop: 'any'
      }],
      chosenObj: "any"
      // isSearch: true,
    },
    itemCategory: { // 物品分類
      option: [],
      chosenObj: '',
      isSearch: false
    },
    priceSetting: { // 搜尋設定->價格設定
      options: [{
        label: "等同崇高石",
        prop: ''
      }, {
        label: "崇高石",
        prop: 'exalted'
      }, {
        label: "混沌石",
        prop: 'chaos'
      }, {
        label: "機會石",
        prop: 'chance'
      }, {
        label: "神聖石",
        prop: 'divine'
      }, {
        label: "崇高石或神聖石",
        prop: 'exalted_divine'
      }],
      chosenObj: ''
    },
    leagues: { // 搜尋設定->搜尋聯盟
      options: [],
      chosenL: ""
    },
    ranges: { // 搜尋設定->搜尋範圍
      options: [{
        label: "即刻購買以及面對面交易",
        prop: 'available'
      }, {
        label: "即刻購買",
        prop: 'securable'
      }, {
        label: "面對面交易(聯盟在線)",
        prop: 'onlineleague'
      }, {
        label: "面對面交易(在線)",
        prop: 'online'
      }, {
        label: "任何",
        prop: 'any'
      }],
      chosenObj: "securable"
    }
  };

  //過濾相關設定
  public filters: any = {
    searchJson: {},
    searchJson_Def: {
      "query": {
        "status": {
          "option": "securable"
        },
        "stats": [{
          "type": "and",
          "filters": []
        }],
        "filters": {
          "type_filters": {
            "filters": {
              "ilvl": {},
              "rarity": {}
            }
          },
          "trade_filters": {
            "filters": {
              "collapse": {
                "option": "true"
              },
              "price": {}
            }
          },
          "misc_filters": {
            "filters": {}
          },
          "map_filters": {
            "filters": {}
          },
          "equipment_filters": {
            "filters": {}
          }
        }
      },
      "sort": {
        "price": "asc"
      }
    }
  }

  //搜尋結果
  public searchResult: any = {
    fetchQueryID: '',
    fetchID: [], // 預計要搜尋物品細項的 ID, 10 個 ID 為一陣列
    resultLength: 0,
    searchTotal: 0, //總共幾筆
    status: '', //狀態文字
    extraFilterStr: '' //額外過濾
  }

  private worker: Worker | null = null;
  private workerInitialized = false;
  private statsSnapshot: any = null;

  constructor(private poe_service: AppService, private ngZone: NgZone, private cdr: ChangeDetectorRef) {
    if ((<any>window).require) {
      try {
        this.shell = (<any>window).require('electron').shell;
      } catch (e) {
        throw e;
      }
    } else {
      console.warn('App not running inside Electron!');
    }
    //取得聯盟資料
    this.subscriptions.add(this.poe_service.get_leagues().subscribe((res: any) => {
      if (res) {
        this.searchOptions.leagues.options = res.result.filter((data: any) => data.realm == 'poe2');
        this.searchOptions.leagues.chosenL = this.searchOptions.leagues.options[0].text;
      }
    }));

    //初始化資料
    this.data = new Data();
    // 監控資料是否準備完成，準備完成後填充 Typeahead 資料
    const checkDataReady = setInterval(() => {
      if (this.data.isReady) {
        this.populateStates();
        this.updateCategoryOptions();
        clearInterval(checkDataReady);
      }
    }, 1000);

    // 取得已儲存的搜尋清單 (從主程序讀取檔案)
    (<any>window).ipcRenderer.on('reply-custom-searches', (event: any, arg: any) => {
      this.savedSearches = arg || [];
      this.cdr.markForCheck();
    });
    (<any>window).ipcRenderer.send('get-custom-searches');

    // 取得已儲存的 POESESSID
    (<any>window).ipcRenderer.on('reply-poesessid', (event: any, arg: any) => {
      this.poeSessionId = arg || '';
      if (this.poeSessionId) {
        this.poeSessionStatus = 'checking';
        this.validatePoeSession();
      }
      this.cdr.markForCheck();
    });
    (<any>window).ipcRenderer.send('get-poesessid');

    // 處理 SessionID 自動檢查的訂閱
    this.subscriptions.add(
      this.sessionCheckSubject.pipe(debounceTime(800), distinctUntilChanged()).subscribe(id => {
        this.validatePoeSession();
      })
    );

    effect(() => {
      const current = this.clipboard.currentText(); // 讀取 Signal

      if (current) {
        this.onClipboardChanged(current);
      }
    });

    // 初始化 Web Worker
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./analyze.worker', import.meta.url));
      this.worker.onmessage = ({ data }) => this.handleWorkerResponse(data);
    }

    // 監聽視窗狀態，隱藏時清空快取
    this.ngZone.runOutsideAngular(() => {
      (<any>window).ipcRenderer.on('visibility-change', (e: any, state: any) => {
        if (state === 'blur' || state === false) {
          this.ngZone.run(() => {
            this.app.preCopyText = '';
            this.clipboard.currentText.set('');
            this.cdr.markForCheck();
          });
        }
      });
    });
  }

  //填充詞綴供選取
  private populateStates() {
    const allStates: string[] = [];
    Object.entries(this.data.stats).forEach(([category, map]) => {
      const label = this.categoryLabels[category] || category;
      (map as Map<string, string[]>).forEach((_ids, text) => {
        allStates.push(`${label}-${text}`);
      });
    });
    this.states = allStates;
    this.cdr.markForCheck();
  }

  // 取得 Typeahead 顯示用的標籤 (例如: 固定)
  getStatLabel(result: string): string {
    return result.split('-')[0];
  }

  // 取得 Typeahead 顯示用的詞綴內容 (例如: 生命最大值)
  getStatName(result: string): string {
    return result.substring(result.indexOf('-') + 1);
  }

  // 取得對應的顏色
  getStatColor(result: string): string {
    const label = this.getStatLabel(result);
    return this.typeColors.get(label) || '#fff';
  }

  /**
   * 當使用者從 Typeahead 選擇一個詞綴時觸發
   * 將格式如 "固定-生命最大值" 的字串轉換回官方 ID 並加入搜尋清單
   */
  handleTypeaheadSelect(event: any) {
    event.preventDefault(); // 阻止 NgbTypeahead 預設將值填入輸入框的行為
    const selection = event.item;
    const separatorIndex = selection.indexOf('-');
    if (separatorIndex === -1) return;

    const label = selection.substring(0, separatorIndex);
    const statText = selection.substring(separatorIndex + 1);

    // 根據顯示標籤反向查詢類別 Key (例如 "固定" -> "implicit")
    const categoryKey = Object.keys(this.categoryLabels).find(key => this.categoryLabels[key] === label);

    if (categoryKey && this.data.stats[categoryKey]) {
      const ids = this.data.stats[categoryKey].get(statText);
      if (ids && ids.length > 0) {
        const newStat = {
          id: ids[0],
          text: statText,
          option: "",
          min: "",
          max: "",
          isValue: false,
          isSearch: true,
          type: label,
          level: -1 // 自定義詞綴設定為 -1 以區別於分析出的階層
        };

        // 根據選擇的過濾方式決定加入哪個清單 (searchStats 或 searchStatsCount)
        const targetKey = this.selectedFilterMethod === 'count' ? 'searchStatsCount' : 'searchStats';

        if (!this.item[targetKey].some((s: any) => s.id === newStat.id)) {
          this.item[targetKey] = [...this.item[targetKey], newStat];
        }
      }
    }

    this.ui.collapse.stats = false; // 關鍵：選擇後強制展開詞綴列表介面
    this.customStat = ''; // 選擇完畢後清空輸入框內容
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    // console.log(localStorage.getItem('copyText'));
    // this.analyze();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  analyze(text: string) {
    if (this.app.isCounting) return;
    if (!this.data.isReady) {
      this.app.apiErrorStr = '資料庫正在從官方伺服器加載，請稍候...';
      return;
    }

    this.resetSearchData();

    // 1. 如果 Worker 尚未初始化，則進行單次大量資料傳輸
    if (!this.workerInitialized && this.worker) {
      if (!this.statsSnapshot) {
        this.statsSnapshot = {};
        Object.keys(this.data.stats).forEach(key => {
          this.statsSnapshot[key] = Object.fromEntries(this.data.stats[key]);
        });
      }

      this.worker.postMessage({
        type: 'INIT',
        basics: this.data.basics,
        stats: this.statsSnapshot,
        weaponTypes: Object.fromEntries(this.weaponTypes)
      });
      this.workerInitialized = true;
    }

    // 2. 後續分析僅傳送物品文字與基本配置，大幅減少負擔
    this.worker?.postMessage({
      type: 'ANALYZE',
      text,
      config: {
        newLine: this.newLine,
        filters_def: this.filters.searchJson_Def,
        item_initial: this.item,
        searchOptions_initial: this.searchOptions,
        ui_initial: this.ui
      }
    });
  }

  private handleWorkerResponse(data: any) {
    if (!data) {
      console.error('[Worker] Received undefined data');
      this.app.isCounting = false;
      return;
    }

    console.log('[Worker] Data received:', data);

    this.ngZone.run(() => {
      const { item, filters, searchOptions, ui, basicsUpdate } = data;
      this.item = item;
      this.filters.searchJson = filters.searchJson;
      this.searchOptions = searchOptions;
      this.ui = ui;

      // 僅更新 basics 中變動的部分（例如寶石選擇），避免覆蓋整個大物件
      if (basicsUpdate) {
        this.data.basics.gem.chosenG = basicsUpdate.gem.chosenG;
        this.data.basics.gem.isSearch = basicsUpdate.gem.isSearch;
      }

      // 通知 Angular 進行變更檢查
      this.cdr.markForCheck();

      // 關鍵：Worker 處理完畢且 Angular 資料綁定後，才通知主程序顯示視窗
      (<any>window).ipcRenderer.send('show-overlay');

      // 稀有物品停止搜尋，選擇詞綴才搜尋
      if (!this.ui.collapse.item) {
        this.app.isCounting = false;
        return;
      }

      this.searchTrade();
    });
  }


  //重置搜尋資料
  resetSearchData() {
    this.ui.collapse.custom = true;
    this.ui.collapse.item = true;
    this.ui.collapse.gem = true;
    this.ui.collapse.map = true;

    this.selectedSavedSearchIndex = null;
    this.isPoeSessionVisible = false;
    this.currentLoadedName = null;
    this.item.name = '';
    this.item.category = '';
    this.item.copyText = '';
    this.item.supported = true;

    this.searchResult.fetchID.length = 0;
    this.searchResult.searchTotal = 0;
    this.searchResult.resultLength = 0;

    this.searchOptions.raritySet.isSearch = false;

    this.searchOptions.itemLevel.isSearch = false;
    this.searchOptions.itemLevel.min = '';
    this.searchOptions.itemLevel.max = '';

    this.searchOptions.mapLevel.isSearch = false;
    this.searchOptions.mapLevel.min = '';
    this.searchOptions.mapLevel.max = '';

    this.searchOptions.itemBasic.text = '';
    this.searchOptions.itemBasic.isSearch = false;

    this.searchOptions.itemSocket.isSearch = false;
    this.searchOptions.itemSocket.min = 0;
    this.searchOptions.itemSocket.max = '';

    this.searchOptions.mapAreaLevel.isSearch = false;
    this.searchOptions.mapAreaLevel.min = '';
    this.searchOptions.mapAreaLevel.max = '';

    this.searchOptions.gemLevel.isSearch = false;
    this.searchOptions.gemLevel.min = '';
    this.searchOptions.gemLevel.max = '';

    this.searchOptions.gemQuality.isSearch = false;
    this.searchOptions.gemQuality.min = '';
    this.searchOptions.gemQuality.max = '';

    this.searchOptions.gemSocket.isSearch = false;
    this.searchOptions.gemSocket.min = '';
    this.searchOptions.gemSocket.max = '';

    this.searchOptions.corruptedSet.chosenObj = 'any';

    this.searchResult.fetchQueryID = '';
    this.searchResult.status = '';
    this.searchResult.extraFilterStr = '';

    this.item.searchStats = [];
    this.item.searchDefences = [];

    this.currentSortType = 'price'; // 重置時恢復預設排序
    this.currentSortDir = 'asc';

    this.app.apiErrorStr = '';
    this.app.preCopyText = '';

    this.cdr.markForCheck();
  }

  //建立搜尋資料
  searchTrade() {
    this.prepareSearchJson();

    this.app.isCounting = true;
    this.app.apiErrorStr = '';
    this.item.supported = true;

    this.searchResult.fetchQueryID = '';
    this.searchResult.searchTotal = 0;
    this.subscriptions.add(this.poe_service.get_trade(this.searchOptions.leagues.chosenL, this.filters.searchJson).subscribe((res: any) => {
      if (res && !res.error) {
        // 關鍵：使用解構賦值建立新物件參考，確保 AnalyzeComponent 的 ngOnChanges 能被觸發
        this.searchResult = {
          ...this.searchResult,
          resultLength: res.result.length,
          searchTotal: res.total,
          status: ` 共 ${res.total} 筆符合 ${this.ui.collapse.price && res.total !== res.result.length ? '- 報價已摺疊' : ''}`,
          fetchQueryID: res.id,
          fetchID: res.result
        };

        if (res.total === 0) {
          this.app.isCounting = false;
        }

        this.app.isApiError = false;
        this.cdr.markForCheck();
      } else {
        this.searchResult.status = res.error.message;
        // this.startCountdown(60);
        this.app.isApiError = true;
        this.app.isCounting = false;

        this.resetSearchData();
      }
    }, (error: any) => {
      this.resetSearchData();
      this.app.isApiError = true;
      this.app.isCounting = false;
      this.app.apiErrorStr = error.error.error.message;
      console.log(error);
    }));

    return;
  }

  /**
   * 根據目前的 UI 狀態構建完整的搜尋 JSON 物件
   */
  private prepareSearchJson() {
    this.pseudos = [];

    if ((this.searchOptions.itemLevel.isSearch || this.searchOptions.itemBasic.isSearch) && this.item.category === '') {
      this.item.category = 'item';
    }

    if (!this.ui.collapse.custom) {
      delete this.filters.searchJson.query.filters.trade_filters;
    }

    // 每次搜尋前重置動態過濾區塊，確保搜尋條件與目前的 UI 顯示完全同步
    this.filters.searchJson.query.stats = [{ "type": "and", "filters": [] }, { "type": "count", "filters": [] }];
    if (this.filters.searchJson.query.filters.equipment_filters) {
      this.filters.searchJson.query.filters.equipment_filters.filters = {};
    }

    let searchCount = 0;

    this.item.searchStats.forEach((element: any) => {
      if (element.id !== '') {
        let value = {};
        let min = element.min;
        let max = element.max;

        if (!isNaN(min) && min != '') {
          Object.assign(value, { min: Number(min) });
        }

        if (!isNaN(max) && max != '') {
          Object.assign(value, { max: Number(max) });
        }

        if (element.option) {
          Object.assign(value, { option: element.option });
        }

        if (element.isSearch) searchCount++;

        this.filters.searchJson.query.stats[0].filters.push({
          "id": element.id,
          "disabled": !element.isSearch,
          "value": value
        })

        if (element.id.includes('pseudo')) {
          this.pseudos.push(element.id);
        }
      }
    })

    this.item.searchStatsCount.forEach((element: any) => {
      if (element.id !== '') {
        let value = {};
        let min = element.min;
        let max = element.max;

        if (!isNaN(min) && min != '') {
          Object.assign(value, { min: Number(min) });
        }

        if (!isNaN(max) && max != '') {
          Object.assign(value, { max: Number(max) });
        }

        if (element.option) {
          Object.assign(value, { option: element.option });
        }

        if (element.isSearch) searchCount++;

        this.filters.searchJson.query.stats[1].filters.push({
          "id": element.id,
          "disabled": !element.isSearch,
          "value": value
        })

        if (element.id.includes('pseudo')) {
          this.pseudos.push(element.id);
        }
      }
    })
    if (this.item.searchStatsCount.length > 0) {
      let value = {};
      let min = this.methodCount.min;
      let max = this.methodCount.max;

      if (!isNaN(Number(min)) && Number(min) > 0) {
        Object.assign(value, { min: Number(min) });
      }
      if (!isNaN(Number(max)) && Number(max) > 0) {
        Object.assign(value, { max: Number(max) });
      }

      this.filters.searchJson.query.stats[1].value = value
    }

    if (this.filters.searchJson.query.filters.equipment_filters.filters) {
      this.item.searchDefences.forEach((element: any) => {
        let value = {};

        if (element.isSearch) {
          Object.assign(value, { min: element.min });
          Object.assign(value, { max: element.max > element.min ? element.max : null });
          Object.assign(this.filters.searchJson.query.filters.equipment_filters.filters, JSON.parse(`{ "${this.defenceTypes.get(element.text)}" : ${JSON.stringify(value)} }`));
        }
      });
    }

    this.searchRange();
    this.priceSetting();
    this.corruptedSet();
    switch (this.item.category) {
      case 'item':
        if (this.item.name !== '') {
          this.ui.collapse.stats = true;
        }
        this.isRaritySearch();
        this.isItemBasicSearch();
        this.isItemCategorySearch();
        this.isItemLevelSearch();
        this.isItemSocketSearch();
        break;
      case 'map':
        this.ui.collapse.map = false;
        this.isRaritySearch();
        this.isMapLevelSearch();
        this.isMapAreaLevelSearch();
        break;
      case 'gem':
        this.ui.collapse.gem = !(this.searchOptions.gemLevel.min > 0);
        this.isRaritySearch();
        this.isGemBasicSearch();
        this.isGemLevelSearch();
        this.isGemQualitySearch();
        this.isGemSocketSearch();
        break;
      case 'unique':
        this.ui.collapse.stats = true;
        this.isItemSocketSearch();
        this.isRaritySearch();
        break;
      default:
        this.isRaritySearch();
        break;
    }

    console.log(this.filters.searchJson);
  }


  //是否針對物品等級搜尋
  isItemLevelSearch() {
    if (!this.searchOptions.itemLevel.isSearch) {
      this.filters.searchJson.query.filters.type_filters.filters.ilvl = {}; // 刪除物品等級 filter
    } else if (this.searchOptions.itemLevel.isSearch) {
      console.log(this.filters.searchJson);
      this.filters.searchJson.query.filters.type_filters.filters.ilvl = { // 增加物品等級最小值 filter
        min: this.searchOptions.itemLevel.min ? this.searchOptions.itemLevel.min : null,
        max: this.searchOptions.itemLevel.max ? this.searchOptions.itemLevel.max : null
      };
    }
  }

  //是否針對稀有度搜尋
  isRaritySearch() {
    if (!this.searchOptions.raritySet.isSearch) {
      // if (this.item.category !== 'currency' && this.item.category !== 'gem' && this.item.category !== '') {
      //   this.filters.searchJson.query.filters.type_filters.filters.rarity = {}; // 刪除稀有度 filter
      // } else {
      delete this.filters.searchJson.query.filters.type_filters.filters.rarity;
      // }
    } else if (this.searchOptions.raritySet.isSearch) {
      if (this.searchOptions.raritySet.chosenObj !== '') {
        this.filters.searchJson.query.filters.type_filters.filters.rarity = { // 增加稀有度 filter
          option: this.searchOptions.raritySet.chosenObj
        };
      } else {
        delete this.filters.searchJson.query.filters.type_filters.filters.rarity;
      }
    }
  }

  //是否針對寶石搜尋
  isGemBasicSearch() {
    if (!this.data.basics.gem.isSearch && Object.keys(this.filters.searchJson.query).includes("type")) {
      delete this.filters.searchJson.query.type; // 刪除技能基底 filter
    } else if (this.data.basics.gem.isSearch) {
      this.filters.searchJson.query.type = this.data.basics.gem.chosenG; // 增加技能基底 filter
    }
  }

  //是否針對寶石等級搜尋
  isGemLevelSearch() {
    if (!this.searchOptions.gemLevel.isSearch && Object.keys(this.filters.searchJson.query.filters.type_filters.filters).includes("gem_level")) {
      delete this.filters.searchJson.query.filters.type_filters.filters.gem_level; // 刪除技能品質 filter
    } else if (this.searchOptions.gemLevel.isSearch) {
      this.filters.searchJson.query.filters.type_filters.filters.gem_level = {
        min: this.searchOptions.gemLevel.min ? this.searchOptions.gemLevel.min : null,
        max: this.searchOptions.gemLevel.max ? this.searchOptions.gemLevel.max : null
      };
    }
  }

  //是否針對寶石品質搜尋
  isGemQualitySearch() {
    if (!this.searchOptions.gemQuality.isSearch && Object.keys(this.filters.searchJson.query.filters.type_filters.filters).includes("quality")) {
      delete this.filters.searchJson.query.filters.type_filters.filters.quality; // 刪除技能品質 filter
    } else if (this.searchOptions.gemQuality.isSearch) {
      this.filters.searchJson.query.filters.type_filters.filters.quality = {
        min: this.searchOptions.gemQuality.min ? this.searchOptions.gemQuality.min : null,
        max: this.searchOptions.gemQuality.max ? this.searchOptions.gemQuality.max : null
      };
    }
  }

  //是否針對寶石插槽搜尋
  isGemSocketSearch() {
    if (!this.searchOptions.gemSocket.isSearch && Object.keys(this.filters.searchJson.query.filters.misc_filters.filters).includes("gem_sockets")) {
      delete this.filters.searchJson.query.filters.misc_filters.filters.gem_sockets; // 刪除技能品質 filter
    } else if (this.searchOptions.gemSocket.isSearch) {
      this.filters.searchJson.query.filters.misc_filters.filters.gem_sockets = {
        min: this.searchOptions.gemSocket.min ? this.searchOptions.gemSocket.min : null,
        max: this.searchOptions.gemSocket.max ? this.searchOptions.gemSocket.max : null
      };
    }
  }

  //是否針對物品插槽搜尋
  isItemSocketSearch() {
    if (!this.searchOptions.itemSocket.isSearch && Object.keys(this.filters.searchJson.query.filters.equipment_filters.filters).includes("rune_sockets")) {
      delete this.filters.searchJson.query.filters.equipment_filters.filters.rune_sockets; // 刪除插槽 filter
    } else if (this.searchOptions.itemSocket.isSearch) {
      this.filters.searchJson.query.filters.equipment_filters.filters.rune_sockets = {
        min: this.searchOptions.itemSocket.min ? this.searchOptions.itemSocket.min : null,
        max: this.searchOptions.itemSocket.max ? this.searchOptions.itemSocket.max : null
      };
    }
  }

  //是否針對物品分類搜尋
  isItemCategorySearch() {
    if (!this.searchOptions.itemCategory.isSearch && this.searchOptions.itemCategory.chosenObj) {
      delete this.filters.searchJson.query.filters.type_filters.filters.category; // 刪除物品種類 filter
    } else if (this.searchOptions.itemCategory.isSearch && this.searchOptions.itemCategory.chosenObj) {
      this.filters.searchJson.query.filters.type_filters.filters.category = { // 增加物品種類 filter
        option: this.searchOptions.itemCategory.chosenObj
      };
    }
  }

  //是否針對物品基底搜尋
  isItemBasicSearch() {
    if (this.searchOptions.itemBasic.isSearch && this.searchOptions.itemBasic.text) {
      this.filters.searchJson.query.type = this.searchOptions.itemBasic.text;
    } else {
      delete this.filters.searchJson.query.type;
    }
  }

  //是否針對地圖階級搜尋
  isMapLevelSearch() {
    if (!this.searchOptions.mapLevel.isSearch && Object.keys(this.filters.searchJson.query.filters.map_filters.filters).includes("map_tier")) {
      delete this.filters.searchJson.query.filters.map_filters.filters.map_tier; // 刪除地圖階級 filter
    } else if (this.searchOptions.mapLevel.isSearch) {
      this.filters.searchJson.query.filters.map_filters.filters.map_tier = {// 指定地圖階級最小 / 最大值 filter
        min: this.searchOptions.mapLevel.min ? this.searchOptions.mapLevel.min : null,
        max: this.searchOptions.mapLevel.max ? this.searchOptions.mapLevel.max : null
      };
    }
  }

  //是否針對地圖區域等級搜尋
  isMapAreaLevelSearch() {
    if (!this.searchOptions.mapAreaLevel.isSearch && Object.keys(this.filters.searchJson.query.filters.misc_filters.filters).includes("area_level")) {
      delete this.filters.searchJson.query.filters.misc_filters.filters.area_level; // 刪除地圖區域等級 filter
    } else if (this.searchOptions.mapAreaLevel.isSearch) {
      this.filters.searchJson.query.filters.misc_filters.filters.area_level = {// 指定地圖區域等級最小 / 最大值 filter
        min: this.searchOptions.mapAreaLevel.min ? this.searchOptions.mapAreaLevel.min : null,
        max: this.searchOptions.mapAreaLevel.max ? this.searchOptions.mapAreaLevel.max : null
      };
    }
  }

  //開始冷靜
  startCountdown(Time: any) {
    this.app.countTime = Time * 1000;
    this.app.isCounting = true;
  }

  //點擊後搜尋
  clickToSearch() { // TODO: 重構物品/地圖交替搜尋時邏輯 stats: [{type: "and", filters: [], disabled: true(?)}]
    this.currentSortType = 'price'; // 點擊時恢復預設排序
    this.currentSortDir = 'asc';

    if (this.item.category === 'item' || this.item.category === 'unique' || this.item.category === 'map') {
      this.filters.searchJson.query.stats = [{ "type": "and", "filters": [] }];
      this.filters.searchJson.query.filters.equipment_filters = { filters: {} };
    }
    // else if (this.item.category === 'map' && this.basics.map.isSearch) {
    //   console.log('map進來了');
    //   this.item.name = `物品名稱 <br>『${this.basics.map.chosenM}』`;
    // } else if (this.item.category === 'gem' && this.basics.gem.isSearch) { //需要重看
    //   this.item.name = `物品名稱 <br>『${this.basics.gem.chosenG}』`
    // }

    this.searchTrade();
  }

  //更新價格
  priceSetting() {
    if (this.searchOptions.priceSetting.chosenObj !== '') {
      this.filters.searchJson.query.filters.type_filters.filters.price = { // 增加價格 filter
        option: this.searchOptions.priceSetting.chosenObj
      };
    } else {
      this.filters.searchJson.query.filters.type_filters.filters.price = {}; // 刪除價格 filter
    }
  }

  //開啟官方交易市集
  openOfficalTradeSite() {
    this.shell.openExternal(`${this.app.baseUrl}/trade2/search/poe2/${this.searchOptions.leagues.chosenL}/${this.searchResult.fetchQueryID}`);
  }

  //已汙染設定
  corruptedSet() {
    if (this.searchOptions.corruptedSet.chosenObj === 'any') {
      if (Object.keys(this.filters.searchJson.query.filters.misc_filters.filters).includes("corrupted")) {
        delete this.filters.searchJson.query.filters.misc_filters.filters.corrupted; // 刪除已汙染 filter
      }
    } else {
      Object.assign(this.filters.searchJson.query.filters.misc_filters.filters, { // 增加已汙染 filter
        corrupted: {
          option: this.searchOptions.corruptedSet.chosenObj
        }
      });
    }
  }

  //搜尋範圍設定
  searchRange() {
    this.filters.searchJson.query.status.option = this.searchOptions.ranges.chosenObj;
  }

  //子元件回傳狀態
  countingStatus($e: any) {
    this.app.isCounting = $e;
  }

  private onClipboardChanged(content: string) {
    if (content.indexOf('稀有度: ') > -1) {
      this.app.preCopyText = content;

      setTimeout(() => {
        this.analyze(content);
      }, 50);
    }
  }

  /**
   * 移除特定索引的防禦屬性
   */
  removeDefence(index: number) {
    this.item.searchDefences.splice(index, 1);
    this.cdr.markForCheck();
  }

  /**
   * 移除插槽過濾（重置數值與搜尋開關）
   */
  removeSocket() {
    this.searchOptions.itemSocket.min = 0;
    this.searchOptions.itemSocket.isSearch = false;
    this.cdr.markForCheck();
  }

  /**
   * 移除特定索引的詞綴
   */
  removeStat(index: number, type: string) {
    switch (type) {
      case 'and':
        this.item.searchStats.splice(index, 1);
        break;
      case 'count':
        this.item.searchStatsCount.splice(index, 1);
        break;
    }
    this.cdr.markForCheck();
  }

  /**
   * 當 SESSIONID 變更時同步至主程序
   */
  onSessionIdChange() {
    this.poeSessionStatus = 'checking';
    (<any>window).ipcRenderer.send('set-poesessid', this.poeSessionId);
    this.sessionCheckSubject.next(this.poeSessionId);
  }

  /**
   * 驗證 Session 有效性
   */
  validatePoeSession() {
    if (!this.poeSessionId) {
      this.poeSessionStatus = null;
      this.cdr.markForCheck();
      return;
    }

    this.poe_service.validateSession().subscribe({
      next: () => {
        this.poeSessionStatus = 'valid';
        this.cdr.markForCheck();
      },
      error: () => {
        this.poeSessionStatus = 'invalid';
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * 當自定義分類變更時，同步更新 item.category 以確保正確的搜尋邏輯與介面顯示
   */
  onCategoryChange() {
    if (this.searchOptions.itemCategory.chosenObj && this.searchOptions.itemCategory.chosenObj.startsWith('map')) {
      this.item.category = 'map';
    } else {
      this.item.category = 'item';
    }
    this.cdr.markForCheck();
  }

  //顯示自定義搜尋介面
  showCustomArea() {
    //隱藏其他介面
    this.resetSearchData();

    // 使用深拷貝避免污染原始樣板物件
    this.filters.searchJson = JSON.parse(JSON.stringify(this.filters.searchJson_Def));

    this.searchOptions.raritySet.isSearch = false;

    this.updateCategoryOptions();
    this.searchOptions.itemCategory.chosenObj = '';
    this.searchOptions.itemCategory.isSearch = false;

    this.ui.collapse.custom = false;
    this.ui.collapse.item = false;
  }

  /**
   * 根據指定白名單過濾物品分類，並確保 prop 值不重複
   */
  private updateCategoryOptions() {
    const allowedPrefixes = ['accessory', 'armour', 'flask', 'jewel', 'weapon', 'map', 'sanctum'];
    const uniqueOptions = new Map<string, { label: string, prop: string }>();
    const basicsSet = new Set<string>();

    this.data.basics.categorizedItems.forEach((item: any) => {
      // 填充物品名稱到基底清單供 Typeahead 選取
      if (item.type) basicsSet.add(item.type);

      const root = item.option?.split('.')[0];
      if (allowedPrefixes.includes(root) && !uniqueOptions.has(item.option)) {
        uniqueOptions.set(item.option, { label: item.name, prop: item.option });
      }
    });

    this.itemBasics = Array.from(basicsSet);
    this.searchOptions.itemCategory.option = [
      { label: '任何', prop: '' },
      ...Array.from(uniqueOptions.values())
    ];
  }

  //儲存自訂搜尋設定
  clickToSaveCustomSearch() {
    // 1. 同步目前的 UI 狀態到 searchJson
    this.prepareSearchJson();

    let saveName = '';
    let isOverwrite = false;

    if (this.currentLoadedName) {
      saveName = this.currentLoadedName;
      isOverwrite = true;
    } else {
      // 自動命名邏輯 (Custom1, Custom2...)
      const nextIndex = this.savedSearches.length + 1;
      saveName = `Custom${nextIndex}`;
    }

    const saveData = {
      name: saveName,
      overwrite: isOverwrite,
      content: JSON.parse(JSON.stringify(this.filters.searchJson)),
      item: JSON.parse(JSON.stringify(this.item)),
      searchOptions: JSON.parse(JSON.stringify(this.searchOptions))
    };

    // 3. 透過 IPC 傳送至主程序儲存為 JSON 檔案
    (<any>window).ipcRenderer.send('save-custom-search', saveData);

    // 4. 更新本地清單
    if (isOverwrite) {
      const idx = this.savedSearches.findIndex(s => s.name === saveName);
      if (idx !== -1) this.savedSearches[idx] = saveData;
      this.showToast(`已成功覆蓋設定：${saveName}`);
    } else {
      this.savedSearches.push(saveData);
      this.showToast(`已成功儲存設定：${saveName}`);
    }

    this.cdr.markForCheck();
  }

  //顯示提示
  private showToast(msg: string) {
    this.app.saveSuccessStr = msg;
    this.app.isSaveSuccess = true;
    this.cdr.markForCheck();
    // 3 秒後自動隱藏提示文字
    setTimeout(() => {
      this.app.isSaveSuccess = false;
      this.app.saveSuccessStr = '';
      this.cdr.markForCheck();
    }, 3000);
  }

  /**
   * 載入選定的自訂搜尋
   */
  loadSavedSearch(index: any) {
    if (index === undefined || index === null) return;

    this.selectedSavedSearchIndex = index;
    const saved = this.savedSearches[index];
    if (saved) {
      this.currentLoadedName = saved.name;
      // 還原搜尋用的 JSON 結構
      if (saved.content) this.filters.searchJson = JSON.parse(JSON.stringify(saved.content));

      // 還原 UI 繫結的物品資料 (名稱、基底、詞綴清單等)
      if (saved.item) this.item = JSON.parse(JSON.stringify(saved.item));

      // 還原搜尋選項 (等級、插槽、稀有度、分類勾選狀態等)
      if (saved.searchOptions) this.searchOptions = JSON.parse(JSON.stringify(saved.searchOptions));

      // 自動展開相關介面以顯示讀取後的內容
      this.ui.collapse.custom = false;
      this.ui.collapse.item = false;
      if (this.item.searchStats.length > 0 || this.item.searchDefences.length > 0) {
        this.ui.collapse.stats = false;
      }

      this.cdr.markForCheck();
    }
  }

  /**
   * 重新命名自訂搜尋
   */
  clickToRename(content: any, index: number, event: Event) {
    event.stopPropagation(); // 防止觸發下拉選單的點擊載入
    const saved = this.savedSearches[index];
    this.tempRenameValue = saved.name;

    this.modalService.open(content, { centered: true }).result.then((result) => {
      if (result === 'ok' && this.tempRenameValue && this.tempRenameValue !== saved.name) {
        const oldName = saved.name;
        const newName = this.tempRenameValue;
        saved.name = newName;
        if (this.currentLoadedName === oldName) this.currentLoadedName = newName;

        (<any>window).ipcRenderer.send('rename-custom-search', { oldName, newName, data: saved });
        this.showToast(`已重新命名為：${newName}`);
        this.cdr.markForCheck();
      }
    }, () => { });
  }

  /**
   * 刪除自訂搜尋
   */
  clickToDelete(content: any, index: number, event: Event) {
    event.stopPropagation(); // 防止觸發載入
    const saved = this.savedSearches[index];

    this.modalService.open(content, { centered: true }).result.then((result) => {
      if (result === 'ok') {
        (<any>window).ipcRenderer.send('delete-custom-search', saved.name);
        this.savedSearches.splice(index, 1);
        if (this.currentLoadedName === saved.name) {
          this.resetSearchData();
        }
        this.showToast(`已刪除設定：${saved.name}`);
        this.cdr.markForCheck();
      }
    }, () => { });
  }

  statsFilter(statsFilter: any) {
    const statTypes = ["enchant", "skill", "implicit", "rune", "fractured", "explicit", "crafted", "desecrated"];

    statTypes.forEach(type => {
      if (statsFilter.hashs[type]) {
        statsFilter.hashs[type].forEach((hash: any) => {
          const statId = hash[0];
          const statText = this.data.statsById[type].get(statId);

          // 檢查是否已存在於目前的搜尋列表中，避免重複加入
          const exists = this.item.searchStats.some((s: any) => s.id === statId);

          if (statText && !exists) {
            // 使用 push 並在最後觸發 cdr
            this.item.searchStats = [...this.item.searchStats, {
              id: statId,
              text: statText,
              option: "",
              min: "",
              max: "",
              isValue: false,
              isSearch: true,
              type: statsFilter.rarity === 'Unique' ? "傳奇" : this.categoryLabels[type],
              level: -1 // 自定義詞綴設定為 -1 以區別於分析出的階層
            }];
          }
        })
      }
    });

    this.ui.collapse.stats = false; // 關鍵：選擇後強制展開詞綴列表介面
    this.customStat = ''; // 選擇完畢後清空輸入框內容
    this.cdr.markForCheck();
  }

  changeSort(sort: any) {
    this.filters.searchJson.sort = sort;
    // 解析傳入的物件以記錄目前的狀態
    const entries = Object.entries(sort);
    if (entries.length > 0) {
      this.currentSortType = entries[0][0];
      this.currentSortDir = entries[0][1] as any;
    }
    this.searchTrade();
    this.cdr.markForCheck();
  }
}
