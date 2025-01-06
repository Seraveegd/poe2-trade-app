import { Component, OnInit } from '@angular/core';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { AppService } from '../app.service';
// import { RouterLink, RouterOutlet } from '@angular/router';
import { interval, lastValueFrom, map } from 'rxjs';
import { AnalyzeComponent } from "./analyze/analyze.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Clipboard, Shell } from 'electron';
import { NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';

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
export class HomeComponent implements OnInit {
  private clipboard!: Clipboard;
  private shell!: Shell;
  // private ipc!: IpcRenderer;
  public isCollapsed: boolean = false;
  public typeColors: any = new Map([
    ['固定', '#BD5A5A'],
    ['符文', '#85A1A5'],
    ['附魔', '#F8E169'],
    ['隨機', '#665DAE'],
    ['汙染', '#C62A29'],
    ['傳奇', '#AB4C11'],
    ['防禦', '#E6CA81'],
    ['插槽', '#8A8A8A'],
    ['聖所', '#A1422E']
  ]);

  private defenceTypes: any = new Map([
    ['能量護盾', 'es'],
    ['護甲', 'ar'],
    ['閃避值', 'ev'],
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

  //原始資料
  public datas: any = {
    items: [], // 交易網物品 API 資料
    stats: [],  // 交易網詞綴 API 資料
    // duplicateStats: duplicateStatsData, // 重複的詞綴 API 資料
  };

  //物品資料
  public basics: any = {
    categorizedItems: [], // 有分類的物品資料
    map: { // 地圖基底
      option: [],
      chosenM: '無',
      isSearch: false,
    },
    gem: { // 技能寶石基底
      option: [],
      chosenG: '無',
      isSearch: false,
    }
  };

  //查詢物品資料
  public item: any = {
    name: '',
    category: '',
    type: '',
    supported: true,
    copyText: '',
    searchStats: [], // 分析拆解後的物品詞綴陣列，提供使用者在界面勾選是否查詢及輸入數值
    searchDefences: []
  };

  //詞綴資料
  public stats: any = {
    implicit: [], // 固定屬性
    explicit: [], // 隨機屬性
    wrap: [], //拆行詞綴
    enchant: [], // 附魔詞綴
    rune: [], // 符文詞綴
    skill: [], //技能詞綴
    allocates: [], // 項鍊塗油配置附魔詞綴
    sanctum: [] //聖所詞綴
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
      chosenObj: {
        label: "任何",
        prop: ''
      },
      isSearch: false
    },
    priceSetting: { // 搜尋設定->價格設定
      options: [{
        label: "Relative",
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
      }],
      chosenObj: ''
    },
    leagues: { // 搜尋設定->搜尋聯盟
      options: [],
      chosenL: ""
    }
  };

  //過濾相關設定
  public filters: any = {
    searchJson: {},
    searchJson_Def: {
      "query": {
        "status": {
          "option": "online"
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
  }

  constructor(private poe_service: AppService) {
    if ((<any>window).require) {
      try {
        this.clipboard = (<any>window).require('electron').clipboard;
        this.shell = (<any>window).require('electron').shell;
      } catch (e) {
        throw e;
      }
    } else {
      console.warn('App not running inside Electron!');
    }
    //取得聯盟資料
    this.poe_service.get_leagues().subscribe((res: any) => {
      if (res) {
        this.searchOptions.leagues.options = res.result.filter((data: any) => data.realm == 'poe2');
        this.searchOptions.leagues.chosenL = this.searchOptions.leagues.options[0].text;
      }
    });

    this.loadData();
  }

  ngOnInit(): void {
    // console.log(localStorage.getItem('copyText'));
    // this.analyze();
  }

  public async loadData() {
    const allItems = this.poe_service.getItemData();
    const allStats = this.poe_service.getStatsData();
    this.datas.items = await lastValueFrom(allItems);
    this.datas.stats = await lastValueFrom(allStats);

    this.dealWithitemsData();
    this.dealWithstatsData();

    const getCopyText = interval(1000).pipe(map(() => this.clipboard.readText()));

    getCopyText.subscribe((text: any) => {
      if (this.app.preCopyText !== text) {
        this.app.onReady = false;
      }

      if (text.indexOf('稀有度: ') > -1 && !this.app.onReady) { // POE 內的文字必定有稀有度
        this.app.preCopyText = text;
        this.app.onReady = true;
        (<any>window).ipcRenderer.send('analyze-item');
        this.analyze(text);
      }
    })
  }

  analyze(text: string) {
    console.log(this.searchOptions);
    let item = text;

    if (this.app.isCounting) {
      // this.cleanCopyText()
      this.clipboard.writeText('');
      return;
      // this.$message({
      //   duration: 2000,
      //   type: 'error',
      //   message: `請等待限制間隔倒數完畢後再次按下 Ctrl+C`
      // });
      // return
    }

    this.resetSearchData();

    this.filters.searchJson = JSON.parse(JSON.stringify(this.filters.searchJson_Def)); // Deep Copy：用JSON.stringify把物件轉成字串 再用JSON.parse把字串轉成新的物件

    const NL = this.newLine;
    let itemArray = item.split(NL); // 以行數拆解複製物品文字

    console.log(itemArray);

    itemArray = this.deleteUnUseString(itemArray);

    let start = itemArray[0].indexOf("物品種類") === -1 ? 0 : 1;

    //物品稀有度
    let posRarity = itemArray[start].indexOf(': ');
    let Rarity = itemArray[start].substring(posRarity + 2).trim();

    console.log(Rarity);

    //物品名稱 - name
    let searchName = itemArray[start + 1];
    this.item.name = itemArray[start + 2] === "--------" ? `物品名稱 <br>『${itemArray[start + 1]}』` : `物品名稱 <br>『${itemArray[start + 1]} ${itemArray[start + 2]}』`;

    //物品基底 - type
    let itemBasic = itemArray[start + 2] === "--------" ? itemArray[start + 1] : itemArray[start + 2];
    if (Rarity == '魔法' || Rarity == '普通') {
      itemBasic = this.checkBasicName(itemBasic);
    }

    console.log(itemBasic);

    let itemNameString = itemArray[start + 2] === "--------" ? itemArray[start + 1] : `${itemArray[start + 1]} ${itemArray[start + 2]}`;
    let itemBasicCount = 0;

    //物品檢查
    this.basics.categorizedItems.some((element: any) => {
      // console.log(element);
      let itemNameStringIndex = itemBasic === element.type;
      console.log(itemNameString, itemNameStringIndex);

      if (itemNameStringIndex && !itemBasicCount) {
        itemBasicCount++;
        this.itemAnalysis(item, itemArray, element);
        if (Rarity !== '傳奇') {
          this.item.category = 'item';
          if (element.option.indexOf('map') === -1) {
            this.ui.collapse.item = false;
          }
        }
        // this.options.isItem = true;
        // this.options.isItemCollapse = true;
        return true;
      }

      return false;
    });

    //詞綴分析
    if (Rarity === "傳奇") { // 傳奇道具
      this.item.category = 'unique';
      this.ui.collapse.item = true;
      this.searchOptions.raritySet.chosenObj = item.indexOf('傳奇 (貼模)') > -1 ? 'uniquefoil' : 'unique';

      this.searchOptions.itemSocket.min = this.getSocketNumber(item);
      this.searchOptions.itemSocket.max = this.getSocketNumber(item);

      if (item.indexOf('未鑑定') === -1) { // 已鑑定傳奇
        this.searchOptions.raritySet.isSearch = true;
        Object.assign(this.filters.searchJson.query, { name: searchName, type: itemBasic });
        // this.isRaritySearch();

        this.itemStatsAnalysis(itemArray, 1);
      } else { // 未鑑定傳奇(但會搜到相同基底)
        if (searchName.indexOf('精良的') > -1) { // 未鑑定的品質傳奇物品
          searchName = searchName.substring(4);
        }
        this.searchOptions.raritySet.isSearch = true;
        Object.assign(this.filters.searchJson.query, { type: searchName });
        // this.isRaritySearch();
      }
    } else if (Rarity === "寶石") {//之後檢視
      this.item.category = 'gem';
      this.basics.gem.chosenG = searchName;
      this.basics.gem.isSearch = true;

      if (item.indexOf('輔助寶石') === -1) {
        let levelPos = item.substring(item.indexOf('等級: ') + 4);
        let levelPosEnd = levelPos.indexOf(NL);
        this.searchOptions.gemLevel.min = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
        this.searchOptions.gemLevel.isSearch = true;

        let minQuality = 0;
        if (item.indexOf('品質: +') > -1) {
          let quaPos = item.substring(item.indexOf('品質: +') + 5); // 品質截斷字串 (包含'品質: +'前的字串全截斷)
          let quaPosEnd = quaPos.indexOf('% (augmented)'); // 品質定位點
          minQuality = parseInt(quaPos.substring(0, quaPosEnd).trim(), 10);

          this.searchOptions.gemQuality.isSearch = true;
          this.searchOptions.gemQuality.min = minQuality;
        }

        this.searchOptions.gemSocket.isSearch = true;
        this.searchOptions.gemSocket.min = this.getSocketNumber(item);
      }
    } else if (Rarity === "通貨" || Rarity === "通貨不足") {
      console.log(this.item.name);
      this.item.category = 'currency';

      if (searchName.indexOf('寶石') > -1) {
        let levelPos = item.substring(item.indexOf('等級: ') + 4);
        let levelPosEnd = levelPos.indexOf(NL);
        let level = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
        this.searchOptions.itemLevel.min = level;
        this.searchOptions.itemLevel.max = level;
        this.searchOptions.itemLevel.isSearch = true;
        this.isItemLevelSearch();

        this.item.name += ("<br>等級: " + level);
      }

      if (searchName.indexOf("巨靈之幣") > -1 || searchName.indexOf('最後通牒雕刻') > -1) {
        let levelPos = item.substring(item.indexOf('區域等級: ') + 6);
        let levelPosEnd = levelPos.indexOf(NL);
        let level = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
        this.searchOptions.mapAreaLevel.min = level;

        let maxLevel = 0;
        switch (true) {
          case level >= 75:
            maxLevel = 82;
            break;
          case level >= 60 && level < 75:
            maxLevel = 74;
            break;
          case level >= 45 && level < 60:
            maxLevel = 59;
            break;
          case level < 45:
            maxLevel = 44;
            break;
          default:
            break;
        }
        this.searchOptions.mapAreaLevel.max = maxLevel;
        this.searchOptions.mapAreaLevel.isSearch = true;
        this.isMapAreaLevelSearch();

        this.item.name += ("<br>區域等級: " + level);
      }

      Object.assign(this.filters.searchJson.query, { type: searchName });
      this.searchOptions.raritySet.chosenObj = "";
      console.log(this.searchOptions);
      // return;
    } else if (this.item.category === 'item') {
      this.searchOptions.itemSocket.min = this.getSocketNumber(item);
      this.searchOptions.itemSocket.max = this.getSocketNumber(item);
      //分析詞綴
      if (Rarity !== '普通' || searchName.indexOf('碑牌') > -1) {
        this.itemStatsAnalysis(itemArray, 0);
      }
      //分析防禦
      console.log(this.item.type);
      if (this.item.type.indexOf('armour') > -1) {
        this.itemDefencesAnalysis(itemArray);
      }
      // console.log(this.searchOptions);
      if (!this.ui.collapse.item) {
        return;
      }
    }

    //地圖
    if (item.indexOf('物品種類: 換界石') > -1) {
      this.item.category = 'map';
      this.mapAnalysis(item, itemArray, Rarity);
    }

    this.searchTrade();
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
    this.item.searchStats = [];
    this.item.searchDefences = [];

    this.app.apiErrorStr = '';
  }

  //物品分析
  itemAnalysis(item: any, itemArray: any, matchItem: any) {
    const NL = this.newLine;
    this.searchOptions.itemCategory.option.length = 0;
    this.searchOptions.raritySet.chosenObj = 'nonunique';
    this.searchOptions.raritySet.isSearch = true;

    this.item.type = matchItem.option;
    // 判斷物品基底
    console.log(matchItem);
    this.searchOptions.itemBasic.text = matchItem.text || matchItem.type;
    // 判斷物品等級
    if (item.indexOf('物品等級: ') > -1) {
      let levelPos = item.substring(item.indexOf('物品等級: ') + 5);
      let levelPosEnd = levelPos.indexOf(NL);
      let levelValue = parseInt(levelPos.substring(0, levelPosEnd).trim(), 10);
      this.searchOptions.itemLevel.min = levelValue >= 86 ? 86 : levelValue; // 物等超過86 只留86
    }
    // 判斷物品分類
    this.searchOptions.itemCategory.option.push({
      label: matchItem.name,
      prop: matchItem.option,
    });

    this.searchOptions.itemCategory.chosenObj = matchItem.option;

    if (matchItem.weapon) {
      this.searchOptions.itemCategory.option.push({
        label: this.weaponTypes.get(matchItem.weapon),
        prop: matchItem.weapon,
      });
    }
    //如果是地圖物品，以物品基底搜尋
    if (matchItem.option.indexOf('map') > -1) {
      this.searchOptions.itemBasic.isSearch = true;
    }

    this.searchOptions.itemCategory.isSearch = true;
  }

  //換界石分析
  mapAnalysis(item: any, itemArray: any, Rarity: any) {
    // this.itemStatsAnalysis(itemArray, 1) 地圖先不加入詞綴判斷
    const NL = this.newLine;

    this.searchOptions.raritySet.chosenObj = 'nonunique';
    this.searchOptions.raritySet.isSearch = true;

    let mapPos = item.indexOf('換界石階級:') > -1 ? item.substring(item.indexOf('換界石階級:') + 6) : 0; // 地圖階級截斷字串

    if (mapPos) {
      let mapPosEnd = mapPos.indexOf(NL); // 地圖階級換行定位點
      let mapTier = parseInt(mapPos.substring(0, mapPosEnd).trim(), 10);
      this.searchOptions.mapLevel.min = mapTier;
      this.searchOptions.mapLevel.max = mapTier;
      this.searchOptions.mapLevel.isSearch = true;
    }

    this.searchTrade();
  }

  //物品詞綴分析
  itemStatsAnalysis(itemArray: any, rarityFlag: any) {
    this.ui.collapse.stats = rarityFlag ? true : false;

    let tempStat: any = [];
    let itemDisplayStats: any = []; // 該物品顯示的詞綴陣列
    let itemStatStart = 0;// 物品隨機詞綴初始位置
    let itemStatEnd = itemArray.length - 1; // 物品隨機詞綴結束位置 //之後可能需要修改

    //尋找結束行
    itemArray.forEach((element: any, index: any) => {
      let isEndPoint = index > 0 ? itemArray[index - 1].indexOf("(enchant)") > -1 || itemArray[index - 1].indexOf("(implicit)") > -1 || itemArray[index - 1].indexOf("(scourge)") > -1 || itemArray[index - 1].indexOf("(rune)") > -1 : false;

      if (element.indexOf('物品等級:') > -1) {
        itemStatStart = index + 2;
      }

      if (element === "--------" && !isEndPoint && itemStatStart && index > itemStatStart && itemStatEnd == itemArray.length - 1) { // 判斷隨機詞綴結束點
        itemStatEnd = index;
      }

      if (element.indexOf('未鑑定') > -1) {
        itemStatEnd = index - 1;
        return
      }
    });

    console.log(itemStatStart, itemStatEnd);
    console.log(this.item.type);

    for (let index = itemStatStart; index < itemStatEnd; index++) {
      if (itemArray[index] !== "--------" && itemArray[index]) {
        let text = itemArray[index];
        itemDisplayStats.push(text);

        if (itemArray[index].indexOf('(implicit)') > -1) { // 固定屬性
          console.log("固定");
          text = text.substring(0, text.indexOf('(implicit)')).trim(); // 刪除(implicit)字串
          tempStat.push({ text: this.getStat(text, 'implicit') });
          tempStat[tempStat.length - 1].type = "固定";
          tempStat[tempStat.length - 1].category = "implicit";
        } else if (itemArray[index].indexOf('(rune)') > -1) { //符文屬性
          console.log("符文");
          text = text.substring(0, text.indexOf('(rune)')).trim(); // 刪除(rune)字串
          tempStat.push({ text: this.getStat(text, 'rune') });
          tempStat[tempStat.length - 1].type = "符文";
          tempStat[tempStat.length - 1].category = "rune";
        } else if (itemArray[index].indexOf('(enchant)') > -1) { // 附魔
          console.log("附魔");
          text = text.substring(0, text.indexOf('(enchant)')).trim(); // 刪除(enchant)字串
          tempStat.push({ text: this.getStat(text, 'enchant') });
          tempStat[tempStat.length - 1].type = "附魔";
          tempStat[tempStat.length - 1].category = "enchant";
        } else if (this.item.type.indexOf('sanctum') > -1) { //聖所詞綴
          console.log("聖所");
          tempStat.push({ text: this.getStat(text, 'sanctum') });
          tempStat[tempStat.length - 1].type = "聖所";
          tempStat[tempStat.length - 1].category = "sanctum";
        } else if (rarityFlag) { //傳奇裝詞綴
          console.log("傳奇");
          tempStat.push({ text: this.getStat(text, 'explicit') });
          tempStat[tempStat.length - 1].type = "傳奇";
          tempStat[tempStat.length - 1].category = "explicit";
        } else { // 隨機屬性
          console.log("隨機");
          tempStat.push({ text: this.getStat(text, 'explicit') });
          tempStat[tempStat.length - 1].type = "隨機";
          tempStat[tempStat.length - 1].category = "explicit";
        }
      }
    }

    // let elementalResistanceTotal = 0;
    // let spellDamageTotal = 0;
    //比對詞綴，抓出隨機數值與詞綴搜尋 ID
    tempStat.forEach((element: any, idx: any, array: any) => {
      if (element.text.stat.indexOf('未找到詞綴') === -1) {
        let isStatSearch = false;
        let statID = element.text.id; // 詞綴ID
        let apiStatText = element.text.stat; // API 抓回來的詞綴字串
        let itemStatText = itemDisplayStats[idx]; // 物品上的詞綴字串

        console.log(element, statID, apiStatText, itemStatText);

        let itemStatArray = itemStatText.split(' ') // 將物品上的詞綴拆解
        let matchStatArray = apiStatText.split(' ') // 將詞綴資料庫上的詞綴拆解
        // console.log(itemStatText)
        // console.log(matchStatArray)
        let randomMinValue = 0; // 預設詞綴隨機數值最小值為空值(之後修)
        let randomMaxValue = 0; // 預設詞綴隨機數值最大值為空值(之後修)
        let optionValue = 0; // 星團珠寶附魔 / 項鍊塗油配置 / 禁忌烈焰.血肉配置 的 ID

        // //塗油~之後修
        // if (statID === "enchant.stat_2954116742") {
        //   let obj = stringSimilarity.findBestMatch(itemStatText, this.stats.allocates);
        //   optionValue = parseInt(obj.ratings[obj.bestMatchIndex + 1].target, 10);
        //   apiStatText = `配置 塗油天賦：${obj.ratings[obj.bestMatchIndex].target}`;
        // }

        //  else if (statID === "explicit.stat_2460506030" || statID === "explicit.stat_1190333629") {
        //   isStatSearch = true
        //   this.isStatsCollapse = true
        //   let obj = stringSimilarity.findBestMatch(itemStatText, this.forbiddenZoneStats)
        //   optionValue = parseInt(obj.ratings[obj.bestMatchIndex + 1].target, 10)
        //   apiStatText = `若禁忌${statID === "explicit.stat_2460506030" ? '烈焰' : '血肉'}上有符合的詞綴，\n配置：${obj.ratings[obj.bestMatchIndex].target}`
        // } else if (statID === "explicit.stat_2422708892") {
        //   isStatSearch = true
        //   this.isStatsCollapse = true
        //   let obj = stringSimilarity.findBestMatch(itemStatText, this.impossibleEscapeStats)
        //   optionValue = parseInt(obj.ratings[obj.bestMatchIndex + 1].target, 10)
        //   apiStatText = `範圍 ${obj.ratings[obj.bestMatchIndex].target} 內的天賦可以在沒有連結你的天賦樹下被配置`
        // } else if (statID === "explicit.stat_3642528642") {
        //   isStatSearch = true
        //   this.isStatsCollapse = true
        //   let areaStat = itemStatText.split(',')[1]
        //   switch (areaStat) {
        //     case '小':
        //       optionValue = '1'
        //       break;
        //     case '中':
        //       optionValue = '2'
        //       break;
        //     case '大':
        //       optionValue = '3'
        //       break;
        //     case '非':
        //       optionValue = '4'
        //       areaStat = '非常大'
        //       break;
        //     case '極':
        //       optionValue = '5'
        //       areaStat = '極大'
        //       break;
        //     default:
        //       break;
        //   }
        //   apiStatText = `只會影響『${areaStat}』範圍內的天賦`
        // } else {

        if (itemStatText.indexOf("試煉地圖") > -1) {
          for (let index = 0; index < itemStatArray.length; index++) {
            if (!isNaN(itemStatArray[index])) { // 物品詞綴最小值
              console.log(itemStatArray[index]);
              randomMinValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
              randomMinValue = isNaN(randomMinValue) ? 0 : randomMinValue;
            }
          }
        } else {
          for (let index = 0; index < itemStatArray.length; index++) { // 比較由空格拆掉後的詞綴陣列元素
            if (randomMinValue && itemStatArray[index] !== matchStatArray[index]) { // 物品詞綴最大值
              randomMaxValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
              randomMaxValue = isNaN(randomMaxValue) ? 0 : randomMaxValue;
            }
            if (!randomMinValue && itemStatArray[index] !== matchStatArray[index]) { // 物品詞綴最小值
              randomMinValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
              randomMinValue = isNaN(randomMinValue) ? 0 : randomMinValue;
              if (matchStatArray[index]) {
                if (matchStatArray[index].indexOf('，#') > -1) { // 處理隨機數值在'，'後的詞綴(無法用空格符號 split)
                  let tempStat = itemStatArray[index].substring(itemStatArray[index].indexOf('，') + 1);
                  randomMinValue = parseFloat(tempStat.replace(/[+-]^\D+/g, ''));
                } else if (matchStatArray[index].indexOf('：#') > -1) { // 處理隨機數值在'：'後的詞綴(無法用空格符號 split)
                  let tempStat = itemStatArray[index].substring(itemStatArray[index].indexOf('：') + 1);
                  randomMinValue = parseFloat(tempStat.replace(/[+-]^\D+/g, ''));
                }
              }
            }
          }
        }
        // }

        // API 詞綴只有"增加"，但物品可能有"減少"詞綴相關處理
        if (apiStatText.includes('增加') && itemStatText.includes('減少')) {
          // apiStatText = apiStatText.replace('增加', '減少');
          randomMinValue = -randomMinValue;
        }

        // 物品中包含 "# 至 #" 的詞綴，在官方市集搜尋中皆以相加除二作搜尋
        if (randomMaxValue) {
          randomMinValue = (randomMinValue + randomMaxValue) / 2;
          randomMaxValue = 0;
        }

        // switch (true) { // 計算三元素抗性至偽屬性
        //   case statID.indexOf('stat_3372524247') > -1 || statID.indexOf('stat_1671376347') > -1 || statID.indexOf('stat_4220027924') > -1:
        //     // 單抗詞綴 '火焰抗性' || '閃電抗性' || '冰冷抗性'
        //     elementalResistanceTotal += randomMinValue
        //     break;
        //   case statID.indexOf('stat_2915988346') > -1 || statID.indexOf('stat_3441501978') > -1 || statID.indexOf('stat_4277795662') > -1:
        //     // 雙抗詞綴 '火焰與冰冷抗性' || '火焰與閃電抗性' || '冰冷與閃電抗性'
        //     elementalResistanceTotal += (randomMinValue * 2)
        //     break;
        //   case statID.indexOf('stat_2901986750') > -1:
        //     // 三抗詞綴 '全部元素抗性'
        //     elementalResistanceTotal += (randomMinValue * 3)
        //     break;
        //   case statID.indexOf('stat_2974417149') > -1:
        //     // "增加 #% 法術傷害"
        //     spellDamageTotal += randomMinValue
        //     break;
        //   default:
        //     break;
        // }

        // if (elementalResistanceTotal && idx === array.length - 1) {
        //   this.options.searchStats.unshift({ // 若該裝備有抗性詞，增加偽屬性至詞綴最前端
        //     "id": "pseudo.pseudo_total_elemental_resistance",
        //     "text": `+#% 元素抗性`,
        //     "option": optionValue,
        //     "min": elementalResistanceTotal,
        //     "max": '',
        //     "isValue": true,
        //     "isNegative": false,
        //     "isSearch": false,
        //     "type": "偽屬性"
        //   })
        // }

        // if (spellDamageTotal && idx === array.length - 1) {
        //   this.searchStats.unshift({ // 計算法術傷害偽屬性
        //     "id": "pseudo.pseudo_increased_spell_damage",
        //     "text": `增加 #% 法術傷害`,
        //     "option": optionValue,
        //     "min": spellDamageTotal,
        //     "max": '',
        //     "isValue": true,
        //     "isNegative": false,
        //     "isSearch": false,
        //     "type": "偽屬性"
        //   })
        // }

        this.item.searchStats.push({
          "id": statID,
          "text": apiStatText,
          "option": optionValue,
          "min": randomMinValue,
          "max": randomMaxValue === 0 ? '' : randomMaxValue,
          "isValue": randomMinValue ? true : false,
          "isSearch": isStatSearch,
          "type": element.type
        })
      } else {
        //實作未找到
        this.item.searchStats.push({
          "id": "",
          "text": itemDisplayStats[idx],
          "option": "",
          "min": '',
          "max": '',
          "isValue": false,
          "isSearch": false,
          "type": element.type
        })
      }
    });
  }

  //物品防禦分析
  itemDefencesAnalysis(itemArray: any) {
    let start = 0;
    itemArray.forEach((item: any) => {
      if (start == 1 && item.indexOf('品質') === -1 && item.indexOf('--------') === -1) {
        let posS = item.indexOf(':');
        let posE = item.indexOf("(");
        let type = item.substring(0, posS);
        let value = +item.substring(posS + 2, posE > -1 ? posE - 1 : item.length).replace('%', '');

        this.item.searchDefences.push({
          text: type,
          type: '防禦',
          min: value,
          max: '',
          isSearch: false
        });
      }

      if (item.indexOf('--------') > -1) {
        start += 1;
      }

      if (start > 1) return;
    })
  }

  //建立搜尋資料
  searchTrade() {
    this.app.isCounting = true;
    this.app.apiErrorStr = '';
    this.item.supported = true;

    if (this.filters.searchJson.query.stats[0].filters.length === 0) {
      this.item.searchStats.forEach((element: any, index: any, array: any) => {
        if (element.id !== '') {
          let value = {};
          let min = element.min;
          let max = element.max;

          if (min >= 0) {
            Object.assign(value, { min: min });
          }

          if (max != 0 && (max > min)) {
            Object.assign(value, { max: max });
          }

          // if (element.isNegative && !isNaN(min)) {
          //   Object.assign(value, { max: -min });
          //   // value.max = -min;
          // } else if (!isNaN(min)) {
          //   Object.assign(value, { min: min });
          //   // value.min = min;
          // }

          // if (element.isNegative && !isNaN(max)) {
          //   Object.assign(value, { min: -max });
          //   // value.min = -max;
          // } else if (!isNaN(max)) {
          //   Object.assign(value, { max: max });
          //   // value.max = max;
          // }

          if (element.option) {
            Object.assign(value, { option: element.option });
          }

          // 比較 element.id 與 duplicateStats 內的 allIds 陣列，如果 element.id 有包含在內，則搜尋詞綴時就改為 type: "count"
          // let isCountType = this.options.duplicateStats.allIds.find((data: any) => data.includes(element.id));

          // if (isCountType) {
          //   let matchedItem = this.duplicateStats.result.find(item => item.ids.includes(isCountType));
          //   let filters = matchedItem.ids.map(id => ({
          //     id: id,
          //     disabled: element.isSearch ? false : true,
          //   }));

          //   this.searchJson.query.stats.push({
          //     "type": "count",
          //     filters,
          //     "value": {
          //       "min": 1
          //     }
          //   });
          // } else {
          this.filters.searchJson.query.stats[0].filters.push({
            "id": element.id,
            "disabled": !element.isSearch,
            "value": value
          })
          // }
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
      default:
        this.isRaritySearch();
        break;
    }

    this.searchResult.fetchQueryID = '';
    this.searchResult.searchTotal = 0;
    this.poe_service.get_trade(this.searchOptions.leagues.chosenL, this.filters.searchJson).subscribe((res: any) => {
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
    });

    return;
    // this.axios.post(`http://localhost:3031/trade`, {
    //   searchJson: obj,
    //   baseUrl: this.options.baseUrl,
    //   league: this.options.leagues.chosenL,
    //   cookie: this.$store.state.POESESSID, //之後處理
    // })
    //   .then((response) => {
    //     this.resultLength = response.data.resultLength
    //     this.searchTotal = response.data.total // 總共搜到幾項物品
    //     if (JSON.stringify(this.searchJson) == JSON.stringify(this.searchJson_Def)) { // 嘗試修復有時搜尋會無法代入條件的 bug
    //       this.copyText = ''
    //     }
    //     this.status = ` 共 ${response.data.total} 筆符合 ${this.isPriceCollapse && response.data.total !== response.data.resultLength ? '- 報價已摺疊' : ''}`
    //     this.fetchID = response.data.fetchID
    //     this.fetchQueryID = response.data.id
    //     let limitState = response.data.limitState
    //     // console.log(limitState, this.$moment().format('HH:mm:ss.SSS'))
    //     switch (true) { // X-Rate-Limit-Ip: 5:10:60,15:60:300,30:300:1800
    //       case limitState.third >= 28:
    //         this.startCountdown(50)
    //         break;
    //       case limitState.third >= 24:
    //         this.startCountdown(10)
    //         break;
    //       case limitState.second >= 14:
    //         this.startCountdown(8)
    //         break;
    //       case limitState.second >= 12:
    //         this.startCountdown(4)
    //         break;
    //       case limitState.first >= 4:
    //         this.startCountdown(2)
    //         break;
    //       default:
    //         break;
    //     }
    //   })
    //   .catch(function (error) {
    //     let errMsg = JSON.stringify(error.response.data)
    //     if (error.response.status === 429) {
    //       errMsg += `\n被 Server 限制發送需求了，請等待後再重試`
    //     }
    //     vm.issueText = `Version: v1.325.0, Server: ${vm.storeServerString}\n此次搜尋異常！\n${errMsg}\n\`\`\`\n${vm.copyText.replace('稀有度: ', 'Rarity: ')}\`\`\``
    //     vm.itemsAPI()
    //     vm.isSupported = false
    //     vm.isStatsCollapse = false
    //     vm.$message({
    //       type: 'error',
    //       message: errMsg
    //     });
    //     console.log(errMsg);
    //   })
  }

  //取得詞綴
  getStat(stat: string, type: any): any {
    let mdStat = '';
    if (stat.indexOf('試煉地圖') === -1) {  //原型顯示1，但會有更多
      mdStat = stat.replace("+", "").replace("-", "").replace(/\d+/g, "#").replace("#.#", "#");
    } else {
      mdStat = stat.replace(/\d+/g, "1");
    }
    console.log(mdStat);
    //處理只有增加，字串有減少字樣
    if (mdStat.indexOf('能力值需求') > -1 || mdStat.indexOf('緩速程度') > -1 || mdStat.indexOf('最大魔力') > -1 || mdStat.indexOf('中毒的') > -1 || mdStat.indexOf('流血的持續時間') > -1 || mdStat.indexOf('每次使用') > -1 || mdStat.indexOf('陷阱造成') > -1 || mdStat.indexOf('怪物造成的') > -1 || mdStat.indexOf('頭目') > -1 || mdStat.indexOf('販售') > -1 || mdStat.indexOf('稀有怪物') > -1 || mdStat.indexOf('怪物減少') > -1) {
      mdStat = mdStat.replace('減少', '增加');
    }

    let findStat = stat;
    let findIdx = 0;
    let findResult = this.stats[type].some((e: any, idx: any, arr: any) => {
      if (idx % 2 === 0) {
        const result = e === mdStat;

        if (result) {
          //修正重複攻擊速度詞綴(隨機與傳奇)
          if (this.stats[type][idx + 1] == 'explicit.stat_210067635' && this.item.type.indexOf('weapon') === -1) {
            return false;
          }

          findStat = e;
          findIdx = idx;
        }

        return result;
      } else {
        return false;
      }
    });

    console.log(mdStat, findStat);

    if (!findResult) console.error("未找到詞綴：" + stat);

    return findResult ? {
      id: this.stats[type][findIdx + 1],
      stat: this.stats[type][findIdx]
    } : {
      id: '',
      stat: findStat + "(未找到詞綴)"
    };
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
    if (!this.basics.gem.isSearch && Object.keys(this.filters.searchJson.query).includes("type")) {
      delete this.filters.searchJson.query.type; // 刪除技能基底 filter
    } else if (this.basics.gem.isSearch) {
      this.filters.searchJson.query.type = this.basics.gem.chosenG; // 增加技能基底 filter
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
      this.filters.searchJson.query.filters.misc_filters.filters = {// 指定地圖區域等級最小 / 最大值 filter
        area_level: {
          min: this.searchOptions.mapAreaLevel.min ? this.searchOptions.mapAreaLevel.min : null,
          max: this.searchOptions.mapAreaLevel.max ? this.searchOptions.mapAreaLevel.max : null
        }
      };
    }
  }

  //刪除不需要字串
  deleteUnUseString(itemArray: any) {
    //之後查看
    if (itemArray[2].indexOf('你無法使用這項裝備，它的數值將被忽略') > -1) {
      itemArray.splice(2, 2);
    }

    let priceText = itemArray[itemArray.length - 2];
    if (priceText.indexOf(': ~b/o') > -1 || priceText.indexOf(': ~price') > -1 || priceText.indexOf('Note:') > -1) {
      // 處理在高倉標價後搜尋的物品陣列
      itemArray.splice(itemArray.length - 3, 2);
    }

    return itemArray;
  }

  //開始冷靜
  startCountdown(Time: any) {
    this.app.countTime = Time * 1000;
    this.app.isCounting = true;
  }

  //物品格式化
  dealWithitemsData() { // 物品 API
    let accessoryIndex = 0; //飾品
    let armourIndex = 0; //護甲
    let flasksIndex = 0; //藥水
    let jewelIndex = 0; //珠寶
    let weaponIndex = 0; //武器
    let mapIndex = 0; //地圖
    let sanctumIndex = 0; //聖所
    this.basics.categorizedItems.length = 0;
    this.basics.map.option.length = 0;
    this.basics.gem.option.length = 0;

    let result = this.datas.items.result;
    //"id": "accessory", "label": "飾品"
    result[result.findIndex((e: any) => e.id === "accessory")].entries.forEach((element: any) => {
      const basetype = ["赤紅項鍊", "生皮腰帶", "鍛鐵戒指"];

      if (basetype.includes(element.type) && !('flags' in element)) {
        accessoryIndex += 1;
      }

      switch (accessoryIndex) {
        case 1: // 項鍊起始點 { "type": "赤紅項鍊", "text": "赤紅項鍊" }
          element.name = "項鍊";
          element.option = "accessory.amulet";
          this.basics.categorizedItems.push(element);
          break;
        case 2: // 腰帶起始點 { "type": "生皮腰帶", "text": "生皮腰帶" }
          element.name = "腰帶";
          element.option = "accessory.belt";
          this.basics.categorizedItems.push(element);
          break;
        case 3: // 戒指起始點 { "type": "鍛鐵戒指", "text": "鍛鐵戒指" }
          element.name = "戒指";
          element.option = "accessory.ring";
          this.basics.categorizedItems.push(element);
          break;
        default:
          break;
      }
    });
    //"id": "armour", "label": "護甲"
    result[result.findIndex((e: any) => e.id === "armour")].entries.forEach((element: any) => {
      const basetype = ["皮革背心", "生皮長靴", "枝條法器", "麂皮護腕", "破舊兜帽", "朽木塔盾", "寬頭箭袋"];

      if (basetype.includes(element.type) && !('flags' in element)) {
        armourIndex += 1;
      }

      switch (armourIndex) {
        case 1: // 胸甲起始點 { "type": "皮革背心", "text": "皮革背心" }
          element.name = "胸甲";
          element.option = "armour.chest";
          this.basics.categorizedItems.push(element);
          break;
        case 2: // 鞋子起始點 { "type": "生皮長靴", "text": "生皮長靴" }
          element.name = "鞋子";
          element.option = "armour.boots";
          this.basics.categorizedItems.push(element);
          break;
        case 3: // 法器起始點 { "type": "枝條法器", "text": "枝條法器" }
          element.name = "法器";
          element.option = "armour.focus";
          this.basics.categorizedItems.push(element);
          break;
        case 4: // 手套起始點 { "type": "麂皮護腕", "text": "麂皮護腕" }
          element.name = "手套";
          element.option = "armour.gloves";
          this.basics.categorizedItems.push(element);
          break;
        case 5: // 頭部起始點 { "type": "破舊兜帽", "text": "破舊兜帽" }
          element.name = "頭部";
          element.option = "armour.helmet";
          this.basics.categorizedItems.push(element);
          break;
        case 6: // 盾牌起始點 { "type": "朽木塔盾", "text": "朽木塔盾" }
          element.name = "盾";
          element.option = "armour.shield";
          this.basics.categorizedItems.push(element);
          break;
        case 7: // 箭袋起始點 { "type": "寬頭箭袋", "text": "寬頭箭袋" }
          element.name = "箭袋";
          element.option = "armour.quiver";
          this.basics.categorizedItems.push(element);
          break;
        default:
          break;
      }
    });
    //"id": "flask", "label": "藥劑"
    result[result.findIndex((e: any) => e.id === "flask")].entries.forEach((element: any) => {
      const basetype = ["解凍護符", "低階生命藥劑"];

      if (basetype.includes(element.type) && !('flags' in element)) {
        flasksIndex += 1;
      }

      switch (flasksIndex) {
        case 1: // 護符起始點 { "type": "解凍護符", "text": "解凍護符" }
          element.name = "護符";
          element.option = "flask"; //之後檢查
          this.basics.categorizedItems.push(element);
          break;
        case 2: // 藥劑起始點 { "type": "低階生命藥劑", "text": "低階生命藥劑" }
          element.name = "藥劑";
          element.option = "flask";
          this.basics.categorizedItems.push(element);
          break;
        default:
          break;
      }
    });
    //"id": "jewel", "label": "珠寶"
    result[result.findIndex((e: any) => e.id === "jewel")].entries.forEach((element: any) => {
      const basetype = ["翠綠碧雲"];

      if (basetype.includes(element.type) && !('flags' in element)) {
        jewelIndex += 1;
      }

      switch (jewelIndex) {
        case 1: // 珠寶起始點 { "type": "翠綠碧雲", "text": "翠綠碧雲" }
          element.name = "珠寶";
          element.option = "jewel";
          this.basics.categorizedItems.push(element);
          break;
        default:
          break;
      }
    });
    //"id": "weapon", "label": "武器"
    result[result.findIndex((e: any) => e.id === "weapon")].entries.forEach((element: any) => {
      const basetype = ["木製棍棒", "雜響權杖", "凋零法杖", "粗製弓", "臨時十字弓", "纏繞細杖", "灰燼長杖", "分裂巨斧", "墮落巨棍棒"]

      if (basetype.includes(element.type) && !('flags' in element)) {
        weaponIndex += 1;
      }

      switch (weaponIndex) {
        case 1: // 單手錘起始點 { "type": "木製棍棒", "text": "木製棍棒" }
          element.name = "單手錘";
          element.option = "weapon.onemace";
          element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
          this.basics.categorizedItems.push(element);
          break;
        case 2: // 權杖起始點 { "type": "雜響權杖", "text": "雜響權杖" }
          element.name = "權杖";
          element.option = "weapon.sceptre";
          element.weapon = "weapon.caster";
          this.basics.categorizedItems.push(element);
          break;
        case 3: // 法杖起始點 { "type": "凋零法杖", "text": "凋零法杖" }
          element.name = "法杖";
          element.option = "weapon.wand";
          element.weapon = "weapon.caster";
          this.basics.categorizedItems.push(element);
          break;
        case 4: // 弓起始點 { "type": "粗製弓", "text": "粗製弓" }
          element.name = "弓";
          element.option = "weapon.bow";
          element.weapon = "weapon.ranged";
          // element.weapon = "weapon.one"
          this.basics.categorizedItems.push(element);
          break;
        case 5: // 十字弓起始點 { "type": "鏽劍", "text": "鏽劍" }
          element.name = "十字弓";
          element.option = "weapon.crossbow";
          element.weapon = "weapon.ranged";
          // element.weapon = "weapon.one"
          this.basics.categorizedItems.push(element);
          break;
        case 6: // 細杖起始點 { "type": "纏繞細杖", "text": "纏繞細杖" }
          element.name = "細杖";
          element.option = "weapon.warstaff";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element);
          break;
        case 7: // 長杖起始點{ "type": "灰燼長杖", "text": "灰燼長杖" }
          element.name = "長杖";
          element.option = "weapon.staff";
          element.weapon = "weapon.caster";
          this.basics.categorizedItems.push(element);
          break;
        case 8: // 雙手斧起始點 { "type": "分裂巨斧", "text": "分裂巨斧" }
          element.name = "雙手斧";
          element.option = "weapon.twoaxe";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element);
          break;
        case 9: // 雙手錘起始點 { "type": "墮落巨棍棒", "text": "墮落巨棍棒" }
          element.name = "雙手錘";
          element.option = "weapon.twomace";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element);
          break;
        default:
          break;
      }
    });
    //"id": "maps", "label": "地圖"
    result[result.findIndex((e: any) => e.id === "map")].entries.forEach((element: any) => {
      const basetype = ["探險日誌", "幻像異界", "地圖鑰匙（階級 1）", "遠古危機碎片", "意志的測試代幣", "巨靈之幣", "裂痕碑牌", "最後通牒雕刻", "怯懦之運"] // 地圖起始點 { "type": "探險日誌", "text": "探險日誌" }

      if (basetype.includes(element.type) && !('flags' in element)) {
        mapIndex += 1;
      }

      switch (mapIndex) {
        case 1: // 日誌起始點 { "type": "探險日誌", "text": "探險日誌" }
          element.name = "日誌";
          element.option = "map.logbook";
          this.basics.categorizedItems.push(element);
          break;
        case 2: // 終局物品起始點 { "type": "幻像異界", "text": "幻像異界" }
          element.name = "終局物品";
          element.option = "map";
          this.basics.categorizedItems.push(element);
          break;
        case 3: // 地圖起始點 { "type": "地圖鑰匙（階級 1）", "text": "地圖鑰匙（階級 1）" }
          this.basics.map.option.push(element.type);
          break;
        case 4: // 地圖碎片起始點 { "type": "遠古危機碎片", "text": "遠古危機碎片" }
          // element.name = "地圖碎片";
          // element.option = "map.fragment";
          // this.basics.categorizedItems.push(element);
          this.basics.map.option.push(element.type);
          break;
        case 5: // 巔峰鑰匙起始點 { "type": "意志的測試代幣", "text": "意志的測試代幣" } //之後檢查
          element.name = "巔峰鑰匙";
          element.option = "map.bosskey";
          this.basics.categorizedItems.push(element);
          break;
        case 6: // 巨靈之幣起始點 { "type": "巨靈之幣", "text": "巨靈之幣" }
          // element.name = "巨靈之幣";
          // element.option = "map.barya";
          // this.basics.categorizedItems.push(element);
          this.basics.map.option.push(element.type);
          break;
        case 7: // 碑牌日誌起始點 { "type": "裂痕碑牌", "text": "裂痕碑牌" }
          element.name = "碑牌";
          element.option = "map.tablet";
          this.basics.categorizedItems.push(element);
          break;
        case 8: // 通牒鑰匙起始點 { "type": "最後通牒雕刻", "text": "最後通牒雕刻" }
          // element.name = "通牒鑰匙";
          // element.option = "map.ultimatum";
          // this.basics.categorizedItems.push(element);
          this.basics.map.option.push(element.type);
          break;
        case 9: // 地圖碎片起始點 { "type": "怯懦之運", "text": "怯懦之運" }
          element.name = "地圖碎片";
          element.option = "map.fragment";
          this.basics.categorizedItems.push(element);
          break;
      }

      // if (element.type.type.indexOf("探險日誌") > -1 || element.type.type.indexOf("地圖")) {
      //   this.basics.map.option.push(element.type);
      // } else {
      //   this.basics.categorizedItems.push(element);
      // }
    });
    //"id": "gems", "label": "技能寶石"
    result[result.findIndex((e: any) => e.id === "gem")].entries.forEach((element: any) => {
      this.basics.gem.option.push(element.text);
    });
    //"id": "sanctum"
    result[result.findIndex((e: any) => e.id === "sanctum")].entries.forEach((element: any) => {
      const basetype = ["古甕聖物"];

      if (basetype.includes(element.type) && !('flags' in element)) {
        sanctumIndex += 1;
      }

      switch (sanctumIndex) {
        case 1: // 聖物起始點 { "type": "古甕聖物", "text": "古甕聖物" }
          element.name = "聖物";
          element.option = "sanctum.relic";
          this.basics.categorizedItems.push(element);
          break;
        // case 2: // 聖域研究起始點 { "type": "聖域寶庫研究", "text": "聖域寶庫研究" }
        //   element.name = "聖域研究";
        //   element.option = "sanctum.research";
        //   this.options.mapBasic.option.push(element.type);
        //   break;
        default:
          break;
      }
    });

    //清除資料
    this.datas.items = [];
  }

  //詞綴格式化
  dealWithstatsData() {
    let result = this.datas.stats.result;
    //隨機屬性
    result[result.findIndex((e: any) => e.id === "explicit")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      let count = (text.match(/\[/g) || []).length;
      //處理說明字串
      if (count > 0) {
        text = this.replaceIllustrate(text, count);
      }
      //處理折行詞綴
      if (text.includes('\n')) {
        this.stats.wrap.push(text);
      }

      this.stats.explicit.push(text, element.id);
    })
    //固定屬性
    result[result.findIndex((e: any) => e.id === "implicit")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      let count = (text.match(/\[/g) || []).length;
      //處理說明字串
      if (count > 0) {
        text = this.replaceIllustrate(text, count);
      }
      //處理折行詞綴
      if (text.includes('\n')) {
        this.stats.wrap.push(text);
      }

      this.stats.implicit.push(text, element.id)
    })
    //附魔詞綴
    result[result.findIndex((e: any) => e.id === "enchant")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      // if (element.id === "enchant.stat_2954116742") { // 項鍊塗油配置附魔詞綴
      //   element.option.options.forEach((element, index) => {
      //     this.allocatesStats.push(element.text, (element.id).toString())
      //   })
      // }
      let count = (text.match(/\[/g) || []).length;
      //處理說明字串
      if (count > 0) {
        text = this.replaceIllustrate(text, count);
      }
      //處理折行詞綴
      if (text.includes('\n')) {
        this.stats.wrap.push(text);
      }

      this.stats.enchant.push(text, element.id);
    })
    //符文詞綴
    result[result.findIndex((e: any) => e.id === "rune")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      let count = (text.match(/\[/g) || []).length;
      //處理說明字串
      if (count > 0) {
        text = this.replaceIllustrate(text, count);
      }
      //處理折行詞綴
      if (text.includes('\n')) {
        this.stats.wrap.push(text);
      }

      this.stats.rune.push(text, element.id);
    })
    //聖域
    result[result.findIndex((e: any) => e.id === "sanctum")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      let count = (text.match(/\[/g) || []).length;
      //處理說明字串
      if (count > 0) {
        text = this.replaceIllustrate(text, count);
      }

      this.stats.sanctum.push(text, element.id);
    })
    //技能詞綴
    result[result.findIndex((e: any) => e.id === "skill")].entries.forEach((element: any, index: any) => {
      let text = element.text;
      //處理折行詞綴
      if (text.includes('\n')) {
        this.stats.wrap.push(text);
      }

      this.stats.skill.push(text, element.id);
    })

    //清除資料
    this.datas.stats = [];
  }

  //點擊後搜尋
  clickToSearch() { // TODO: 重構物品/地圖交替搜尋時邏輯 stats: [{type: "and", filters: [], disabled: true(?)}]
    if (this.item.category === 'item' || this.item.category === 'unique') {
      this.filters.searchJson.query.stats = [{ "type": "and", "filters": [] }];
      this.filters.searchJson.query.filters.equipment_filters = { filters: {} };
    } else if (this.item.category === 'map' && this.basics.map.isSearch) {
      this.item.name = `物品名稱 <br>『${this.basics.map.chosenM}』`;
    } else if (this.item.category === 'gem' && this.basics.gem.isSearch) { //需要重看
      this.item.name = `物品名稱 <br>『${this.basics.gem.chosenG}』`
    }

    this.searchTrade();
  }

  //取代說明字樣
  replaceIllustrate(text: any, count: any) {
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
      this.filters.searchJson.query.filters.misc_filters.filters = {}; // 刪除已汙染 filter
    } else {
      this.filters.searchJson.query.filters.misc_filters.filters = { // 增加已汙染 filter
        corrupted: {
          option: this.searchOptions.corruptedSet.chosenObj
        }
      };
    }
  }

  //子元件回傳狀態
  countingStatus($e: any) {
    this.app.isCounting = $e;
  }

  //檢查基底名稱
  checkBasicName(itemBasic: string): string {
    if (itemBasic.indexOf('精良的') > -1) {
      itemBasic = itemBasic.substring(itemBasic.indexOf('精良的') + 4, itemBasic.length);
    }
    //的count
    let countFirst = (itemBasic.match(/\的/g) || []).length;
    let countSecond = (itemBasic.match(/\之/g) || []).length;
    // console.log([...itemBasic.matchAll(/\的/g)]);
    //的位置
    let firstPos = itemBasic.indexOf("的");
    //之位置
    let SecondPos = countFirst > 1 ? +[...itemBasic.matchAll(/\的/g)][1].index : countSecond > 1 ? +[...itemBasic.matchAll(/\之/g)][1].index : itemBasic.indexOf("之");

    if (SecondPos > firstPos && firstPos !== -1) {
      itemBasic = itemBasic.substring(SecondPos + 1, itemBasic.length);
    } else if (firstPos > SecondPos) {
      itemBasic = itemBasic.substring(firstPos + 1, itemBasic.length);
    } else if (firstPos === -1) {
      itemBasic = itemBasic.substring(SecondPos + 1, itemBasic.length);
    }

    console.log(itemBasic);

    return itemBasic;
  }

  //取得插槽數量
  getSocketNumber(text: string): number {
    let start = text.indexOf('插槽: ');

    if (start > -1) {
      let socPos = text.substring(text.indexOf('插槽: ') + 4); // 插槽截斷字串 (包含'插槽: +'前的字串全截斷)
      let socPosEnd = socPos.indexOf(this.newLine);

      return socPos.substring(0, socPosEnd).trim().split(" ").length;
    } else {
      return 0;
    }
  }
}
