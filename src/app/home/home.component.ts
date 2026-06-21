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
  public itemIcons = new Map<string, string>();
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
  @ViewChild(AnalyzeComponent) analyzeComponent!: AnalyzeComponent;

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
  private searchSubscription?: Subscription;

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
      stats: true,
      advanced: true
    }
  }

  //過濾面板勾選狀態
  public filterPanel = {
    checked: {
      all: false,
      c1: false,
      c2: false,
      c3: false,
      c4: false,
      c5: false
    }
  }

  // UX 架構展示區塊專用的資料模型
  public uxSearchOptions: any = {
    base: {
      category: '',
      rarity: '',
      ilvl: { min: '', max: '' },
      quality: { min: '', max: '' }
    },
    equipment: {
      damage: { min: '', max: '' },
      aps: { min: '', max: '' },
      crit: { min: '', max: '' },
      dps: { min: '', max: '' },
      pdps: { min: '', max: '' },
      edps: { min: '', max: '' },
      reload_time: { min: '', max: '' },
      ar: { min: '', max: '' },
      ev: { min: '', max: '' },
      es: { min: '', max: '' },
      ward: { min: '', max: '' },
      block: { min: '', max: '' },
      spirit: { min: '', max: '' },
      rune_sockets: { min: '', max: '' }
    },
    requirements: {
      lvl: { min: '', max: '' },
      str: { min: '', max: '' },
      dex: { min: '', max: '' },
      int: { min: '', max: '' }
    },
    maps: {
      map_tier: { min: '', max: '' },
      map_packsize: { min: '', max: '' },
      map_magic_monsters: { min: '', max: '' },
      map_rare_monsters: { min: '', max: '' },
      map_iir: { min: '', max: '' },
      map_revives: { min: '', max: '' },
      map_bonus: { min: '', max: '' },
      map_gold: { min: '', max: '' },
      map_experience: { min: '', max: '' },
      ultimatum_hint: ''
    },
    misc: {
      gem_level: { min: '', max: '' },
      gem_sockets: { min: '', max: '' },
      area_level: { min: '', max: '' },
      stack_size: { min: '', max: '' },
      identified: '',
      fractured_item: '',
      corrupted: '',
      sanctified: '',
      twice_corrupted: '',
      mutated: '',
      veiled: '',
      desecrated: '',
      crafted: '',
      foreseeing: '',
      mirrored: '',
      sanctum_gold: { min: '', max: '' },
      unidentified_tier: { min: '', max: '' }
    }
  };

  /**
   * 遞迴地過濾物件，只保留非空（非空字串、非null、非undefined、非空物件/陣列）的屬性。
   * 用於在偵錯區塊中顯示更精簡的 uxSearchOptions 狀態。
   * @param obj 待過濾的物件或值
   * @returns 過濾後的物件或值，如果整個物件/陣列為空則返回 undefined
   */
  public getFilteredUxSearchOptions(obj: any): any {
    // 核心修正：統一處理 null, undefined 與空字串，將其視為不可顯示的過濾項
    if (obj === null || obj === undefined || obj === '') {
      return undefined;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // 如果是陣列，遞迴過濾其元素
    if (Array.isArray(obj)) {
      const filteredArray = obj.map(item => this.getFilteredUxSearchOptions(item)).filter(item => {
        // 過濾掉 undefined, null, 空字串, 以及遞迴後變為空物件/空陣列的元素
        if (item === undefined || item === null || item === '') {
          return false;
        }
        if (typeof item === 'object' && Object.keys(item).length === 0) {
          return false;
        }
        return true;
      });
      // 如果陣列過濾後為空，則返回 undefined
      return filteredArray.length > 0 ? filteredArray : undefined;
    }

    // 如果是物件，遞迴過濾其屬性
    const filteredObj: any = {};
    let hasNonEmptyProperty = false;

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const filteredValue = this.getFilteredUxSearchOptions(obj[key]);
        if (filteredValue !== undefined) { // 只保留非 undefined 的值
          filteredObj[key] = filteredValue;
          hasNonEmptyProperty = true;
        }
      }
    }
    // 如果物件過濾後為空，則返回 undefined
    return hasNonEmptyProperty ? filteredObj : undefined;
  }

  /**
   * 取得 UX 搜尋選項的預設結構
   */
  private getUxSearchOptionsDefaults(): any {
    return {
      base: { category: '', rarity: '', ilvl: { min: '', max: '' }, quality: { min: '', max: '' } },
      equipment: {
        damage: { min: '', max: '' }, aps: { min: '', max: '' }, crit: { min: '', max: '' }, dps: { min: '', max: '' },
        pdps: { min: '', max: '' }, edps: { min: '', max: '' }, reload_time: { min: '', max: '' }, ar: { min: '', max: '' },
        ev: { min: '', max: '' }, es: { min: '', max: '' }, ward: { min: '', max: '' }, block: { min: '', max: '' },
        spirit: { min: '', max: '' }, rune_sockets: { min: '', max: '' }
      },
      requirements: {
        lvl: { min: '', max: '' }, str: { min: '', max: '' }, dex: { min: '', max: '' }, int: { min: '', max: '' }
      },
      maps: {
        map_tier: { min: '', max: '' }, map_packsize: { min: '', max: '' }, map_magic_monsters: { min: '', max: '' },
        map_rare_monsters: { min: '', max: '' }, map_iir: { min: '', max: '' }, map_revives: { min: '', max: '' },
        map_bonus: { min: '', max: '' }, map_gold: { min: '', max: '' }, map_experience: { min: '', max: '' },
        ultimatum_hint: ''
      },
      misc: {
        gem_level: { min: '', max: '' }, gem_sockets: { min: '', max: '' }, area_level: { min: '', max: '' },
        stack_size: { min: '', max: '' }, identified: '', fractured_item: '', corrupted: '', sanctified: '',
        twice_corrupted: '', mutated: '', veiled: '', desecrated: '', crafted: '', foreseeing: '',
        mirrored: '', sanctum_gold: { min: '', max: '' }, unidentified_tier: { min: '', max: '' }
      }
    };
  }

  /**
   * 判斷過濾條件是否處於啟動狀態
   * 排除 null, undefined 與空字串
   * @param value 欲檢查的數值
   * @returns 是否為啟動狀態
   */
  public isFilterActive(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * 計算特定區塊中已啟用的過濾器數量
   * @param section 區塊物件 (如 uxSearchOptions.base)
   */
  public getActiveFilterCount(section: any): number {
    if (!section) return 0;
    let count = 0;
    for (const key in section) {
      const val = section[key];
      // 如果是包含 min/max 的物件，只要其中一個有值就計為 1 項
      if (val && typeof val === 'object' && ('min' in val || 'max' in val)) {
        if (this.isFilterActive(val.min) || this.isFilterActive(val.max)) {
          count++;
        }
      } else if (this.isFilterActive(val)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 計算 uxSearchOptions 全部的啟用過濾器總數
   */
  public get totalUxFilterCount(): number {
    return (this.filterPanel.checked.c1 ? this.getActiveFilterCount(this.uxSearchOptions.base) : 0) +
      (this.filterPanel.checked.c2 ? this.getActiveFilterCount(this.uxSearchOptions.equipment) : 0) +
      (this.filterPanel.checked.c3 ? this.getActiveFilterCount(this.uxSearchOptions.requirements) : 0) +
      (this.filterPanel.checked.c4 ? this.getActiveFilterCount(this.uxSearchOptions.maps) : 0) +
      (this.filterPanel.checked.c5 ? this.getActiveFilterCount(this.uxSearchOptions.misc) : 0);
  }

  /**
   * 檢查 uxSearchOptions 中是否有任何無效的範圍
   */
  public get hasUxSearchError(): boolean {
    const sections = [
      this.uxSearchOptions.base,
      this.uxSearchOptions.equipment,
      this.uxSearchOptions.requirements,
      this.uxSearchOptions.maps,
      this.uxSearchOptions.misc
    ];
    return sections.some(section => {
      return Object.values(section).some((val: any) =>
        val && typeof val === 'object' && 'min' in val && 'max' in val && this.isRangeInvalid(val)
      );
    });
  }

  /**
   * 驗證數值範圍是否有效
   */
  public isRangeInvalid(range: any): boolean {
    if (!range || range.min === '' || range.max === '' || range.min === null || range.max === null) {
      return false;
    }
    return Number(range.min) > Number(range.max);
  }

  /**
   * 重置特定 UX 搜尋區塊
   */
  public resetUxSection(section: 'base' | 'equipment' | 'requirements' | 'maps' | 'misc') {
    const defaults = this.getUxSearchOptionsDefaults();
    this.uxSearchOptions[section] = JSON.parse(JSON.stringify(defaults[section]));
    this.cdr.markForCheck();
  }

  /**
   * 重置所有 UX 搜尋選項
   */
  public resetUxSearchOptions() {
    this.resetUxSection('base');
    this.resetUxSection('equipment');
    this.resetUxSection('requirements');
    this.resetUxSection('maps');
    this.resetUxSection('misc');
  }

  public options = {
    category: [
      {
        "id": null,
        "text": "任何"
      },
      {
        "id": "weapon",
        "text": "武器"
      },
      {
        "id": "weapon.onemelee",
        "text": "任何單手近戰武器"
      },
      {
        "id": "weapon.unarmed",
        "text": "空手"
      },
      {
        "id": "weapon.claw",
        "text": "爪"
      },
      {
        "id": "weapon.dagger",
        "text": "匕首"
      },
      {
        "id": "weapon.onesword",
        "text": "單手劍"
      },
      {
        "id": "weapon.oneaxe",
        "text": "單手斧"
      },
      {
        "id": "weapon.onemace",
        "text": "單手錘"
      },
      {
        "id": "weapon.spear",
        "text": "長鋒"
      },
      {
        "id": "weapon.flail",
        "text": "鏈錘"
      },
      {
        "id": "weapon.twomelee",
        "text": "任何雙手近戰武器"
      },
      {
        "id": "weapon.twosword",
        "text": "雙手劍"
      },
      {
        "id": "weapon.twoaxe",
        "text": "雙手斧"
      },
      {
        "id": "weapon.twomace",
        "text": "雙手錘"
      },
      {
        "id": "weapon.warstaff",
        "text": "細杖"
      },
      {
        "id": "weapon.talisman",
        "text": "魔符"
      },
      {
        "id": "weapon.ranged",
        "text": "任何遠程武器"
      },
      {
        "id": "weapon.bow",
        "text": "弓"
      },
      {
        "id": "weapon.crossbow",
        "text": "十字弓"
      },
      {
        "id": "weapon.caster",
        "text": "任何法術武器"
      },
      {
        "id": "weapon.wand",
        "text": "法杖"
      },
      {
        "id": "weapon.sceptre",
        "text": "權杖"
      },
      {
        "id": "weapon.staff",
        "text": "長杖"
      },
      {
        "id": "weapon.rod",
        "text": "釣竿"
      },
      {
        "id": "armour",
        "text": "任意護甲"
      },
      {
        "id": "armour.helmet",
        "text": "頭盔"
      },
      {
        "id": "armour.chest",
        "text": "胸甲"
      },
      {
        "id": "armour.gloves",
        "text": "手套"
      },
      {
        "id": "armour.boots",
        "text": "鞋子"
      },
      {
        "id": "armour.quiver",
        "text": "箭袋"
      },
      {
        "id": "armour.shield",
        "text": "盾"
      },
      {
        "id": "armour.focus",
        "text": "法器"
      },
      {
        "id": "armour.buckler",
        "text": "輕盾"
      },
      {
        "id": "accessory",
        "text": "配件"
      },
      {
        "id": "accessory.amulet",
        "text": "項鍊"
      },
      {
        "id": "accessory.belt",
        "text": "腰帶"
      },
      {
        "id": "accessory.ring",
        "text": "戒指"
      },
      {
        "id": "gem",
        "text": "任何寶石"
      },
      {
        "id": "gem.activegem",
        "text": "技能寶石"
      },
      {
        "id": "gem.supportgem",
        "text": "輔助寶石"
      },
      {
        "id": "gem.metagem",
        "text": "主要寶石"
      },
      {
        "id": "jewel",
        "text": "任何珠寶"
      },
      {
        "id": "flask",
        "text": "任何藥劑"
      },
      {
        "id": "flask.life",
        "text": "生命藥劑"
      },
      {
        "id": "flask.mana",
        "text": "魔力藥劑"
      },
      {
        "id": "flask.charm",
        "text": "護符"
      },
      {
        "id": "map",
        "text": "任何終局物品"
      },
      {
        "id": "map.waystone",
        "text": "換界石"
      },
      {
        "id": "map.fragment",
        "text": "地圖碎片"
      },
      {
        "id": "map.logbook",
        "text": "日誌"
      },
      {
        "id": "map.breachstone",
        "text": "裂痕石"
      },
      {
        "id": "map.barya",
        "text": "巨靈之幣"
      },
      {
        "id": "map.bosskey",
        "text": "巔峰鑰匙"
      },
      {
        "id": "map.ultimatum",
        "text": "通牒鑰匙"
      },
      {
        "id": "map.tablet",
        "text": "碑牌"
      },
      {
        "id": "card",
        "text": "命運卡"
      },
      {
        "id": "sanctum.relic",
        "text": "古典"
      },
      {
        "id": "currency",
        "text": "任何通貨"
      },
      {
        "id": "currency.omen",
        "text": "預兆"
      },
      {
        "id": "currency.socketable",
        "text": "任何增幅"
      },
      {
        "id": "currency.rune",
        "text": "符文"
      },
      {
        "id": "currency.soulcore",
        "text": "靈魂核心"
      },
      {
        "id": "currency.idol",
        "text": "魔偶"
      }
    ],
    rarity: [
      {
        "id": null,
        "text": "任何"
      },
      {
        "id": "normal",
        "text": "一般"
      },
      {
        "id": "magic",
        "text": "魔法"
      },
      {
        "id": "rare",
        "text": "稀有"
      },
      {
        "id": "unique",
        "text": "傳奇"
      },
      {
        "id": "uniquefoil",
        "text": "傳奇 (貼模)"
      },
      {
        "id": "nonunique",
        "text": "非傳奇道具"
      }
    ]
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
    serverOptions: ['台服', '國際服'],
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
    },
    itemBasic: { // 搜尋設定->物品基底
      text: '',
      isSearch: false
    },
    itemCategory: { // 物品分類
      option: [],
    },
    priceSetting: { // 搜尋設定->價格設定
      options: [{
        label: "等同崇高石",
        prop: ''
      }, {
        label: "崇高石或神聖石",
        prop: 'exalted_divine'
      }, {
        label: "崇高石",
        prop: 'exalted'
      }, {
        label: "神聖石",
        prop: 'divine'
      }, {
        label: "混沌石",
        prop: 'chaos'
      }, {
        label: "機會石",
        prop: 'chance'
      }, {
        label: "增幅石",
        prop: "aug"
      }, {
        label: "蛻變石",
        prop: "transmute"
      }, {
        label: "瓦爾寶珠",
        prop: "vaal"
      }, {
        label: "點金石",
        prop: "alch"
      }, {
        label: "無效石",
        prop: "annul"
      }, {
        label: "卡蘭德魔鏡",
        prop: "mirror"
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
    },
    itemSocket: {
      min: 0,
      max: '',
      isSearch: false
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
          "type_filters": {//類別過濾
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
          "misc_filters": {//其它
            "filters": {}
          },
          "map_filters": {//終局篩選器
            "filters": {}
          },
          "equipment_filters": {//裝備篩選器
            "filters": {}
          },
          "req_filters": {//物品需求
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

    this.getLeagues();

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

  onServerChange($e: any) {
    if ($e.target.selectedIndex === 0) {
      this.poe_service.setUrl("https://pathofexile.tw");
    } else {
      this.poe_service.setUrl("https://www.pathofexile.com");
    }
    this.getLeagues();
  }

  getLeagues() {
    //取得聯盟資料
    this.subscriptions.add(this.poe_service.get_leagues().subscribe((res: any) => {
      this.searchOptions.leagues.options = [];
      this.searchOptions.leagues.chosenL = null;

      if (res) {
        this.searchOptions.leagues.options = res.result.filter((data: any) => data.realm == 'poe2');
        this.searchOptions.leagues.chosenL = this.searchOptions.leagues.options[0].text;
      }

      this.cdr.markForCheck();
    }));
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

        // 確保目標陣列存在，避免舊有的儲存設定因缺少欄位而崩潰
        if (!this.item[targetKey]) {
          this.item[targetKey] = [];
        }

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
    // 初始化時深層複製預設搜尋 JSON 結構，確保觀測對象具有完整的初始屬性
    this.filters.searchJson = JSON.parse(JSON.stringify(this.filters.searchJson_Def));
  }

  /**
   * 用於在 UI 即時預覽目前的搜尋 JSON 狀態 (filters.searchJson)
   */
  public get liveSearchJson(): any {
    this.prepareSearchJson();
    return this.filters.searchJson;
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
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
        uxSearchOptions: this.uxSearchOptions,
        weaponTypes: Object.fromEntries(this.weaponTypes)
      });
      this.workerInitialized = true;
    }

    // 2. 後續分析僅傳送物品文字與基本配置，大幅減少負擔
    this.worker?.postMessage({
      type: 'ANALYZE',
      text,
      uxSearchOptions: this.uxSearchOptions,
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
      const { item, filters, searchOptions, uxSearchOptions, ui, basicsUpdate } = data;
      this.item = item;
      this.filters.searchJson = filters.searchJson;
      this.searchOptions = searchOptions;
      this.uxSearchOptions = uxSearchOptions;
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

      this.searchTrade();
    });
  }


  //重置搜尋資料
  resetSearchData() {
    this.ui.collapse.custom = true;
    this.ui.collapse.advanced = true;

    this.selectedSavedSearchIndex = null;
    this.isPoeSessionVisible = false;
    this.currentLoadedName = null;
    this.item.name = '';
    this.item.category = '';
    this.item.copyText = '';
    this.item.supported = true;

    this.searchOptions.itemSocket.isSearch = false;
    this.searchOptions.itemSocket.min = 0;
    this.searchOptions.itemSocket.max = '';

    this.searchResult.fetchID.length = 0;
    this.searchResult.searchTotal = 0;
    this.searchResult.resultLength = 0;

    this.searchOptions.itemBasic.text = '';
    this.searchOptions.itemBasic.isSearch = false;

    this.searchResult.fetchQueryID = '';
    this.searchResult.status = '';
    this.searchResult.extraFilterStr = '';

    this.item.searchStats = [];
    this.item.searchDefences = [];

    this.resetUxSearchOptions();
    this.resetFilterPanel();

    this.currentSortType = 'price'; // 重置時恢復預設排序
    this.currentSortDir = 'asc';

    this.app.apiErrorStr = '';
    this.app.preCopyText = '';

    this.cdr.markForCheck();
  }

  //建立搜尋資料
  searchTrade() {
    // 稀有物品停止搜尋，選擇詞綴才搜尋
    if (this.ui.collapse.custom && !this.ui.collapse.stats) {
      this.app.isCounting = false;
      this.filterPanel.checked.all = true;
      this.filterPanel.checked.c1 = true;
      this.filterPanel.checked.c2 = true;
      this.filterPanel.checked.c3 = true;
      this.filterPanel.checked.c4 = true;
      this.filterPanel.checked.c5 = true;
      return;
    }

    if (this.ui.collapse.custom) {
      this.filterPanel.checked.all = true;
      this.filterPanel.checked.c1 = true;
      this.filterPanel.checked.c2 = true;
      this.filterPanel.checked.c3 = true;
      this.filterPanel.checked.c4 = true;
      this.filterPanel.checked.c5 = true;
    }

    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }

    this.prepareSearchJson();

    this.app.isCounting = true;
    this.app.apiErrorStr = '';
    this.item.supported = true;

    this.searchResult.fetchQueryID = '';
    this.searchResult.searchTotal = 0;
    this.searchSubscription = this.poe_service.get_trade(this.searchOptions.leagues.chosenL, this.filters.searchJson).subscribe({
      next: (res: any) => {
        if (res && !res.error) {
          // 關鍵：使用解構賦值建立新物件參考，確保 AnalyzeComponent 的 ngOnChanges 能被觸發
          this.searchResult = {
            ...this.searchResult,
            resultLength: res.result.length,
            searchTotal: res.total,
            status: ` 共 ${res.total} 筆符合`,
            fetchQueryID: res.id,
            fetchID: res.result
          };

          if (res.total === 0) {
            this.app.isCounting = false;
          }

          this.app.isApiError = false;
          this.cdr.markForCheck();
        } else {
          const errorMsg = res.error?.message || '搜尋發生錯誤';
          this.searchResult.status = errorMsg;
          // this.startCountdown(60);
          this.app.isApiError = true;
          this.app.isCounting = false;

          if (this.analyzeComponent) {
            this.analyzeComponent.showToast(errorMsg, 'bg-danger text-light', 5000);
          }

          this.resetSearchData();
        }
      },
      error: (error: any) => {
        this.resetSearchData();
        this.app.isApiError = true;
        this.app.isCounting = false;
        const msg = error.error?.error?.message || error.message || '未知錯誤';
        this.app.apiErrorStr = msg;

        if (this.analyzeComponent) {
          this.analyzeComponent.showToast(msg, 'bg-danger text-light', 5000);
        }

        console.log(error);
      }
    });

    return;
  }

  /**
   * 根據目前的 UI 狀態構建完整的搜尋 JSON 物件
   */
  public prepareSearchJson() {
    this.pseudos = [];

    if ((this.isFilterActive(this.uxSearchOptions.base.ilvl.min) || this.searchOptions.itemBasic.isSearch) && this.item.category === '') {
      this.item.category = 'item';
    }

    //刪除預設報價摺疊
    if (!this.ui.collapse.custom) {
      delete this.filters.searchJson.query.filters.trade_filters;
    }

    // 每次搜尋前重置動態過濾區塊
    this.filters.searchJson.query.stats = [{ "type": "and", "filters": [] }, { "type": "count", "filters": [] }];

    // 初始化過濾器結構 (增加安全性檢查，確保 query 與 filters 存在)
    if (!this.filters.searchJson.query) this.filters.searchJson.query = {};
    if (!this.filters.searchJson.query.filters) this.filters.searchJson.query.filters = {};

    const f = this.filters.searchJson.query.filters;
    f.type_filters = { filters: {} };
    f.equipment_filters = { filters: {} };
    f.req_filters = { filters: {} };
    f.map_filters = { filters: {} };
    f.misc_filters = { filters: {} };

    // 處理基礎交易狀態範圍、價格條件與物品名稱/基底文字搜尋
    this.searchRange();
    this.priceSetting();
    this.isItemBasicSearch();
    if (this.ui.collapse.custom) {
      this.isItemSocketSearch();
    }


    // 處理 UX 草案中的過濾設定 (包含類別、裝備、需求、終局及其它)
    const addRange = (target: any, key: string, range: any) => {
      if (range && (this.isFilterActive(range.min) || this.isFilterActive(range.max))) {
        const value: any = {};
        if (this.isFilterActive(range.min)) value.min = Number(range.min);
        if (this.isFilterActive(range.max)) value.max = Number(range.max);
        target[key] = value;
      }
    };

    const addOption = (target: any, key: string, value: any) => {
      if (this.isFilterActive(value)) {
        target[key] = { option: value };
      }
    };

    // 1. 類別過濾 (base -> type_filters)
    if (this.filterPanel.checked.c1) {
      addOption(f.type_filters.filters, 'category', this.uxSearchOptions.base.category);
      addOption(f.type_filters.filters, 'rarity', this.uxSearchOptions.base.rarity);
      addRange(f.type_filters.filters, 'ilvl', this.uxSearchOptions.base.ilvl);
      addRange(f.type_filters.filters, 'quality', this.uxSearchOptions.base.quality);
    }

    // 2. 裝備篩選器 (equipment -> equipment_filters)
    if (this.filterPanel.checked.c2) {
      const eq = this.uxSearchOptions.equipment;
      addRange(f.equipment_filters.filters, 'damage', eq.damage);
      addRange(f.equipment_filters.filters, 'aps', eq.aps);
      addRange(f.equipment_filters.filters, 'crit', eq.crit);
      addRange(f.equipment_filters.filters, 'dps', eq.dps);
      addRange(f.equipment_filters.filters, 'pdps', eq.pdps);
      addRange(f.equipment_filters.filters, 'edps', eq.edps);
      addRange(f.equipment_filters.filters, 'reload', eq.reload_time);
      addRange(f.equipment_filters.filters, 'ar', eq.ar);
      addRange(f.equipment_filters.filters, 'ev', eq.ev);
      addRange(f.equipment_filters.filters, 'es', eq.es);
      addRange(f.equipment_filters.filters, 'ward', eq.ward);
      addRange(f.equipment_filters.filters, 'block', eq.block);
      addRange(f.equipment_filters.filters, 'spirit', eq.spirit);
      addRange(f.equipment_filters.filters, 'rune_sockets', eq.rune_sockets);
    }

    // 3. 物品需求 (requirements -> req_filters)
    if (this.filterPanel.checked.c3) {
      const req = this.uxSearchOptions.requirements;
      addRange(f.req_filters.filters, 'lvl', req.lvl);
      addRange(f.req_filters.filters, 'str', req.str);
      addRange(f.req_filters.filters, 'dex', req.dex);
      addRange(f.req_filters.filters, 'int', req.int);
    }

    // 4. 終局篩選器 (maps -> map_filters)
    if (this.filterPanel.checked.c4) {
      const maps = this.uxSearchOptions.maps;
      addRange(f.map_filters.filters, 'map_tier', maps.map_tier);
      addRange(f.map_filters.filters, 'map_packsize', maps.map_packsize);
      addRange(f.map_filters.filters, 'map_magic_monsters', maps.map_magic_monsters);
      addRange(f.map_filters.filters, 'map_rare_monsters', maps.map_rare_monsters);
      addRange(f.map_filters.filters, 'map_iir', maps.map_iir);
      addRange(f.map_filters.filters, 'map_revives', maps.map_revives);
      addRange(f.map_filters.filters, 'map_bonus', maps.map_bonus);
      addRange(f.map_filters.filters, 'map_gold', maps.map_gold);
      addRange(f.map_filters.filters, 'map_experience', maps.map_experience);
      addOption(f.map_filters.filters, 'ultimatum_hint', maps.ultimatum_hint);
    }

    // 5. 其它 (misc -> misc_filters)
    if (this.filterPanel.checked.c5) {
      const misc = this.uxSearchOptions.misc;
      addRange(f.misc_filters.filters, 'gem_level', misc.gem_level);
      addRange(f.misc_filters.filters, 'gem_sockets', misc.gem_sockets);
      addRange(f.misc_filters.filters, 'area_level', misc.area_level);
      addRange(f.misc_filters.filters, 'stack_size', misc.stack_size);
      addOption(f.misc_filters.filters, 'identified', misc.identified);
      addOption(f.misc_filters.filters, 'fractured_item', misc.fractured_item);
      addOption(f.misc_filters.filters, 'corrupted', misc.corrupted);
      addOption(f.misc_filters.filters, 'sanctified_item', misc.sanctified);
      addOption(f.misc_filters.filters, 'twice_corrupted', misc.twice_corrupted);
      addOption(f.misc_filters.filters, 'mutated_item', misc.mutated);
      addOption(f.misc_filters.filters, 'veiled', misc.veiled);
      addOption(f.misc_filters.filters, 'desecrated_item', misc.desecrated);
      addOption(f.misc_filters.filters, 'crafted_item', misc.crafted);
      addOption(f.misc_filters.filters, 'foreseen_item', misc.foreseeing);
      addOption(f.misc_filters.filters, 'mirrored', misc.mirrored);
      addRange(f.misc_filters.filters, 'sanctum_gold', misc.sanctum_gold);
      addRange(f.misc_filters.filters, 'unidentified_tier', misc.unidentified_tier);
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

    this.item.searchDefences.forEach((element: any) => {
      if (element.isSearch) {
        const value: any = {};
        if (this.isFilterActive(element.min)) value.min = Number(element.min);
        if (this.isFilterActive(element.max)) value.max = Number(element.max);
        const apiField = this.defenceTypes.get(element.text);
        if (apiField) {
          this.filters.searchJson.query.filters.equipment_filters.filters[apiField] = value;
        }
      }
    });

    console.log(this.filters.searchJson);
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

  //是否針對物品基底搜尋
  isItemBasicSearch() {
    if (this.searchOptions.itemBasic.isSearch && this.searchOptions.itemBasic.text) {
      let itemBasicStrs = this.searchOptions.itemBasic.text.split(' ');
      switch (itemBasicStrs.length) {
        case 1:
          this.filters.searchJson.query.type = this.searchOptions.itemBasic.text;
          break;
        case 2:
          this.filters.searchJson.query.name = itemBasicStrs[0];
          this.filters.searchJson.query.type = itemBasicStrs[1];
          break;
        case 3:
          this.filters.searchJson.query.name = {
            discriminator: "legacy",
            option: itemBasicStrs[0]
          };
          this.filters.searchJson.query.type = {
            discriminator: "legacy",
            option: itemBasicStrs[1]
          };
          break;
        default:
          this.filters.searchJson.query.type = this.searchOptions.itemBasic.text;
      }
    } else {
      delete this.filters.searchJson.query.name;
      delete this.filters.searchJson.query.type;
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
    this.ui.collapse.advanced = true; // 搜尋時自動隱藏進階過濾區塊
    if (this.ui.collapse.custom) {
      this.ui.collapse.stats = true; // 搜尋時自動隱藏詞綴區塊
    }

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
    // 移到 uxSearchOptions.misc.corrupted 處理
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
    this.uxSearchOptions.equipment.rune_sockets.min = '';
    this.uxSearchOptions.equipment.rune_sockets.max = '';
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
    if (this.uxSearchOptions.base.category && this.uxSearchOptions.base.category.startsWith('map')) {
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

    this.updateCategoryOptions();

    this.ui.collapse.custom = false;
    this.ui.collapse.advanced = true;
  }

  /**
   * 根據指定白名單過濾物品分類，並確保 prop 值不重複
   */
  private updateCategoryOptions() {
    const allowedPrefixes = ['accessory', 'armour', 'flask', 'jewel', 'weapon', 'map', 'sanctum'];
    const uniqueOptions = new Map<string, { label: string, prop: string }>();
    const basicsSet = new Set<string>();
    this.itemIcons.clear();

    this.data.basics.categorizedItems.forEach((item: any) => {
      // 填充物品名稱到基底清單供 Typeahead 選取
      if (item.type) {
        basicsSet.add(item.type);
        this.itemIcons.set(item.type, '📦'); // 一般裝備基底使用盒子圖示
      }

      const root = item.option?.split('.')[0];
      if (allowedPrefixes.includes(root) && !uniqueOptions.has(item.option)) {
        uniqueOptions.set(item.option, { label: item.name, prop: item.option });
      }
    });

    this.data.basics.uniques.forEach((item: any) => {
      // 填充傳奇物品名稱到清單供 Typeahead 選取
      if (item.text) {
        basicsSet.add(item.text);
        this.itemIcons.set(item.text, '⭐'); // 傳奇物品使用星星圖示
      }
    });

    this.data.basics.map.option.forEach((opt: any) => {
      // 填充地圖基底名稱 (如：換界石、巨靈之幣等)
      if (opt) {
        basicsSet.add(opt);
        this.itemIcons.set(opt, '🗺️'); // 地圖相關使用地圖圖示
      }
    });

    this.data.basics.gem.option.forEach((opt: any) => {
      // 填充技能寶石名稱
      if (opt) {
        basicsSet.add(opt);
        this.itemIcons.set(opt, '💎'); // 技能寶石使用寶石圖示
      }
    });

    this.data.basics.currency.option.forEach((opt: any) => {
      // 填充胎贈名稱
      if (opt) {
        basicsSet.add(opt);
        this.itemIcons.set(opt, '🌱'); // 胎贈使用圖示
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
      searchOptions: JSON.parse(JSON.stringify(this.searchOptions)),
      uxSearchOptions: JSON.parse(JSON.stringify(this.uxSearchOptions)) // 新增：儲存 UX 過濾器狀態
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
      if (saved.content) {
        // 先套用預設模板，再覆蓋儲存內容，確保結構完整性
        const base = JSON.parse(JSON.stringify(this.filters.searchJson_Def));
        this.filters.searchJson = Object.assign(base, JSON.parse(JSON.stringify(saved.content)));
      }

      // 還原 UI 繫結的物品資料 (名稱、基底、詞綴清單等)
      if (saved.item) {
        this.item = JSON.parse(JSON.stringify(saved.item));
        // 關鍵：補齊舊資料可能缺少的陣列欄位
        if (!this.item.searchStats) this.item.searchStats = [];
        if (!this.item.searchStatsCount) this.item.searchStatsCount = [];
        if (!this.item.searchDefences) this.item.searchDefences = [];
      }

      // 還原搜尋選項 (等級、插槽、稀有度、分類勾選狀態等)
      if (saved.searchOptions) this.searchOptions = JSON.parse(JSON.stringify(saved.searchOptions));

      // 還原 UX 過濾器狀態 (新增)
      if (saved.uxSearchOptions) {
        // 使用 Object.assign 確保即使舊存檔缺少某些屬性，也能從預設值繼承，避免錯誤
        this.uxSearchOptions = Object.assign(JSON.parse(JSON.stringify(this.getUxSearchOptionsDefaults())), JSON.parse(JSON.stringify(saved.uxSearchOptions)));
      }

      // 自動展開相關介面以顯示讀取後的內容
      this.ui.collapse.custom = false;
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
        const targetKey = this.selectedFilterMethod === 'count' ? 'searchStatsCount' : 'searchStats';

        // 確保陣列存在
        if (!this.item[targetKey]) this.item[targetKey] = [];

        statsFilter.hashs[type].forEach((hash: any) => {
          const statId = hash[0];
          const statText = this.data.statsById[type].get(statId);

          // 檢查是否已存在於目前的搜尋列表中，避免重複加入
          const exists = this.item[targetKey].some((s: any) => s.id === statId);

          if (statText && !exists) {
            this.item[targetKey] = [...this.item[targetKey], {
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

  onCheckedChangeAll() {
    const isChecked = this.filterPanel.checked.all;
    this.filterPanel.checked.c1 = isChecked;
    this.filterPanel.checked.c2 = isChecked;
    this.filterPanel.checked.c3 = isChecked;
    this.filterPanel.checked.c4 = isChecked;
    this.filterPanel.checked.c5 = isChecked;
    this.cdr.markForCheck();
  }

  resetFilterPanel() {
    this.filterPanel.checked = {
      all: false,
      c1: false,
      c2: false,
      c3: false,
      c4: false,
      c5: false
    }
  }
}
