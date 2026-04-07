import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ViralityCard extends StatelessWidget {
  final Map<String, dynamic> scores;
  final Map<String, dynamic> analysis;
  final Map<String, dynamic>? editPlan;

  const ViralityCard({
    super.key,
    required this.scores,
    required this.analysis,
    this.editPlan,
  });

  @override
  Widget build(BuildContext context) {
    final info      = scores['info_density'] as num?;
    final pacing    = scores['pacing_score'] as num?;
    final hook      = scores['hook_score'] as num? ?? info;
    final retention = scores['retention_score'] as num? ?? pacing;

    if (info == null && pacing == null) return const SizedBox.shrink();

    final overall = ((((info ?? 50) + (pacing ?? 50)) / 2)).round();
    final cuts    = editPlan?['cuts_applied'] as num?;

    final hookLabel  = hook  != null && hook  >= 70 ? 'Güçlü'  : hook  != null && hook  >= 40 ? 'Orta' : 'Zayıf';
    final tempoLabel = pacing != null && pacing >= 70
        ? 'Hızlı ve ilgi çekici'
        : pacing != null && pacing >= 40
            ? 'Dengeli'
            : 'Yavaş, izleyici kaybedebilirsin';

    final verdict      = overall >= 70 ? 'Viral potansiyeli yüksek' : overall >= 45 ? 'Ortalama içerik' : 'Geliştirme önerilir';
    final verdictColor = overall >= 70 ? C.green : overall >= 45 ? C.warn : C.error;
    final barColor     = overall >= 70 ? C.green : overall >= 45 ? C.warn : C.error;

    final tips = <String>[];
    if ((info ?? 50) < 50) tips.add('İlk 3 saniyeye güçlü bir kanca ekle');
    if ((pacing ?? 50) < 50) tips.add('Daha sık kesimle tempo artır');
    if (cuts != null && cuts < 3) tips.add('Daha fazla kesim dinamizm sağlayabilir');
    if ((retention ?? 50) < 50) tips.add('İzlenme süresini artırmak için sonucu güçlendir');

    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: C.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: verdictColor.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('VİRALİTE ANALİZİ',
              style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: overall / 100,
                    backgroundColor: C.border,
                    valueColor: AlwaysStoppedAnimation(barColor),
                    minHeight: 6,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text('$overall', style: TextStyle(color: barColor, fontSize: 20, fontWeight: FontWeight.w700)),
              const Text('/100', style: TextStyle(color: C.muted, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 8),
          Text(verdict, style: TextStyle(color: verdictColor, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          _metricRow('Kanca Gücü', hookLabel),
          _metricRow('Tempo', tempoLabel),
          if (tips.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(color: C.border, height: 1),
            const SizedBox(height: 10),
            const Text('ÖNERİLER',
                style: TextStyle(color: C.dim, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ...tips.map((t) => Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text('• $t', style: const TextStyle(color: C.dim, fontSize: 11, height: 1.5)),
            )),
          ],
        ],
      ),
    );
  }

  Widget _metricRow(String key, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(key, style: const TextStyle(color: C.muted, fontSize: 12)),
          Text(val,  style: const TextStyle(color: C.dim,  fontSize: 12)),
        ],
      ),
    );
  }
}
