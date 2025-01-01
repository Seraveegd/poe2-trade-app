import { Component, OnInit } from '@angular/core';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { AppService } from '../app.service';
// import { RouterLink, RouterOutlet } from '@angular/router';
import { interval, lastValueFrom, map, Observable } from 'rxjs';
import { AnalyzeComponent } from "./analyze/analyze.component";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Clipboard } from 'electron';

@Component({
  selector: 'app-home',
  imports: [
    NgbCollapseModule,
    NgbTooltipModule,
    FormsModule,
    CommonModule,
    // RouterLink,
    // RouterOutlet,
    AnalyzeComponent
  ],
  providers: [AppService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private clipboard!: Clipboard;
  public isCollapsed: boolean = false;

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
    issueText: '',
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
    supported: true,
    copyText: '',
    searchStats: [] // 分析拆解後的物品詞綴陣列，提供使用者在界面勾選是否查詢及輸入數值
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
  }

  //搜尋相關設定
  public searchOptions: any = {
    // isOnline: true,
    isPriced: true,
    isPriceCollapse: true, // 透過帳號摺疊名單 (Collapse Listings by Account) 預設為 true
    serverOptions: ['台服'],
    raritySet: { // 稀有度設定
      option: [{
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
      chosenObj: "nonunique",
      isSearch: false,
    },
    itemLevel: { // 搜尋設定->物品等級
      min: 0,
      max: '',
      isSearch: false,
    },
    mapLevel: { // 搜尋設定->換界石階級
      min: 0,
      max: 0,
      isSearch: false,
    },
    itemBasic: { // 搜尋設定->物品基底
      text: '',
      isSearch: false,
    },
    gemLevel: { // 搜尋設定->技能寶石等級
      min: 0,
      max: '',
      isSearch: false,
    },
    gemQuality: { // 搜尋設定->技能寶石品質
      min: 0,
      max: '',
      isSearch: false,
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
      chosenObj: "any",
      // isSearch: true,
    },
    itemCategory: { // 物品分類
      option: [],
      chosenObj: {
        label: "任何",
        prop: ''
      },
      isSearch: false,
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

  //暫時留著
  public options: any = {
    clickCount: 0,
    // copyText: '',
    searchedText: '',
    testResponse: '',
    gggMapBasic: [],
    gggGemBasic: [],
  };

  constructor(private poe_service: AppService) {
    if ((<any>window).require) {
      try {
        this.clipboard = (<any>window).require('electron').clipboard;
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

      if (text.indexOf('稀有度: ') > -1 && !this.app.isApiError && !this.app.onReady) { // POE 內的文字必定有稀有度
        this.app.preCopyText = text;
        this.app.onReady = true;
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

    //物品稀有度
    let posRarity = itemArray[1].indexOf(': ');
    let Rarity = itemArray[1].substring(posRarity + 2).trim();

    console.log(Rarity);

    //物品名稱 - name
    let searchName = itemArray[2];
    this.item.name = itemArray[3] === "--------" ? `物品名稱 <br>『${itemArray[2]}』` : `物品名稱 <br>『${itemArray[2]} ${itemArray[3]}』`;

    //物品基底 - type
    let itemBasic = itemArray[3];
    let itemNameString = itemArray[3] === "--------" ? itemArray[2] : `${itemArray[2]} ${itemArray[3]}`;
    let itemBasicCount = 0;

    //物品檢查
    this.basics.categorizedItems.some((element: any) => {
      let itemNameStringIndex = itemNameString.indexOf(element.text || element.type);
      console.log(itemNameString, itemNameStringIndex);

      if (itemNameStringIndex > -1 && !itemBasicCount && (itemNameString.indexOf('碎片') === -1 || Rarity !== '傳奇')) {
        itemBasicCount++;
        this.itemAnalysis(item, itemArray, element);
        this.item.category = 'item';
        this.ui.collapse.item = false;
        // this.options.isItem = true;
        // this.options.isItemCollapse = true;
        return true;
      }

      return false;
    });

    //詞綴分析
    if (Rarity === "傳奇") { // 傳奇道具
      this.searchOptions.raritySet.chosenObj = item.indexOf('傳奇 (貼模)') > -1 ? 'uniquefoil' : 'unique';

      console.log(this.filters.searchJson);

      if (item.indexOf('未鑑定') === -1) { // 已鑑定傳奇
        this.searchOptions.raritySet.isSearch = true;
        Object.assign(this.filters.searchJson.query, { name: searchName, type: itemBasic });
        // this.isRaritySearch();

        if (this.item.category === 'item') {
          this.itemStatsAnalysis(itemArray, 1);
        }
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

      // const isTransfigured = this.transfiguredGems.find(gem => gem.text === searchName); // 比對是否為變異寶石
      // if (isTransfigured) {
      //   this.searchJson.query.type = {
      //     "option": this.replaceString(isTransfigured.type),
      //     "discriminator": isTransfigured.disc
      //   }
      //   if (item.indexOf('瓦爾．') > -1) { // 瓦爾 & 變異寶石
      //     let vaalPos = item.substring(item.indexOf('瓦爾．'))
      //     let vaalPosEnd = vaalPos.indexOf(NL)
      //     let vaalGem = vaalPos.substring(0, vaalPosEnd)
      //     this.searchName = `物品名稱『${vaalGem} (${searchName})』`
      //     this.searchJson.query.type.option = this.replaceString(`瓦爾．${isTransfigured.type}`)
      //   }
      // } else {
      //   if (item.indexOf('瓦爾．') > -1) { // 瓦爾技能
      //     let vaalPos = item.substring(item.indexOf('瓦爾．'))
      //     let vaalPosEnd = vaalPos.indexOf(NL)
      //     let vaalGem = vaalPos.substring(0, vaalPosEnd)
      //     this.searchName = `物品名稱『${vaalGem}』`
      //     this.gemBasic.chosenG = vaalGem
      //   }
      //   this.gemBasic.isSearch = true
      //   this.isGemBasicSearch()
      // }

      let levelPos = item.substring(item.indexOf('等級: ') + 4);
      let levelPosEnd = levelPos.indexOf(NL);
      this.searchOptions.gemLevel.min = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);

      let minQuality = 0;
      if (item.indexOf('品質: +') > -1) {
        let quaPos = item.substring(item.indexOf('品質: +') + 5); // 品質截斷字串 (包含'品質: +'前的字串全截斷)
        let quaPosEnd = quaPos.indexOf('% (augmented)'); // 品質定位點
        minQuality = parseInt(quaPos.substring(0, quaPosEnd).trim(), 10);
      }
      // if (!isTransfigured) { // 若不是變異寶石，則搜尋技能品質
      this.searchOptions.gemQuality.isSearch = true;
      // }
      this.searchOptions.gemQuality.min = minQuality;
      this.isGemQualitySearch();
    }
    else if (this.item.category === 'item') {
      this.itemStatsAnalysis(itemArray, 0);
      console.log(this.searchOptions);
      return;
    }

    // if (item.indexOf('物品種類: 異界地圖') > -1 || item.indexOf('釋界之邀：') > -1 || item.indexOf('物品種類: 契約書') > -1 || item.indexOf('物品種類: 藍圖') > -1 || item.indexOf('物品種類: 聖域研究') > -1) { // 類地圖搜尋
    //   this.mapAnalysis(item, itemArray, Rarity)
    // } else if ((Rarity === "稀有" || Rarity === "傳奇") && item.indexOf('點擊右鍵將此加入你的獸獵寓言。') > -1) { // 獸獵（物品化怪物）
    //   let monstersCount = 0
    //   this.monstersItems.some(element => {
    //     if (itemNameString.indexOf(element.text) > -1 && !monstersCount) {
    //       this.searchJson.query.type = element.type
    //       return true
    //     }
    //   });
    // } else if (Rarity === "傳奇" && item.indexOf('在塔恩的鍊金室') === -1) { // 傳奇道具
    //   if (item.indexOf('古典傳奇') > -1) {
    //     this.raritySet.chosenObj = {
    //       label: "古典傳奇",
    //       prop: 'uniquefoil'
    //     }
    //   } else {
    //     this.raritySet.chosenObj = {
    //       label: "傳奇",
    //       prop: 'unique'
    //     }
    //   }
    //   if (item.indexOf('未鑑定') === -1) { // 已鑑定傳奇
    //     this.searchJson.query.name = this.replaceString(searchName)
    //     this.searchJson.query.type = this.replaceString(itemBasic)
    //     this.raritySet.isSearch = true
    //     this.isRaritySearch()
    //     if (this.isItem) {
    //       this.itemStatsAnalysis(itemArray, 1)
    //     }
    //   } else { // 未鑑定傳奇(但會搜到相同基底)
    //     if (searchName.indexOf('精良的') > -1) { // 未鑑定的品質傳奇物品
    //       searchName = searchName.substring(4)
    //     }
    //     this.raritySet.isSearch = true
    //     this.isRaritySearch()
    //     this.searchJson.query.type = this.replaceString(searchName)
    //     this.$message({
    //       duration: 2000,
    //       type: 'warning',
    //       message: `未鑑定傳奇物品會搜到相同基底的其他傳奇裝`
    //     });
    //   }
    // } else if (Rarity === "命運卡" || Rarity === "通貨" || Rarity === "通貨不足") {
    //   this.searchJson.query.type = this.replaceString(searchName)
    //   if (item.indexOf('可以使用於個人地圖裝置以開啟前往現今阿茲瓦特神殿的傳送門。') > -1) { // 史記房間判斷
    //     this.templeStatsAnalysis(itemArray)
    //     this.isStatsCollapse = true
    //     return
    //   } else if (item.indexOf('在你的地圖裝置使用此物品來開啟前往卡蘭德迷湖的傳送門。') > -1) { // 鏡像碑牌判斷
    //     this.mirroredStatsAnalysis(itemArray)
    //     this.isStatsCollapse = true
    //     return
    //   }
    // } else if (Rarity === "寶石") {
    //   this.isGem = true
    //   this.gemBasic.chosenG = searchName

    //   const isTransfigured = this.transfiguredGems.find(gem => gem.text === searchName); // 比對是否為變異寶石
    //   if (isTransfigured) {
    //     this.searchJson.query.type = {
    //       "option": this.replaceString(isTransfigured.type),
    //       "discriminator": isTransfigured.disc
    //     }
    //     if (item.indexOf('瓦爾．') > -1) { // 瓦爾 & 變異寶石
    //       let vaalPos = item.substring(item.indexOf('瓦爾．'))
    //       let vaalPosEnd = vaalPos.indexOf(NL)
    //       let vaalGem = vaalPos.substring(0, vaalPosEnd)
    //       this.searchName = `物品名稱『${vaalGem} (${searchName})』`
    //       this.searchJson.query.type.option = this.replaceString(`瓦爾．${isTransfigured.type}`)
    //     }
    //   } else {
    //     if (item.indexOf('瓦爾．') > -1) { // 瓦爾技能
    //       let vaalPos = item.substring(item.indexOf('瓦爾．'))
    //       let vaalPosEnd = vaalPos.indexOf(NL)
    //       let vaalGem = vaalPos.substring(0, vaalPosEnd)
    //       this.searchName = `物品名稱『${vaalGem}』`
    //       this.gemBasic.chosenG = vaalGem
    //     }
    //     this.gemBasic.isSearch = true
    //     this.isGemBasicSearch()
    //   }

    //   let levelPos = item.substring(item.indexOf('等級: ') + 4)
    //   let levelPosEnd = levelPos.indexOf(NL)
    //   this.gemLevel.min = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10)

    //   let minQuality = 0
    //   if (item.indexOf('品質: +') > -1) {
    //     let quaPos = item.substring(item.indexOf('品質: +') + 5) // 品質截斷字串 (包含'品質: +'前的字串全截斷)
    //     let quaPosEnd = quaPos.indexOf('% (augmented)') // 品質定位點
    //     minQuality = parseInt(quaPos.substring(0, quaPosEnd).trim(), 10)
    //   }
    //   if (!isTransfigured) { // 若不是變異寶石，則搜尋技能品質
    //     this.gemQuality.isSearch = true
    //   }
    //   this.gemQuality.min = minQuality
    //   this.isGemQualitySearch()
    // } else if (Rarity === "普通" && !this.isItem) {
    //   // } else if (Rarity === "普通" && (item.indexOf('透過聖殿實驗室或個人') > -1 || item.indexOf('可以使用於個人的地圖裝置來增加地圖的詞綴') > -1 || item.indexOf('放置兩個以上不同的徽印在地圖裝置中') > -1 || item.indexOf('你必須完成異界地圖中出現的全部六種試煉才能進入此區域') > -1 || item.indexOf('擊殺指定數量的怪物後會掉落培育之物') > -1 || item.indexOf('將你之前祭祀神壇保存的怪物加入至該地圖的祭祀神壇中') > -1 || item.indexOf('使用此物品開啟前往無悲憫與同情之地的時空之門') > -1 || item.indexOf('在個人地圖裝置使用此物品開啟譫妄異域時空之門') > -1 || item.indexOf('地圖裝置來使用此物品以前往進入瓦爾寶庫') > -1)) {
    //   // 地圖碎片、裂痕石、徽印、聖甲蟲、眾神聖器、女神祭品、培育器、浸血碑器、釋界之令、幻像異界、瓦爾遺鑰
    //   this.searchJson.query.type = this.replaceString(searchName)
    //   if (item.indexOf('右鍵點擊此物品再左鍵點擊虛空石，來套用物品化的六分儀詞綴至虛空石上。') > -1) { // 充能的羅盤
    //     this.compassStatsAnalysis(itemArray)
    //     this.isStatsCollapse = true
    //     return
    //   }
    // } else if (Rarity === "任務" && !this.isItem) {
    //   this.searchName = `物品名稱 <br>『充能的羅盤』`
    //   if (item.indexOf('放置於此以提升你輿圖全部地圖的階級。') > -1) { // 任務虛空石
    //     this.compassStatsAnalysis(itemArray)
    //     this.isStatsCollapse = true
    //     return
    //   }
    // } else if (this.isItem) {
    //   this.itemStatsAnalysis(itemArray, 0)
    //   return
    // } else {
    //   this.itemsAPI()
    //   this.issueText = `Version: v1.325.0\n尚未支援搜尋該道具\n\`\`\`\n${this.copyText.replace('稀有度: ', 'Rarity: ')}\`\`\``
    //   this.isSupported = false
    //   this.isStatsCollapse = false
    //   return
    // }

    this.searchTrade();
  }

  //重置搜尋資料
  resetSearchData() {
    this.item.name = '';

    this.searchResult.fetchID.length = 0;

    this.item.category = '';

    this.item.supported = true;

    this.searchOptions.raritySet.isSearch = false;

    this.searchOptions.itemLevel.isSearch = false;
    this.searchOptions.itemLevel.min = '';
    this.searchOptions.itemLevel.max = '';

    this.searchOptions.mapLevel.isSearch = false;
    this.searchOptions.mapLevel.min = '';
    this.searchOptions.mapLevel.max = '';

    // this.options.areaLevel.isSearch = false
    // this.options.areaLevel.min = ''
    // this.options.areaLevel.max = ''
    // this.options.itemLinked.isSearch = false
    // this.options.itemLinked.min = ''
    // this.options.itemLinked.max = ''
    this.searchOptions.itemBasic.isSearch = false;

    this.searchOptions.gemLevel.isSearch = false;
    this.searchOptions.gemLevel.min = '';
    this.searchOptions.gemLevel.max = '';

    this.searchOptions.gemQuality.isSearch = false;
    this.searchOptions.gemQuality.min = '';
    this.searchOptions.gemQuality.max = '';

    this.searchOptions.corruptedSet.chosenObj = 'any';

    this.searchResult.fetchQueryID = '';
    this.searchResult.status = '';
    this.item.searchStats = [];
  }

  //物品分析
  itemAnalysis(item: any, itemArray: any, matchItem: any) {
    const NL = this.newLine;
    this.searchOptions.itemCategory.option.length = 0;
    // this.options.itemExBasic.chosenObj = {
    //   label: "任何",
    //   prop: ''
    // };
    this.searchOptions.raritySet.chosenObj = 'nonunique';
    this.searchOptions.raritySet.isSearch = true;
    // this.isRaritySearch();
    // 判斷物品基底
    this.searchOptions.itemBasic.text = matchItem.text || matchItem.type;
    // 判斷物品等級
    if (item.indexOf('物品等級: ') > -1) {
      let levelPos = item.substring(item.indexOf('物品等級: ') + 5);
      let levelPosEnd = levelPos.indexOf(NL);
      let levelValue = parseInt(levelPos.substring(0, levelPosEnd).trim(), 10);
      this.searchOptions.itemLevel.min = levelValue >= 86 ? 86 : levelValue; // 物等超過86 只留86
    }
    // 判斷插槽連線
    // if (item.indexOf('插槽: ') > -1) {
    //   const regLinkStr = /[A-Z]/g // 全域搜尋大寫英文字母
    //   const regLink6 = /(-){5}/g // 六連
    //   const regLink5 = /(-){4}/g // 五連
    //   const regLink4 = /(-){3}/g // 四連
    //   let linkedPos = item.substring(item.indexOf('插槽: ') + 3)
    //   let linkedPosEnd = linkedPos.indexOf(NL)
    //   let linkedString = linkedPos.substring(0, linkedPosEnd).trim().replace(regLinkStr, '')
    //   switch (true) {
    //     case regLink6.test(linkedString) == true:
    //       this.itemLinked.min = 6
    //       break;
    //     case regLink5.test(linkedString) == true:
    //       this.itemLinked.min = 5
    //       break;
    //     case regLink4.test(linkedString) == true:
    //       this.itemLinked.min = 4
    //       break;
    //     default:
    //       break;
    //   }
    // }
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
    this.searchOptions.itemCategory.isSearch = true;
    // this.isItemCategorySearch();

    // // 判斷勢力基底
    // this.itemExBasic.isSearch = true
    // switch (true) {
    //   case itemArray.indexOf('塑者之物') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "塑者之物",
    //       prop: "shaper_item"
    //     }
    //     break;
    //   case itemArray.indexOf('尊師之物') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "尊師之物",
    //       prop: "elder_item"
    //     }
    //     break;
    //   case itemArray.indexOf('聖戰軍王物品') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "聖戰君王物品",
    //       prop: "crusader_item"
    //     }
    //     break;
    //   case itemArray.indexOf('救贖者物品') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "救贖者物品",
    //       prop: "redeemer_item"
    //     }
    //     break;
    //   case itemArray.indexOf('總督軍物品') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "總督軍物品",
    //       prop: "warlord_item"
    //     }
    //     break;
    //   case itemArray.indexOf('狩獵者物品') > -1:
    //     this.itemExBasic.chosenObj = {
    //       label: "狩獵者物品",
    //       prop: "hunter_item"
    //     }
    //     break;
    //   default:
    //     this.itemExBasic.isSearch = false
    //     break;
    // }
    // this.isExBasicSearch()

    // switch (matchItem.option) { // 藥劑、劫盜裝備、守望會自動搜尋該基底
    //   case 'flask':
    //   case 'heistequipment':
    //     this.itemLevel.isSearch = true // 藥劑及劫盜裝備增加物等篩選
    //     this.isItemLevelSearch()
    //   case 'sentinel':
    //     this.itemBasic.isSearch = true
    //     this.isItemBasicSearch()
    //     this.searchTrade(this.searchJson)
    //     break;
    //   default:
    //     break;
    // }
  }

  //換界石分析
  mapAnalysis(item: any, itemArray: any, Rarity: any) {
    // this.itemStatsAnalysis(itemArray, 1) 地圖先不加入詞綴判斷
    const NL = this.newLine;
    this.item.category = 'map';
    this.ui.collapse.map = false;
    // this.options.isMap = true;
    // this.options.isMapCollapse = true;
    // this.options.mapCategory = {
    //   isShaper: false,
    //   isElder: false,
    //   isCitadel: false,
    //   isBlighted: false
    // };
    this.searchOptions.raritySet.chosenObj = 'nonunique';
    this.searchOptions.raritySet.isSearch = true;
    // this.isRaritySearch();
    let mapPos = item.indexOf('換界石階級:') > -1 ? item.substring(item.indexOf('換界石階級:') + 5) : 0; // 地圖階級截斷字串
    // let areaPos = item.indexOf('地區等級:') > -1 ? item.substring(item.indexOf('地區等級:') + 5) : 0 // 地區等級截斷字串
    // if (!areaPos)
    //   areaPos = item.indexOf('區域等級:') > -1 ? item.substring(item.indexOf('區域等級:') + 5) : 0 // 區域等級截斷字串
    if (mapPos) {
      let mapPosEnd = mapPos.indexOf(NL); // 地圖階級換行定位點
      let mapTier = parseInt(mapPos.substring(0, mapPosEnd).trim(), 10);
      this.searchOptions.mapLevel.min = mapTier;
      this.searchOptions.mapLevel.max = mapTier;
      this.searchOptions.mapLevel.isSearch = true;
      this.isMapLevelSearch();
    }
    // else if (areaPos) {
    //   let areaPosEnd = areaPos.indexOf(NL) // 地區等級換行定位點
    //   let areaTier = parseInt(areaPos.substring(0, areaPosEnd).trim(), 10)
    //   this.areaLevel.min = areaTier
    //   this.areaLevel.isSearch = true
    //   this.isAreaLevelSearch()
    // }

    let itemNameString = itemArray[2] === "--------" ? itemArray[1] : `${itemArray[1]} ${itemArray[2]}`
    let mapBasicCount = 0;

    this.basics.map.option.some((element: any) => {
      let itemNameStringIndex = itemNameString.indexOf(element.replace(/[^\u4e00-\u9fa5|．|：]/gi, "")) // 比對 mapBasic.option 時只比對中文字串
      if (itemNameStringIndex > -1 && !mapBasicCount) {
        mapBasicCount++
        this.basics.map.chosenM = this.app.isTwServer ? element.replace(/[^\u4e00-\u9fa5|．|：]/gi, "") : itemNameString.slice(itemNameStringIndex)
        return true
      }

      return false;
    });
    this.basics.map.isSearch = true
    // this.isMapBasicSearch()
    // this.options.searchJson.query.filters.map_filters.filters.map_blighted = { // 過濾凋落圖
    //   "option": "false"
    // }

    // if (Rarity === "傳奇") { //傳奇地圖
    //   this.options.raritySet.chosenObj = {
    //     label: "傳奇",
    //     prop: 'unique'
    //   }
    //   if (item.indexOf('未鑑定') === -1) { // 已鑑定地圖
    //     this.options.searchJson.query.name = this.replaceString(itemArray[1])
    //   }
    //   this.options.raritySet.isSearch = true
    //   this.isRaritySearch()
    // } else if (item.indexOf('區域被塑界者控制 (implicit)') > -1) { // 塑界者地圖
    //   this.mapCategory.isShaper = true
    //   this.searchJson.query.stats[0].filters[0] = {
    //     "id": "implicit.stat_1792283443",
    //     "value": {
    //       "option": "1"
    //     }
    //   }
    // } else if (item.indexOf('區域被異界尊師控制 (implicit)') > -1) { // 尊師地圖
    //   this.mapCategory.isElder = true
    //   this.searchJson.query.stats[0].filters[0] = {
    //     "id": "implicit.stat_1792283443",
    //     "value": {
    //       "option": "2"
    //     }
    //   }
    //   if (item.indexOf('地圖被異界．奴役佔據 (implicit)') > -1) { // 尊師守衛地圖
    //     this.mapElderGuard.chosenObj = {
    //       label: "異界．奴役",
    //       prop: "1"
    //     }
    //     this.mapElderGuard.isSearch = true
    //     this.isMapElderGuardSearch()
    //   } else if (item.indexOf('地圖被異界．根除佔據 (implicit)') > -1) {
    //     this.mapElderGuard.chosenObj = {
    //       label: "異界．根除",
    //       prop: "2"
    //     }
    //     this.mapElderGuard.isSearch = true
    //     this.isMapElderGuardSearch()
    //   } else if (item.indexOf('地圖被異界．干擾佔據 (implicit)') > -1) {
    //     this.mapElderGuard.chosenObj = {
    //       label: "異界．干擾",
    //       prop: "3"
    //     }
    //     this.mapElderGuard.isSearch = true
    //     this.isMapElderGuardSearch()
    //   } else if (item.indexOf('地圖被異界．淨化佔據 (implicit)') > -1) {
    //     this.mapElderGuard.chosenObj = {
    //       label: "異界．淨化",
    //       prop: "4"
    //     }
    //     this.mapElderGuard.isSearch = true
    //     this.isMapElderGuardSearch()
    //   }
    // } else if (item.indexOf('地圖含有巴倫的壁壘 (implicit)') > -1) { // 壁壘守衛地圖
    //   this.mapCategory.isCitadel = true
    //   this.mapCitadelGuard.chosenObj = {
    //     label: "聖戰軍王．巴倫",
    //     prop: "1"
    //   }
    //   this.mapCitadelGuard.isSearch = true
    //   this.isMapCitadelGuardSearch()
    // } else if (item.indexOf('地圖含有維羅提尼亞的壁壘 (implicit)') > -1) {
    //   this.mapCategory.isCitadel = true
    //   this.mapCitadelGuard.chosenObj = {
    //     label: "救贖者．維羅提尼亞",
    //     prop: "2"
    //   }
    //   this.mapCitadelGuard.isSearch = true
    //   this.isMapCitadelGuardSearch()
    // } else if (item.indexOf('地圖含有奧赫茲明的壁壘 (implicit)') > -1) {
    //   this.mapCategory.isCitadel = true
    //   this.mapCitadelGuard.chosenObj = {
    //     label: "狩獵者．奧赫茲明",
    //     prop: "3"
    //   }
    //   this.mapCitadelGuard.isSearch = true
    //   this.isMapCitadelGuardSearch()
    // } else if (item.indexOf('地圖含有圖拉克斯的壁壘 (implicit)') > -1) {
    //   this.mapCategory.isCitadel = true
    //   this.mapCitadelGuard.chosenObj = {
    //     label: "總督軍．圖拉克斯",
    //     prop: "4"
    //   }
    //   this.mapCitadelGuard.isSearch = true
    //   this.isMapCitadelGuardSearch()
    // } else if (item.indexOf('凋落的') > -1 || item.indexOf('Blighted') > -1) {
    //   this.mapCategory.isBlighted = true
    //   this.searchJson.query.filters.map_filters.filters.map_blighted = {
    //     "option": "true"
    //   }
    // }
    // else { // error handle
    //   this.status = `Oops! 尚未支援搜尋此種地圖`
    //   return
    // }
    this.searchTrade();
  }

  //物品詞綴分析
  itemStatsAnalysis(itemArray: any, rarityFlag: any) {
    // if (itemArray.indexOf('塑者之物') > -1) // 勢力判斷由 itemAnalysis function 處理
    //   itemArray.splice(itemArray.indexOf('塑者之物'), 1)
    // if (itemArray.indexOf('尊師之物') > -1)
    //   itemArray.splice(itemArray.indexOf('尊師之物'), 1)
    // if (itemArray.indexOf('聖戰軍王物品') > -1)
    //   itemArray.splice(itemArray.indexOf('聖戰軍王物品'), 1)
    // if (itemArray.indexOf('救贖者物品') > -1)
    //   itemArray.splice(itemArray.indexOf('救贖者物品'), 1)
    // if (itemArray.indexOf('狩獵者物品') > -1)
    //   itemArray.splice(itemArray.indexOf('狩獵者物品'), 1)
    // if (itemArray.indexOf('總督軍物品') > -1)
    //   itemArray.splice(itemArray.indexOf('總督軍物品'), 1)

    // let clusterA = itemArray.findIndex((e: any) => e.indexOf('個附加的天賦為珠寶插槽') > -1) // 星團珠寶贅詞
    // let clusterB = itemArray.findIndex((e: any) => e.indexOf('附加的天賦點不與珠寶範圍互動。點擊右鍵從插槽中移除。') > -1)
    // if (clusterB > -1)
    //   itemArray.splice(clusterB, 1)
    // if (clusterA > -1)
    //   itemArray.splice(clusterA, 1)

    this.ui.collapse.stats = rarityFlag ? true : false;
    let tempStat: any = [];
    let itemDisplayStats: any = []; // 該物品顯示的詞綴陣列
    let itemStatStart = 0;// 物品隨機詞綴初始位置
    let itemStatEnd = itemArray.length - 1; // 物品隨機詞綴結束位置 //之後可能需要修改

    // function spliceWrapStats(spliceNumber: any, index: any) { //配合 splice function 與 \n 數量調整詞綴結束位置
    //   itemArray.splice(index + 1, spliceNumber)
    //   itemStatEnd = itemArray.length - spliceNumber
    // }

    //尋找結束行
    itemArray.forEach((element: any, index: any) => {
      let isEndPoint = index > 0 ? itemArray[index - 1].indexOf("(enchant)") > -1 || itemArray[index - 1].indexOf("(implicit)") > -1 || itemArray[index - 1].indexOf("(scourge)") > -1 || itemArray[index - 1].indexOf("(rune)") > -1 : false;

      if (element.indexOf('物品等級:') > -1) {
        itemStatStart = index + 2;
      }
      // "--------" 字串前一筆資料若為固定詞或附魔詞或災魘詞，則不將此 index 視為詞綴結束點
      // if (stringSimilarity.compareTwoStrings(element, '魔符階級:') > 0.7) {
      //   itemStatStart = index + 2
      // } else if (stringSimilarity.compareTwoStrings(element, '物品等級:') > 0.7) {
      //   itemStatStart = index + 2
      // }
      // this.options.wrapStats.forEach((wrapStatsElement: any, wrapStatsIndex: any) => {
      //   let firstWSE = wrapStatsElement.split("\n")[0]
      //   let secondWSE = wrapStatsElement.split("\n")[1]
      //   let newLineCount = wrapStatsElement.split("\n").length - 1
      //   let tempStatArray = []
      //   // 比對折行詞綴第一筆與第二筆，比對成功就將 itemArray 刪除指定筆數
      //   if (element && stringSimilarity.compareTwoStrings(firstWSE, element) > 0.7 && stringSimilarity.compareTwoStrings(secondWSE, itemArray[index + 1]) > 0.7) {
      //     for (let i = 0; i <= newLineCount; i++) {
      //       tempStatArray.push(itemArray[index + i])
      //     }
      //     itemArray[index] = tempStatArray.join('\n')
      //     spliceWrapStats(newLineCount, index)
      //   }
      // });
      // if (element.indexOf("附加的小型天賦給予：") > -1 && element.indexOf("(enchant)") > -1) { // 有折行的星團珠寶附魔詞綴
      //   switch (true) {
      //     case element.indexOf("斧攻擊增加 12% 擊中和異常狀態傷害") > -1:
      //       itemArray[index] = `${itemArray[index]}\n劍攻擊增加 12% 擊中和異常狀態傷害 (enchant)`
      //       spliceWrapStats(1, index)
      //       break;
      //     case element.indexOf("長杖攻擊增加 12% 擊中和異常狀態傷害") > -1:
      //       itemArray[index] = `${itemArray[index]}\n錘或權杖攻擊增加 12% 擊中和異常狀態傷害 (enchant)`
      //       spliceWrapStats(1, index)
      //       break;
      //     case element.indexOf("爪攻擊增加 12% 擊中和異常狀態傷害") > -1:
      //       itemArray[index] = `${itemArray[index]}\n匕首攻擊增加 12% 擊中和異常狀態傷害 (enchant)`
      //       spliceWrapStats(1, index)
      //       break;
      //     case element.indexOf("持弓類武器時增加 12% 傷害") > -1:
      //       itemArray[index] = `${itemArray[index]}\n增加 12% 弓技能持續傷害 (enchant)`
      //       spliceWrapStats(1, index)
      //       break;
      //     case element.indexOf("增加 12% 陷阱傷害") > -1:
      //       itemArray[index] = `${itemArray[index]}\n增加 12% 地雷傷害 (enchant)`
      //       spliceWrapStats(1, index)
      //       break;
      //     case element.indexOf("增加 10% 來自藥劑的生命回復") > -1:
      //       itemArray[index] = `${itemArray[index]}\n增加 10% 來自藥劑的魔力回復`
      //       spliceWrapStats(1, index)
      //       break;
      //     default:
      //       break;
      //   }
      // } else if (element.indexOf("只會影響") > -1 && element.indexOf("範圍內的天賦") > -1) { // 希望之絃 Thread of Hope 特殊判斷
      //   let areaStat = itemArray[index].substr(4, 1)
      //   itemArray[index] = `只能影響 # Ring 上的天賦,${areaStat}`
      // } else if (element.indexOf("卓烙總督物品") > -1 || element.indexOf("吞噬天地物品") > -1 || element.indexOf("Searing Exarch Item") > -1 || element.indexOf("Eater of Worlds Item") > -1) {
      //   spliceWrapStats(2, index + 1) // 忽略 3.17 新勢力詞綴
      // }
      if (element === "--------" && !isEndPoint && itemStatStart && index > itemStatStart && itemStatEnd == itemArray.length - 1) { // 判斷隨機詞綴結束點
        itemStatEnd = index;
      }

      if (element.indexOf('未鑑定') > -1) {
        itemStatEnd = index - 1;
        return
      }
    });

    console.log(itemStatStart, itemStatEnd)

    for (let index = itemStatStart; index < itemStatEnd; index++) {
      if (itemArray[index] !== "--------" && itemArray[index]) {
        let text = itemArray[index];
        itemDisplayStats.push(text);

        if (itemArray[index].indexOf('(implicit)') > -1) { // 固定屬性
          console.log("固定");
          text = text.substring(0, text.indexOf('(implicit)')).trim(); // 刪除(implicit)字串
          tempStat.push({ text: this.getStat(text, 'implicit') });
          tempStat[tempStat.length - 1].type = "固定";
        } else if (itemArray[index].indexOf('(rune)') > -1) { //符文屬性
          console.log("符文");
          text = text.substring(0, text.indexOf('(rune)')).trim(); // 刪除(rune)字串
          tempStat.push({ text: this.getStat(text, 'rune') });
          tempStat[tempStat.length - 1].type = "符文";
        } else if (itemArray[index].indexOf('(enchant)') > -1) { // 附魔
          console.log("附魔");
          text = text.substring(0, text.indexOf('(enchant)')).trim(); // 刪除(enchant)字串
          tempStat.push({ text: this.getStat(text, 'enchant') });
          tempStat[tempStat.length - 1].type = "附魔";
        } else if (rarityFlag) { //傳奇裝詞綴
          console.log("傳奇");
          tempStat.push({ text: this.getStat(text, 'explicit') });
          tempStat[tempStat.length - 1].type = "傳奇";
        } else { // 隨機屬性
          console.log("隨機");
          tempStat.push({ text: this.getStat(text, 'explicit') });
          tempStat[tempStat.length - 1].type = "隨機";
        }
      }
    }

    // let elementalResistanceTotal = 0;
    // let spellDamageTotal = 0;
    //比對詞綴，抓出隨機數值與詞綴搜尋 ID
    tempStat.forEach((element: any, idx: any, array: any) => {
      if (element.text.indexOf('未找到詞綴') === -1) {
        let isStatSearch = false;
        // let bestIndex = (element.bestMatchIndex % 2 === 0) ? element.bestMatchIndex + 1 : element.bestMatchIndex; // 處理判斷到英文詞綴的例外狀況，通常是季初有新詞綴尚未翻譯時才發生
        let posStat = this.stats.explicit.indexOf(element.text);
        let statID = this.stats.explicit[posStat + 1]; // 詞綴ID
        let apiStatText = this.stats.explicit[posStat]; // API 抓回來的詞綴字串
        let itemStatText = itemDisplayStats[idx]; // 物品上的詞綴字串

        console.log(element, statID, apiStatText, itemStatText);

        // switch (true) { // 部分(Local)屬性判斷處理：若物品為武器，攻擊屬性應為（部分）標籤
        //   case statID.indexOf('stat_960081730') > -1 || statID.indexOf('stat_1940865751') > -1: // 附加 # 至 # 物理傷害 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) { // 武器類別
        //       statID = `${statID.split('.')[0]}.stat_1940865751`
        //     } else { // 非武器
        //       statID = `${statID.split('.')[0]}.stat_960081730`
        //     }
        //     break;
        //   case statID.indexOf('stat_321077055') > -1 || statID.indexOf('stat_709508406') > -1: // 附加 # 至 # 火焰傷害 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_709508406`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_321077055`
        //     }
        //     break;
        //   case statID.indexOf('stat_3531280422') > -1 || statID.indexOf('stat_2223678961') > -1: // 附加 # 至 # 混沌傷害 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_2223678961`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_3531280422`
        //     }
        //     break;
        //   case statID.indexOf('stat_1334060246') > -1 || statID.indexOf('stat_3336890334') > -1: // 附加 # 至 # 閃電傷害 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_3336890334`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_1334060246`
        //     }
        //     break;
        //   case statID.indexOf('stat_2387423236') > -1 || statID.indexOf('stat_1037193709') > -1: // 附加 # 至 # 冰冷傷害 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_1037193709`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_2387423236`
        //     }
        //     break;
        //   case statID.indexOf('stat_681332047') > -1 || statID.indexOf('stat_210067635') > -1: // 攻擊速度 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_210067635`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_681332047`
        //     }
        //     break;
        //   case statID.indexOf('stat_681332047') > -1 || statID.indexOf('stat_210067635') > -1: // 攻擊速度 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_210067635`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_681332047`
        //     }
        //     break;
        //   case statID.indexOf('stat_3593843976') > -1 || statID.indexOf('stat_55876295') > -1: // #% 的物理攻擊傷害偷取生命 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_55876295`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_3593843976`
        //     }
        //     break;
        //   case statID.indexOf('stat_3237948413') > -1 || statID.indexOf('stat_669069897') > -1: // #% 所造成的物理攻擊傷害偷取魔力 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('weapon') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_669069897`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_3237948413`
        //     }
        //     break;
        //   // 若物品為護甲，防禦屬性應為（部分）標籤
        //   case statID.indexOf('stat_2144192055') > -1 || statID.indexOf('stat_53045048') > -1: // # 點閃避值 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('armour') > -1) { // 護甲類別
        //       statID = `${statID.split('.')[0]}.stat_53045048`
        //     } else { // 非護甲
        //       statID = `${statID.split('.')[0]}.stat_2144192055`
        //     }
        //     break;
        //   case statID.indexOf('stat_2106365538') > -1 || statID.indexOf('stat_124859000') > -1: // 增加 #% 閃避值 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('armour') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_124859000`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_2106365538`
        //     }
        //     break;
        //   case statID.indexOf('stat_809229260') > -1 || statID.indexOf('stat_3484657501') > -1: // # 點護甲 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('armour') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_3484657501`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_809229260`
        //     }
        //     break;
        //   case statID.indexOf('stat_2866361420') > -1 || statID.indexOf('stat_1062208444') > -1: // 增加 #% 護甲 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('armour') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_1062208444`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_2866361420`
        //     }
        //     break;
        //   case statID.indexOf('stat_3489782002') > -1 || statID.indexOf('stat_4052037485') > -1: // # 最大能量護盾 (部分)
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('armour') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_4052037485`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_3489782002`
        //     }
        //     break;
        //   case statID.indexOf('stat_3240073117') > -1 || statID.indexOf('stat_44972811') > -1: // # 處理台服兩詞綴相同翻譯 "增加 #% 生命回復率"
        //     // stat_3240073117 Recovery rate: 腰帶、護甲
        //     // stat_44972811 Regeneration rate: 項鍊、頭手鞋
        //     if (this.options.itemCategory.chosenObj.prop.indexOf('belt') > -1 || this.options.itemCategory.chosenObj.prop.indexOf('chest') > -1) {
        //       statID = `${statID.split('.')[0]}.stat_3240073117`
        //     } else {
        //       statID = `${statID.split('.')[0]}.stat_44972811`
        //     }
        //     break;
        //   case statID.indexOf('pseudo.pseudo_logbook') > -1: // 探險日誌詞綴為偽屬性
        //     element.type = '偽屬性'
        //     break;
        //   default:
        //     break;
        // }
        let itemStatArray = itemStatText.split(' ') // 將物品上的詞綴拆解
        let matchStatArray = apiStatText.split(' ') // 將詞綴資料庫上的詞綴拆解
        // console.log(itemStatText)
        // console.log(matchStatArray)
        let randomMinValue = 0; // 預設詞綴隨機數值最小值為空值(之後修)
        let randomMaxValue = 0; // 預設詞綴隨機數值最大值為空值(之後修)
        let optionValue = 0; // 星團珠寶附魔 / 項鍊塗油配置 / 禁忌烈焰.血肉配置 的 ID

        // if (statID === "enchant.stat_3948993189") {
        //   isStatSearch = true
        //   let obj = stringSimilarity.findBestMatch(itemStatText, this.clusterJewelStats)
        //   optionValue = parseInt(obj.ratings[obj.bestMatchIndex + 1].target, 10)
        //   apiStatText = `附加的小型天賦給予：\n${obj.ratings[obj.bestMatchIndex].target}`

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
        // }

        // let isNegativeStat = false // API 詞綴只有"增加"，但物品可能有"減少"詞綴相關處理
        // if (apiStatText.includes('增加') && itemStatText.includes('減少')) {
        //   apiStatText = apiStatText.replace('增加', '減少');
        //   isNegativeStat = true;
        // }

        // if (this.options.itemCategory.chosenObj.prop === 'logbook' && itemStatText.includes('區域含有') && (itemStatText.includes('梅德偉') || itemStatText.includes('沃拉娜') || itemStatText.includes('烏特雷') || itemStatText.includes('奧爾羅斯'))) { // 探險日誌探險頭目相關處理
        //   isStatSearch = true
        //   statID = "implicit.stat_3159649981"
        //   apiStatText = itemStatText.replace('(implicit)', '')
        //   if (itemStatText.indexOf("梅德偉") > -1) optionValue = 1
        //   else if (itemStatText.indexOf("沃拉娜") > -1) optionValue = 2
        //   else if (itemStatText.indexOf("烏特雷") > -1) optionValue = 3
        //   else if (itemStatText.indexOf("奧爾羅斯") > -1) optionValue = 4
        // }
        // if (statID.includes("explicit.indexable_")) { // 贗品．龍牙翱翔、禁忌軍帽詞綴自動打勾
        //   isStatSearch = true;
        //   this.isStatsCollapse = true;
        // }
        // const grandSpectrumStats = ["stat_3163738488", "stat_2948375275", "stat_242161915", "stat_611279043", "stat_482240997", "stat_308799121", "stat_2276643899", "stat_596758264", "stat_332217711"]
        // if (grandSpectrumStats.some(stat => statID.includes(stat))) { // 巨光譜詞綴自動打勾
        //   isStatSearch = true;
        //   this.options.isStatsCollapse = true;
        // }
        // if (statID === "enchant.stat_3086156145" || statID === "explicit.stat_1085446536") { // cluster jewel analysis
        //   isStatSearch = true;
        //   this.options.isStatsCollapse = true;
        //   let tempValue = randomMinValue;
        //   switch (randomMinValue) { // 附加天賦數判斷
        //     case 4:
        //       randomMaxValue = randomMinValue + 1;
        //       break;
        //     case 5:
        //       randomMaxValue = tempValue;
        //       randomMinValue = tempValue - 1;
        //       break;
        //     default:
        //       randomMaxValue = tempValue;
        //       break;
        //   }
        //   switch (true) { // 物品等級區分判斷
        //     case this.options.itemLevel.min >= 84:
        //       this.options.itemLevel.min = 84;
        //       break;
        //     case this.options.itemLevel.min >= 75:
        //       this.options.itemLevel.min = 75;
        //       this.options.itemLevel.max = 83;
        //       break;
        //     case this.options.itemLevel.min >= 68:
        //       this.options.itemLevel.min = 68;
        //       this.options.itemLevel.max = 74;
        //       break;
        //     case this.options.itemLevel.min >= 50:
        //       this.options.itemLevel.min = 50;
        //       this.options.itemLevel.max = 67;
        //       break;
        //     case this.options.itemLevel.min < 50:
        //       this.options.itemLevel.min = '';
        //       this.options.itemLevel.max = 49;
        //       break;
        //     default:
        //       break;
        //   }
        //   this.options.itemLevel.isSearch = true;
        //   this.isItemLevelSearch();
        // } else if (randomMaxValue) { // 物品中包含 "# 至 #" 的詞綴，在官方市集搜尋中皆以相加除二作搜尋
        //   randomMinValue = (randomMinValue + randomMaxValue) / 2;
        //   randomMaxValue = 0;
        // }

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
          // "isNegative": isNegativeStat,
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
          // "isNegative": false,
          "isSearch": false,
          "type": element.type
        })
      }
    });
  }

  //建立搜尋資料
  searchTrade() {
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

    this.priceSetting();
    switch (this.item.category) {
      case 'item':
        this.ui.collapse.stats = true;
        this.isRaritySearch();
        this.isItemBasicSearch();
        this.isItemCategorySearch();
        this.isItemLevelSearch();
        break;
      case 'map':
        this.isMapLevelSearch();
        break;
      case 'gem':
        this.isGemBasicSearch();
        this.isGemQualitySearch();
        break;
      default:
        break;
    }

    this.searchResult.fetchQueryID = '';
    this.searchResult.searchTotal = 0;
    this.poe_service.get_trade(this.searchOptions.leagues.chosenL, this.filters.searchJson).subscribe((res: any) => {
      if (res && !res.error) {
        this.searchResult.resultLength = res.result.length;
        this.searchResult.searchTotal = res.total; // 總共搜到幾項物品

        this.item.copyText = '';

        this.searchResult.status = ` 共 ${this.searchResult.searchTotal} 筆符合 ${this.ui.collapse.price && this.searchResult.searchTotal !== this.searchResult.resultLength ? '- 報價已摺疊' : ''}`;
        this.searchResult.fetchQueryID = res.id;
        this.searchResult.fetchID = res.result;
      } else {
        this.searchResult.status = res.error.message;
        this.startCountdown(60);
      }
    }, (error: any) => {
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
  getStat(stat: string, type: any): string {
    let mdStat = stat.replace(/\d+/g, "#").replace("+", "");
    console.log(mdStat);
    //處理只有增加，字串有減少字樣
    if (mdStat.indexOf('能力值需求') > -1) {
      mdStat = mdStat.replace('減少', '增加');
    }

    let findStat = stat;
    let findResult = this.stats[type].some((e: any) => {
      const result = e === mdStat;

      if (result) findStat = e;

      return result;
    });

    console.log(mdStat, findStat);

    if (!findResult) console.error("未找到詞綴：" + stat);

    return findResult ? findStat : findStat + "(未找到詞綴)";
  }

  //是否針對物品等級搜尋
  isItemLevelSearch() {
    if (!this.searchOptions.itemLevel.isSearch && Object.keys(this.filters.searchJson.query.filters.type_filters.filters).includes("ilvl")) {
      this.filters.searchJson.query.filters.type_filters.filters.ilvl = {}; // 刪除物品等級 filter
    } else if (this.searchOptions.itemLevel.isSearch) {
      Object.assign(this.filters.searchJson.query.filters.type_filters.filters.ilvl, { // 增加物品等級最小值 filter
        min: this.searchOptions.itemLevel.min ? this.searchOptions.itemLevel.min : null,
        max: this.searchOptions.itemLevel.max ? this.searchOptions.itemLevel.max : null
      });
    }
  }

  //是否針對稀有度搜尋
  isRaritySearch() {
    if (!this.searchOptions.raritySet.isSearch && Object.keys(this.filters.searchJson.query.filters.type_filters.filters).includes("rarity")) {
      delete this.filters.searchJson.query.filters.type_filters.filters.rarity; // 刪除稀有度 filter
    } else if (this.searchOptions.raritySet.isSearch) {
      Object.assign(this.filters.searchJson.query.filters.type_filters.filters.rarity, { // 增加稀有度 filter
        option: this.searchOptions.raritySet.chosenObj
      });
    }
  }

  //是否針對寶石搜尋
  isGemBasicSearch() {
    if (!this.basics.gem.isSearch) {
      delete this.filters.searchJson.query.type; // 刪除技能基底 filter
    } else if (this.basics.gem.isSearch) {
      this.filters.searchJson.query.type = this.basics.gem.chosenG; // 增加技能基底 filter
    }
  }

  //是否針對寶石品質搜尋
  isGemQualitySearch() {
    if (!this.searchOptions.gemQuality.isSearch) {
      delete this.filters.searchJson.query.filters.misc_filters.filters.quality; // 刪除技能品質 filter
    } else if (this.searchOptions.gemQuality.isSearch) {
      this.filters.searchJson.query.filters.misc_filters.filters.quality = { // 指定技能品質最小 / 最大值 filter
        "min": this.searchOptions.gemQuality.min ? this.searchOptions.gemQuality.min : null,
        "max": this.searchOptions.gemQuality.max ? this.searchOptions.gemQuality.max : null
      };
    }
  }

  //是否針對物品分類搜尋
  isItemCategorySearch() {
    if (!this.searchOptions.itemCategory.isSearch && this.searchOptions.itemCategory.chosenObj) {
      delete this.filters.searchJson.query.filters.type_filters.filters.category; // 刪除物品種類 filter
    } else if (this.searchOptions.itemCategory.isSearch && this.searchOptions.itemCategory.chosenObj) {
      this.filters.searchJson.query.filters.type_filters.filters.category = { // 增加物品種類 filter
        "option": this.searchOptions.itemCategory.chosenObj
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

  //是否針對換界石階級搜尋
  isMapLevelSearch() {
    if (!this.searchOptions.mapLevel.isSearch) {
      delete this.filters.searchJson.query.filters.map_filters.filters.map_tier; // 刪除地圖階級 filter
    } else if (this.searchOptions.mapLevel.isSearch) {
      this.filters.searchJson.query.filters.map_filters.filters.map_tier = { // 指定地圖階級最小 / 最大值 filter
        "min": this.searchOptions.mapLevel.min ? this.searchOptions.mapLevel.min : null,
        "max": this.searchOptions.mapLevel.max ? this.searchOptions.mapLevel.max : null
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
        case 1: // 藥劑起始點 { "type": "低階生命藥劑", "text": "低階生命藥劑" }
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
          this.basics.categorizedItems.push(element)
          break;
        case 3: // 法杖起始點 { "type": "凋零法杖", "text": "凋零法杖" }
          element.name = "法杖";
          element.option = "weapon.wand";
          element.weapon = "weapon.caster";
          this.basics.categorizedItems.push(element)
          break;
        case 4: // 弓起始點 { "type": "粗製弓", "text": "粗製弓" }
          element.name = "弓";
          element.option = "weapon.bow";
          element.weapon = "weapon.ranged";
          // element.weapon = "weapon.one"
          this.basics.categorizedItems.push(element)
          break;
        case 5: // 十字弓起始點 { "type": "鏽劍", "text": "鏽劍" }
          element.name = "十字弓";
          element.option = "weapon.crossbow";
          element.weapon = "weapon.ranged";
          // element.weapon = "weapon.one"
          this.basics.categorizedItems.push(element)
          break;
        case 6: // 細杖起始點 { "type": "纏繞細杖", "text": "纏繞細杖" }
          element.name = "細杖";
          element.option = "weapon.warstaff";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element)
          break;
        case 7: // 長杖起始點{ "type": "灰燼長杖", "text": "灰燼長杖" }
          element.name = "長杖";
          element.option = "weapon.staff";
          element.weapon = "weapon.caster";
          this.basics.categorizedItems.push(element)
          break;
        case 8: // 雙手斧起始點 { "type": "分裂巨斧", "text": "分裂巨斧" }
          element.name = "雙手斧";
          element.option = "weapon.twoaxe";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element)
          break;
        case 9: // 雙手錘起始點 { "type": "墮落巨棍棒", "text": "墮落巨棍棒" }
          element.name = "雙手錘";
          element.option = "weapon.twomace";
          element.weapon = "weapon.twomelee";
          this.basics.categorizedItems.push(element)
          break;
        default:
          break;
      }
    });
    //"id": "maps", "label": "地圖"
    result[result.findIndex((e: any) => e.id === "map")].entries.forEach((element: any) => {
      const basetype = ["探險日誌"] // 地圖起始點 { "type": "探險日誌", "text": "探險日誌" }

      this.basics.map.option.push(element.type);
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

      this.stats.explicit.push(text, element.id);
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
  }

  //點擊後搜尋
  clickToSearch() { // TODO: 重構物品/地圖交替搜尋時邏輯 stats: [{type: "and", filters: [], disabled: true(?)}]
    if (this.item.category === 'item') {
      this.filters.searchJson.query.stats = [{ "type": "and", "filters": [] }];
    } else if (this.item.category === 'map' && this.basics.map.isSearch) {
      this.item.name = `物品名稱 <br>『${this.basics.map.chosenM}』`;
    } else if (this.item.category === 'gem' && this.basics.gem.isSearch) { //需要重看
      this.item.name = `物品名稱 <br>『${this.searchOptions.gemQualitySet.chosenObj !== '0' && this.searchOptions.gemQualitySet.isSearch ? `${this.searchOptions.gemQualitySet.chosenObj.label} ` : ''}${this.basics.gem.chosenG}』`
    }

    this.searchTrade();
  }

  //開啟官方市集
  popOfficialWebsite() {
    // shell.openExternal(`${this.app.baseUrl}/trade/search?q=${JSON.stringify(this.filters.searchJson)}`)
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
      if (!Object.keys(this.filters.searchJson.query.filters.type_filters.filters).includes("price")) {
        Object.assign(this.filters.searchJson.query.filters.type_filters.filters, { // 增加稀有度 filter
          price: {
            option: this.searchOptions.priceSetting.chosenObj
          }
        });
      } else {
        Object.assign(this.filters.searchJson.query.filters.type_filters.filters.price, { // 增加稀有度 filter
          option: this.searchOptions.priceSetting.chosenObj
        });
      }
    } else {
      this.filters.searchJson.query.filters.type_filters.filters.price = {};
    }
  }
}
