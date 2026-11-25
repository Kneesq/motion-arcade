import {balloonPalette} from './arcade.js';
import {gameAudio} from './sound.js';

const storageKey = 'motion-arcade-game-options-v1';
const paletteKeys = balloonPalette.map(color => color.key);

function loadPreferences() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch { /* Storage may be unavailable in private browsing. */ }

  const playerColors = [];
  for (let player = 0; player < 4; player++) {
    const key = saved?.playerColors?.[player];
    playerColors.push(paletteKeys.includes(key) && !playerColors.includes(key)
      ? key : paletteKeys.find(candidate => !playerColors.includes(candidate)));
  }
  const runnerEnv = ['sky', 'forest', 'ocean'].includes(saved?.runnerEnv) ? saved.runnerEnv : 'sky';
  const bgm = ['auto', 'babyshark', 'twinkle', 'tigers', 'lamb', 'happy', 'off'].includes(saved?.bgm) ? saved.bgm : 'auto';
  return {
    skin: saved?.skin === 'bubble' ? 'bubble' : 'balloon',
    colorChallenge: saved?.colorChallenge === true,
    playerColors,
    runnerMode: saved?.runnerMode === 'versus' ? 'versus' : 'cooperative',
    runnerEnv,
    bgm
  };
}

export function mountGameOptions(container) {
  const preferences = loadPreferences();
  let activeGame = '', count = 1;
  const root = document.createElement('div');
  root.className = 'game-options';
  root.innerHTML = `
    <fieldset data-setting="skin">
      <legend>目标外观</legend>
      <div class="segments">
        <button type="button" data-choice="balloon">气球</button>
        <button type="button" data-choice="bubble">透明泡泡</button>
      </div>
    </fieldset>
    <fieldset data-setting="colorChallenge">
      <legend>多人玩法</legend>
      <div class="segments">
        <button type="button" data-choice="false">自由击破</button>
        <button type="button" data-choice="true">指定颜色</button>
      </div>
    </fieldset>
    <fieldset class="go-assignments">
      <legend>玩家颜色</legend>
      <p class="go-help">击中自己的颜色 +10 分，击中其他颜色 −5 分。选择他人的颜色可与对方互换。</p>
      <div class="go-player-grid"></div>
    </fieldset>
    <fieldset data-setting="runnerEnv">
      <legend>跑酷环境</legend>
      <div class="segments">
        <button type="button" data-choice="sky">天空</button>
        <button type="button" data-choice="forest">森林</button>
        <button type="button" data-choice="ocean">海洋</button>
      </div>
    </fieldset>
    <fieldset data-setting="runnerMode">
      <legend>双人跑酷模式</legend>
      <div class="segments">
        <button type="button" data-choice="cooperative">合作闯关</button>
        <button type="button" data-choice="versus">双人对战</button>
      </div>
    </fieldset>
    <fieldset data-setting="bgm">
      <legend>动感童歌音乐</legend>
      <div class="segments">
        <button type="button" data-choice="auto">轮播童歌</button>
        <button type="button" data-choice="babyshark">Baby Shark</button>
        <button type="button" data-choice="twinkle">小星星</button>
        <button type="button" data-choice="tigers">两只老虎</button>
        <button type="button" data-choice="lamb">小羊羔</button>
        <button type="button" data-choice="happy">幸福拍手</button>
        <button type="button" data-choice="off">关闭</button>
      </div>
    </fieldset>`;
  container.replaceChildren(root);

  const assignments = root.querySelector('.go-assignments');
  const grid = root.querySelector('.go-player-grid');
  const pickers = preferences.playerColors.map((_, player) => {
    const label = document.createElement('label');
    label.className = 'go-player';
    const title = document.createElement('span');
    title.textContent = '玩家 ' + (player + 1);
    const swatch = document.createElement('i');
    swatch.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', title.textContent + '的目标颜色');
    for (const color of balloonPalette) select.add(new Option(color.name, color.key));
    select.addEventListener('change', () => {
      const other = preferences.playerColors.indexOf(select.value);
      if (other !== -1) preferences.playerColors[other] = preferences.playerColors[player];
      preferences.playerColors[player] = select.value;
      saveAndRefresh();
    });
    label.append(title, swatch, select);
    grid.append(label);
    return {label, swatch, select};
  });

  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    const key = button.closest('fieldset').dataset.setting;
    preferences[key] = key === 'colorChallenge' ? button.dataset.choice === 'true' : button.dataset.choice;
    saveAndRefresh();
    if (key === 'bgm') {
      if (preferences.bgm === 'off') gameAudio.stop();
      else gameAudio.previewBgm(preferences.bgm);
    }
  });

  function saveAndRefresh() {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
    render(activeGame, count);
  }

  function values() {
    const balloon = activeGame === 'balloon';
    const challenge = balloon && count >= 2 && preferences.colorChallenge;
    return {
      skin: balloon ? preferences.skin : 'balloon',
      colorChallenge: challenge,
      playerColors: challenge ? preferences.playerColors.slice(0, count) : [],
      runnerMode: activeGame === 'runner' && count === 2 ? preferences.runnerMode : 'cooperative',
      runnerEnv: preferences.runnerEnv,
      bgm: preferences.bgm
    };
  }

  function render(gameId, players) {
    activeGame = gameId;
    count = Math.max(1, Math.min(4, Math.trunc(Number(players)) || 1));
    const balloon = gameId === 'balloon';
    const runner = gameId === 'runner';
    const pairedRun = runner && count === 2;
    root.hidden = !balloon && !runner;
    root.querySelector('[data-setting=skin]').hidden = !balloon;
    root.querySelector('[data-setting=colorChallenge]').hidden = !balloon || count < 2;
    root.querySelector('[data-setting=runnerEnv]').hidden = !runner;
    root.querySelector('[data-setting=runnerMode]').hidden = !pairedRun;
    root.querySelector('[data-setting=bgm]').hidden = !balloon && !runner;
    assignments.hidden = !values().colorChallenge;
    for (const group of root.querySelectorAll('[data-setting]')) {
      const selected = String(preferences[group.dataset.setting]);
      for (const b of group.querySelectorAll('[data-choice]')) {
        b.setAttribute('aria-pressed', String(b.dataset.choice === selected));
      }
    }
    pickers.forEach(({label, swatch, select}, player) => {
      label.hidden = player >= count;
      select.disabled = assignments.hidden || label.hidden;
      select.value = preferences.playerColors[player];
      swatch.style.backgroundColor = balloonPalette.find(color => color.key === select.value).color;
    });
  }

  render(activeGame, count);
  return {render, values};
}
