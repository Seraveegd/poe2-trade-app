import { Component, OnInit, inject, effect, OnDestroy, NgZone } from '@angular/core';
import { NgbCollapseModule, NgbTooltipModule, NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';
import { AppService } from '../app.service';
import { AnalyzeComponent } from "./analyze/analyze.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Shell } from 'electron';
import { ClipboardService } from './clipboard.service';

import { Subscription } from 'rxjs';
import { Data } from './data';

@Component({
  selector: 'app-home',
  imports: [
    NgbCollapseModule,
    NgbTooltipModule,
    NgbAlertModule,
    FormsModule,
    CommonModule,
    AnalyzeComponent
  ],
  providers: [AppService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  public clipboard = inject(ClipboardService);
  private shell!: Shell;
  private subscriptions = new Subscription();

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
    ['偽屬性', '#545454']
  ]);

  // //詞綴種類
  // public statTypes = [
  //   ['implicit', '固定'],
  //   ['rune', '增幅'],
  //   ['enchant', '附魔'],
  //   ['desecrated', '褻瀆'],
  //   ['fractured', '破裂'],
  //   ['sanctum', '聖所']
  // ];

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

  //目前相關狀態
  public app: any = {
    baseUrl: 'https://pathofexile.tw',
    isTwServer: true,
    onReady: false,
    isCounting: false,
    isApiError: false,
    apiErrorStr: '',
    // issueText: '',
    countTime: 0,
    preCopyText: ''
  };

  //介面開關
  public ui: any = {
    collapse: {
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
    searchStats: [], // 分析拆解後的物品詞綴陣列，提供使用者在界面勾選是否查詢及輸入數值
    searchDefences: []
  };

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
      chosenObj: {
        label: "任何",
        prop: ''
      },
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

  constructor(private poe_service: AppService, private ngZone: NgZone) {
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
    (<any>window).ipcRenderer.on('visibility-change', (e: any, state: any) => {
      this.ngZone.run(() => {
        if (state === 'blur' || state === false) {
          this.app.preCopyText = '';
          // 關鍵：強制重置 Signal 內容，確保下次複製相同物品時能觸發 effect
          this.clipboard.currentText.set('');
        }
      });
    });
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
    this.ngZone.run(() => {
      if (!data) {
        console.error('[Worker] Received undefined data');
        this.app.isCounting = false;
        return;
      }

      console.log('[Worker] Data received:', data);

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
    this.ui.collapse.item = true;
    this.ui.collapse.gem = true;
    this.ui.collapse.map = true;

    this.item.name = '';
    this.item.category = '';
    this.item.supported = true;

    this.searchResult.fetchID.length = 0;

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

    this.app.apiErrorStr = '';
  }

  //建立搜尋資料
  searchTrade() {
    this.app.isCounting = true;
    this.app.apiErrorStr = '';
    this.item.supported = true;

    let searchCount = 0;

    if (this.filters.searchJson.query.stats[0].filters.length === 0) {
      this.item.searchStats.forEach((element: any, index: any, array: any) => {
        if (element.id !== '') {
          let value = {};
          let min = element.min;
          let max = element.max;

          if (!isNaN(min) && min != '') {
            Object.assign(value, { min: min });
          }

          if (!isNaN(max) && max != '') {
            Object.assign(value, { max: max });
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
        }
      })
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
        this.ui.collapse.stats = true;
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

    this.searchResult.fetchQueryID = '';
    this.searchResult.searchTotal = 0;
    this.subscriptions.add(this.poe_service.get_trade(this.searchOptions.leagues.chosenL, this.filters.searchJson).subscribe((res: any) => {
      if (res && !res.error) {
        this.searchResult.resultLength = res.result.length;
        this.searchResult.searchTotal = res.total; // 總共搜到幾項物品

        this.searchResult.status = ` 共 ${this.searchResult.searchTotal} 筆符合 ${this.ui.collapse.price && this.searchResult.searchTotal !== this.searchResult.resultLength ? '- 報價已摺疊' : ''}`;
        this.searchResult.fetchQueryID = res.id;
        this.searchResult.fetchID = res.result;

        if (res.total === 0) {
          this.app.isCounting = false;
        }

        this.app.isApiError = false;
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
      if (this.item.category !== 'currency' && this.item.category !== 'gem') {
        this.filters.searchJson.query.filters.type_filters.filters.rarity = {}; // 刪除稀有度 filter
      } else {
        delete this.filters.searchJson.query.filters.type_filters.filters.rarity;
      }
    } else if (this.searchOptions.raritySet.isSearch) {
      this.filters.searchJson.query.filters.type_filters.filters.rarity = { // 增加稀有度 filter
        option: this.searchOptions.raritySet.chosenObj
      };
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
      delete this.filters.searchJson.query.filters.equipment_filters.filters.rune_sockets; // 刪除技能品質 filter
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
      this.filters.searchJson.query.filters.type_filters.filters.category = {}; // 刪除物品種類 filter
    } else if (this.searchOptions.itemCategory.isSearch && this.searchOptions.itemCategory.chosenObj) {
      this.filters.searchJson.query.filters.type_filters.filters.category = { // 增加物品種類 filter
        option: this.searchOptions.itemCategory.chosenObj
      };
    }
  }

  //是否針對物品基底搜尋
  isItemBasicSearch() {
    if (!this.searchOptions.itemBasic.isSearch && Object.keys(this.filters.searchJson.query).includes("type")) {
      delete this.filters.searchJson.query.type // 刪除物品基底 filter
    } else if (this.searchOptions.itemBasic.isSearch) {
      Object.assign(this.filters.searchJson.query, { // 增加物品基底 filter
        type: this.searchOptions.itemBasic.text
      });
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
}
