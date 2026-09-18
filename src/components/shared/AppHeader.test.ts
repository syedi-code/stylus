import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from './AppHeader.vue';

/**
 * The header is the only way to change tabs, and its tab list is now the
 * single source for both the desktop rail and the mobile panel. These cover
 * the things whose loss would be silent: the set of tabs, that selecting one
 * reports it, and that the active tab is marked in a way the sliding thumb and
 * the styling can both key off.
 */

function mountHeader(props: Record<string, unknown> = {}) {
	return mount(AppHeader, {
		props: { currentTab: 'notes', userEmail: 'someone@example.com', ...props },
	});
}

const TABS = ['Notes', 'Thoughts', 'Quotes', 'Essays', 'Library'];

describe('AppHeader', () => {
	it('renders exactly the live tabs, in order, in the desktop rail', () => {
		const labels = mountHeader()
			.findAll('nav .tab span')
			.map((n) => n.text());
		expect(labels).toEqual(TABS);
	});

	it('no longer offers threads', () => {
		expect(mountHeader().text().toLowerCase()).not.toContain('threads');
	});

	it('marks the active tab, and only the active tab', () => {
		const active = mountHeader({ currentTab: 'essays' }).findAll(
			'nav .tab[data-active="true"]'
		);
		expect(active).toHaveLength(1);
		expect(active[0].text()).toBe('Essays');
	});

	it('reports the tab you pick', async () => {
		const wrapper = mountHeader();
		await wrapper.findAll('nav .tab')[2].trigger('click');
		expect(wrapper.emitted('update:currentTab')).toEqual([['quotes']]);
	});

	it('underlines the active tab in its own hue', () => {
		const hues = TABS.map((_, i) =>
			mountHeader({ currentTab: ['notes', 'thoughts', 'quotes', 'essays', 'library'][i] })
				.find('nav .indicator')
				.attributes('style')
				?.match(/background:\s*([^;]+)/)?.[1]
		);
		expect(hues.every(Boolean)).toBe(true);
		expect(new Set(hues).size).toBe(TABS.length);
	});

	it('keeps the labels in title case, not shouted', () => {
		for (const label of mountHeader().findAll('nav .tab .lbl')) {
			expect(label.text()).toMatch(/^[A-Z][a-z]+$/);
		}
	});

	it('logs out from the account popover', async () => {
		const wrapper = mountHeader();
		await wrapper.find('button[aria-label="Account"]').trigger('click');
		await wrapper.find('.account-panel button').trigger('click');
		expect(wrapper.emitted('logout')).toHaveLength(1);
	});
});
