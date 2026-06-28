import { LinkPresets } from "../constants/link-presets";
import {
	LinkPreset,
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/config";
import { siteConfig } from "./siteConfig";

/**
 * 构建导航栏链接配置
 * 遵循企业级代码规范：
 * - 使用 LinkPreset 枚举消除魔法值
 * - 通过 LinkPresets 集中管理链接元数据（i18n、图标、URL）
 * - 页面开关控制可选链接的显隐
 * - 先依次构建各导航项，再统一组装到 links 数组
 */
const buildNavBarConfig = (): NavBarConfig => {
	// 自定义链接（来自站点配置）
	const customLinks = siteConfig.navbar?.customLinks || [];
	const customTopLinks: NavBarLink[] = [];
	const customPostsLinks: NavBarLink[] = [];
	const customContactLinks: NavBarLink[] = [];
	const customMyLinks: NavBarLink[] = [];

	for (const cl of customLinks) {
		if (!cl.name || !cl.url) continue;
		const link: NavBarLink = {
			name: cl.name,
			url: cl.url,
			external: cl.external ?? cl.url.startsWith("http"),
			icon: cl.icon,
		};
		const parent = cl.parent || "my";
		if (parent === "top") customTopLinks.push(link);
		else if (parent === "posts") customPostsLinks.push(link);
		else if (parent === "contact") customContactLinks.push(link);
		else customMyLinks.push(link);
	}

	// 1. 构建文章下拉菜单
	const postsNav: NavBarLink = {
		...LinkPresets[LinkPreset.NavPosts],
		children: [LinkPreset.Archive, LinkPreset.Categories, LinkPreset.PostList, ...customPostsLinks],
	};

	// 2. 构建联系我下拉菜单
	const contactChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.friends) {
		contactChildren.push(LinkPreset.Friends);
	}
	if (siteConfig.pages.guestbook) {
		contactChildren.push(LinkPreset.Guestbook);
	}
	contactChildren.push(LinkPreset.QQGroup);
	contactChildren.push(...customContactLinks);

	const contactNav: NavBarLink | null =
		contactChildren.length > 0
			? {
					...LinkPresets[LinkPreset.ContactMe],
					children: contactChildren,
				}
			: null;

	// 3. 构建我的下拉菜单
	const myChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Fhome);
	}
		if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Fnote);
	}
	if (siteConfig.pages.calendar) {
		myChildren.push(LinkPreset.Calendar);
	}
		if (siteConfig.pages.bangumi) {
		myChildren.push(LinkPreset.Bangumi);
	}
	if (siteConfig.pages.books) {
		myChildren.push(LinkPreset.Books);
	}
	if (siteConfig.pages.moviesGames) {
		myChildren.push(LinkPreset.MoviesGames);
	}
	if (siteConfig.pages.musicPage) {
		myChildren.push(LinkPreset.MusicPage);
	}
	if (siteConfig.pages.changelog) {
		myChildren.push(LinkPreset.Changelog);
	}
	if (siteConfig.pages.moments) {
		myChildren.push(LinkPreset.Moments);
	}
	if (siteConfig.pages.lifeRoutines) {
		myChildren.push(LinkPreset.Routines);
	}
	if (siteConfig.pages.lifePlaces) {
		myChildren.push(LinkPreset.Places);
	}
	if (siteConfig.pages.lifeNotebooks) {
		myChildren.push(LinkPreset.Notebooks);
	}
	if (siteConfig.pages.gallery) {
		myChildren.push(LinkPreset.Gallery);
	}
	if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Sponsor);
	}
	myChildren.push(...customMyLinks);
	myChildren.push(LinkPreset.About);

	const myNav: NavBarLink = {
		...LinkPresets[LinkPreset.NavMy],
		children: myChildren,
	};

	// 4. 统一组装导航栏链接（顺序：主页 → 自定义顶级链接 → 文章 → 收藏 → 联系我 → 我的）
	const links: (NavBarLink | LinkPreset)[] = [
		LinkPreset.Home,
		...customTopLinks,
		postsNav,
		...(siteConfig.pages.collections ? [LinkPreset.Collections] : []),
		...(contactNav ? [contactNav] : []),
		myNav,
	];

	return { links };
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = buildNavBarConfig();
