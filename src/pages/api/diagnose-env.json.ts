/**
 * 诊断端点：检查环境变量是否正确配置
 */

export const prerender = false;

export async function GET() {
	const envVars = {
		GH_APP_ID: process.env.GH_APP_ID || '(not set)',
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY ? '✓ Set (length: ' + process.env.GH_PRIVATE_KEY.length + ')' : '(not set)',
		GH_USER: process.env.GH_USER || '(not set)',
		GH_REPO: process.env.GH_REPO || '(not set)',
		NODE_ENV: process.env.NODE_ENV || '(not set)',
		VERCEL: process.env.VERCEL || '(not set)',
	};

	return new Response(JSON.stringify({
		message: 'Environment Variables Diagnostic',
		timestamp: new Date().toISOString(),
		variables: envVars,
		allSet: !!(process.env.GH_APP_ID && process.env.GH_PRIVATE_KEY && process.env.GH_USER && process.env.GH_REPO),
	}, null, 2), {
		headers: {
			'Content-Type': 'application/json',
		}
	});
}
