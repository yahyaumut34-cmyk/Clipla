class EditResult {
  final String? downloadUrl;
  final String? outputUrl;
  final String? jobId;
  final Map<String, dynamic> duration;
  final Map<String, dynamic> scores;
  final Map<String, dynamic> claudeAnalysis;
  final Map<String, dynamic>? editPlan;
  final bool autoSubtitleApplied;
  final String? autoSubtitleLanguage;
  final String? suggestedSubtitleLang;

  const EditResult({
    this.downloadUrl,
    this.outputUrl,
    this.jobId,
    this.duration = const {},
    this.scores = const {},
    this.claudeAnalysis = const {},
    this.editPlan,
    this.autoSubtitleApplied = false,
    this.autoSubtitleLanguage,
    this.suggestedSubtitleLang,
  });

  String get effectiveUrl => downloadUrl ?? outputUrl ?? '';

  EditResult copyWith({
    String? downloadUrl,
    String? outputUrl,
    bool? autoSubtitleApplied,
    String? autoSubtitleLanguage,
  }) {
    return EditResult(
      downloadUrl: downloadUrl ?? this.downloadUrl,
      outputUrl: outputUrl ?? this.outputUrl,
      jobId: jobId,
      duration: duration,
      scores: scores,
      claudeAnalysis: claudeAnalysis,
      editPlan: editPlan,
      autoSubtitleApplied: autoSubtitleApplied ?? this.autoSubtitleApplied,
      autoSubtitleLanguage: autoSubtitleLanguage ?? this.autoSubtitleLanguage,
      suggestedSubtitleLang: suggestedSubtitleLang,
    );
  }

  factory EditResult.fromJson(Map<String, dynamic> json) {
    return EditResult(
      downloadUrl: json['download_url'] as String?,
      outputUrl: json['output_url'] as String?,
      jobId: json['job_id'] as String?,
      duration: (json['duration'] as Map?)?.cast<String, dynamic>() ?? {},
      scores: (json['scores'] as Map?)?.cast<String, dynamic>() ?? {},
      claudeAnalysis: (json['claude_analysis'] as Map?)?.cast<String, dynamic>() ?? {},
      editPlan: (json['edit_plan'] as Map?)?.cast<String, dynamic>(),
      autoSubtitleApplied: json['autoSubtitleApplied'] as bool? ?? false,
      autoSubtitleLanguage: json['autoSubtitleLanguage'] as String?,
      suggestedSubtitleLang: json['suggestedSubtitleLang'] as String?,
    );
  }
}
