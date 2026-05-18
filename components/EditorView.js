import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { C } from '../shared/theme';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { EFFECT_CATEGORIES } from '../hooks/useEffectIntent';

// ─── Sekme tanımları ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'effect',   icon: '⚡', label: 'Efekt' },
  { id: 'filter',   icon: '🎨', label: 'Filtre' },
  { id: 'color',    icon: '🌈', label: 'Renk' },
  { id: 'speed',    icon: '⏩', label: 'Hız' },
  { id: 'text',     icon: '🔤', label: 'Metin' },
  { id: 'audio',    icon: '🎵', label: 'Ses' },
  { id: 'subtitle', icon: '📝', label: 'Altyazı' },
  { id: 'trim',     icon: '✂️', label: 'Kırp' },
  { id: 'transform',icon: '🔄', label: 'Dönüştür' },
  { id: 'beat',     icon: '🥁', label: 'Beat' },
  { id: 'bgremove', icon: '🎭', label: 'Arka Plan' },
  { id: 'reverse',  icon: '⏪', label: 'Ters Çevir' },
  { id: 'shorts',   icon: '🎬', label: 'Kısa' },
  { id: 'undo',     icon: '↩️', label: 'Geri Al' },
];

// ─── Ortak chip ───────────────────────────────────────────────────────────────
function Chip({ label, emoji, active, onPress }) {
  return (
    <TouchableOpacity
      style={[cm.chip, active && cm.chipOn]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {emoji ? <Text style={cm.chipEmoji}>{emoji}</Text> : null}
      <Text style={[cm.chipTxt, active && cm.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}
const cm = StyleSheet.create({
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1d2e', borderWidth: 1, borderColor: '#2a2d3e' },
  chipOn:    { backgroundColor: C.accent, borderColor: C.accent },
  chipEmoji: { fontSize: 14 },
  chipTxt:   { fontSize: 13, color: '#8a8da8', fontWeight: '500' },
  chipTxtOn: { color: '#fff', fontWeight: '700' },
});

// ─── Ortak aksiyon butonu ─────────────────────────────────────────────────────
function ActionBtn({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[ab.btn, disabled && { opacity: 0.38 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={ab.txt}>{label}</Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  btn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  txt: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Bölüm başlığı ────────────────────────────────────────────────────────────
function SectionLabel({ text }) {
  return <Text style={{ fontSize: 10, color: '#555877', letterSpacing: 1.5, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>{text}</Text>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANELLER
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Efekt Paneli ─────────────────────────────────────────────────────────────
function EffectPanel({ onApplyEffect }) {
  const [sel, setSel]       = useState(null);
  const [intensity, setInt] = useState('0.7');
  const cats = Object.entries(EFFECT_CATEGORIES);

  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="VİSUEL EFEKTLER" />
      <View style={ep.grid}>
        {cats.map(([key, cat]) => {
          const on = sel === key;
          return (
            <TouchableOpacity
              key={key}
              style={[ep.card, on && { borderColor: cat.color, shadowColor: cat.color, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 }]}
              onPress={() => setSel(on ? null : key)}
              activeOpacity={0.78}
            >
              <Text style={ep.emoji}>{cat.emoji}</Text>
              <Text style={[ep.lbl, on && { color: cat.color }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {sel && (
        <View style={ep.bottom}>
          <View style={ep.intRow}>
            <Text style={ep.intLbl}>Yoğunluk</Text>
            <TextInput
              style={ep.intInput}
              value={intensity}
              onChangeText={setInt}
              keyboardType="numeric"
              placeholderTextColor="#555"
            />
          </View>
          <ActionBtn
            label={`${EFFECT_CATEGORIES[sel]?.emoji}  Uygula`}
            onPress={() => onApplyEffect({ category: sel, intensity: Math.min(Math.max(parseFloat(intensity) || 0.7, 0.1), 1.0) })}
          />
        </View>
      )}
    </ScrollView>
  );
}
const ep = StyleSheet.create({
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:   { width: '47%', backgroundColor: '#13151f', borderRadius: 14, borderWidth: 1.5, borderColor: '#22253a', padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 },
  emoji:  { fontSize: 28 },
  lbl:    { fontSize: 12, color: '#aab', fontWeight: '600', textAlign: 'center' },
  bottom: { marginTop: 16, gap: 10 },
  intRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 12 },
  intLbl: { fontSize: 13, color: '#aab' },
  intInput: { width: 64, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 10, fontSize: 14, color: '#fff', textAlign: 'center' },
});

// ─── Ses Paneli ───────────────────────────────────────────────────────────────
const MOODS    = [{ id:'epic', l:'Epik', e:'🎸' },{ id:'happy', l:'Mutlu', e:'😄' },{ id:'calm', l:'Sakin', e:'🌊' },{ id:'energetic', l:'Enerjik', e:'⚡' },{ id:'sad', l:'Hüzünlü', e:'🌧' }];
const SFXS     = [{ id:'whoosh', l:'Whoosh', e:'💨' },{ id:'impact', l:'Impact', e:'💥' },{ id:'applause', l:'Alkış', e:'👏' },{ id:'beep', l:'Bip', e:'📢' },{ id:'pop', l:'Pop', e:'🎈' }];
const PROFILES = [{ id:'clean', l:'Temiz', e:'🧹' },{ id:'music', l:'Müzik', e:'🎵' },{ id:'voice', l:'Ses', e:'🎙' },{ id:'podcast', l:'Podcast', e:'🎧' }];

function AudioPanel({ onAddMusic, onAddSfx, onEnhanceAudio }) {
  const [sub, setSub]   = useState('music');
  const [mood, setMood] = useState(null);
  const [sfx, setSfx]   = useState(null);
  const [prof, setProf] = useState(null);
  const [vol, setVol]   = useState('0.22');

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={ap.subRow}>
        {[['music','🎵 Müzik'],['sfx','🔊 SFX'],['enhance','🧹 Düzelt']].map(([id,lbl]) => (
          <TouchableOpacity key={id} style={[ap.sub, sub===id && ap.subOn]} onPress={() => setSub(id)}>
            <Text style={[ap.subTxt, sub===id && ap.subTxtOn]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
        {sub === 'music' && <>
          <SectionLabel text="RUH HALİ" />
          <View style={pan.chipRow}>
            {MOODS.map(m => <Chip key={m.id} label={m.l} emoji={m.e} active={mood===m.id} onPress={() => setMood(mood===m.id?null:m.id)} />)}
          </View>
          <View style={ap.volRow}>
            <Text style={ap.volLbl}>Ses Seviyesi</Text>
            <TextInput style={ap.volIn} value={vol} onChangeText={setVol} keyboardType="numeric" placeholderTextColor="#555" />
          </View>
          <ActionBtn label="🎵  Müzik Ekle" onPress={() => onAddMusic({ mood, volume: parseFloat(vol)||0.22 })} disabled={!mood} />
        </>}

        {sub === 'sfx' && <>
          <SectionLabel text="SES EFEKTİ" />
          <View style={pan.chipRow}>
            {SFXS.map(s => <Chip key={s.id} label={s.l} emoji={s.e} active={sfx===s.id} onPress={() => setSfx(sfx===s.id?null:s.id)} />)}
          </View>
          <ActionBtn label="🔊  SFX Ekle" onPress={() => onAddSfx({ sfx_type: sfx })} disabled={!sfx} />
        </>}

        {sub === 'enhance' && <>
          <SectionLabel text="PROFIL" />
          <View style={pan.chipRow}>
            {PROFILES.map(p => <Chip key={p.id} label={p.l} emoji={p.e} active={prof===p.id} onPress={() => setProf(prof===p.id?null:p.id)} />)}
          </View>
          <ActionBtn label="🧹  Sesi İyileştir" onPress={() => onEnhanceAudio({ profile: prof })} disabled={!prof} />
        </>}
      </ScrollView>
    </View>
  );
}
const ap = StyleSheet.create({
  subRow:   { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#1a1d2e' },
  sub:      { flex: 1, paddingVertical: 11, alignItems: 'center' },
  subOn:    { borderBottomWidth: 2, borderColor: C.accent },
  subTxt:   { fontSize: 12, color: '#555877' },
  subTxtOn: { color: C.accent, fontWeight: '700' },
  volRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 12, marginTop: 12 },
  volLbl:   { fontSize: 13, color: '#aab' },
  volIn:    { width: 64, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 10, fontSize: 14, color: '#fff', textAlign: 'center' },
});

// ─── Altyazı Paneli ───────────────────────────────────────────────────────────
const SUB_LANGS  = [{ id:'tr', l:'Türkçe' },{ id:'en', l:'İngilizce' },{ id:'auto', l:'Otomatik' }];
const SUB_STYLES = [{ id:'bold', l:'Kalın' },{ id:'classic', l:'Klasik' },{ id:'minimal', l:'Minimal' },{ id:'colored', l:'Renkli' }];
const SUB_POS    = [{ id:'bottom', l:'Alt' },{ id:'middle', l:'Orta' },{ id:'top', l:'Üst' }];

function SubtitlePanel({ onGenerateSubtitles }) {
  const [lang, setLang]   = useState('tr');
  const [style, setSt]    = useState('bold');
  const [pos, setPos]     = useState('bottom');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="DİL" />
      <View style={pan.chipRow}>{SUB_LANGS.map(l  => <Chip key={l.id} label={l.l} active={lang===l.id}  onPress={() => setLang(l.id)} />)}</View>
      <SectionLabel text="STİL" />
      <View style={pan.chipRow}>{SUB_STYLES.map(s => <Chip key={s.id} label={s.l} active={style===s.id} onPress={() => setSt(s.id)} />)}</View>
      <SectionLabel text="POZİSYON" />
      <View style={pan.chipRow}>{SUB_POS.map(p    => <Chip key={p.id} label={p.l} active={pos===p.id}   onPress={() => setPos(p.id)} />)}</View>
      <ActionBtn label="📝  Altyazı Oluştur" onPress={() => onGenerateSubtitles({ language: lang, style, position: pos, burn_in: true })} />
    </ScrollView>
  );
}

// ─── Kırp Paneli ──────────────────────────────────────────────────────────────
function TrimPanel({ onSend }) {
  const [start, setStart] = useState('');
  const [end, setEnd]     = useState('');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <View style={tr.hintBox}>
        <Text style={tr.hint}>Hassas saniye ayarını sen gir, yapay zeka uygular</Text>
      </View>
      <View style={tr.row}>
        <View style={tr.field}>
          <Text style={tr.lbl}>Başlangıç (sn)</Text>
          <TextInput style={tr.input} value={start} onChangeText={setStart} keyboardType="numeric" placeholder="0" placeholderTextColor="#555" />
        </View>
        <Text style={tr.arrow}>→</Text>
        <View style={tr.field}>
          <Text style={tr.lbl}>Bitiş (sn)</Text>
          <TextInput style={tr.input} value={end} onChangeText={setEnd} keyboardType="numeric" placeholder="Son" placeholderTextColor="#555" />
        </View>
      </View>
      <ActionBtn label="✂️  AI'ya Gönder" onPress={() => onSend(`${start||'0'} saniyeden ${end||'son'} saniyeye kırp`)} disabled={!start && !end} />
    </ScrollView>
  );
}
const tr = StyleSheet.create({
  hintBox: { backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.18)', marginBottom: 4 },
  hint:    { fontSize: 12, color: C.accent, textAlign: 'center', lineHeight: 18 },
  row:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  field:   { flex: 1, gap: 6 },
  lbl:     { fontSize: 11, color: '#555877' },
  input:   { height: 48, backgroundColor: '#13151f', borderRadius: 10, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 14, fontSize: 16, color: '#fff', textAlign: 'center' },
  arrow:   { fontSize: 20, color: '#555877', paddingBottom: 12 },
});

// ─── Beat Sync Paneli ─────────────────────────────────────────────────────────
const BEATS = [{ id:'pulse', l:'Pulse', e:'🌊' },{ id:'flash', l:'Flash', e:'⚡' },{ id:'zoom', l:'Zoom', e:'🔍' }];
function BeatPanel({ onBeatSync }) {
  const [eff, setEff]   = useState('pulse');
  const [sens, setSens] = useState('0.7');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="EFEKT TİPİ" />
      <View style={bt.grid}>
        {BEATS.map(b => (
          <TouchableOpacity key={b.id} style={[bt.card, eff===b.id && bt.cardOn]} onPress={() => setEff(b.id)} activeOpacity={0.78}>
            <Text style={{ fontSize: 30 }}>{b.e}</Text>
            <Text style={[bt.lbl, eff===b.id && { color: C.accent }]}>{b.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={bt.sensRow}>
        <Text style={bt.sensLbl}>Hassasiyet (0.1–1.0)</Text>
        <TextInput style={bt.sensIn} value={sens} onChangeText={setSens} keyboardType="numeric" placeholderTextColor="#555" />
      </View>
      <ActionBtn label="🥁  Beat Sync Uygula" onPress={() => onBeatSync({ effect: eff, sensitivity: Math.min(Math.max(parseFloat(sens)||0.7, 0.1), 1.0) })} />
    </ScrollView>
  );
}
const bt = StyleSheet.create({
  grid:    { flexDirection: 'row', gap: 10 },
  card:    { flex: 1, backgroundColor: '#13151f', borderRadius: 14, borderWidth: 1.5, borderColor: '#22253a', padding: 14, alignItems: 'center', gap: 6 },
  cardOn:  { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.1)' },
  lbl:     { fontSize: 12, color: '#aab', fontWeight: '600' },
  sensRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 12, marginTop: 14 },
  sensLbl: { fontSize: 13, color: '#aab' },
  sensIn:  { width: 64, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 10, fontSize: 14, color: '#fff', textAlign: 'center' },
});

// ─── Arka Plan Paneli ─────────────────────────────────────────────────────────
const BG_MODES = [{ id:'chromakey', l:'Chroma Key', e:'🟩', d:'Yeşil perde' },{ id:'ai', l:'AI Kaldır', e:'🤖', d:'Yapay zeka ile' }];
function BgPanel({ onBgRemove }) {
  const [mode, setMode]   = useState('chromakey');
  const [color, setColor] = useState('green');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="MOD" />
      <View style={bg.grid}>
        {BG_MODES.map(m => (
          <TouchableOpacity key={m.id} style={[bg.card, mode===m.id && bg.cardOn]} onPress={() => setMode(m.id)} activeOpacity={0.78}>
            <Text style={{ fontSize: 28 }}>{m.e}</Text>
            <Text style={[bg.lbl, mode===m.id && { color: C.accent }]}>{m.l}</Text>
            <Text style={bg.desc}>{m.d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {mode === 'chromakey' && <>
        <SectionLabel text="CHROMA RENGİ" />
        <View style={pan.chipRow}>
          {['green','blue','red'].map(c => (
            <Chip key={c} label={c==='green'?'🟩 Yeşil':c==='blue'?'🟦 Mavi':'🟥 Kırmızı'} active={color===c} onPress={() => setColor(c)} />
          ))}
        </View>
      </>}
      <ActionBtn label="🎭  Arka Planı Kaldır" onPress={() => onBgRemove({ mode, chromaColor: color })} />
    </ScrollView>
  );
}
const bg = StyleSheet.create({
  grid:   { flexDirection: 'row', gap: 10 },
  card:   { flex: 1, backgroundColor: '#13151f', borderRadius: 14, borderWidth: 1.5, borderColor: '#22253a', padding: 14, alignItems: 'center', gap: 4 },
  cardOn: { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.1)' },
  lbl:    { fontSize: 12, color: '#aab', fontWeight: '600' },
  desc:   { fontSize: 10, color: '#555877', textAlign: 'center' },
});

// ─── Kısa Klipler Paneli ──────────────────────────────────────────────────────
function ShortsPanel({ onGenerateShorts }) {
  const [topN, setTopN]   = useState('5');
  const [sem, setSem]     = useState(true);
  const [emo, setEmo]     = useState(true);
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <View style={sh.countRow}>
        <Text style={sh.countLbl}>Kaç klip oluşturulsun?</Text>
        <TextInput style={sh.countIn} value={topN} onChangeText={setTopN} keyboardType="numeric" placeholderTextColor="#555" />
      </View>
      <SectionLabel text="SEÇENEKLER" />
      {[
        [sem, setSem, 'Semantik Analiz', 'İçerik anlamına göre seç'],
        [emo, setEmo, 'Duygusal Zirve', 'En yoğun anları seç'],
      ].map(([val, set, lbl, desc]) => (
        <TouchableOpacity key={lbl} style={sh.toggleRow} onPress={() => set(p => !p)} activeOpacity={0.78}>
          <View style={[sh.track, val && sh.trackOn]}>
            <View style={[sh.thumb, val && sh.thumbOn]} />
          </View>
          <View>
            <Text style={sh.lbl}>{lbl}</Text>
            <Text style={sh.desc}>{desc}</Text>
          </View>
        </TouchableOpacity>
      ))}
      <ActionBtn label="🎬  Kısa Klipler Oluştur" onPress={() => onGenerateShorts({ topN: parseInt(topN)||5, semanticAnalysis: sem, detectEmotionalPeak: emo })} />
    </ScrollView>
  );
}
const sh = StyleSheet.create({
  countRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 14 },
  countLbl:  { fontSize: 13, color: '#aab' },
  countIn:   { width: 56, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 8, fontSize: 16, color: '#fff', textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#13151f', borderRadius: 10, padding: 14 },
  track:     { width: 44, height: 24, borderRadius: 12, backgroundColor: '#1a1d2e', justifyContent: 'center', padding: 2 },
  trackOn:   { backgroundColor: C.accent },
  thumb:     { width: 20, height: 20, borderRadius: 10, backgroundColor: '#555877' },
  thumbOn:   { backgroundColor: '#fff', alignSelf: 'flex-end' },
  lbl:       { fontSize: 13, color: '#dde', fontWeight: '500' },
  desc:      { fontSize: 10, color: '#555877' },
});

// ─── Filtre Paneli ────────────────────────────────────────────────────────────
const VISUAL_FILTERS = [
  { id: 'bw',        l: 'Siyah Beyaz', e: '⬛' },
  { id: 'vintage',   l: 'Vintage',     e: '📷' },
  { id: 'cinematic', l: 'Sinematik',   e: '🎬' },
  { id: 'warm',      l: 'Sıcak',       e: '🌅' },
  { id: 'cool',      l: 'Soğuk',       e: '❄️' },
  { id: 'fade',      l: 'Soluk',       e: '🌫' },
  { id: 'sharp',     l: 'Keskin',      e: '💎' },
  { id: 'drama',     l: 'Dramatik',    e: '🎭' },
];
function FilterPanel({ onApplyFilter }) {
  const [sel, setSel] = useState(null);
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="VİSUEL FİLTRELER" />
      <View style={fp.grid}>
        {VISUAL_FILTERS.map(f => (
          <TouchableOpacity key={f.id} style={[fp.card, sel===f.id && fp.cardOn]} onPress={() => setSel(f.id===sel?null:f.id)} activeOpacity={0.78}>
            <Text style={{ fontSize: 26 }}>{f.e}</Text>
            <Text style={[fp.lbl, sel===f.id && { color: C.accent }]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ActionBtn label="🎨  Filtreyi Uygula" onPress={() => onApplyFilter({ filter_name: sel })} disabled={!sel} />
    </ScrollView>
  );
}
const fp = StyleSheet.create({
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:   { width: '47%', backgroundColor: '#13151f', borderRadius: 14, borderWidth: 1.5, borderColor: '#22253a', padding: 12, alignItems: 'center', gap: 5 },
  cardOn: { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.1)' },
  lbl:    { fontSize: 12, color: '#aab', fontWeight: '600', textAlign: 'center' },
});

// ─── Renk Paneli ──────────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { id: 'warm',      l: 'Sıcak',      e: '🌅' },
  { id: 'cool',      l: 'Soğuk',      e: '❄️' },
  { id: 'vivid',     l: 'Canlı',      e: '🌈' },
  { id: 'muted',     l: 'Soluk',      e: '🌫' },
  { id: 'cinematic', l: 'Sinematik',  e: '🎬' },
];
function ColorPanel({ onColorGrade }) {
  const [preset, setPreset]   = useState(null);
  const [bright, setBright]   = useState('0');
  const [contrast, setContr]  = useState('1');
  const [sat, setSat]         = useState('1');
  const manual = !preset;
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="HAZIR PROFIL" />
      <View style={pan.chipRow}>
        {COLOR_PRESETS.map(p => <Chip key={p.id} label={p.l} emoji={p.e} active={preset===p.id} onPress={() => setPreset(preset===p.id?null:p.id)} />)}
      </View>
      {manual && <>
        <SectionLabel text="MANUEL AYAR" />
        {[
          ['Parlaklık (-1 / +1)', bright, setBright],
          ['Kontrast (0 / 3)', contrast, setContr],
          ['Doygunluk (0 / 3)', sat, setSat],
        ].map(([lbl, val, set]) => (
          <View key={lbl} style={cp.row}>
            <Text style={cp.lbl}>{lbl}</Text>
            <TextInput style={cp.input} value={val} onChangeText={set} keyboardType="numeric" placeholderTextColor="#555" />
          </View>
        ))}
      </>}
      <ActionBtn
        label="🌈  Uygula"
        onPress={() => preset
          ? onColorGrade({ preset })
          : onColorGrade({ brightness: parseFloat(bright)||0, contrast: parseFloat(contrast)||1, saturation: parseFloat(sat)||1 })
        }
      />
    </ScrollView>
  );
}
const cp = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 12 },
  lbl:   { fontSize: 12, color: '#aab', flex: 1 },
  input: { width: 70, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 10, fontSize: 14, color: '#fff', textAlign: 'center' },
});

// ─── Hız Paneli ───────────────────────────────────────────────────────────────
const SPEED_PRESETS = [
  { id: 0.25, l: '0.25x', e: '🐌' },
  { id: 0.5,  l: '0.5x',  e: '🐢' },
  { id: 0.75, l: '0.75x', e: '🚶' },
  { id: 1.5,  l: '1.5x',  e: '🏃' },
  { id: 2,    l: '2x',    e: '⚡' },
  { id: 3,    l: '3x',    e: '🚀' },
];
function SpeedPanel({ onChangeSpeed }) {
  const [sel, setSel]     = useState(null);
  const [custom, setCustom] = useState('');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="HIZ AYARI" />
      <View style={sp2.grid}>
        {SPEED_PRESETS.map(s => (
          <TouchableOpacity key={s.id} style={[sp2.card, sel===s.id && sp2.cardOn]} onPress={() => { setSel(s.id); setCustom(String(s.id)); }} activeOpacity={0.78}>
            <Text style={{ fontSize: 22 }}>{s.e}</Text>
            <Text style={[sp2.lbl, sel===s.id && { color: C.accent }]}>{s.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={sp2.customRow}>
        <Text style={sp2.customLbl}>Özel hız (0.25 – 4.0)</Text>
        <TextInput style={sp2.customIn} value={custom} onChangeText={v => { setCustom(v); setSel(null); }} keyboardType="numeric" placeholder="1.5" placeholderTextColor="#555" />
      </View>
      <ActionBtn label="⏩  Hızı Uygula" onPress={() => onChangeSpeed({ speed: parseFloat(custom)||sel||1.5 })} disabled={!custom && !sel} />
    </ScrollView>
  );
}
const sp2 = StyleSheet.create({
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:      { width: '30%', backgroundColor: '#13151f', borderRadius: 12, borderWidth: 1.5, borderColor: '#22253a', padding: 12, alignItems: 'center', gap: 4 },
  cardOn:    { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.1)' },
  lbl:       { fontSize: 12, color: '#aab', fontWeight: '600' },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13151f', borderRadius: 10, padding: 12, marginTop: 4 },
  customLbl: { fontSize: 12, color: '#aab' },
  customIn:  { width: 70, height: 36, backgroundColor: '#0d0f1a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2d3e', paddingHorizontal: 10, fontSize: 14, color: '#fff', textAlign: 'center' },
});

// ─── Metin Paneli ─────────────────────────────────────────────────────────────
const TEXT_POSITIONS = [
  { id: 'top', l: 'Üst' }, { id: 'center', l: 'Orta' }, { id: 'bottom', l: 'Alt' },
  { id: 'top_left', l: 'Sol Üst' }, { id: 'bottom_right', l: 'Sağ Alt' },
];
const TEXT_COLORS = [
  { id: 'white', l: 'Beyaz', dot: '#fff' }, { id: 'yellow', l: 'Sarı', dot: '#fde047' },
  { id: 'red', l: 'Kırmızı', dot: '#f87171' }, { id: '#00CFFF', l: 'Mavi', dot: '#00cfff' },
];
function TextPanel({ onAddText }) {
  const [text, setText]   = useState('');
  const [pos, setPos]     = useState('bottom');
  const [color, setColor] = useState('white');
  const [size, setSize]   = useState('48');
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="METİN" />
      <TextInput
        style={txp.textIn}
        value={text}
        onChangeText={setText}
        placeholder="Metni buraya yaz..."
        placeholderTextColor="#555"
        multiline
        maxLength={120}
      />
      <SectionLabel text="POZİSYON" />
      <View style={pan.chipRow}>
        {TEXT_POSITIONS.map(p => <Chip key={p.id} label={p.l} active={pos===p.id} onPress={() => setPos(p.id)} />)}
      </View>
      <SectionLabel text="RENK" />
      <View style={pan.chipRow}>
        {TEXT_COLORS.map(c => (
          <TouchableOpacity key={c.id} style={[txp.colorChip, color===c.id && txp.colorChipOn]} onPress={() => setColor(c.id)}>
            <View style={[txp.dot, { backgroundColor: c.dot }]} />
            <Text style={txp.colorLbl}>{c.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={cp.row}>
        <Text style={cp.lbl}>Font büyüklüğü</Text>
        <TextInput style={cp.input} value={size} onChangeText={setSize} keyboardType="numeric" placeholderTextColor="#555" />
      </View>
      <ActionBtn label="🔤  Metni Ekle" onPress={() => onAddText({ text, position: pos, color, font_size: parseInt(size)||48 })} disabled={!text.trim()} />
    </ScrollView>
  );
}
const txp = StyleSheet.create({
  textIn:      { backgroundColor: '#13151f', borderRadius: 10, borderWidth: 1, borderColor: '#2a2d3e', padding: 14, fontSize: 14, color: '#fff', minHeight: 70, textAlignVertical: 'top' },
  colorChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#13151f', borderWidth: 1.5, borderColor: '#2a2d3e' },
  colorChipOn: { borderColor: C.accent },
  dot:         { width: 12, height: 12, borderRadius: 6 },
  colorLbl:    { fontSize: 12, color: '#aab' },
});

// ─── Dönüştür Paneli ──────────────────────────────────────────────────────────
const RATIOS = [
  { id: '9:16', l: '9:16', sub: 'TikTok / Reels', e: '📱' },
  { id: '16:9', l: '16:9', sub: 'YouTube',        e: '🖥' },
  { id: '1:1',  l: '1:1',  sub: 'Instagram Kare', e: '⬜' },
  { id: '4:5',  l: '4:5',  sub: 'IG Portrait',    e: '🖼' },
];
function TransformPanel({ onTransform }) {
  const [ratio, setRatio]   = useState(null);
  const [rotate, setRotate] = useState(null);
  const [flip, setFlip]     = useState(null);
  return (
    <ScrollView contentContainerStyle={pan.wrap} showsVerticalScrollIndicator={false}>
      <SectionLabel text="EN-BOY ORANI" />
      <View style={trp.grid}>
        {RATIOS.map(r => (
          <TouchableOpacity key={r.id} style={[trp.card, ratio===r.id && trp.cardOn]} onPress={() => setRatio(ratio===r.id?null:r.id)} activeOpacity={0.78}>
            <Text style={{ fontSize: 22 }}>{r.e}</Text>
            <Text style={[trp.lbl, ratio===r.id && { color: C.accent }]}>{r.l}</Text>
            <Text style={trp.sub}>{r.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <SectionLabel text="DÖNDÜR" />
      <View style={pan.chipRow}>
        {[['90°', 90], ['180°', 180], ['270°', 270]].map(([l, v]) =>
          <Chip key={v} label={l} active={rotate===v} onPress={() => setRotate(rotate===v?null:v)} />
        )}
      </View>
      <SectionLabel text="YANSIT" />
      <View style={pan.chipRow}>
        <Chip label="↔ Yatay"  active={flip==='horizontal'} onPress={() => setFlip(flip==='horizontal'?null:'horizontal')} />
        <Chip label="↕ Dikey"  active={flip==='vertical'}   onPress={() => setFlip(flip==='vertical'?null:'vertical')} />
      </View>
      <ActionBtn
        label="🔄  Uygula"
        onPress={() => onTransform({ aspect_ratio: ratio, rotate, flip })}
        disabled={!ratio && !rotate && !flip}
      />
    </ScrollView>
  );
}
const trp = StyleSheet.create({
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:   { width: '47%', backgroundColor: '#13151f', borderRadius: 12, borderWidth: 1.5, borderColor: '#22253a', padding: 12, alignItems: 'center', gap: 3 },
  cardOn: { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.1)' },
  lbl:    { fontSize: 13, color: '#dde', fontWeight: '600' },
  sub:    { fontSize: 10, color: '#555877', textAlign: 'center' },
});

// ─── Ters Çevir Paneli ────────────────────────────────────────────────────────
function ReversePanel({ onReverse }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
      <Text style={{ fontSize: 52 }}>⏪</Text>
      <Text style={{ fontSize: 16, color: '#dde', fontWeight: '700', textAlign: 'center' }}>Videoyu ters çevir</Text>
      <Text style={{ fontSize: 12, color: '#555877', textAlign: 'center', lineHeight: 18 }}>
        Videonun tüm karelerini sondan başa oynatır.{'\n'}Kısa videolarda en iyi çalışır.
      </Text>
      <TouchableOpacity style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40 }} onPress={onReverse} activeOpacity={0.8}>
        <Text style={{ color: C.accent, fontSize: 14, fontWeight: '700' }}>⏪  Ters Çevir</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Geri Al Paneli ───────────────────────────────────────────────────────────
function UndoPanel({ onUndo }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 }}>
      <Text style={{ fontSize: 52 }}>↩️</Text>
      <Text style={{ fontSize: 16, color: '#dde', fontWeight: '700', textAlign: 'center' }}>Son düzenlemeyi geri al</Text>
      <Text style={{ fontSize: 12, color: '#555877', textAlign: 'center', lineHeight: 18 }}>
        Önceki versiyona döner. Bu işlem geri alınamaz.
      </Text>
      <TouchableOpacity style={ud.btn} onPress={onUndo} activeOpacity={0.8}>
        <Text style={ud.txt}>↩️  Geri Al</Text>
      </TouchableOpacity>
    </View>
  );
}
const ud = StyleSheet.create({
  btn: { backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40 },
  txt: { color: '#f87171', fontSize: 14, fontWeight: '700' },
});

// ─── Ortak panel wrapper stilleri ─────────────────────────────────────────────
const pan = StyleSheet.create({
  wrap:    { padding: 16, paddingBottom: 24, gap: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANA EDİTÖR
// ═══════════════════════════════════════════════════════════════════════════════
export function EditorView({
  jobData,
  result,
  wsState,
  onSend,
  onApplyEffect,
  onGenerateSubtitles,
  onAddMusic,
  onAddSfx,
  onEnhanceAudio,
  onBeatSync,
  onBgRemove,
  onGenerateShorts,
  onUndo,
  onChangeSpeed,
  onColorGrade,
  onTransform,
  onAddText,
  onApplyFilter,
  onReverse,
  onDownload,
  onRestart,
  editLoading,
  editProgress,
  activeTab,
  setActiveTab,
}) {
  const videoUri  = result?.download_url || result?.output_url || null;
  const duration  = jobData?.duration || 0;
  const hasResult = !!videoUri;

  const pct = (() => {
    const m = (editProgress || '').match(/(\d+)/);
    return m ? Math.min(parseInt(m[1], 10), 100) : 20;
  })();

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <View style={ev.root}>

      {/* ══ PREVIEW ══════════════════════════════════════════════════════════ */}
      <View style={ev.preview}>
        {hasResult ? (
          <NativeVideoPlayer uri={videoUri} style={ev.player} />
        ) : (
          <View style={ev.placeholder}>
            <View style={ev.placeholderInner}>
              <Text style={ev.placeholderIcon}>▶</Text>
            </View>
            <Text style={ev.videoName} numberOfLines={1}>{jobData?.name || 'video.mp4'}</Text>
            {duration > 0 && <Text style={ev.videoDur}>{fmtTime(duration)}</Text>}
          </View>
        )}

        {/* İşleme overlay */}
        {wsState === 'processing' && (
          <View style={ev.procOverlay}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={ev.procTxt}>{editProgress || 'Video işleniyor...'}</Text>
            <View style={ev.procTrack}>
              <View style={[ev.procFill, { width: `${pct}%` }]} />
            </View>
            <Text style={ev.procPct}>{pct}%</Text>
          </View>
        )}

        {/* Done action bar — sağ üst köşe */}
        {hasResult && (
          <View style={ev.doneBar}>
            <TouchableOpacity style={ev.doneBtn} onPress={onDownload} activeOpacity={0.85}>
              <Text style={ev.doneTxt}>⬇ İndir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ev.newBtn} onPress={onRestart} activeOpacity={0.85}>
              <Text style={ev.newTxt}>🔄</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ══ TİMELİNE ══════════════════════════════════════════════════════════ */}
      <View style={ev.timeline}>
        {/* Merkez çizgi (playhead) */}
        <View style={ev.centerLine} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ev.tlContent}
        >
          {/* Video klip bloğu */}
          <View style={[ev.clip, { width: Math.max((duration || 10) * 8, 120) }]}>
            <Text style={ev.clipTxt} numberOfLines={1}>{jobData?.name || 'video'}</Text>
          </View>
          {/* Boşluk — kullanıcı kaydırabilsin */}
          <View style={{ width: 120 }} />
        </ScrollView>
        {duration > 0 && (
          <View style={ev.tlDurRow}>
            <Text style={ev.tlTime}>0:00</Text>
            <Text style={ev.tlTime}>{fmtTime(duration / 2)}</Text>
            <Text style={ev.tlTime}>{fmtTime(duration)}</Text>
          </View>
        )}
      </View>

      {/* ══ PANELLİ ALAN ══════════════════════════════════════════════════════ */}
      <View style={ev.panelArea}>
        {activeTab === 'effect'    && <EffectPanel    onApplyEffect={onApplyEffect} />}
        {activeTab === 'filter'    && <FilterPanel    onApplyFilter={onApplyFilter} />}
        {activeTab === 'color'     && <ColorPanel     onColorGrade={onColorGrade} />}
        {activeTab === 'speed'     && <SpeedPanel     onChangeSpeed={onChangeSpeed} />}
        {activeTab === 'text'      && <TextPanel      onAddText={onAddText} />}
        {activeTab === 'audio'     && <AudioPanel     onAddMusic={onAddMusic} onAddSfx={onAddSfx} onEnhanceAudio={onEnhanceAudio} />}
        {activeTab === 'subtitle'  && <SubtitlePanel  onGenerateSubtitles={onGenerateSubtitles} />}
        {activeTab === 'trim'      && <TrimPanel      onSend={onSend} />}
        {activeTab === 'transform' && <TransformPanel onTransform={onTransform} />}
        {activeTab === 'beat'      && <BeatPanel      onBeatSync={onBeatSync} />}
        {activeTab === 'bgremove'  && <BgPanel        onBgRemove={onBgRemove} />}
        {activeTab === 'reverse'   && <ReversePanel   onReverse={onReverse} />}
        {activeTab === 'shorts'    && <ShortsPanel    onGenerateShorts={onGenerateShorts} />}
        {activeTab === 'undo'      && <UndoPanel      onUndo={onUndo} />}
      </View>

      {/* ══ ARAÇ ÇUBUĞU ═══════════════════════════════════════════════════════ */}
      <View style={ev.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ev.toolbarInner}
        >
          {TABS.map(tab => {
            const on = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={ev.toolItem}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.72}
              >
                <View style={[ev.toolIconWrap, on && ev.toolIconOn]}>
                  <Text style={ev.toolIcon}>{tab.icon}</Text>
                </View>
                <Text style={[ev.toolLbl, on && ev.toolLblOn]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const ev = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07090f' },

  // Preview
  preview: {
    flex: 2.5,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  player: { flex: 1, width: '100%' },

  placeholder: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 10 },
  placeholderInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.3)', justifyContent: 'center', alignItems: 'center' },
  placeholderIcon: { fontSize: 28, color: C.accent },
  videoName: { fontSize: 13, color: '#8a8da8', maxWidth: '70%', textAlign: 'center' },
  videoDur:  { fontSize: 11, color: '#555877' },

  // Processing
  procOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,9,15,0.85)', justifyContent: 'center', alignItems: 'center', gap: 14, padding: 32 },
  procTxt:     { fontSize: 13, color: '#ccd', textAlign: 'center' },
  procTrack:   { width: '70%', height: 3, backgroundColor: '#1a1d2e', borderRadius: 2, overflow: 'hidden' },
  procFill:    { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  procPct:     { fontSize: 12, color: '#555877' },

  // Done bar
  doneBar: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  doneBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  doneTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  newBtn:  { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  newTxt:  { fontSize: 14 },

  // Timeline
  timeline:    { height: 88, backgroundColor: '#0d0f1a', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#13151f', justifyContent: 'center' },
  centerLine:  { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', zIndex: 10, opacity: 0.9 },
  tlContent:   { paddingHorizontal: '50%', alignItems: 'center', gap: 0 },
  clip:        { height: 48, backgroundColor: '#1e3a5f', borderRadius: 6, borderWidth: 1.5, borderColor: '#2563eb', justifyContent: 'center', paddingHorizontal: 10 },
  clipTxt:     { fontSize: 11, color: '#93c5fd', fontWeight: '600' },
  tlDurRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 4 },
  tlTime:      { fontSize: 9, color: '#3a3d55' },

  // Panel
  panelArea: { flex: 1, backgroundColor: '#0a0c14', borderTopWidth: 1, borderColor: '#13151f' },

  // Toolbar
  toolbar:      { height: 78, backgroundColor: '#07090f', borderTopWidth: 1, borderColor: '#13151f' },
  toolbarInner: { paddingHorizontal: 8, alignItems: 'center', height: 78 },
  toolItem:     { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 4, height: 78 },
  toolIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#13151f', alignItems: 'center', justifyContent: 'center' },
  toolIconOn:   { backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  toolIcon:     { fontSize: 18 },
  toolLbl:      { fontSize: 10, color: '#3a3d55', fontWeight: '600' },
  toolLblOn:    { color: C.accent },
});
