import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../models/edit_result.dart';
import '../providers/plan_provider.dart';
import '../providers/wizard_provider.dart';
import '../services/tts_service.dart';
import '../services/stt_service.dart';
import '../theme/app_theme.dart';
import '../utils/constants.dart';
import '../utils/effect_intent.dart';
import '../widgets/badge_widget.dart';
import '../widgets/video_player_widget.dart';
import '../widgets/virality_card.dart';
import '../widgets/effect_picker_widget.dart';

class StepPreviewScreen extends StatefulWidget {
  const StepPreviewScreen({super.key});

  @override
  State<StepPreviewScreen> createState() => _StepPreviewScreenState();
}

class _StepPreviewScreenState extends State<StepPreviewScreen> {
  late EditResult _result;
  late String _jobId;

  bool   _subLoading          = false;
  String _subStatus           = '';
  String _subLang             = 'tr';

  bool   _effectApplying      = false;
  bool   _effectPickerVisible = false;

  bool   _voiceEnabled        = false;

  // SFX & Müzik
  bool   _soundLoading  = false;
  final  List<Map<String, dynamic>> _appliedSounds = [];

  // Güncel handleTranscript referansı (stale closure önleme)
  void Function(String)? _transcriptRouter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final wizard = context.read<WizardProvider>();
      setState(() {
        _result = wizard.result!;
        _jobId  = wizard.jobData!.jobId;
      });

      if (_result.autoSubtitleApplied && _result.autoSubtitleLanguage != null) {
        setState(() {
          _subStatus = '✓ ${kSubLangs[_result.autoSubtitleLanguage!] ?? _result.autoSubtitleLanguage!} altyazı eklendi (otomatik)';
          _subLang   = _result.autoSubtitleLanguage!;
        });
      }
    });
  }

  // ── Altyazı ─────────────────────────────────────────────────────────────────

  Future<void> _generateSubtitles({String? lang}) async {
    final targetLang = lang ?? _subLang;
    final plan = context.read<PlanProvider>();
    if (!plan.isSubtitleAllowed(targetLang)) {
      context.read<WizardProvider>().showPaywall('subtitles');
      return;
    }
    setState(() { _subLoading = true; _subStatus = ''; });
    try {
      final data = await generateSubtitles(_jobId, language: targetLang);
      final videoUrl = data['video_url'] as String?;
      if (videoUrl != null && mounted) {
        final absUrl = bustCache(toAbsoluteUrl(videoUrl));
        final wizard = context.read<WizardProvider>();
        wizard.updateResultUrl(absUrl);
        setState(() {
          _result    = wizard.result!;
          _subStatus = '✓ ${kSubLangs[targetLang] ?? targetLang} altyazı eklendi';
          _subLang   = targetLang;
        });
        _speak('${kSubLangs[targetLang] ?? targetLang} altyazı eklendi');
      }
    } catch (e) {
      setState(() { _subStatus = 'Hata: ${e.toString()}'; });
    } finally {
      if (mounted) setState(() { _subLoading = false; });
    }
  }

  // ── Görsel Efekt ─────────────────────────────────────────────────────────────

  Future<void> _applyEffect(String category, double intensity, {double? timestamp}) async {
    setState(() { _effectApplying = true; _effectPickerVisible = false; });
    try {
      final data = await applyEffect(_jobId, category: category, intensity: intensity, timestamp: timestamp);
      final url = (data['download_url'] ?? data['output_url'] ?? '') as String;
      if (url.isNotEmpty && mounted) {
        final absUrl = bustCache(toAbsoluteUrl(url));
        final wizard = context.read<WizardProvider>();
        wizard.updateResultUrl(absUrl);
        setState(() { _result = wizard.result!; });
        _speak('Efekt uygulandı');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Efekt uygulanamadı: $e'), backgroundColor: C.error),
        );
      }
    } finally {
      if (mounted) setState(() { _effectApplying = false; });
    }
  }

  // ── Ses Efekti (SFX) ─────────────────────────────────────────────────────────

  Future<void> _applySfx(String sfxType, {double? timestamp}) async {
    setState(() { _soundLoading = true; _subStatus = '${kSfxLabels[sfxType] ?? sfxType} ekleniyor...'; });
    try {
      final data = await addSoundEffect(_jobId, sfxType: sfxType, timestamp: timestamp);
      final url = (data['download_url'] ?? '') as String;
      if (url.isNotEmpty && mounted) {
        final absUrl = bustCache(toAbsoluteUrl(url));
        final wizard = context.read<WizardProvider>();
        wizard.updateResultUrl(absUrl);
        setState(() {
          _result = wizard.result!;
          _subStatus = '✓ ${kSfxLabels[sfxType] ?? sfxType} eklendi${timestamp != null ? " (${timestamp.toInt()}s)" : ""}';
          _appliedSounds.add({'type': 'sfx', 'sfx_type': sfxType, 'timestamp': timestamp});
        });
        _speak('${kSfxLabels[sfxType] ?? sfxType} sesi eklendi');
      }
    } catch (e) {
      if (mounted) setState(() { _subStatus = 'SFX hatası: $e'; });
      _speak('Ses efekti eklenemedi');
    } finally {
      if (mounted) setState(() { _soundLoading = false; });
    }
  }

  // ── Arka Plan Müziği ─────────────────────────────────────────────────────────

  Future<void> _applyMusic(String mood, {double startTime = 0.0, double? endTime}) async {
    setState(() { _soundLoading = true; _subStatus = '${kMusicLabels[mood] ?? mood} müzik ekleniyor...'; });
    try {
      final data = await addMusic(_jobId, mood: mood, startTime: startTime, endTime: endTime);
      final url = (data['download_url'] ?? '') as String;
      if (url.isNotEmpty && mounted) {
        final absUrl = bustCache(toAbsoluteUrl(url));
        final wizard = context.read<WizardProvider>();
        wizard.updateResultUrl(absUrl);
        setState(() {
          _result = wizard.result!;
          _subStatus = '✓ ${kMusicLabels[mood] ?? mood} müzik eklendi';
          _appliedSounds.add({'type': 'music', 'mood': mood, 'start_time': startTime, 'end_time': endTime});
        });
        _speak('${kMusicLabels[mood] ?? mood} müzik eklendi');
      }
    } catch (e) {
      if (mounted) setState(() { _subStatus = 'Müzik hatası: $e'; });
      _speak('Müzik eklenemedi');
    } finally {
      if (mounted) setState(() { _soundLoading = false; });
    }
  }

  // ── TTS yardımcı ─────────────────────────────────────────────────────────────

  void _speak(String text, {VoidCallback? onDone}) {
    context.read<TtsService>().speak(text, onDone: onDone);
  }

  // ── Sesli Komut Router ────────────────────────────────────────────────────────

  void _handleTranscript(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    // 1. SFX komutu
    final sfxMatch = parseSfxCommand(trimmed);
    if (sfxMatch != null) {
      _applySfx(sfxMatch['sfx_type'] as String, timestamp: sfxMatch['timestamp'] as double?);
      return;
    }

    // 2. Müzik komutu
    final musicMatch = parseMusicCommand(trimmed);
    if (musicMatch != null) {
      _applyMusic(musicMatch['mood'] as String, startTime: (musicMatch['start_time'] as double?) ?? 0.0);
      return;
    }

    // 3. Altyazı dili
    if (isSubtitleLangCmd(trimmed)) {
      final code = detectSubtitleLang(trimmed);
      if (code != null) {
        _generateSubtitles(lang: code);
        return;
      }
    }

    // 4. Görsel efekt
    final intent = detectEffectIntent(trimmed);
    if (intent != null && isApplyEffectCmd(trimmed)) {
      _applyEffect(intent.category, intent.intensity);
      return;
    }

    // 5. Anlayamadı
    _speak('Anlayamadım. Ses efekti, müzik veya altyazı komutu deneyin.',
        onDone: () { if (_voiceEnabled) _startListening(); });
  }

  void _startListening() {
    final stt = context.read<SttService>();
    stt.startListening(onResult: (t) => _transcriptRouter?.call(t));
  }

  void _toggleVoice() {
    final stt = context.read<SttService>();
    if (_voiceEnabled) {
      stt.stopListening();
      setState(() { _voiceEnabled = false; });
    } else {
      setState(() { _voiceEnabled = true; });
      _speak('Sesli komut etkinleştirildi. Ses efekti veya müzik komutu söyleyebilirsiniz.',
          onDone: _startListening);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final wizard = context.watch<WizardProvider>();
    _result = wizard.result ?? _result;
    // Güncel handler referansını her build'de güncelle (stale closure önleme)
    _transcriptRouter = _handleTranscript;

    final videoUrl = bustCache(toAbsoluteUrl(_result.effectiveUrl));
    final dur      = _result.duration;
    final loading  = _soundLoading || _subLoading || _effectApplying;

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Başlık + sesli komut toggle
              Row(
                children: [
                  const BadgeWidget(label: 'ADIM 3'),
                  const Spacer(),
                  if (context.read<SttService>().available)
                    GestureDetector(
                      onTap: _toggleVoice,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: _voiceEnabled ? C.accent.withValues(alpha: 0.15) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: _voiceEnabled ? C.accent : C.border),
                        ),
                        child: Text(_voiceEnabled ? '🎤 Aktif' : '🎤',
                            style: TextStyle(color: _voiceEnabled ? C.accent : C.dim, fontSize: 12)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const Text('Önizle', style: TextStyle(color: C.txt, fontSize: 34, fontStyle: FontStyle.italic)),
              const SizedBox(height: 4),

              if (dur.isNotEmpty) ...[
                Text(
                  '${dur['input'] ?? '?'}s ham → ${dur['output'] ?? '?'}s kurgulanan',
                  style: const TextStyle(color: C.dim, fontSize: 13),
                ),
                const SizedBox(height: 16),
              ],

              if (videoUrl.isNotEmpty) ...[
                VideoPlayerWidget(url: videoUrl),
                const SizedBox(height: 20),
              ],

              ViralityCard(
                scores:   _result.scores,
                analysis: _result.claudeAnalysis,
                editPlan: _result.editPlan,
              ),

              // ── SES & MÜZİK KARTI ───────────────────────────────────────
              _buildSoundCard(loading),

              const SizedBox(height: 20),

              // ── ALTYAZI ─────────────────────────────────────────────────
              const Text('ALTYAZI',
                  style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),

              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: C.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: C.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _subLang,
                    dropdownColor: C.card,
                    style: const TextStyle(color: C.txt, fontSize: 13),
                    items: kSubLangs.entries
                        .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) { if (v != null) setState(() { _subLang = v; }); },
                  ),
                ),
              ),
              const SizedBox(height: 8),

              if (_subStatus.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(_subStatus,
                      style: TextStyle(
                        color: _subStatus.startsWith('Hata') ? C.error : C.green,
                        fontSize: 12,
                      )),
                ),

              _buildActionButton(
                loading: _subLoading,
                label: 'Altyazı Ekle (${kSubLangs[_subLang] ?? _subLang})',
                onTap: _generateSubtitles,
              ),

              const SizedBox(height: 20),

              // ── EFEKTLER ────────────────────────────────────────────────
              const Text('EFEKTLER',
                  style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),

              GestureDetector(
                onTap: () => setState(() { _effectPickerVisible = true; }),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: C.accent.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: C.accent.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (_effectApplying) ...[
                        const SizedBox(width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: C.accent)),
                        const SizedBox(width: 8),
                        const Text('Efekt uygulanıyor...', style: TextStyle(color: C.accent, fontSize: 13)),
                      ] else ...[
                        const Text('✨ ', style: TextStyle(fontSize: 16)),
                        const Text('Efekt Ekle', style: TextStyle(color: C.accent, fontSize: 13)),
                      ],
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // ── İLERLE ──────────────────────────────────────────────────
              GestureDetector(
                onTap: () => context.read<WizardProvider>().nextStep(),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: C.accent, borderRadius: BorderRadius.circular(10)),
                  child: const Center(
                    child: Text('İndir ve Paylaş',
                        style: TextStyle(color: Colors.white, fontSize: 14,
                            fontWeight: FontWeight.w500, letterSpacing: 0.5)),
                  ),
                ),
              ),
            ],
          ),
        ),

        if (_effectPickerVisible)
          EffectPickerWidget(
            visible: _effectPickerVisible,
            applying: _effectApplying,
            onSelect: (cat, intensity) => _applyEffect(cat, intensity),
            onClose: () => setState(() { _effectPickerVisible = false; }),
          ),
      ],
    );
  }

  // ── SES & MÜZİK widget ───────────────────────────────────────────────────────

  Widget _buildSoundCard(bool globalLoading) {
    const sfxItems = [
      ('laugh',        '😂', 'Kahkaha'),
      ('applause',     '👏', 'Alkış'),
      ('airhorn',      '📣', 'Düdük'),
      ('sad_trombone', '🎺', 'Fiyasko'),
      ('crowd_cheer',  '🎉', 'Coşku'),
      ('drum_hit',     '🥁', 'Davul'),
      ('bell',         '🔔', 'Zil'),
      ('whoosh',       '💨', 'Woş'),
    ];
    const musicItems = [
      ('calm',      '🌿', 'Sakin'),
      ('energetic', '⚡', 'Enerjik'),
      ('rhythmic',  '🎵', 'Ritmik'),
      ('minimal',   '🎹', 'Minimal'),
      ('slow',      '🌙', 'Yavaş'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        const Text('SES & MÜZİK',
            style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),

        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: C.card,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: C.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Sesli komut ipucu
              Text(
                '🎤 "${_voiceEnabled ? "Dinliyorum..." : "5. saniyeye kahkaha sesi koy"}"',
                style: TextStyle(color: _voiceEnabled ? C.green : C.dim, fontSize: 11),
              ),
              const SizedBox(height: 14),

              // SFX butonları
              const Text('Ses Efektleri',
                  style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: sfxItems.map((item) {
                  final (sfx, emoji, label) = item;
                  return _chipButton(
                    label: '$emoji $label',
                    disabled: globalLoading,
                    onTap: () => _applySfx(sfx),
                  );
                }).toList(),
              ),

              const SizedBox(height: 14),

              // Müzik butonları
              const Text('Arka Plan Müziği',
                  style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: musicItems.map((item) {
                  final (mood, emoji, label) = item;
                  return _chipButton(
                    label: '$emoji $label',
                    disabled: globalLoading,
                    onTap: () => _applyMusic(mood),
                  );
                }).toList(),
              ),

              // Uygulanan sesler
              if (_appliedSounds.isNotEmpty) ...[
                const SizedBox(height: 14),
                const Divider(color: C.border, height: 1),
                const SizedBox(height: 10),
                const Text('Eklenenler',
                    style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1)),
                const SizedBox(height: 6),
                ..._appliedSounds.map((s) {
                  if (s['type'] == 'sfx') {
                    final ts = s['timestamp'] as double?;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(
                        '🔊 ${ts != null ? "${ts.toInt()}s - " : ""}${kSfxLabels[s["sfx_type"]] ?? s["sfx_type"]}',
                        style: const TextStyle(color: C.green, fontSize: 11),
                      ),
                    );
                  } else {
                    final st = (s['start_time'] as double?) ?? 0.0;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(
                        '🎵 ${st > 0 ? "${st.toInt()}s" : "Baştan"} - ${kMusicLabels[s["mood"]] ?? s["mood"]} müzik',
                        style: const TextStyle(color: C.green, fontSize: 11),
                      ),
                    );
                  }
                }),
              ],

              // Yükleniyor
              if (_soundLoading) ...[
                const SizedBox(height: 10),
                const Row(
                  children: [
                    SizedBox(width: 14, height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: C.accent)),
                    SizedBox(width: 8),
                    Text('İşleniyor...', style: TextStyle(color: C.dim, fontSize: 12)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _chipButton({required String label, required bool disabled, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: AnimatedOpacity(
        opacity: disabled ? 0.4 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: C.card,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: C.border),
          ),
          child: Text(label, style: const TextStyle(color: C.txt, fontSize: 11)),
        ),
      ),
    );
  }

  Widget _buildActionButton({required bool loading, required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedOpacity(
        opacity: loading ? 0.5 : 1,
        duration: const Duration(milliseconds: 200),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: C.card,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: C.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading) ...[
                const SizedBox(width: 14, height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: C.accent)),
                const SizedBox(width: 8),
              ],
              Text(loading ? 'Ekleniyor...' : label,
                  style: const TextStyle(color: C.txt, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}
