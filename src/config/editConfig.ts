/**
 * 在线编辑 - 各模块 Repo 文件配置
 * 统一管理各功能模块在仓库中的数据文件路径
 */

export interface EditRepoConfig {
	/** 仓库中的文件路径（相对于仓库根目录） */
	repoPath: string;
	enable: boolean;
}

// 友链编辑配置
export const friendsEditConfig: EditRepoConfig = {
	enable: true,
	repoPath: "src/data/friends.json",
};

// 工具收藏编辑配置
export const collectionsEditConfig: EditRepoConfig = {
	enable: true,
	repoPath: "src/data/collections.json",
};

// 番剧/影视编辑配置
export const bangumiEditConfig: EditRepoConfig = {
	enable: true,
	repoPath: "src/data/bangumi.json",
};

// 说说编辑配置
export const momentsEditConfig: EditRepoConfig = {
	enable: true,
	repoPath: "src/data/moments.json",
};

// GitHub 仓库配置（用于直接修改仓库文件）
const envAppId = (import.meta as any).env?.PUBLIC_GITHUB_APP_ID || "";
export const repoConfig = {
	owner: "fqzlr",
	repo: "my-blog",
	branch: "main",
	appId: envAppId || "",
};
