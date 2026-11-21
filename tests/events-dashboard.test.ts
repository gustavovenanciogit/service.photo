import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countFilters, eventPhase, galleryBadge, matchesFilter, matchesSearch, monthGrid, soldPercent, sortEvents, storageSummary, upcoming, type DashboardEvent,
} from '../src/lib/events-dashboard.ts';

const NOW = new Date('2026-11-21T15:00:00Z');
const TODAY = '2026-11-21';
const ev = (o: Partial<DashboardEvent>): DashboardEvent =>
  ({
    id: 'evt_x', slug: 'x', name: 'Evento', date: '2026-11-15', location: 'Manaus/AM', category: '', description: '', cover_photo_id: '', price_single: 12.9,
    price_pack: 119.9, sale_days: 180, download_days: 30, status: 'publicado', listed: false, face_only: false, face_search: 0, face_pack_at: '', watermark_model: 0,
    cover_image: '', cover_position: '50% 50%', photo_count: 100, published_at: '2026-11-16T10:00:00Z', purged_at: '', created_at: '2026-11-10T00:00:00Z',
    updated_at: '', ...o,
  }) as DashboardEvent;

test('fase do evento a partir dos dados reais', () => {
  assert.equal(eventPhase(ev({}), TODAY, NOW), 'em_andamento');
  assert.equal(eventPhase(ev({ date: '2026-11-29', status: 'rascunho', published_at: '' }), TODAY, NOW), 'agendado');
  assert.equal(eventPhase(ev({ date: '2026-11-29' }), TODAY, NOW), 'agendado');
  assert.equal(eventPhase(ev({ status: 'rascunho', published_at: '' }), TODAY, NOW), 'rascunho');
  assert.equal(eventPhase(ev({ status: 'encerrado' }), TODAY, NOW), 'finalizado');
  // Prazo de venda terminou sozinho
  assert.equal(eventPhase(ev({ published_at: '2026-01-01T00:00:00Z', sale_days: 30 }), TODAY, NOW), 'finalizado');
  assert.deepEqual(galleryBadge(ev({}), NOW).label, 'Publicado');
  assert.deepEqual(galleryBadge(ev({ status: 'rascunho', published_at: '' }), NOW).label, 'Rascunho');
});

test('filtros e contagens', () => {
  const list = [ev({ id: 'a' }), ev({ id: 'b', date: '2026-11-29' }), ev({ id: 'c', status: 'encerrado' }), ev({ id: 'd', date: TODAY })];
  assert.deepEqual(countFilters(list, TODAY, NOW), { todos: 4, proximos: 2, em_andamento: 2, finalizados: 1 });
  assert.equal(matchesFilter(ev({ date: '2026-12-06', status: 'encerrado' }), 'proximos', TODAY, NOW), false);
});

test('busca por nome, local e data, sem acento', () => {
  const e = ev({ name: 'Treino Aberto Kohë', location: 'Ponta Negra', date: '2026-12-06' });
  assert.ok(matchesSearch(e, 'kohe'));
  assert.ok(matchesSearch(e, 'ponta'));
  assert.ok(matchesSearch(e, '06/12'));
  assert.ok(matchesSearch(e, '2026-12'));
  assert.ok(matchesSearch(e, '  '));
  assert.equal(matchesSearch(e, 'corrida'), false);
});

test('ordenação e próximos eventos', () => {
  const list = [ev({ id: 'a', name: 'B', date: '2026-11-10', sales_total: 50 }), ev({ id: 'b', name: 'A', date: '2026-12-01', sales_total: 200 }), ev({ id: 'c', name: 'C', date: '2026-11-25' })];
  assert.deepEqual(sortEvents(list, 'data_desc').map((e) => e.id), ['b', 'c', 'a']);
  assert.deepEqual(sortEvents(list, 'data_asc').map((e) => e.id), ['a', 'c', 'b']);
  assert.deepEqual(sortEvents(list, 'nome').map((e) => e.id), ['b', 'a', 'c']);
  assert.deepEqual(sortEvents(list, 'vendas').map((e) => e.id), ['b', 'a', 'c']);
  assert.deepEqual(upcoming(list, TODAY).map((e) => e.id), ['c', 'b']);
});

test('calendário: novembro de 2026 começa num domingo e tem 5 semanas', () => {
  const g = monthGrid(2026, 11);
  assert.equal(g[0]![0], '2026-11-01');
  assert.equal(g.length, 5);
  assert.equal(g[4]![1], '2026-11-30');
  assert.equal(g[4]![2], null);
  const feb = monthGrid(2027, 2);
  assert.equal(feb.flat().filter(Boolean).length, 28);
});

test('vendas e armazenamento', () => {
  assert.equal(soldPercent({ photo_count: 709, photos_sold: 510 }), 72);
  assert.equal(soldPercent({ photo_count: 0, photos_sold: 0 }), 0);
  assert.deepEqual(storageSummary(128e9, 500e9), { used: '128 GB', quota: '500 GB', percent: 26 });
  assert.deepEqual(storageSummary(2.35e9, 10e9), { used: '2,4 GB', quota: '10 GB', percent: 24 });
  assert.equal(storageSummary(350e6, 10e9).used, '350 MB');
});
