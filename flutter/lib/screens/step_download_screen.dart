import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import '../api/api_service.dart';
import '../models/edit_result.dart';
import '../providers/wizard_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/badge_widget.dart';

class StepDownloadScreen extends StatefulWidget {
  const StepDownloadScreen({super.key});

  @override
  State<StepDownloadScreen> createState() => _StepDownloadScreenState();
}

class _StepDownloadScreenState extends State<StepDownloadScreen> {
  late EditResult _result;
  bool _sharing = false;
  String _shareError = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      setState(() { _result = context.read<WizardProvider>().result!; });
    });
  }

  String get _videoUrl => toAbsoluteUrl(_result.effectiveUrl);

  Future<void> _download() async {
    final url = _videoUrl;
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _share() async {
    final url = _videoUrl;
    if (url.isEmpty) return;
    setState(() { _sharing = true; _shareError = ''; });

    try {
      final dir = await getTemporaryDirectory();
      final localPath = '${dir.path}/cliplav_y_output.mp4';

      // Download to cache
      final dio = Dio();
      await dio.download(url, localPath);

      final file = File(localPath);
      if (!await file.exists()) throw Exception('Dosya indirilemedi');

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(localPath, mimeType: 'video/mp4')],
          text: 'Clipla-Y ile düzenlendi',
        ),
      );
    } catch (e) {
      // Fallback: URL aç
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        setState(() { _shareError = e.toString(); });
      }
    } finally {
      if (mounted) setState(() { _sharing = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final wizard = context.watch<WizardProvider>();
    _result = wizard.result ?? _result;
    final dur = _result.duration;

    final inputSec  = dur['input']  != null ? '${dur['input']}s'  : '?s';
    final outputSec = dur['output'] != null ? '${dur['output']}s' : '?s';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 24),
          const Text('✓', style: TextStyle(fontSize: 72, color: C.green)),
          const SizedBox(height: 16),
          const BadgeWidget(label: 'HAZIR', color: C.green),
          const SizedBox(height: 12),
          const Text('Videon Hazır!',
              style: TextStyle(color: C.txt, fontSize: 34, fontStyle: FontStyle.italic),
              textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            '$inputSec ham video\n→ $outputSec kurgulanan video',
            style: const TextStyle(color: C.dim, fontSize: 14, height: 1.6),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),

          // MP4 İndir
          _btn(
            label: 'MP4 İndir',
            color: C.green,
            onTap: _download,
          ),
          const SizedBox(height: 10),

          // Paylaş
          _btn(
            label: _sharing ? 'Paylaşılıyor...' : 'Paylaş',
            color: C.accent,
            borderOnly: true,
            loading: _sharing,
            onTap: _sharing ? null : _share,
          ),

          if (_shareError.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(_shareError, style: const TextStyle(color: C.error, fontSize: 11)),
          ],

          const SizedBox(height: 10),

          // Yeni video
          _btn(
            label: 'Yeni Video Yükle',
            color: C.dim,
            borderOnly: true,
            onTap: () => wizard.restart(),
          ),

          const SizedBox(height: 32),

          // İstatistikler
          if (_result.scores.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: C.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: C.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('SONUÇ',
                      style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  ..._result.scores.entries.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(e.key, style: const TextStyle(color: C.muted, fontSize: 12)),
                        Text('${e.value}', style: const TextStyle(color: C.txt, fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _btn({
    required String label,
    required Color color,
    bool borderOnly = false,
    bool loading = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedOpacity(
        opacity: onTap == null ? 0.3 : 1,
        duration: const Duration(milliseconds: 200),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: borderOnly ? Colors.transparent : color,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderOnly ? color : color),
          ),
          child: loading
              ? Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: color, strokeWidth: 2)))
              : Center(
                  child: Text(label,
                      style: TextStyle(
                        color: borderOnly ? color : Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.5,
                      )),
                ),
        ),
      ),
    );
  }
}
