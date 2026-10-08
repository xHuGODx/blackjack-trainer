import { test, expect, type Page } from '@playwright/test';
import { createDeck } from '../../lib/blackjack/game';
import type { Rank } from '../../lib/blackjack/model';
async function rig(page: Page, sequence: Rank[]) {
  const rest = createDeck(6);
  const front = sequence.map(rank => rest.splice(rest.findIndex(c => c.rank === rank),1)[0]);
  const target = [...front,...rest], working = createDeck(6), indices: number[] = [];
  for (let i = working.length - 1; i > 0; i--) { const j = working.findIndex(c => c.id === target[i].id); indices.push(j); [working[i],working[j]] = [working[j],working[i]]; }
  await page.addInitScript(values => { let i = 0; Object.defineProperty(crypto,'getRandomValues',{value: (array: Uint32Array) => { array[0] = values[i++] ?? 0; return array; }}); }, indices);
}
test('play, double, dealer settlement, automatic count and fresh refresh', async ({page},info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await rig(page,['5','6','6','10','10','10']); await page.goto('/');
  await expect(page.getByTestId('game-balance')).toHaveText('1,000');
  await page.getByRole('button',{name:'Deal hand',exact:true}).click();
  await expect(page.getByTestId('game-cards-seen')).toHaveText('3');
  await expect(page.getByLabel('Dealer hole card face down')).toBeVisible();
  await expect(page.getByTestId('game-recommendation')).toHaveText('Double');
  if (info.project.name === 'mobile') { await expect(page.getByLabel('Live game overview')).toBeVisible(); await expect(page.getByLabel('Live game overview')).toContainText('Double'); }
  await page.getByRole('button',{name:'Table rules',exact:true}).click();
  await expect(page.getByLabel('Number of decks',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Back to the table'}).click();
  await page.getByRole('button',{name:/^Double/}).click();
  await expect(page.getByTestId('game-balance')).toHaveText('1,020');
  await expect(page.getByTestId('game-cards-seen')).toHaveText('6');
  await expect(page.getByLabel('Dealer hole card face down')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('You win 20 credits');
  await page.screenshot({path:`/tmp/blackjack-play-${info.project.name}.png`,fullPage:true});
  await page.reload(); await expect(page.getByTestId('game-balance')).toHaveText('1,000'); await expect(page.getByTestId('game-cards-seen')).toHaveText('0'); expect(errors).toEqual([]);
});
test('split follows active hand and keyboard completes the round', async ({page}) => {
  await rig(page,['8','6','8','10','3','2','10','10']); await page.goto('/');
  await page.getByRole('button',{name:'Deal hand',exact:true}).click();
  await page.keyboard.press('p'); await expect(page.locator('.player-zone')).toHaveCount(2);
  await expect(page.getByTestId('game-recommendation')).toHaveText('Double');
  await page.keyboard.press('d'); await expect(page.locator('.active-hand')).toContainText('HAND 2');
  await page.keyboard.press('s'); await expect(page.getByTestId('game-balance')).toHaveText('1,030');
});
test('insurance reveals dealer blackjack and settles separately', async ({page}) => {
  await rig(page,['9','A','7','10']); await page.goto('/'); await page.getByRole('button',{name:'Deal hand',exact:true}).click();
  await expect(page.getByTestId('game-cards-seen')).toHaveText('3'); await expect(page.locator('.insurance-analysis')).toContainText('Decline insurance');
  await page.getByRole('button',{name:/Take insurance/}).click();
  await expect(page.getByTestId('game-balance')).toHaveText('1,000'); await expect(page.getByRole('status')).toContainText('Dealer blackjack'); await expect(page.getByTestId('game-cards-seen')).toHaveText('4');
});
test('switching modes retains separate shoes and game round', async ({page}) => {
  await rig(page,['10','6','9','10','10']); await page.goto('/'); await page.getByRole('button',{name:'Deal hand',exact:true}).click();
  await page.getByRole('button',{name:'Live assistant',exact:true}).click(); await expect(page.getByTestId('cards-seen')).toHaveText('0');
  await page.getByRole('button',{name:'Add 2 to counter',exact:true}).click();
  await page.getByRole('button',{name:'Play blackjack',exact:true}).click(); await expect(page.getByTestId('game-cards-seen')).toHaveText('3'); await expect(page.getByTestId('game-balance')).toHaveText('990');
  await page.getByRole('button',{name:/^Stand/}).click(); await expect(page.getByTestId('game-balance')).toHaveText('1,010');
  await page.getByRole('button',{name:'Live assistant',exact:true}).click(); await expect(page.getByTestId('cards-seen')).toHaveText('1');
});
test('play layout and dealt cards fit mobile, tablet and desktop widths', async ({page}) => {
  await rig(page,['8','6','8','10','3','2']); await page.goto('/'); await page.getByRole('button',{name:'Deal hand',exact:true}).click(); await page.getByRole('button',{name:/^Split/}).click();
  for (const width of [320,393,620,768,1000,1440]) { await page.setViewportSize({width,height:900}); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),`overflow at ${width}`).toBe(false); }
});
