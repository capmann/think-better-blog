import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITE_TITLE } from '../../consts';

const fontDir = path.resolve(process.cwd(), 'node_modules/@fontsource/inter/files');
const fontRegular = await fs.readFile(path.join(fontDir, 'inter-latin-400-normal.woff'));
const fontBold = await fs.readFile(path.join(fontDir, 'inter-latin-700-normal.woff'));

interface Props {
	title: string;
}

export async function getStaticPaths() {
	const posts = (await getCollection('blog')).filter((p) => !p.data.draft);
	return [
		{ params: { slug: 'default' }, props: { title: SITE_TITLE } },
		...posts.map((post) => ({
			params: { slug: post.id },
			props: { title: post.data.title },
		})),
	];
}

export const GET: APIRoute<Props> = async ({ props }) => {
	const title =
		props.title.length > 80 ? props.title.slice(0, 77) + '…' : props.title;
	const titleSize = title.length > 50 ? 56 : 72;

	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					height: '100%',
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					backgroundColor: '#ffffff',
					padding: '80px',
					fontFamily: 'Inter',
				},
				children: [
					{
						type: 'div',
						props: {
							style: {
								fontSize: 32,
								color: '#6366f1',
								fontWeight: 700,
								letterSpacing: '-0.02em',
							},
							children: SITE_TITLE,
						},
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: titleSize,
								color: '#0f1219',
								fontWeight: 700,
								lineHeight: 1.15,
								letterSpacing: '-0.02em',
								display: 'flex',
							},
							children: title,
						},
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: 24,
								color: '#697080',
							},
							children: 'thinkbetterabout.ai',
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{ name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
				{ name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
			],
		},
	);

	const png = new Resvg(svg).render().asPng();

	return new Response(png, {
		headers: { 'Content-Type': 'image/png' },
	});
};
