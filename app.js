const STORAGE_KEY = 'hongguo-h5-settings-v1';
const FAVORITES_KEY = 'hongguo-h5-favorites-v1';
const $ = (selector) => document.querySelector(selector);
const grid = $('#series-grid');
const statusPanel = $('#status-panel');
const settingsDialog = $('#settings-dialog');
const detailDialog = $('#detail-dialog');
const playerDialog = $('#player-dialog');
const state = { settings: readJSON(STORAGE_KEY, { baseUrl: '', token: '' }), query: null, page: 0, items: [], busy: false, favorites: readJSON(FAVORITES_KEY, []), currentDetail: null, abort: null };

function readJSON(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function cleanBase(value) { const result = value.trim().replace(/\/+$/, ''); if (!/^https?:\/\/[a-z\d.\-\[\]:]+(?::\d+)?$/i.test(result)) throw new Error('请输入完整服务地址，例如 http://192.168.1.10:8787'); return result; }
function authHeaders() { return state.settings.token ? { Authorization: `Bearer ${state.settings.token}` } : {}; }
async function request(path, options = {}) {
  const response = await fetch(state.settings.baseUrl + path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  let data;
  try { data = response.headers.get('content-type')?.includes('json') ? await response.json() : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.error || `服务返回 ${response.status}`);
  return data;
}
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600); }
function setStatus(title, description, buttonLabel, onClick) {
  statusPanel.replaceChildren(); statusPanel.classList.remove('hidden');
  const icon = document.createElement('div'); icon.className = 'status-icon'; icon.textContent = '✦';
  const heading = document.createElement('h3'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = description;
  statusPanel.append(icon, heading, text);
  if (buttonLabel) { const button = document.createElement('button'); button.className = 'button button-primary'; button.textContent = buttonLabel; button.addEventListener('click', onClick); statusPanel.append(button); }
  grid.replaceChildren();
}
function updateConnectionLabel() { $('#connection-label').textContent = state.settings.baseUrl ? `已连接 ${state.settings.baseUrl}` : '尚未连接内容服务'; }
function escapeText(value) { return String(value ?? '').trim(); }
function makeCard(item) {
  const card = document.createElement('article'); card.className = 'series-card'; card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', `查看 ${escapeText(item.title)} 详情`);
  const posterWrap = document.createElement('div'); posterWrap.className = 'poster-wrap';
  if (item.cover) { const image = document.createElement('img'); image.className = 'poster'; image.loading = 'lazy'; image.alt = escapeText(item.title); image.src = item.cover; image.addEventListener('error', () => { image.remove(); posterWrap.prepend(makePlaceholder(item.title)); }, { once: true }); posterWrap.append(image); }
  else posterWrap.append(makePlaceholder(item.title));
  const badgeText = escapeText(item.badge || (Array.isArray(item.tags) ? item.tags[0] : item.tags));
  if (badgeText) { const badge = document.createElement('span'); badge.className = 'poster-badge'; badge.textContent = badgeText; posterWrap.append(badge); }
  const favorite = document.createElement('button'); favorite.className = `favorite-toggle${state.favorites.some((entry) => entry.id === item.id) ? ' is-favorite' : ''}`; favorite.type = 'button'; favorite.textContent = state.favorites.some((entry) => entry.id === item.id) ? '♥' : '＋'; favorite.setAttribute('aria-label', '收藏'); favorite.addEventListener('click', (event) => { event.stopPropagation(); toggleFavorite(item); favorite.classList.toggle('is-favorite', state.favorites.some((entry) => entry.id === item.id)); favorite.textContent = state.favorites.some((entry) => entry.id === item.id) ? '♥' : '＋'; });
  const fade = document.createElement('div'); fade.className = 'poster-fade';
  const description = document.createElement('div'); description.className = 'card-description'; description.textContent = escapeText(item.description);
  posterWrap.append(favorite, fade, description);
  const title = document.createElement('h3'); title.className = 'card-title'; title.textContent = escapeText(item.title) || '未命名剧集';
  const meta = document.createElement('p'); meta.className = 'card-meta'; meta.textContent = [escapeText(item.badge), Array.isArray(item.tags) ? item.tags.join(' · ') : escapeText(item.tags)].filter(Boolean).join(' · ') || '短剧';
  card.append(posterWrap, title, meta); card.addEventListener('click', () => openDetail(item)); card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(item); } }); return card;
}
function makePlaceholder(title) { const placeholder = document.createElement('div'); placeholder.className = 'poster-placeholder'; placeholder.textContent = escapeText(title).slice(0, 1) || '剧'; return placeholder; }
function toggleFavorite(item) { const existing = state.favorites.some((entry) => entry.id === item.id); state.favorites = existing ? state.favorites.filter((entry) => entry.id !== item.id) : [item, ...state.favorites]; saveJSON(FAVORITES_KEY, state.favorites); showToast(existing ? '已取消收藏' : '已加入收藏'); if ($('#section-title').textContent === '我的收藏') renderItems(state.favorites); }
function renderItems(items) {
  statusPanel.classList.add('hidden'); grid.replaceChildren(); items.forEach((item) => grid.append(makeCard(item)));
  $('#result-count').textContent = `${items.length} 部`;
  $('#load-more').classList.toggle('hidden', state.query === null || state.items.length === 0 || state.items.length < 20);
  if (!items.length) setStatus(state.query ? '没有找到相关剧集' : '收藏夹还是空的', state.query ? '试试更短的关键词，或检查服务端搜索结果。' : '遇到喜欢的故事，点海报上的加号就能收藏。', null);
}
function openSettings() { $('#base-url').value = state.settings.baseUrl; $('#access-token').value = state.settings.token; $('#settings-error').textContent = ''; settingsDialog.showModal(); }
async function testConnection() {
  const error = $('#settings-error'); error.textContent = '正在检查服务…';
  try { const baseUrl = cleanBase($('#base-url').value); const token = $('#access-token').value.trim(); const response = await fetch(`${baseUrl}/health`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); const health = await response.json(); if (!response.ok) throw new Error(health.error || `服务返回 ${response.status}`); if (health.service !== 'hongguotv' || health.apiVersion !== 1) throw new Error('服务版本不兼容（需要 hongguoTV API v1）'); error.textContent = `连接成功 · API v${health.apiVersion} · 内容源状态：${health.upstream || '未知'}`; error.style.color = '#86cf9e'; }
  catch (reason) { error.style.color = '#ff8775'; error.textContent = reason instanceof TypeError ? '无法访问：请检查地址、网络及服务端 CORS 配置。' : reason.message; }
}
async function connect(baseUrl, token) { state.settings = { baseUrl, token }; saveJSON(STORAGE_KEY, state.settings); updateConnectionLabel(); settingsDialog.close(); state.query = null; state.page = 0; state.items = []; $('#section-title').textContent = '今日精选'; $('#section-kicker').textContent = '为你发现'; await loadPage(true); }
async function loadPage(replace = false) {
  if (!state.settings.baseUrl || state.busy) return;
  state.busy = true; $('#refresh-button').textContent = '正在加载…';
  if (!state.items.length) setStatus('正在连接内容服务…', '正在读取真实剧集目录，请稍候。', null);
  try {
    const nextPage = replace ? 1 : state.page + 1;
    const path = state.query === null ? `/api/home?page=${nextPage}` : `/api/search?q=${encodeURIComponent(state.query)}&page=${nextPage}`;
    const data = await request(path);
    if (!Array.isArray(data?.items)) throw new Error('列表数据格式异常');
    state.items = replace ? data.items : mergeItems(state.items, data.items); state.page = nextPage; renderItems(state.items);
    $('#load-more').classList.toggle('hidden', data.items.length < 20);
  } catch (error) { setStatus('内容暂时无法加载', error.message || '请检查网络与服务配置后重试。', '重试', () => loadPage(replace)); }
  finally { state.busy = false; $('#refresh-button').textContent = '换一批 ↻'; }
}
function mergeItems(oldItems, newItems) { const byId = new Map(oldItems.map((item) => [item.id, item])); newItems.forEach((item) => byId.set(item.id, item)); return [...byId.values()]; }
async function openDetail(item) {
  $('#detail-content').replaceChildren(); detailDialog.showModal();
  const loading = document.createElement('div'); loading.className = 'status-panel'; const message = document.createElement('p'); message.textContent = '正在读取剧集详情…'; loading.append(message); $('#detail-content').append(loading);
  try { const detail = await request(`/api/series/${encodeURIComponent(item.id)}`); if (!Array.isArray(detail.episodes)) throw new Error('剧集详情格式异常'); state.currentDetail = detail; renderDetail(detail); }
  catch (error) { $('#detail-content').replaceChildren(); const text = document.createElement('p'); text.className = 'settings-error'; text.textContent = error.message; $('#detail-content').append(text); }
}
function renderDetail(detail) {
  const host = $('#detail-content'); host.replaceChildren();
  const hero = document.createElement('div'); hero.className = 'detail-hero';
  if (detail.cover) { const image = document.createElement('img'); image.className = 'detail-cover'; image.alt = escapeText(detail.title); image.src = detail.cover; image.addEventListener('error', () => { image.replaceWith(makeDetailPlaceholder(detail.title)); }, { once: true }); hero.append(image); } else hero.append(makeDetailPlaceholder(detail.title));
  const copy = document.createElement('div'); const badge = document.createElement('div'); badge.className = 'detail-badge'; badge.textContent = escapeText(detail.badge || '精选短剧'); const title = document.createElement('h2'); title.className = 'detail-title'; title.textContent = escapeText(detail.title); const tags = document.createElement('p'); tags.className = 'detail-tags'; tags.textContent = Array.isArray(detail.tags) ? detail.tags.join(' · ') : escapeText(detail.tags); const desc = document.createElement('p'); desc.className = 'detail-desc'; desc.textContent = escapeText(detail.description) || '暂无简介';
  const actions = document.createElement('div'); actions.className = 'detail-actions'; const play = document.createElement('button'); play.className = 'button button-primary'; play.textContent = '▶ 从第 1 集播放'; play.addEventListener('click', () => playEpisode(detail, detail.episodes[0])); const fav = document.createElement('button'); fav.className = 'button button-secondary'; fav.textContent = state.favorites.some((entry) => entry.id === detail.id) ? '♥ 已收藏' : '＋ 收藏'; fav.addEventListener('click', () => { toggleFavorite(detail); fav.textContent = state.favorites.some((entry) => entry.id === detail.id) ? '♥ 已收藏' : '＋ 收藏'; }); actions.append(play, fav); copy.append(badge, title, tags, desc, actions); hero.append(copy); host.append(hero);
  const heading = document.createElement('div'); heading.className = 'episode-heading'; const h = document.createElement('h3'); h.textContent = '选集'; const count = document.createElement('span'); count.textContent = `${detail.episodes.length} 集`; heading.append(h, count); host.append(heading);
  const list = document.createElement('div'); list.className = 'episode-list'; detail.episodes.forEach((episode, index) => { const button = document.createElement('button'); button.className = 'episode-button'; button.textContent = String(episode.number || index + 1); button.title = escapeText(episode.title); button.addEventListener('click', () => playEpisode(detail, episode)); list.append(button); }); host.append(list);
}
function makeDetailPlaceholder(title) { const el = document.createElement('div'); el.className = 'detail-cover-placeholder'; el.textContent = escapeText(title).slice(0, 1) || '剧'; return el; }
async function playEpisode(series, episode) {
  detailDialog.close(); $('#player-title').textContent = `${escapeText(series.title)} · ${escapeText(episode.title || `第 ${episode.number} 集`)}`; $('#player-message').textContent = '正在解析播放地址…'; playerDialog.showModal(); const video = $('#video-player'); video.pause(); video.removeAttribute('src'); video.load();
  try {
    const play = await request(`/api/episodes/${encodeURIComponent(episode.id)}/play`);
    const streamUrl = state.settings.baseUrl + (play.path || `/api/episodes/${encodeURIComponent(episode.id)}/stream`);
    if (state.settings.token) {
      $('#player-message').textContent = '正在安全读取视频（带访问口令时会通过浏览器缓冲）…';
      state.abort?.abort(); state.abort = new AbortController(); const response = await fetch(streamUrl, { headers: authHeaders(), signal: state.abort.signal }); if (!response.ok) throw new Error(`视频流返回 ${response.status}`); const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); video.dataset.objectUrl = objectUrl; video.src = objectUrl;
    } else video.src = streamUrl;
    $('#player-message').textContent = '如果无法播放，请检查浏览器是否支持此视频编码，以及服务端的跨域配置。'; video.play().catch(() => {});
  } catch (error) { $('#player-message').textContent = error.name === 'AbortError' ? '播放已取消。' : error.message || '无法播放此集'; }
}
function stopPlayer() { const video = $('#video-player'); video.pause(); video.removeAttribute('src'); video.load(); if (video.dataset.objectUrl) { URL.revokeObjectURL(video.dataset.objectUrl); delete video.dataset.objectUrl; } state.abort?.abort(); }

$('#settings-open').addEventListener('click', openSettings); $('#hero-config').addEventListener('click', openSettings); $('#empty-config').addEventListener('click', openSettings); $('#test-connection').addEventListener('click', testConnection);
$('#settings-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const base = cleanBase($('#base-url').value); const token = $('#access-token').value.trim(); await connect(base, token); } catch (error) { $('#settings-error').textContent = error.message; } });
$('#search-form').addEventListener('submit', async (event) => { event.preventDefault(); const query = $('#search-input').value.trim(); if (!query) { state.query = null; $('#section-title').textContent = '今日精选'; $('#section-kicker').textContent = '为你发现'; await loadPage(true); return; } if (!state.settings.baseUrl) { showToast('请先连接内容服务'); openSettings(); return; } state.query = query; state.page = 0; state.items = []; $('#section-title').textContent = `搜索：${query}`; $('#section-kicker').textContent = '搜索结果'; await loadPage(true); });
$('#load-more').addEventListener('click', () => loadPage(false)); $('#refresh-button').addEventListener('click', () => { if ($('#section-title').textContent === '我的收藏') { renderItems(state.favorites); return; } loadPage(true); });
document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', async () => { document.querySelectorAll('.nav-link').forEach((node) => node.classList.toggle('active', node === button)); if (button.dataset.view === 'favorites') { $('#section-title').textContent = '我的收藏'; $('#section-kicker').textContent = '只属于你的片单'; $('#result-count').textContent = `${state.favorites.length} 部`; $('#load-more').classList.add('hidden'); renderItems(state.favorites); } else { state.query = null; $('#search-input').value = ''; $('#section-title').textContent = '今日精选'; $('#section-kicker').textContent = '为你发现'; await loadPage(true); } }));
playerDialog.addEventListener('close', stopPlayer); playerDialog.addEventListener('cancel', stopPlayer);
updateConnectionLabel();
if (state.settings.baseUrl) { $('#section-title').textContent = '今日精选'; loadPage(true); }
