const fs = require("fs");

// 1. Add missing keys to i18nKey.ts
let c = fs.readFileSync("src/i18n/i18nKey.ts", "utf8");
const missingKeys = [
  "changelogTitle", "changelogSubtitle", "changelogAll", "changelogFeature",
  "changelogImprovement", "changelogFix", "changelogRemoval", "changelogNoData",
  "categoryList", "categoryPosts", "allCategories",
  "recentMoments", "portalRecentPosts", "portalRecentMoments", "portalViewAll",
  "portalViewMore", "portalRunningDays", "portalDays", "recentLife", "recentItems",
  "booksTitle", "booksSubtitle", "bookshelfReading", "bookshelfRead", "bookshelfWantRead", "booksNoData",
  "moviesGamesTitle", "moviesGamesSubtitle", "moviesGamesTabAll", "moviesGamesTabMovie",
  "moviesGamesTabTV", "moviesGamesTabAnime", "moviesGamesTabDocumentary", "moviesGamesTabGame", "moviesGamesNoData",
  "musicPageTitle", "musicPageSubtitle", "musicPageNoData",
  "siteHeatmap",
  "welcomeCardLocation", "welcomeCardGreeting", "welcomeCardRecentUpdates",
  "welcomeCardFlipHint", "welcomeCardDragHint", "welcomeCardClose", "welcomeCardLearnMore", "welcomeCardRecentLabel"
];
let insert = "\n";
missingKeys.forEach(k => { insert += "\t" + k + ' = "' + k + '",\n'; });
c = c.replace("navMy = \"navMy\",", "navMy = \"navMy\"," + insert);
fs.writeFileSync("src/i18n/i18nKey.ts", c, "utf8");
console.log("i18nKey.ts: added " + missingKeys.length + " keys");

// 2. Add zh_CN translations
let zh = fs.readFileSync("src/i18n/languages/zh_CN.ts", "utf8");
const zhTranslations = {
  changelogTitle: "更新日志", changelogSubtitle: "记录每一次改进", changelogAll: "全部",
  changelogFeature: "功能", changelogImprovement: "改进", changelogFix: "修复", changelogRemoval: "移除",
  changelogNoData: "暂无更新日志",
  categoryList: "分类列表", categoryPosts: "分类文章", allCategories: "全部分类",
  recentMoments: "最新动态", portalRecentPosts: "近期文章", portalRecentMoments: "近期动态",
  portalViewAll: "查看全部", portalViewMore: "查看更多", portalRunningDays: "已运行",
  portalDays: "天", recentLife: "最近生活", recentItems: "最近项目",
  booksTitle: "我的书架", booksSubtitle: "记录读过的每一本书",
  bookshelfReading: "在读", bookshelfRead: "已读", bookshelfWantRead: "想读", booksNoData: "暂无书籍",
  moviesGamesTitle: "影视游戏", moviesGamesSubtitle: "记录看过的每一部作品",
  moviesGamesTabAll: "全部", moviesGamesTabMovie: "电影", moviesGamesTabTV: "剧集",
  moviesGamesTabAnime: "动漫", moviesGamesTabDocumentary: "纪录片", moviesGamesTabGame: "游戏",
  moviesGamesNoData: "暂无数据",
  musicPageTitle: "我的音乐", musicPageSubtitle: "享受音乐的美好", musicPageNoData: "暂无音乐",
  siteHeatmap: "站点热力图",
  welcomeCardLocation: "当前位置", welcomeCardGreeting: "你好",
  welcomeCardRecentUpdates: "最近更新", welcomeCardFlipHint: "点击翻转",
  welcomeCardDragHint: "拖拽移动", welcomeCardClose: "关闭",
  welcomeCardLearnMore: "了解更多", welcomeCardRecentLabel: "最新"
};
let zhInsert = "\n";
Object.entries(zhTranslations).forEach(([k, v]) => { zhInsert += "\t[Key." + k + ']: "' + v + '",\n'; });
zh = zh.replace("[Key.navMy]:", zhInsert + "\n\t[Key.navMy]:");
fs.writeFileSync("src/i18n/languages/zh_CN.ts", zh, "utf8");
console.log("zh_CN.ts: added translations");

// 3. Add en translations
let en = fs.readFileSync("src/i18n/languages/en.ts", "utf8");
const enTranslations = {
  changelogTitle: "Changelog", changelogSubtitle: "Record every improvement",
  changelogAll: "All", changelogFeature: "Feature", changelogImprovement: "Improvement",
  changelogFix: "Fix", changelogRemoval: "Removal", changelogNoData: "No changelog yet",
  categoryList: "Categories", categoryPosts: "Category Posts", allCategories: "All Categories",
  recentMoments: "Recent Moments", portalRecentPosts: "Recent Posts",
  portalRecentMoments: "Recent Moments", portalViewAll: "View All",
  portalViewMore: "View More", portalRunningDays: "Running", portalDays: "days",
  recentLife: "Recent Life", recentItems: "Recent Items",
  booksTitle: "Bookshelf", booksSubtitle: "Record every book I've read",
  bookshelfReading: "Reading", bookshelfRead: "Read", bookshelfWantRead: "Want to Read",
  booksNoData: "No books yet",
  moviesGamesTitle: "Movies & Games", moviesGamesSubtitle: "Record every work I've watched",
  moviesGamesTabAll: "All", moviesGamesTabMovie: "Movie", moviesGamesTabTV: "TV",
  moviesGamesTabAnime: "Anime", moviesGamesTabDocumentary: "Documentary",
  moviesGamesTabGame: "Game", moviesGamesNoData: "No data yet",
  musicPageTitle: "Music", musicPageSubtitle: "Enjoy the beauty of music",
  musicPageNoData: "No music yet",
  siteHeatmap: "Site Heatmap",
  welcomeCardLocation: "Location", welcomeCardGreeting: "Hello",
  welcomeCardRecentUpdates: "Recent Updates", welcomeCardFlipHint: "Click to flip",
  welcomeCardDragHint: "Drag to move", welcomeCardClose: "Close",
  welcomeCardLearnMore: "Learn More", welcomeCardRecentLabel: "Latest"
};
let enInsert = "\n";
Object.entries(enTranslations).forEach(([k, v]) => { enInsert += "\t[Key." + k + ']: "' + v + '",\n'; });
en = en.replace("[Key.navMy]:", enInsert + "\n\t[Key.navMy]:");
fs.writeFileSync("src/i18n/languages/en.ts", en, "utf8");
console.log("en.ts: added translations");
