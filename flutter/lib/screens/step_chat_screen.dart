import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../models/chat_message.dart';
import '../models/edit_result.dart';
import '../models/job_data.dart';
import '../providers/plan_provider.dart';
import '../providers/wizard_provider.dart';
import '../services/tts_service.dart';
import '../services/stt_service.dart';
import '../services/edit_polling_service.dart';
import '../theme/app_theme.dart';
import '../utils/constants.dart';
import '../utils/effect_intent.dart';
import '../widgets/badge_widget.dart';
import '../widgets/chat_bubble.dart';
import '../widgets/confirm_card.dart';
import '../widgets/effect_picker_widget.dart';

class StepChatScreen extends StatefulWidget {
  const StepChatScreen({super.key});

  @override
  State<StepChatScreen> createState() => _StepChatScreenState();
}

class _StepChatScreenState extends State<StepChatScreen> {
  // Services (singleton via Provider)
  late TtsService _tts;
  late SttService _stt;
  late EditPollingService _polling;
  late JobData _jobData;
  bool _servicesReady = false;

  // Chat state
  final List<ChatMessage> _messages = [];
  int _msgIdCounter = 1;
  final TextEditingController _inputCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  String _tab = 'chat';
  String _platform = 'youtube_shorts';
  String _voiceLang = 'tr-TR';

  bool _loading = false;
  bool _effectApplying = false;
  bool _effectPickerVisible = false;

  ConfirmData? _confirmData;
  EffectCategory? _detectedEffect;
  bool _removeFillers = true;
  bool _preserveRhythm = true;

  String? _pendingCommandText;
  String? _pendingSubLang;

  // Shorts
  bool _shortsLoading = false;
  List<dynamic> _shorts = [];
  String _shortsError = '';

  // Voice transcript routing — ref pattern: always routes to fresh _handleTranscript
  late void Function(String) _stableOnTranscript;
  void Function(String)? _transcriptRouter;

  @override
  void initState() {
    super.initState();
    _stableOnTranscript = (text) => _transcriptRouter?.call(text);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    _jobData = context.read<WizardProvider>().jobData!;
    _tts  = context.read<TtsService>();
    _stt  = context.read<SttService>();
    _polling = context.read<EditPollingService>();

    _addMsg(ChatRole.ai, 'Video yüklendi (${_jobData.duration.toStringAsFixed(0)}s). Mic\'e bas, konuş, tekrar bas.');
    setState(() { _servicesReady = true; });
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  String _nextId() => '${_msgIdCounter++}';

  void _addMsg(ChatRole role, String text) {
    setState(() {
      _messages.add(ChatMessage(id: _nextId(), role: role, text: text));
    });
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Voice routing ─────────────────────────────────────────────────────────
  void _handleTranscript(String text) {
    final t = text.trim();
    if (t.isEmpty) return;

    if (_confirmData != null) {
      if (isConfirmWord(t)) { _addMsg(ChatRole.user, t); _startEdit(); return; }
      if (isRejectWord(t))  {
        _addMsg(ChatRole.user, t);
        setState(() { _confirmData = null; });
        final msg = 'Tamam, ne değiştirmek istiyorsun?';
        _addMsg(ChatRole.ai, msg);
        _tts.speak(msg, onDone: _startMic);
        return;
      }
    }

    if (_detectedEffect != null && isApplyEffectCmd(t)) {
      _addMsg(ChatRole.user, t);
      _handleEffectSelect(_detectedEffect!.category, _detectedEffect!.intensity);
      return;
    }

    if (_detectedEffect != null && isEffectAutoApplyCmd(t)) {
      _addMsg(ChatRole.user, t);
      _handleEffectSelect(_detectedEffect!.category, _detectedEffect!.intensity);
      return;
    }

    if (isShortsCmd(t)) {
      _addMsg(ChatRole.user, t);
      setState(() { _tab = 'shorts'; });
      _doGenerateShorts();
      return;
    }

    if (_detectedEffect != null && isIntensityIncreaseCmd(t)) {
      _addMsg(ChatRole.user, t);
      setState(() { _detectedEffect = _detectedEffect?.copyWithIntensity((_detectedEffect!.intensity * 1.2).clamp(0.1, 1.0)); });
      _tts.speak('Yoğunluk artırıldı');
      return;
    }

    if (_detectedEffect != null && isIntensityDecreaseCmd(t)) {
      _addMsg(ChatRole.user, t);
      setState(() { _detectedEffect = _detectedEffect?.copyWithIntensity((_detectedEffect!.intensity * 0.8).clamp(0.1, 1.0)); });
      _tts.speak('Yoğunluk azaltıldı');
      return;
    }

    if (isSubtitleLangCmd(t)) {
      final code = detectSubtitleLang(t);
      if (code != null) {
        _pendingSubLang = code;
        _addMsg(ChatRole.user, t);
        _tts.speak('Altyazı dili ${kSubLangs[code]} olarak ayarlandı');
        return;
      }
    }

    _sendMsg(text: t);
  }

  // keep router pointing to fresh handler each build
  void _updateRouter() {
    _transcriptRouter = _handleTranscript;
  }

  // ── Send chat message ─────────────────────────────────────────────────────
  Future<void> _sendMsg({String? text}) async {
    final msg = (text ?? _inputCtrl.text).trim();
    if (msg.isEmpty || _loading || _polling.loading) return;

    _inputCtrl.clear();
    _addMsg(ChatRole.user, msg);
    setState(() { _loading = true; _confirmData = null; });

    final intent = detectEffectIntent(msg);
    if (intent != null) setState(() { _detectedEffect = intent; });

    try {
      final history = _messages.reversed.take(8).toList().reversed
          .map((m) => {'role': m.role == ChatRole.ai ? 'assistant' : 'user', 'content': m.text})
          .toList();

      final data = await sendChatMessage(
        message: msg,
        history: history,
        jobId: _jobData.jobId,
        language: _voiceLang,
      );

      final reply = (data['reply'] as String?) ?? 'Anladım.';
      _addMsg(ChatRole.ai, reply);

      // Subtitle lang detection
      final detectedLang = detectSubtitleLang(msg) ?? detectSubtitleLang(reply);
      if (detectedLang != null) _pendingSubLang = detectedLang;

      // Accumulate command
      if (!isStartCommand(msg)) {
        _pendingCommandText = mergeCommand(_pendingCommandText ?? '', msg);
      }

      if (data['ready_to_edit'] == true && data['edit_params'] != null) {
        final params = data['edit_params'] as Map<String, dynamic>;
        final finalCmd = mergeCommand(_pendingCommandText ?? '', isStartCommand(msg) ? '' : msg);
        setState(() {
          _confirmData = ConfirmData(
            platform:           (params['platform'] as String?) ?? _platform,
            targetDurationSec:  (params['target_duration_sec'] as num?)?.toDouble(),
            commandText:        finalCmd,
            subtitleLanguage:   detectedLang ?? _pendingSubLang,
          );
        });
        final confirmReply = '$reply Onaylamak için "evet" de.';
        _tts.speak(confirmReply, onDone: _startMic);
      } else {
        _tts.speak(reply, onDone: _startMic);
      }
    } catch (e) {
      _addMsg(ChatRole.ai, 'Hata: ${e.toString()}');
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  // ── Start edit ────────────────────────────────────────────────────────────
  void _startEdit() {
    final cd = _confirmData;
    if (cd == null) return;
    setState(() { _confirmData = null; });

    final wizard = context.read<WizardProvider>();

    _polling.startEdit(
      jobId:            _jobData.jobId,
      commandText:      cd.commandText,
      platform:         cd.platform,
      targetDurationSec: cd.targetDurationSec,
      subtitleLang:     cd.subtitleLanguage ?? _pendingSubLang,
      removeFillers:    _removeFillers,
      preserveRhythm:   _preserveRhythm,
      onDone: (result) {
        _tts.speak('Video hazır!');
        _pendingCommandText = null;
        _pendingSubLang = null;
        wizard.setResult(result);
        wizard.nextStep();
      },
      onError: (e) {
        _addMsg(ChatRole.ai, 'Hata: ${e.message}');
      },
    );
  }

  // ── Effect ────────────────────────────────────────────────────────────────
  Future<void> _handleEffectSelect(String category, double intensity) async {
    final plan = context.read<PlanProvider>();
    if (!plan.canUseEffects) {
      context.read<WizardProvider>().showPaywall('effects');
      return;
    }
    setState(() { _effectApplying = true; _effectPickerVisible = false; });
    try {
      final data = await applyEffect(_jobData.jobId, category: category, intensity: intensity);
      final url = toAbsoluteUrl((data['download_url'] ?? data['output_url'] ?? '') as String);
      if (url.isNotEmpty) {
        context.read<WizardProvider>().updateResultUrl(url);
      }
      setState(() { _detectedEffect = null; });
      _tts.speak('Efekt uygulandı');
      _addMsg(ChatRole.ai, 'Efekt uygulandı! Önizleme ekranında görebilirsin.');
    } catch (e) {
      _addMsg(ChatRole.ai, 'Efekt uygulanamadı: ${e.toString()}');
    } finally {
      if (mounted) setState(() { _effectApplying = false; });
    }
  }

  // ── Shorts ────────────────────────────────────────────────────────────────
  Future<void> _doGenerateShorts() async {
    final plan = context.read<PlanProvider>();
    if (!plan.canGenerateShorts) {
      context.read<WizardProvider>().showPaywall('shorts');
      return;
    }
    setState(() { _shortsLoading = true; _shortsError = ''; });
    try {
      final data = await generateShorts(_jobData.jobId);
      setState(() { _shorts = (data['shorts'] as List?) ?? []; });
    } catch (e) {
      setState(() { _shortsError = e.toString(); });
    } finally {
      if (mounted) setState(() { _shortsLoading = false; });
    }
  }

  // ── Mic ──────────────────────────────────────────────────────────────────
  void _startMic() {
    if (_tts.speaking) return;
    if (_polling.loading) return;
    _stt.startListening(
      onResult: _handleTranscript,
      locale: _voiceLang,
    );
  }

  Future<void> _toggleMic() async {
    if (_stt.listening) {
      await _stt.stopListening(onResult: _handleTranscript);
    } else {
      _startMic();
    }
  }

  @override
  Widget build(BuildContext context) {
    _updateRouter(); // keep router fresh each build

    final polling = context.watch<EditPollingService>();
    final stt     = context.watch<SttService>();
    final tts     = context.watch<TtsService>();

    return Stack(
      children: [
        Scaffold(
          backgroundColor: C.bg,
          body: Column(
            children: [
              // Tab bar
              _buildTabBar(),
              Expanded(
                child: _tab == 'chat' ? _buildChatTab(polling, stt) : _buildShortsTab(),
              ),
              // Input row
              if (_tab == 'chat') _buildInputRow(polling, stt, tts),
            ],
          ),
        ),
        // Effect picker overlay
        if (_effectPickerVisible)
          EffectPickerWidget(
            visible: _effectPickerVisible,
            applying: _effectApplying,
            onSelect: _handleEffectSelect,
            onClose: () => setState(() { _effectPickerVisible = false; }),
          ),
      ],
    );
  }

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _tabBtn('Sohbet', 'chat'),
          const SizedBox(width: 8),
          _tabBtn('Shorts', 'shorts'),
          const Spacer(),
          const BadgeWidget(label: 'ADIM 2'),
        ],
      ),
    );
  }

  Widget _tabBtn(String label, String value) {
    final active = _tab == value;
    return GestureDetector(
      onTap: () => setState(() { _tab = value; }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? C.accent.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? C.accent : C.border),
        ),
        child: Text(label, style: TextStyle(color: active ? C.accent : C.dim, fontSize: 12, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildChatTab(EditPollingService polling, SttService stt) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollCtrl,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            itemCount: _messages.length,
            itemBuilder: (_, i) => ChatBubble(message: _messages[i]),
          ),
        ),
        // Confirm card / edit progress
        if (_confirmData != null && !polling.loading)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ConfirmCard(
              data: _confirmData!,
              detectedEffect: _detectedEffect,
              effectApplying: _effectApplying,
              removeFillers: _removeFillers,
              preserveRhythm: _preserveRhythm,
              onConfirm: _startEdit,
              onReject: () {
                setState(() { _confirmData = null; });
                const msg = 'Tamam, ne değiştirmek istiyorsun?';
                _addMsg(ChatRole.ai, msg);
                _tts.speak(msg, onDone: _startMic);
              },
              onEffectApply: () => _handleEffectSelect(_detectedEffect!.category, _detectedEffect!.intensity),
              onEffectDismiss: () => setState(() { _detectedEffect = null; }),
              onRemoveFillers: (v) => setState(() { _removeFillers = v; }),
              onPreserveRhythm: (v) => setState(() { _preserveRhythm = v; }),
            ),
          ),
        if (polling.loading)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: C.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: C.border),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 16, height: 16,
                    child: CircularProgressIndicator(color: C.accent, strokeWidth: 2)),
                  const SizedBox(width: 10),
                  Text(polling.progress.isNotEmpty ? polling.progress : 'Video işleniyor...',
                      style: const TextStyle(color: C.dim, fontSize: 13)),
                ],
              ),
            ),
          ),
        if (_loading && !polling.loading)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: C.accent.withValues(alpha: 0.1),
                      border: Border.all(color: C.accent.withValues(alpha: 0.35))),
                  child: const Center(child: Text('C', style: TextStyle(fontSize: 11, color: C.accent))),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(color: C.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.border)),
                  child: const SizedBox(width: 24, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: C.accent)),
                ),
              ],
            ),
          ),
        // Interim STT display
        if (stt.listening && stt.interim.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: C.card, borderRadius: BorderRadius.circular(8), border: Border.all(color: C.border)),
              child: Text(stt.interim, style: const TextStyle(color: C.dim, fontSize: 12, fontStyle: FontStyle.italic)),
            ),
          ),
      ],
    );
  }

  Widget _buildInputRow(EditPollingService polling, SttService stt, TtsService tts) {
    return Container(
      padding: EdgeInsets.only(
        left: 12, right: 12, top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 12,
      ),
      decoration: const BoxDecoration(
        color: C.card,
        border: Border(top: BorderSide(color: C.border)),
      ),
      child: Row(
        children: [
          // Efekt butonu
          GestureDetector(
            onTap: () => setState(() { _effectPickerVisible = true; }),
            child: Container(
              width: 38, height: 38,
              decoration: BoxDecoration(
                color: C.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: C.border),
              ),
              child: const Center(child: Text('✨', style: TextStyle(fontSize: 16))),
            ),
          ),
          const SizedBox(width: 8),
          // Text input
          Expanded(
            child: TextField(
              controller: _inputCtrl,
              style: const TextStyle(color: C.txt, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Nasıl edit etmek istiyorsun?',
                hintStyle: const TextStyle(color: C.muted, fontSize: 13),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: C.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: C.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: C.accent)),
                fillColor: C.bg,
                filled: true,
              ),
              onSubmitted: (_) => _sendMsg(),
            ),
          ),
          const SizedBox(width: 8),
          // Mic button
          if (stt.available)
            GestureDetector(
              onTap: _toggleMic,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: stt.listening ? C.accent : C.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: stt.listening ? C.accent : C.border),
                ),
                child: Center(child: Text(stt.listening ? '■' : '🎤', style: const TextStyle(fontSize: 16))),
              ),
            ),
          const SizedBox(width: 8),
          // Send button
          GestureDetector(
            onTap: (_loading || polling.loading) ? null : _sendMsg,
            child: AnimatedOpacity(
              opacity: (_loading || polling.loading) ? 0.4 : 1,
              duration: const Duration(milliseconds: 200),
              child: Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: C.accent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(child: Text('↑', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold))),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShortsTab() {
    if (_shortsLoading) {
      return const Center(child: CircularProgressIndicator(color: C.accent));
    }
    if (_shortsError.isNotEmpty) {
      return Center(child: Text('Hata: $_shortsError', style: const TextStyle(color: C.error)));
    }
    if (_shorts.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🎬', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            const Text('Henüz kısa klip yok', style: TextStyle(color: C.dim, fontSize: 14)),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _doGenerateShorts,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: C.green, borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Klipleri Oluştur',
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _shorts.length,
      itemBuilder: (_, i) {
        final s = _shorts[i] as Map<String, dynamic>;
        final url = toAbsoluteUrl((s['download_url'] ?? s['url'] ?? '') as String);
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: C.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: C.border),
          ),
          child: Row(
            children: [
              const Text('🎬', style: TextStyle(fontSize: 24)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Klip ${i + 1}', style: const TextStyle(color: C.txt, fontSize: 13, fontWeight: FontWeight.w600)),
                    if (s['duration'] != null)
                      Text('${s['duration']}s', style: const TextStyle(color: C.muted, fontSize: 11)),
                  ],
                ),
              ),
              if (url.isNotEmpty)
                GestureDetector(
                  onTap: () {/* URL aç */},
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: C.accent, borderRadius: BorderRadius.circular(6)),
                    child: const Text('İndir', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
