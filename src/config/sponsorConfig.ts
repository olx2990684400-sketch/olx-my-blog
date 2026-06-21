import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "赞助",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "感谢您的支持，您的赞助将帮助我持续创作优质内容",

	// 赞助用途说明
	usage: "",

	// 是否显示赞助者列表
	showSponsorsList: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否在文章详情页底部显示赞助按钮
	showButtonInPost: true,

	// 赞助方式列表
	methods: [
		{
			name: "爱发电",
			icon: "simple-icons:afdian",
			qrCode: "",
			link: "https://ifdian.net/a/fqzlr",
			description: "通过 爱发电 进行打赏",
			enabled: true,
		},
		{
			name: "微信支付",
			icon: "fa7-brands:weixin",
			// 收款码图片路径（需要放在 public 目录下）
			qrCode: "/assets/images/wechat.png",
			link: "",
			description: "",
			enabled: true,
		},
		{
			name: "支付宝支付",
			icon: "fa7-brands:alipay",
			// 收款码图片路径（需要放在 public 目录下）/assets/images/alipay.webp
			qrCode: "/assets/images/alipay.png",
			link: "",
			description: "",
			enabled: true,
		},

	],

	// 赞助者列表（可选）
	sponsors: [
		// 示例：已实名赞助者
		{
			name: "番茄主理人",
			avatar:
				"https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
			amount: "¥50",
			date: "2025-10-01",
		},

		// 示例：匿名打赏者
		{
			name: "214556787",
			avatar:
				"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
			amount: "¥1",
			date: "2025-10-01",
		},
		// 示例：匿名赞助者
		{
			name: "哈基墩",
			amount: "¥0.01",
			date: "2026-01-01",
			avatar:
				"https://i.stardots.io/784774835/StarDots-2026060803504474780.png",
		},
	],
};
