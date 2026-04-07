import 'dart:async';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../models/job_data.dart';
import '../providers/plan_provider.dart';
import '../providers/wizard_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/badge_widget.dart';
import '../widgets/progress_grid.dart';

String _inferMime(String name) {
  final ext = name.split('.').last.toLowerCase();
  const m = {
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska', 'webm': 'video/webm', 'm4v': 'video/x-m4v',
  };
  return m[ext] ?? 'video/mp4';
}

class StepUploadScreen extends StatefulWidget {
  const StepUploadScreen({super.key});
  @override
  State<StepUploadScreen> createState() => _StepUploadScreenState();
}

class _StepUploadScreenState extends State<StepUploadScreen>
    with SingleTickerProviderStateMixin {
  PlatformFile? _file;
  bool _picking   = false;
  bool _uploading = false;
  String _error   = '';
  int _uploadPct  = 0;
  String _phase   = 'idle'; // idle | uploading | success

  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 1.0, end: 1.03).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    if (_picking || _uploading) return;
    setState(() { _picking = true; _error = ''; });
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.video,
        allowMultiple: false,
        withData: false,
      );
      if (result != null && result.files.isNotEmpty) {
        setState(() { _file = result.files.first; });
      }
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _picking = false; });
    }
  }

  Future<void> _upload() async {
    final file = _file;
    if (file == null || file.path == null) return;

    final plan = context.read<PlanProvider>();
    if (!plan.loaded) return;
    if (!plan.canUpload) {
      context.read<WizardProvider>().showPaywall('upload_limit');
      return;
    }

    setState(() { _uploading = true; _error = ''; _uploadPct = 0; _phase = 'uploading'; });

    try {
      final sizeMB = (file.size / 1024 / 1024);
      final data = await uploadVideoWithProgress(
        file.path!,
        file.name,
        _inferMime(file.name),
        file.size,
        (pct) { if (mounted) setState(() { _uploadPct = pct; }); },
      );

      if (data['job_id'] == null) throw Exception('job_id alınamadı');
      await plan.recordUpload();

      setState(() { _uploadPct = 100; _phase = 'success'; });

      await Future.delayed(const Duration(milliseconds: 1400));
      if (!mounted) return;

      final wizard = context.read<WizardProvider>();
      wizard.setJobData(JobData(
        jobId:    data['job_id'] as String,
        duration: (data['duration'] as num?)?.toDouble() ?? 0,
        file:     file,
      ));
      wizard.nextStep();
    } catch (e) {
      setState(() { _error = e.toString(); _phase = 'idle'; });
    } finally {
      if (mounted) setState(() { _uploading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == 'success') return _buildSuccess();
    if (_phase == 'uploading') return _buildUploading();
    return _buildIdle();
  }

  // ── Başarı ekranı ─────────────────────────────────────────────────────────
  Widget _buildSuccess() {
    return Center(
      child: AnimatedOpacity(
        opacity: 1,
        duration: const Duration(milliseconds: 400),
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: C.card,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: C.green.withValues(alpha: 0.4)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: C.green.withValues(alpha: 0.15),
                ),
                child: const Center(child: Text('✓', style: TextStyle(fontSize: 36, color: C.green))),
              ),
              const SizedBox(height: 16),
              const Text('Video Yüklendi!',
                  style: TextStyle(color: C.green, fontSize: 24, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(_file?.name ?? '', style: const TextStyle(color: C.txt, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 16),
              const ProgressGrid(pct: 100),
              const SizedBox(height: 8),
              const CircularProgressIndicator(color: C.green, strokeWidth: 2),
              const SizedBox(height: 8),
              const Text('Devam ediliyor...', style: TextStyle(color: C.muted, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  // ── Upload aşaması ────────────────────────────────────────────────────────
  Widget _buildUploading() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BadgeWidget(label: 'ADIM 1'),
          const SizedBox(height: 12),
          const Text('Yükleniyor', style: TextStyle(color: C.txt, fontSize: 34, fontStyle: FontStyle.italic)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: C.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: C.green.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                ProgressGrid(pct: _uploadPct),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('$_uploadPct',
                        style: const TextStyle(color: C.green, fontSize: 64, fontWeight: FontWeight.w700, height: 1)),
                    const Text('%', style: TextStyle(color: C.green, fontSize: 24, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _uploadPct < 10 ? 'Sunucuya bağlanıyor...' : _uploadPct < 95 ? 'Yükleniyor...' : 'Sunucu işliyor...',
                  style: const TextStyle(color: C.dim, fontSize: 14),
                ),
                if (_file != null) ...[
                  const SizedBox(height: 4),
                  Text(_file!.name, style: const TextStyle(color: C.muted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Normal ekran (idle) ───────────────────────────────────────────────────
  Widget _buildIdle() {
    final plan    = context.watch<PlanProvider>();
    final hasFile = _file != null;
    final sizeMB  = hasFile ? (_file!.size / 1024 / 1024).toStringAsFixed(1) : '0';
    final isLarge = hasFile && _file!.size > kWarnBytes;
    final isBusy  = _picking || _uploading;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BadgeWidget(label: 'ADIM 1'),
          const SizedBox(height: 12),
          const Text('Videoyu Yükle',
              style: TextStyle(color: C.txt, fontSize: 34, fontStyle: FontStyle.italic)),
          const SizedBox(height: 8),
          const Text('Ham çekimi olduğu gibi at.\nEdit etmene gerek yok.',
              style: TextStyle(color: C.dim, fontSize: 14, height: 1.6)),
          const SizedBox(height: 28),

          // Upload box with pulse
          ScaleTransition(
            scale: _pulseAnim,
            child: GestureDetector(
              onTap: isBusy ? null : _pickFile,
              child: AnimatedOpacity(
                opacity: isBusy ? 0.65 : 1,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  padding: const EdgeInsets.all(48),
                  decoration: BoxDecoration(
                    color: C.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: C.border),
                  ),
                  child: _picking
                      ? const Column(mainAxisSize: MainAxisSize.min, children: [
                          CircularProgressIndicator(color: C.accent),
                          SizedBox(height: 12),
                          Text('Seçiliyor...', style: TextStyle(color: C.txt, fontSize: 16)),
                        ])
                      : Column(mainAxisSize: MainAxisSize.min, children: [
                          const Text('📁', style: TextStyle(fontSize: 44)),
                          const SizedBox(height: 12),
                          Text(hasFile ? 'Farklı Video Seç' : 'Video Seç',
                              style: const TextStyle(color: C.txt, fontSize: 16)),
                          const SizedBox(height: 4),
                          const Text('MP4 · MOV · MKV · AVI',
                              style: TextStyle(color: C.muted, fontSize: 12)),
                        ]),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Seçilen dosya bilgisi
          if (hasFile)
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: C.green.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: C.green.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: C.green.withValues(alpha: 0.15),
                    ),
                    child: const Center(child: Text('✓', style: TextStyle(fontSize: 16))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_file!.name, style: const TextStyle(color: C.txt, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('$sizeMB MB', style: const TextStyle(color: C.muted, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // Plan uyarısı
          if (!plan.isPro)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: plan.uploadsRemaining == 0
                    ? C.error.withValues(alpha: 0.08)
                    : C.warn.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: plan.uploadsRemaining == 0
                      ? C.error.withValues(alpha: 0.4)
                      : C.warn.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                plan.uploadsRemaining == 0
                    ? "Günlük ücretsiz yükleme limitin doldu. Pro'ya geç!"
                    : "Ücretsiz: bugün ${plan.uploadsRemaining} yükleme hakkın kaldı.",
                style: TextStyle(
                  color: plan.uploadsRemaining == 0 ? C.error : C.warn,
                  fontSize: 12, height: 1.5,
                ),
              ),
            ),

          // Büyük dosya uyarısı
          if (isLarge)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: C.warn.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: C.warn.withValues(alpha: 0.3)),
              ),
              child: Text('Büyük dosya: $sizeMB MB. Yükleme süresi uzun olabilir.',
                  style: const TextStyle(color: C.warn, fontSize: 12)),
            ),

          // Hata
          if (_error.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: C.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: C.error.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('⚠ $_error', style: const TextStyle(color: C.error, fontSize: 13, height: 1.5)),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: _upload,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        border: Border.all(color: C.error),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Tekrar Dene', style: TextStyle(color: C.error, fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),

          // Yükle butonu
          GestureDetector(
            onTap: (!hasFile || isBusy) ? null : _upload,
            child: AnimatedOpacity(
              opacity: (!hasFile || isBusy) ? 0.3 : 1,
              duration: const Duration(milliseconds: 200),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: C.accent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text('Yükle ve Devam Et',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: 0.5)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
